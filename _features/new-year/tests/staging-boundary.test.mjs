import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile,rm} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareStaging} from '../staging/config.mjs';

const feature=fileURLToPath(new URL('../',import.meta.url));
const productionBuild=await build({absWorkingDir:feature,entryPoints:['src/worker.mjs'],bundle:true,
  format:'esm',platform:'browser',target:'es2022',write:false,metafile:true,logLevel:'silent'});
const productionCode=productionBuild.outputFiles[0].text;
const production=(await import('data:text/javascript;base64,'+Buffer.from(productionCode).toString('base64'))).default;

test('production bundle graph excludes staging, local data, preview and test harness modules',()=>{
  const inputs=Object.keys(productionBuild.metafile.inputs);
  assert.ok(inputs.includes('src/worker.mjs'));
  for(const input of inputs){
    assert.match(input,/^src\//,input);
    assert.doesNotMatch(input,/(?:^|\/)(?:staging|\.local|scripts|tests|preview)(?:\/|$)|local-server|site-preview|sqlite-adapter|browser-integration/,input);
  }
  for(const output of Object.values(productionBuild.metafile.outputs))assert.deepEqual(output.imports,[],'Production bundle has no unresolved external harness import');
});

test('production bundle contains no staging clock anchors, controls or authentication bypass credentials',()=>{
  assert.doesNotMatch(productionCode,/STAGING_|stagingClock|createStagingApp|authorizeTester|staging_environment|LAB_CONTROL_TOKEN|\/__lab\/time|\/__test\/|local-test-(?:staff|wb|control)-token/);
  assert.doesNotMatch(productionCode,/TEST ONLY — NOT REDEEMABLE/);
});

test('bundled default Worker ignores staging configuration and retains live server time and real staff authentication',async()=>{
  const env={DB:{},PASS_SECRET:'boundary-test-secret-'.repeat(3),ACCESS_ISSUER:'https://boundary-test.cloudflareaccess.com',ACCESS_AUD:'staff-test-audience',
    STAGING_ENABLED:'true',STAGING_REAL_ANCHOR_UTC:'2026-09-27T00:00:00Z',STAGING_EVENT_ANCHOR_UTC:'2027-01-01T06:00:00Z'};
  for(const path of ['/api/time?now=1798783200000','/api/state']){
    const before=Date.now();
    const response=await production.fetch(new Request('https://production-boundary.example.invalid'+path,{headers:{'X-Staging-Now':'1798783200000'}}),env);
    const after=Date.now(),data=await response.json();
    assert.equal(response.status,200);assert.equal(data.mode,'live');
    assert.ok(data.serverNow>=before&&data.serverNow<=after,'Default worker uses actual server wall time');
    assert.equal(data.event.id,'sb-nye-2027');assert.equal(data.event.timezone,'America/Chicago');
    assert.equal(data.event.start,Date.parse('2027-01-01T05:50:00Z'));
    assert.equal(data.event.midnight,Date.parse('2027-01-01T06:00:00Z'));
    assert.equal(data.event.end,Date.parse('2027-01-01T06:05:00Z'));
    assert.equal(data.testLabel,undefined);
    if(path==='/api/state'){assert.equal(data.entry,null);assert.equal(data.pass,null);}
  }
  const staff=await production.fetch(new Request('https://production-boundary.example.invalid/api/staff/me'),env);
  assert.equal(staff.status,401,'A staging flag never substitutes for a real Access staff JWT');
  for(const path of ['/__lab/time','/__test/time']){
    const result=await production.fetch(new Request('https://production-boundary.example.invalid'+path,{method:'POST'}),env);
    assert.equal(result.status,404,'Default entrypoint has no clock control route');
  }
});

test('default Wrangler entrypoint and assets remain production source with public alternate routes disabled',async()=>{
  const config=await readFile(resolve(feature,'wrangler.toml'),'utf8');
  assert.match(config,/^main\s*=\s*"src\/worker\.mjs"\s*$/m);
  assert.match(config,/^workers_dev\s*=\s*false\s*$/m);
  assert.match(config,/^preview_urls\s*=\s*false\s*$/m);
  const assets=config.match(/^\[assets\]\s*\n([\s\S]*?)(?=^\[|$(?![\s\S]))/m)?.[1];
  assert.ok(assets);assert.match(assets,/^directory\s*=\s*"\.\/public"\s*$/m);
  assert.match(assets,/^run_worker_first\s*=\s*true\s*$/m);
  assert.doesNotMatch(config,/^\s*STAGING_[A-Z_]+\s*=|staging\/worker\.mjs|^\s*(?:routes|route)\s*=|^\s*\[\[?routes\]/m);
});

test('prepareStaging builds isolated artifacts without changing the production loader or attaching routes',async()=>{
  const fixture={accountId:'a'.repeat(32),databaseId:'11111111-1111-1111-1111-111111111111',environmentId:'nye-boundary-test-fixture',
    websiteOrigin:'https://website.example.invalid',serviceOrigin:'https://service.example.invalid',accessIssuer:'https://boundary-test.cloudflareaccess.com',
    testerAudience:'b'.repeat(64),staffAudience:'c'.repeat(64),testerEmails:['approved@example.invalid'],
    realAnchorUtc:'2026-09-27T12:00:00Z',eventAnchorUtc:'2027-01-01T05:48:50Z'};
  const productionLoaderPath=resolve(feature,'../../assets/js/new-year-2027.js');
  const originalLoader=await readFile(productionLoaderPath);
  let artifacts;
  try{
    artifacts=await prepareStaging(fixture);
    assert.match(relative(resolve(feature,'.local'),artifacts.outputDirectory),/^staging-build-[a-zA-Z0-9_-]+$/);
    assert.equal(artifacts.domainsAttached,false);
    const config=JSON.parse(await readFile(artifacts.wranglerPath,'utf8'));
    assert.equal(config.routes,undefined);assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);
    assert.equal(config.main,resolve(feature,'staging/worker.mjs'));assert.equal(config.assets.run_worker_first,true);
    assert.ok(config.assets.directory.startsWith(artifacts.outputDirectory+sep));
    const sql=await readFile(artifacts.sqlPath,'utf8');
    assert.match(sql,/CREATE TABLE staging_environment/);assert.match(sql,/nye-boundary-test-fixture/);
    assert.equal((sql.match(/ARTIFICIAL ONE-HOUR REHEARSAL WINDOW/g)||[]).length,2);
    const manifest=JSON.parse(await readFile(artifacts.manifestPath,'utf8'));
    assert.equal(manifest.kind,'private-staging-only');assert.equal(manifest.cloudDeployed,false);assert.equal(manifest.productionLoaderEnabled,true);
    assert.equal(manifest.files.filter(file=>/^site\/[^/]+\.html$/.test(file.asset)).length,12);
    assert.match(await readFile(resolve(artifacts.assetsDirectory,'site/assets/js/new-year-2027.js'),'utf8'),/const ENABLED=true;/);
    assert.deepEqual(await readFile(productionLoaderPath),originalLoader);assert.match(originalLoader.toString(),/const ENABLED=true;/);
  }finally{
    if(artifacts&&/^staging-build-[a-zA-Z0-9_-]+$/.test(relative(resolve(feature,'.local'),artifacts.outputDirectory)))await rm(artifacts.outputDirectory,{recursive:true});
  }
});

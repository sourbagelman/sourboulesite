import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,rm,mkdtemp,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,relative} from 'node:path';
import vm from 'node:vm';
import {buildStaging,buildStagingLoader,WEBSITE_PAGES,SERVICE_FILES} from '../staging/build.mjs';
import {STAGING_LABEL} from '../staging/client-transform.mjs';
import {PREVIEW_FILES} from '../staging/visual-preview.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(root,'../..');
const config={websiteOrigin:'https://website.staging.example.test',serviceOrigin:'https://celebration.staging.example.test'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const run=promisify(execFile);
async function walk(root,prefix='') {
  const found=[];for(const item of await readdir(resolve(root,prefix),{withFileTypes:true})) {
    const path=prefix?prefix+'/'+item.name:item.name;if(item.isDirectory())found.push(...await walk(root,path));else found.push(path);
  }return found.sort();
}
test('full staging build uses current tracked pages/assets, exact transforms, isolated outputs and verifiable hashes',async t=>{
  const before=new Map();
  for(const file of [...WEBSITE_PAGES,'assets/js/new-year-2027.js'])before.set(file,await readFile(resolve(repo,file)));
  const built=await buildStaging(config);t.after(()=>rm(built.outputDirectory,{recursive:true,force:true}));
  assert.ok(built.outputDirectory.startsWith(resolve(root,'.local','staging-build-')));assert.equal(built.assetsDirectory,resolve(built.outputDirectory,'assets'));
  assert.equal(relative(built.assetsDirectory,built.manifestPath),'../manifest.json');
  const manifest=JSON.parse(await readFile(built.manifestPath,'utf8'));
  assert.equal(manifest.sourceHead,(await run('git',['rev-parse','HEAD'],{cwd:repo})).stdout.trim());
  assert.equal(manifest.testLabel,STAGING_LABEL);assert.equal(manifest.cloudDeployed,false);
  assert.deepEqual(await walk(resolve(built.assetsDirectory,'service')),[...SERVICE_FILES].sort());
  assert.deepEqual(await walk(resolve(built.assetsDirectory,'site/new-year-preview')),Object.values(PREVIEW_FILES).sort());
  assert.deepEqual((await readdir(resolve(built.assetsDirectory,'site'))).filter(path=>path.endsWith('.html')).sort(),[...WEBSITE_PAGES].sort());
  for(const file of WEBSITE_PAGES) {
    const page=await readFile(resolve(built.assetsDirectory,'site',file),'utf8');
    assert.ok(page.includes(STAGING_LABEL));assert.equal(page.replace(/<aside data-nye-staging-notice[\s\S]*?<\/aside>/,''),before.get(file).toString());
  }
  const all=await walk(built.assetsDirectory);
  for(const path of all)assert.ok(!/(?:^|\/)(?:\.git|\.local|_features|docs|preview|qa|tests|staging)(?:\/|$)|(?:\.sqlite|\.toml|\.md|\.env)$/.test(path),path);
  assert.ok(!all.includes('manifest.json'));assert.ok(!all.some(path=>path.endsWith('/CNAME')||path.endsWith('/wrangler.toml')));
  for(const file of manifest.files) {
    assert.equal(sha(await readFile(resolve(repo,file.source))),file.sourceSha256);
    assert.equal(sha(await readFile(resolve(built.assetsDirectory,file.asset))),file.assetSha256);
    if(file.asset.startsWith('site/assets/')||file.asset.startsWith('site/images/'))if(!file.asset.endsWith('/new-year-2027.js'))assert.equal(file.sourceSha256,file.assetSha256);
  }
  const loader=await readFile(resolve(built.assetsDirectory,'site/assets/js/new-year-2027.js'),'utf8');
  assert.ok(loader.includes('const ENABLED=true;'));assert.ok(loader.includes("credentials:'include'"));assert.ok(loader.includes(config.serviceOrigin));assert.ok(loader.includes(STAGING_LABEL));
  for(const [file,bytes] of before)assert.deepEqual(await readFile(resolve(repo,file)),bytes);
  assert.ok(before.get('assets/js/new-year-2027.js').toString().includes('const ENABLED=false;'));
});
test('builder rejects invalid/production origins and cannot write outside a fresh local build directory',async()=>{
  for(const websiteOrigin of ['https://thesourboule.com','http://example.test','https://x.test:8443','https://site.account.workers.dev',config.serviceOrigin])await assert.rejects(buildStaging({...config,websiteOrigin}));
  for(const outputDirectory of ['.local','../../index.html','/tmp/unsafe-staging-output','.local/staging-build-test/nested'])await assert.rejects(buildStaging({...config,outputDirectory}),/Output must be/);
  await assert.rejects(buildStaging({...config,secret:'not-a-real-secret'}),/Unexpected staging build option/);
});
test('existing output is never overwritten or removed',async t=>{
  const directory=await mkdtemp(resolve(root,'.local/staging-build-preserved-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  await writeFile(resolve(directory,'keep.txt'),'preserve this existing rehearsal');
  await assert.rejects(buildStaging({...config,outputDirectory:directory}),{code:'EEXIST'});
  assert.equal(await readFile(resolve(directory,'keep.txt'),'utf8'),'preserve this existing rehearsal');
});
test('loader transform fails on source drift and cannot activate on the production origin',async()=>{
  const source=await readFile(resolve(root,'src/integration-loader.js'),'utf8');
  for(const drift of [source.replace('const ENABLED=false;','const ENABLED=true;'),source.replace("credentials:'omit'","credentials:'same-origin'"),source.replace("exit.textContent='Continue to the website';",'exit.textContent="changed";')])assert.throws(()=>buildStagingLoader(drift,config),/source drift/);
  const transformed=buildStagingLoader(source,config),window={};
  vm.runInNewContext(transformed,{location:{origin:'https://thesourboule.com'},window});
  assert.deepEqual(window,{});
});

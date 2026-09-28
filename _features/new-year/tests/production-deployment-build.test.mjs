import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm,readdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildDeployment} from '../production/build-deployment.mjs';
import {PRODUCTION_FILES} from '../production/prepare.mjs';

const feature=fileURLToPath(new URL('../',import.meta.url));
async function walk(root,prefix=''){
  const files=[];
  for(const entry of await readdir(root,{withFileTypes:true})){
    if(entry.isDirectory())files.push(...await walk(resolve(root,entry.name),prefix+entry.name+'/'));
    else files.push(prefix+entry.name);
  }
  return files.sort();
}

test('reproducible deployment build targets only the approved production service, database and staff audience',async t=>{
  const guarded=['production/wrangler.template.json','src/integration-loader.js','../../assets/js/new-year-2027.js'];
  const before=new Map(await Promise.all(guarded.map(async path=>[path,await readFile(resolve(feature,path),'utf8')])));
  const result=await buildDeployment();t.after(()=>rm(result.outputDirectory,{recursive:true,force:true}));
  const config=JSON.parse(await readFile(result.wranglerPath,'utf8'));
  assert.equal(config.name,'sour-boule-nye-production');
  assert.equal(config.account_id,'c84d6dc733d90811006e8d8837dcd1c3');
  assert.deepEqual(config.routes,[{pattern:'celebrate.thesourboule.com',custom_domain:true}]);
  assert.deepEqual(config.d1_databases,[{binding:'DB',database_name:'sour-boule-nye-production',database_id:'1d1e7a58-44d6-4ea7-a114-b05ad3d9b377'}]);
  assert.deepEqual(config.vars,{
    PRODUCTION_ENABLED:'true',PRODUCTION_SERVICE_ORIGIN:'https://celebrate.thesourboule.com',
    WEBSITE_ORIGINS:'https://thesourboule.com,https://www.thesourboule.com',
    ACCESS_ISSUER:'https://sourbagelman.cloudflareaccess.com',
    ACCESS_AUD:'dd921507cd930cf59c924b36a6ca2d2035d837ae1e1316640b4b8e63701207fd'
  });
  assert.equal(config.main,resolve(feature,'production/worker.mjs'));
  assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);assert.equal(config.observability.enabled,false);
  assert.equal(config.assets.run_worker_first,true);
  assert.doesNotMatch(JSON.stringify(config),/STAGING_|TESTER|nye-staging|nye-service-staging|191f1e9c-b291-43bd-841f-5cfb514835e2|PASS_SECRET|REQUIRES_|clock|simulat/i);
  assert.deepEqual(await walk(result.assetsDirectory),[...PRODUCTION_FILES].sort());
  const manifest=JSON.parse(await readFile(result.manifestPath,'utf8'));
  assert.equal(manifest.productionEnabled,true);assert.equal(manifest.productionVerified,false);assert.equal(manifest.websiteLoaderEnabled,false);
  assert.equal(manifest.resources.staffAccessAppId,'63f1c1ce-a257-4a4a-9212-8c246b7c7ee8');
  assert.equal(manifest.resources.zoneId,'ccc24f503b6009cf857e445d232c0e5e');
  for(const [path,source] of before)assert.equal(await readFile(resolve(feature,path),'utf8'),source,path+' unchanged');
  assert.equal(JSON.parse(before.get('production/wrangler.template.json')).vars.PRODUCTION_ENABLED,'false');
  assert.match(before.get('../../assets/js/new-year-2027.js'),/const ENABLED=false;/);
});

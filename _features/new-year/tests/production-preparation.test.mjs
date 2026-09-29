import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {runInNewContext} from 'node:vm';
import {setImmediate} from 'node:timers/promises';
import {build} from 'esbuild';
import {prepareProduction,productionAsset,PRODUCTION_FILES} from '../production/prepare.mjs';
import {LocalD1} from '../scripts/sqlite-adapter.mjs';
import {EVENT} from '../src/config.mjs';
const feature=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(feature,'../..');
async function walk(path,prefix=''){const found=[];for(const item of await readdir(path,{withFileTypes:true})){const name=prefix+item.name;if(item.isDirectory())found.push(...await walk(resolve(path,item.name),name+'/'));else found.push(name);}return found.sort();}
test('production preparation contains only real guest/staff assets and leaves current website and loader untouched',async t=>{
  const pages=['index.html','brand-home.html','about.html','catering.html','contact.html','events.html','fort-worth.html','locations.html','menu.html','menus-order.html','willow-bend.html','willow-bend-menu.html','assets/js/new-year-2027.js'];
  const originals=new Map(await Promise.all(pages.map(async path=>[path,await readFile(resolve(repo,path))])));
  const output=await prepareProduction();t.after(()=>rm(output.outputDirectory,{recursive:true,force:true}));
  assert.deepEqual(await walk(output.assetsDirectory),[...PRODUCTION_FILES].sort());
  const config=JSON.parse(await readFile(output.wranglerPath));
  assert.equal(config.name,'sour-boule-nye-production');assert.equal(config.vars.PRODUCTION_ENABLED,'false');
  assert.equal(config.vars.PRODUCTION_SERVICE_ORIGIN,'https://celebrate.thesourboule.com');assert.equal(config.main,resolve(feature,'production/worker.mjs'));
  assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);assert.equal(config.assets.run_worker_first,true);
  assert.equal(config.account_id,undefined);assert.equal(config.routes,undefined);assert.match(config.d1_databases[0].database_id,/REQUIRES_FRESH_PRODUCTION/);
  assert.ok(!JSON.stringify(config).includes('STAGING_'));assert.ok(!JSON.stringify(config).includes('TESTER'));assert.ok(!JSON.stringify(config).includes('PASS_SECRET'));
  for(const path of PRODUCTION_FILES){
    const out=await readFile(resolve(output.assetsDirectory,path),'utf8'),input=await readFile(resolve(feature,'public',path),'utf8');
    assert.equal(out,productionAsset(path,input));
    if(!['staff/index.html','assets/staff.js'].includes(path))assert.equal(out,input);
    assert.doesNotMatch(out,/nye-staging|nye-service-staging|04271|sb-nye-preview-only|data-stage=|\/__lab\//);
  }
  assert.match(await readFile(resolve(output.assetsDirectory,'staff/index.html'),'utf8'),/src="\/staff\/assets\/staff.js"/);
  assert.match(await readFile(resolve(output.assetsDirectory,'assets/staff.js'),'utf8'),/fetch\('\/staff\/api\/'/);
  for(const [path,content] of originals)assert.deepEqual(await readFile(resolve(repo,path)),content);
  const manifest=JSON.parse(await readFile(output.manifestPath));assert.equal(manifest.productionVerified,false);assert.equal(manifest.websiteLoaderEnabled,true);
});
test('fresh production schema has no test data, identities or inferred holiday hours',async()=>{
  const db=new LocalD1();try{
    await db.exec(await readFile(resolve(feature,'migrations/0001_initial.sql'),'utf8'));
    await db.exec(await readFile(resolve(feature,'production/0002_production_environment.sql'),'utf8'));
    assert.equal((await db.prepare('SELECT identifier FROM production_environment WHERE id=1').first()).identifier,'sb-nye-2027-production');
    for(const name of ['sessions','entries','presence','passes','redemption_audit','staff_users','staff_locations','redemption_windows'])assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM '+name).first()).n,0,name);
  }finally{db.close();}
});
test('production Worker bundles only real backend code, with no private staging or simulation imports',async()=>{
  const result=await build({entryPoints:[resolve(feature,'production/worker.mjs')],bundle:true,write:false,format:'esm',platform:'browser',metafile:true});
  for(const path of Object.keys(result.metafile.inputs))assert.doesNotMatch(path,/\/(staging|preview|scripts)\//);
  const source=result.outputFiles[0].text;assert.doesNotMatch(source,/STAGING_REAL_ANCHOR|STAGING_EVENT_ANCHOR|STAGING_TESTER_EMAILS|authorizeTester|04271|\/__lab\/time/);
});
test('production marker refuses existing staging or populated databases without deleting their records',async()=>{
  for(const populated of [false,true]){
    const db=new LocalD1();try{
      await db.exec(await readFile(resolve(feature,'migrations/0001_initial.sql'),'utf8'));
      if(populated)await db.prepare('INSERT INTO staff_users(subject,email) VALUES(?,?)').bind('preserve-staff','staff@example.invalid').run();
      else await db.exec('CREATE TABLE staging_environment(id INTEGER PRIMARY KEY,identifier TEXT)');
      const migration=await readFile(resolve(feature,'production/0002_production_environment.sql'),'utf8');
      assert.throws(()=>db.exec(migration),/CHECK constraint failed/);
      assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM production_environment').first()).n,0);
      if(populated)assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM staff_users').first()).n,1);
    }finally{db.close();}
  }
});
test('enabling the real loader in October does not open early and later follows only server event time',async()=>{
  const shipped=await readFile(resolve(repo,'assets/js/new-year-2027.js'),'utf8');assert.ok(shipped.includes('const ENABLED=true;'));
  // Run the exact prepared release asset in memory. No source/generated asset is written.
  let serverNow=Date.parse('2026-10-01T17:00:00Z'),elapsed=0;const intervals=[],requests=[],nodes=[];
  const element=tag=>({tag,children:[],style:{},isConnected:true,append(...children){this.children.push(...children);},setAttribute(){},addEventListener(){},attachShadow(){return element('shadow');},showModal(){this.open=true;},close(){this.open=false;},focus(){},remove(){nodes.splice(nodes.indexOf(this),1);}});
  const footer=element('footer'),body=element('body');body.append=(node)=>nodes.push(node);
  const context={window:{HTMLDialogElement:class{},addEventListener(){}},location:{origin:'https://thesourboule.com'},document:{activeElement:null,createElement:element,querySelector:()=>footer,body,addEventListener(){}},
    sessionStorage:{getItem:()=>null,setItem(){}},performance:{now:()=>elapsed},setInterval(fn,ms){intervals.push({fn,ms});},AbortSignal,
    fetch:async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>({serverNow,event:EVENT,mode:'live'})};}};
  runInNewContext(shipped,context);await setImmediate();
  const tick=intervals.find(x=>x.ms===500).fn,sync=intervals.find(x=>x.ms===60000).fn;
  assert.equal(nodes.length,0);assert.equal(footer.children[0].hidden,true);assert.equal(requests[0].url,'https://celebrate.thesourboule.com/api/time');
  assert.equal(requests[0].options.credentials,'omit');
  serverNow=EVENT.start-1000;sync();await setImmediate();tick();assert.equal(nodes.length,0,'Still no takeover before the event');
  elapsed=1001;tick();assert.equal(nodes.length,1,'Already-open website automatically opens from the server-anchored clock');
  serverNow=EVENT.end;sync();await setImmediate();tick();assert.equal(nodes.length,0,'Automatically removes takeover at 00:05');
  assert.equal(footer.children[0].hidden,false,'Pass recovery remains available');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,rm,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {optionsFrom,anonymousPromotionState,checkedTime,localPath,runCloudPhase,browserLaunchOptions,nativeBrowserFactory} from '../staging/cloud-api-check.mjs';
import {EVENT} from '../src/config.mjs';
const feature=fileURLToPath(new URL('../',import.meta.url)),local=resolve(feature,'.local');
const args=['--phase','eligibility','--service','https://nye-stage.example.invalid','--guest-state','.local/guest.json','--fw-state','.local/fw.json','--wb-state','.local/wb.json','--run-file','.local/run.json'];
test('cloud rehearsal is opt-in and rejects production endpoints or credential-file overwrites',()=>{
  assert.equal(optionsFrom(args).execute,false);
  assert.equal(optionsFrom([...args,'--execute']).execute,true);
  assert.equal(optionsFrom([...args,'--browser-dns']).browserDns,true);
  assert.throws(()=>optionsFrom([...args,'--execute','--execute']));
  assert.throws(()=>optionsFrom([...args,'--browser-dns','--browser-dns']));
  assert.throws(()=>optionsFrom(args.map(value=>value==='https://nye-stage.example.invalid'?'https://thesourboule.com':value)));
  assert.throws(()=>optionsFrom(args.map(value=>value==='.local/run.json'?'.local/guest.json':value)));
  assert.throws(()=>localPath('../credentials.json'));
  assert.throws(()=>localPath('.local/database.sqlite'));
});
test('cloud rehearsal isolates only guest promotion cookies and keeps genuine Access cookies unchanged',()=>{
  const access={name:'CF_Authorization',value:'LOCAL-TEST-FIXTURE',domain:'nye-stage.example.invalid',path:'/',httpOnly:true,secure:true};
  const original={cookies:[access,{name:'__Host-sb_nye',value:'LOCAL-TEST-PROMOTION-FIXTURE'}],origins:[]};
  const isolated=anonymousPromotionState(original);
  assert.deepEqual(isolated.cookies,[access]);assert.deepEqual(original.cookies.length,2);
});
test('cloud rehearsal requires staging labels and the exact server-owned schedule',()=>{
  const data={mode:'staging',testLabel:'TEST ONLY — NOT REDEEMABLE',serverNow:EVENT.start,event:EVENT};
  assert.equal(checkedTime(data),EVENT.start);
  assert.throws(()=>checkedTime({...data,mode:'live'}));
  assert.throws(()=>checkedTime({...data,event:{...EVENT,midnight:EVENT.midnight+1}}));
  for(const key of ['preWindow','postWindow','sessionExpires'])assert.throws(()=>checkedTime({...data,event:{...EVENT,[key]:EVENT[key]+1}}));
});
test('browser DNS transport retains HTTPS identity and genuine cookies, intercepting only one blank client document',async()=>{
  const service='https://nye-stage.example.invalid',calls=[];
  const fixture={cookies:[{name:'CF_Authorization',value:'LOCAL-ONLY-FIXTURE',path:'/staff',httpOnly:true,secure:true}],origins:[]};
  let currentURL;
  const page={route:async(url,handler)=>{calls.push(['route',url]);await handler({fulfill:async options=>calls.push(['blank',options])});},goto:async url=>{currentURL=url;calls.push(['goto',url]);return {status:()=>200,headers:()=>({'content-type':'application/json'})};},url:()=>currentURL,evaluate:async(fn,params)=>{calls.push(['request',params]);return {status:200,type:'basic',headers:{'content-type':'application/json'},text:'{"mode":"staging"}'};}};
  const browserContext={newPage:async()=>page,storageState:async()=>fixture,close:async()=>calls.push(['closeContext'])};
  const browser={newContext:async options=>{calls.push(['context',options]);return browserContext;},close:async()=>calls.push(['closeBrowser'])};
  const resolver={setServers:servers=>calls.push(['dnsServers',servers]),resolve4:async host=>{calls.push(['resolve',host]);return ['192.0.2.123'];}};
  const launcher={launch:async options=>{calls.push(['launch',options]);return browser;}};
  const factory=await nativeBrowserFactory(service,{resolver,launcher});const client=await factory.newContext({storageState:fixture});
  const response=await client.fetch(service+'/staff/api/verify',{method:'POST',data:{code:'12345'}});
  assert.equal(response.status(),200);assert.deepEqual(await response.json(),{mode:'staging'});
  assert.deepEqual(calls.find(call=>call[0]==='dnsServers')[1],['1.1.1.1']);assert.deepEqual(calls.find(call=>call[0]==='resolve'),['resolve','nye-stage.example.invalid']);
  const launch=calls.find(call=>call[0]==='launch')[1];assert.equal(launch.headless,true);assert.deepEqual(launch.args,['--host-resolver-rules=MAP nye-stage.example.invalid 192.0.2.123,EXCLUDE localhost']);
  const context=calls.find(call=>call[0]==='context')[1];assert.equal(context.storageState,fixture);assert.equal(context.ignoreHTTPSErrors,false);
  const route=calls.find(call=>call[0]==='route')[1];assert.ok(route.startsWith(service+'/__cloud_rehearsal_transport_'));assert.doesNotMatch(route,/\*/);
  assert.deepEqual(calls.filter(call=>call[0]==='goto').map(call=>call[1]),[service+'/api/time',route]);assert.deepEqual(factory.stats(),{readOnlyAccessPreflights:1});
  const blank=calls.find(call=>call[0]==='blank')[1];assert.match(blank.body,/connect-src 'self'/);assert.doesNotMatch(blank.body,/<script/);
  assert.deepEqual(calls.find(call=>call[0]==='request')[1],{url:service+'/staff/api/verify',method:'POST',body:{code:'12345'}});
  await assert.rejects(client.fetch('https://thesourboule.com/api/session',{method:'POST',data:{}}));
  assert.equal(calls.filter(call=>call[0]==='request').length,1);assert.equal(await client.storageState(),fixture);
  await client.dispose();await factory.dispose();assert.ok(calls.some(call=>call[0]==='closeBrowser'));
});
test('native transport fails closed if genuine Access JSON navigation does not complete',async()=>{
  let closed=0,evaluated=0;
  const page={goto:async()=>({status:()=>200,headers:()=>({'content-type':'text/html'})}),url:()=> 'https://example.cloudflareaccess.com/login',evaluate:async()=>{evaluated++;}};
  const context={newPage:async()=>page,close:async()=>{closed++;}};
  const factory=await nativeBrowserFactory('https://nye-stage.example.invalid',{resolver:{setServers(){},resolve4:async()=>['192.0.2.1']},launcher:{launch:async()=>({newContext:async()=>context,close:async()=>{}})}});
  await assert.rejects(factory.newContext({storageState:{cookies:[{name:'CF_Authorization',value:'LOCAL-ONLY-FIXTURE'}],origins:[]}}),/preflight/);
  assert.equal(closed,1);assert.equal(evaluated,0);assert.deepEqual(factory.stats(),{readOnlyAccessPreflights:1});await factory.dispose();
});
test('browser DNS override rejects production hosts and non-address command injection',()=>{
  assert.throws(()=>browserLaunchOptions('https://thesourboule.com','192.0.2.1'));
  assert.throws(()=>browserLaunchOptions('https://nye-stage.example.invalid','192.0.2.1,MAP * 127.0.0.1'));
  assert.throws(()=>browserLaunchOptions('https://nye-stage.example.invalid','not-an-address'));
});
test('cloud rehearsal failure reports redact injected transport secrets and write only private JSON',async()=>{
  await mkdir(local,{recursive:true});const dir=await mkdtemp(join(local,'cloud-api-unit-'));
  try {
    for(const name of ['guest','fw','wb'])await writeFile(join(dir,name+'.json'),JSON.stringify({cookies:[],origins:[]}),{mode:0o600});
    const options=optionsFrom(['--phase','eligibility','--service','https://nye-stage.example.invalid','--guest-state',join(dir,'guest.json'),'--fw-state',join(dir,'fw.json'),'--wb-state',join(dir,'wb.json'),'--run-file',join(dir,'run.json'),'--execute']);
    const report=await runCloudPhase(options,{requestFactory:{newContext:async()=>{throw Error('SECRET_DO_NOT_PRINT_HEADER_COOKIE');}},onProgress:()=>{}});
    assert.equal(report.result,'FAIL');assert.equal(report.requestCount,0);assert.equal(report.failed,1);
    assert.doesNotMatch(JSON.stringify(report),/SECRET_DO_NOT_PRINT/);
    assert.doesNotMatch(await readFile(options.report,'utf8'),/SECRET_DO_NOT_PRINT/);
    assert.equal((await stat(options.report)).mode&0o777,0o600);
  } finally {await rm(dir,{recursive:true,force:true});}
});

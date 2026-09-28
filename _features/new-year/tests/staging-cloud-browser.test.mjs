import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,symlink,rm,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {browserConfiguration,browserOptions,checkTime,parsedIdentity,privateProfile,freshPromotionSession,continuedWithinWindow,installNetworkFailure,installDeviceDateSimulation,freshAccessState} from '../staging/cloud-browser-check.mjs';
import vm from 'node:vm';
import {EVENT} from '../src/config.mjs';
import {STAGING_LABEL} from '../staging/client-transform.mjs';
const config={websiteOrigin:'https://site.staging.example.invalid',serviceOrigin:'https://service.staging.example.invalid'};
const clock=serverNow=>({serverNow,event:{...EVENT},mode:'staging',testLabel:STAGING_LABEL});
test('cloud helper requires exact isolated sibling HTTPS origins',()=>{
  assert.deepEqual(browserConfiguration(config),config);
  for(const websiteOrigin of ['https://thesourboule.com','https://www.thesourboule.com','https://celebrate.thesourboule.com','https://account.workers.dev','http://site.staging.example.invalid','https://site.staging.example.invalid:8443','https://other.example.invalid',config.serviceOrigin])assert.throws(()=>browserConfiguration({...config,websiteOrigin}));
});
test('CLI permits only documented native profiles, viewports, pages and scenarios',()=>{
  const login=browserOptions(['login','reviewed.json','--profile','lance','--staff','--resolve-ip','104.21.53.28']);
  assert.equal(login.staff,true);assert.equal(login.profile,'lance');assert.equal(login.viewport,'1366x768');
  const run=browserOptions(['run','reviewed.json','--profile','lance','--scenario','opening','--page','willow-bend-menu','--viewport','320x568']);
  assert.equal(run.scenario,'opening');
  for(const flags of [['--profile','../escape'],['--profile','a','--token','secret'],['--profile','a','--clock','2027'],['--profile','a','--resolve-ip','104.21.53.28, MAP * evil'],['--profile','a','--viewport','100x100'],['--profile','a','--page','https://production.test']])assert.throws(()=>browserOptions(['login','reviewed.json',...flags]));
  assert.throws(()=>browserOptions(['run','reviewed.json','--profile','lance']));
  assert.throws(()=>browserOptions(['run','reviewed.json','--profile','lance','--scenario','deploy']));
});
test('boundary scenarios require natural imminent server boundaries, never client clock values',()=>{
  for(const [scenario,boundary] of [['opening',EVENT.start],['midnight',EVENT.midnight],['ending',EVENT.end]]) {
    assert.equal(checkTime(scenario,clock(boundary-60000)),80000);
    assert.equal(checkTime(scenario,clock(boundary-125000)),145000);
    assert.throws(()=>checkTime(scenario,clock(boundary-11000)),/TIMING_PREREQUISITE/);
    assert.throws(()=>checkTime(scenario,clock(boundary+1)),/TIMING_PREREQUISITE/);
    assert.throws(()=>checkTime(scenario,clock(boundary-125001)),/TIMING_PREREQUISITE/);
  }
});
test('active and recovery scenarios enforce their independent server windows',()=>{
  for(const scenario of ['active','continue','failure-time','failure-frame']) {
    assert.equal(checkTime(scenario,clock(EVENT.start)),20000);
    assert.throws(()=>checkTime(scenario,clock(EVENT.start-1)),/TIMING_PREREQUISITE/);
    assert.throws(()=>checkTime(scenario,clock(EVENT.end-19999)),/TIMING_PREREQUISITE/);
  }
  assert.equal(checkTime('recovery',clock(EVENT.end+1000)),20000);
  assert.throws(()=>checkTime('recovery',clock(EVENT.midnight-1)),/TIMING_PREREQUISITE/);
  assert.throws(()=>checkTime('recovery',clock(EVENT.sessionExpires)),/TIMING_PREREQUISITE/);
});
test('helper rejects live, simulated local, malformed, or drifted event metadata',()=>{
  for(const change of [{mode:'live'},{mode:'local-lab'},{testLabel:'sample'},{serverNow:'1798782600000'},{event:{...EVENT,midnight:EVENT.midnight+1}},{event:{...EVENT,timezone:'UTC'}}])assert.throws(()=>checkTime('active',{...clock(EVENT.start),...change}),/metadata/);
});
test('staff identity parser accepts the actual CSP-protected JSON document without fetching',()=>{
  const identity={sub:'fixture-subject',email:'fixture@example.invalid',mode:'staging',testLabel:STAGING_LABEL};
  assert.deepEqual(parsedIdentity(JSON.stringify(identity,null,2)),identity);
  for(const text of ['Cloudflare Access sign in','<html>Sign in</html>',JSON.stringify({...identity,mode:'live'}),JSON.stringify({...identity,sub:null}),JSON.stringify({...identity,testLabel:'demo'}),''])assert.equal(parsedIdentity(text),null);
});
test('fresh promotion session rejects failed, unauthenticated or incomplete state responses',()=>{
  const fresh={...clock(EVENT.midnight-60000),entry:null,pass:null};
  assert.equal(freshPromotionSession(fresh),true);
  for(const invalid of [null,undefined,{},clock(EVENT.start),{...fresh,mode:'live'},{...fresh,testLabel:'sample'},{...fresh,event:{}},{...fresh,entry:undefined},{...fresh,pass:undefined},{...fresh,entry:{firstName:'Existing'}},{...fresh,pass:{code:'12345'}}])assert.equal(freshPromotionSession(invalid),false);
});
test('Continue cannot claim session persistence once the active window has ended',()=>{
  assert.equal(continuedWithinWindow(clock(EVENT.start)),true);
  assert.equal(continuedWithinWindow(clock(EVENT.end-1)),true);
  for(const now of [EVENT.start-1,EVENT.end,EVENT.end+10000])assert.throws(()=>continuedWithinWindow(clock(now)),/TIMING_PREREQUISITE/);
  assert.throws(()=>continuedWithinWindow(null),/metadata/);
  assert.throws(()=>continuedWithinWindow({...clock(EVENT.start),mode:'live'}),/metadata/);
});
test('failure injection counts only actual matching intercepted browser requests',async()=>{
  for(const scenario of ['failure-time','failure-frame']) {
    const routes=[],report={injectedNetworkFailures:0},aborts=[];
    await installNetworkFailure({route:async(pattern,handler)=>routes.push({pattern,handler})},config,scenario,report);
    assert.equal(report.injectedNetworkFailures,0);assert.equal(routes.length,1);
    const {pattern,handler}=routes[0];
    if(scenario==='failure-time')assert.equal(pattern,config.serviceOrigin+'/api/time');
    else {assert.equal(pattern(new URL(config.serviceOrigin+'/?embed=1')),true);assert.equal(pattern(new URL(config.serviceOrigin+'/?pass=1')),false);assert.equal(pattern(new URL(config.websiteOrigin+'/?embed=1')),false);}
    await handler({abort:async reason=>aborts.push(reason)});
    assert.equal(report.injectedNetworkFailures,1);assert.deepEqual(aborts,['failed']);
  }
});
test('device-Date simulation is explicit, staging-origin scoped, and leaves parsing/server time alone',async()=>{
  let script,args;await installDeviceDateSimulation({addInitScript:async(fn,values)=>{script=fn;args=values;}},config);
  for(const origin of [config.websiteOrigin,config.serviceOrigin,'https://login.cloudflareaccess.com']) {
    const sandbox={Date,location:{origin},args};sandbox.window=sandbox;
    vm.runInNewContext('('+script.toString()+')(args)',sandbox);
    if(origin===config.websiteOrigin||origin===config.serviceOrigin) {
      assert.ok(sandbox.Date.now()>=EVENT.midnight+86400000);
      assert.equal(sandbox.Date.parse('2027-01-01T06:00:00Z'),EVENT.midnight);
      assert.equal(new sandbox.Date('2026-12-31T00:00:00Z').getUTCFullYear(),2026);
    } else assert.equal(sandbox.Date,Date);
  }
  assert.equal(checkTime('device-clock',clock(EVENT.midnight-60000)),20000);
  for(const now of [EVENT.start-1,EVENT.midnight-19999,EVENT.midnight])assert.throws(()=>checkTime('device-clock',clock(now)),/TIMING_PREREQUISITE/);
});
test('isolated device-clock context retains genuine Access cookies and removes only the guest promotion cookie',()=>{
  const state={cookies:[{name:'CF_Authorization',value:'fixture-native-access'},{name:'__Host-sb_nye',value:'fixture-guest'},{name:'CF_Authorization',path:'/staff',value:'fixture-native-staff'}],origins:[{origin:config.websiteOrigin,localStorage:[]}]};
  const fresh=freshAccessState(state);
  assert.deepEqual(fresh.cookies,[state.cookies[0],state.cookies[2]]);assert.equal(fresh.origins,state.origins);assert.equal(state.cookies.length,3);
});
test('native profiles stay private inside .local and reject symlink destinations',async()=>{
  const feature=fileURLToPath(new URL('../',import.meta.url)),local=resolve(feature,'.local');await mkdir(local,{recursive:true});
  const name='unit-'+process.pid+'-'+Date.now(),path=await privateProfile(name);
  try {assert.equal(path,resolve(local,'cloud-browser-'+name));assert.equal((await stat(path)).mode&0o777,0o700);await assert.rejects(privateProfile('../escape'));}
  finally {await rm(path,{recursive:true});}
  const target=await mkdtemp(resolve(local,'browser-test-target-')),linkName=name+'-link',link=resolve(local,'cloud-browser-'+linkName);
  try {await symlink(target,link,'dir');await assert.rejects(privateProfile(linkName),/symlink/);}
  finally {await rm(link);await rm(target,{recursive:true});}
});

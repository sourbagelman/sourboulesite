import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {LocalD1} from '../scripts/sqlite-adapter.mjs';
import {createStagingApp,TEST_LABEL} from '../staging/worker.mjs';
import {stagingClock} from '../staging/clock.mjs';
import {EVENT as E} from '../src/config.mjs';
const REAL=Date.parse('2026-09-28T18:00:00.000Z');
const ISSUER='https://staging-rehearsal-test.cloudflareaccess.com';
const SITE='https://nye-site-staging.example.invalid',SERVICE='https://nye-service-staging.example.invalid';
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);Object.assign(jwk,{kid:'staging-test-key',alg:'RS256',use:'sig'});
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
async function signed(claims) {
  const h=encode({alg:'RS256',kid:jwk.kid}),p=encode(claims);
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(h+'.'+p));
  return h+'.'+p+'.'+Buffer.from(signature).toString('base64url');
}
async function fixture() {
  const DB=new LocalD1();await DB.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
  await DB.exec('CREATE TABLE staging_environment(id INTEGER PRIMARY KEY CHECK(id=1),identifier TEXT NOT NULL)');
  await DB.prepare('INSERT INTO staging_environment VALUES(1,?)').bind('local-signed-jwt-fixture').run();
  const assets=[];let now=REAL;
  const env={DB,PASS_SECRET:'LOCAL-STAGING-TEST-ONLY-NOT-A-CLOUD-SECRET-0123456789',
    ASSETS:{fetch:async request=>{assets.push(new URL(request.url).pathname);return new Response('<!doctype html><p>'+TEST_LABEL+'</p>',{headers:{'Content-Type':'text/html'}});}},
    STAGING_ENABLED:'true',STAGING_SITE_ORIGIN:SITE,STAGING_SERVICE_ORIGIN:SERVICE,
    STAGING_ACCESS_ISSUER:ISSUER,STAGING_SITE_AUD:'site-application',STAGING_SERVICE_AUD:'service-application',STAGING_STAFF_AUD:'staff-application',
    STAGING_TESTER_EMAILS:'tester@example.invalid,fw@example.invalid,wb@example.invalid',STAGING_ENVIRONMENT_ID:'local-signed-jwt-fixture',
    STAGING_REAL_ANCHOR_UTC:new Date(REAL).toISOString(),STAGING_EVENT_ANCHOR_UTC:new Date(E.start).toISOString()};
  const app=createStagingApp({wallClock:()=>now,fetcher:async()=>Response.json({keys:[jwk]})});
  for(const [subject,email,location] of [['station-fw','fw@example.invalid','fort-worth'],['station-wb','wb@example.invalid','willow-bend']]) {
    await DB.prepare('INSERT INTO staff_users(subject,email) VALUES(?,?)').bind(subject,email).run();
    await DB.prepare('INSERT INTO staff_locations(subject,location) VALUES(?,?)').bind(subject,location).run();
  }
  const token=(overrides={})=>signed({iss:ISSUER,aud:['service-application'],sub:'anonymous-tester',email:'tester@example.invalid',exp:now/1000+3600,nbf:now/1000-10,...overrides});
  async function request(path,{host=SERVICE,method='GET',body,cookie,audience,station,auth=true,claims={},jwt,origin=host,headers={}}={}) {
    const subject=station==='fw'?'station-fw':station==='wb'?'station-wb':'anonymous-tester';
    const email=station==='fw'?'fw@example.invalid':station==='wb'?'wb@example.invalid':'tester@example.invalid';
    const staff=path==='/staff'||path.startsWith('/staff/')||path.startsWith('/api/staff');
    const h={Origin:origin,...headers};
    if(auth)h['Cf-Access-Jwt-Assertion']=jwt||await token({sub:subject,email,aud:[audience||(host===SITE?'site-application':staff?'staff-application':'service-application')],...claims});
    if(cookie)h.Cookie=cookie;
    if(body!==undefined)h['Content-Type']='application/json';
    const response=await app.fetch(new Request(host+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}),env);
    const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={text};}
    return {status:response.status,headers:response.headers,data};
  }
  const post=(path,body,options={})=>request(path,{...options,body,method:'POST'});
  async function guest() {
    const session=await post('/api/session',{});assert.equal(session.status,200);
    const cookie=session.headers.get('set-cookie').split(';')[0];
    assert.equal((await post('/api/register',{firstName:'Jamie'},{cookie})).status,200);
    return cookie;
  }
  const eventTime=value=>{now=REAL+value-E.start;};
  const presence=cookie=>post('/api/presence',{visible:true,view:'countdown'},{cookie});
  async function qualify() {eventTime(E.midnight-1000);const cookie=await guest();await presence(cookie);eventTime(E.midnight);const result=await presence(cookie);assert.equal(result.status,200);return{cookie,pass:result.data.pass};}
  return {DB,env,assets,app,request,post,guest,presence,qualify,token,eventTime,setReal:value=>{now=value;},close:()=>DB.close()};
}
async function using(fn) {const f=await fixture();try{await fn(f);}finally{f.close();}}

test('staging clock maps trusted server time one-to-one onto the unchanged event',()=>{
  const env={STAGING_REAL_ANCHOR_UTC:new Date(REAL).toISOString(),STAGING_EVENT_ANCHOR_UTC:new Date(E.start).toISOString()};
  let now=REAL;const clock=stagingClock(env,()=>now);
  assert.equal(clock(),E.start);now+=600000;assert.equal(clock(),E.midnight);now+=300000;assert.equal(clock(),E.end);
  assert.throws(()=>stagingClock({...env,STAGING_REAL_ANCHOR_UTC:'2026-09-28 18:00'}));
  assert.throws(()=>stagingClock({...env,STAGING_REAL_ANCHOR_UTC:'2026-09-31T18:00:00Z'}));
  assert.throws(()=>stagingClock({...env,STAGING_EVENT_ANCHOR_UTC:'2030-01-01T00:00:00Z'}));
});
test('staging configuration fails closed before assets when a required gate is missing',()=>using(async f=>{
  for(const key of ['STAGING_ENABLED','STAGING_SITE_ORIGIN','STAGING_SERVICE_ORIGIN','STAGING_ACCESS_ISSUER','STAGING_SITE_AUD','STAGING_SERVICE_AUD','STAGING_STAFF_AUD','STAGING_TESTER_EMAILS','STAGING_ENVIRONMENT_ID','STAGING_REAL_ANCHOR_UTC','STAGING_EVENT_ANCHOR_UTC','PASS_SECRET','DB','ASSETS']) {
    const saved=f.env[key];delete f.env[key];assert.equal((await f.request('/',{host:SITE})).status,503,key);f.env[key]=saved;
  }
  assert.deepEqual(f.assets,[]);
}));
test('staging rejects production hosts, insecure origins and workers.dev configurations',()=>using(async f=>{
  for(const origin of ['https://thesourboule.com','https://www.thesourboule.com','https://thesourboule.com.','https://celebrate.thesourboule.com','https://workers.dev','https://*.staging.example.invalid','http://nye-staging.example.invalid','https://nye-staging.worker.workers.dev']) {
    f.env.STAGING_SITE_ORIGIN=origin;assert.equal((await f.request('/',{host:origin})).status,503);
  }
}));
test('staging unknown/direct-origin hosts cannot receive assets or APIs even with a valid JWT',()=>using(async f=>{
  for(const host of ['https://unknown.example.invalid','https://nye.worker.workers.dev','http://nye-service-staging.example.invalid'])for(const path of ['/','/api/time','/assets/guest.js'])assert.equal((await f.request(path,{host})).status,404);
  assert.deepEqual(f.assets,[]);
}));
test('every staging site/service/asset/API path requires a real signed tester JWT',()=>using(async f=>{
  for(const [host,path] of [[SITE,'/'],[SITE,'/images/logo.png'],[SERVICE,'/'],[SERVICE,'/assets/guest.js'],[SERVICE,'/api/time'],[SERVICE,'/staff/'],[SERVICE,'/api/staff/me']]) {
    const r=await f.request(path,{host,auth:false});assert.equal(r.status,401,path);assert.equal(r.data.testLabel,TEST_LABEL);
  }
  assert.deepEqual(f.assets,[]);
}));
test('staging authentication rejects unapproved testers, forged signatures, wrong audiences and expired real sessions',()=>using(async f=>{
  assert.equal((await f.request('/',{claims:{email:'outsider@example.invalid'}})).status,401);
  assert.equal((await f.request('/',{audience:'wrong-application'})).status,401);
  assert.equal((await f.request('/',{claims:{exp:REAL/1000}})).status,401);
  assert.equal((await f.request('/',{claims:{nbf:REAL/1000+1}})).status,401);
  const jwt=await f.token(),parts=jwt.split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
  assert.equal((await f.request('/',{jwt:parts.join('.')})).status,401);
}));
test('staging JWT validity uses actual wall time, never the virtual 2027 campaign clock',()=>using(async f=>{
  const result=await f.request('/api/time');assert.equal(result.status,200);assert.equal(result.data.serverNow,E.start);assert.equal(result.data.mode,'staging');
  const old=await f.token({exp:REAL/1000+5});f.setReal(REAL+5000);assert.equal((await f.request('/api/time',{jwt:old})).status,401);
}));
test('staging tester removal denies a still-signed token immediately',()=>using(async f=>{
  const jwt=await f.token();f.env.STAGING_TESTER_EMAILS='fw@example.invalid,wb@example.invalid';assert.equal((await f.request('/',{jwt})).status,401);
}));
test('staging fails closed on missing, mismatched or unrelated database identity',()=>using(async f=>{
  await f.DB.prepare('UPDATE staging_environment SET identifier=?').bind('unrelated-project').run();assert.equal((await f.request('/api/time')).status,503);
  await f.DB.prepare('DELETE FROM staging_environment').run();assert.equal((await f.request('/',{host:SITE})).status,503);
  await f.DB.exec('DROP TABLE staging_environment');assert.equal((await f.request('/')).status,503);
  assert.deepEqual(f.assets,[]);
}));
test('staging maps only authorized site/service assets and pins service framing',()=>using(async f=>{
  const site=await f.request('/',{host:SITE});assert.equal(site.status,200);assert.equal(f.assets.at(-1),'/site/index.html');
  const service=await f.request('/');assert.equal(f.assets.at(-1),'/service/index.html');assert.match(service.headers.get('content-security-policy'),new RegExp('frame-ancestors '+SITE.replaceAll('.','\\.')+';'));
  await f.request('/staff/assets/staff.js',{station:'fw'});assert.equal(f.assets.at(-1),'/service/assets/staff.js');
  assert.equal((await f.request('/api/time',{host:SITE})).status,404);
  assert.equal((await f.request('/%2f..%2fsite/index.html')).status,503);
}));
test('visual preview remains tester-authenticated, read-only and disconnected from guest and staff APIs',()=>using(async f=>{
  const paths=['/new-year-preview/','/new-year-preview/index.html','/new-year-preview/preview.js','/new-year-preview/view.js','/new-year-preview/staff-ui.js','/new-year-preview/nye.css'];
  const before=await f.DB.prepare('SELECT total_changes() AS changes').first();
  for(const path of paths) {
    assert.equal((await f.request(path,{host:SITE,auth:false})).status,401);
    assert.equal((await f.request(path,{host:SITE,claims:{email:'outsider@example.invalid'}})).status,401);
  }
  assert.deepEqual(f.assets,[]);
  for(const path of paths) {
    const r=await f.request(path,{host:SITE});assert.equal(r.status,200);
    assert.equal(f.assets.at(-1),'/site'+(path.endsWith('/')?path+'index.html':path));
    const csp=r.headers.get('content-security-policy');
    for(const directive of ["connect-src 'none'","frame-src 'none'","form-action 'none'","worker-src 'none'","script-src 'self'"])assert.ok(csp.includes(directive));
    assert.ok(!csp.includes(SERVICE));assert.equal(r.headers.get('set-cookie'),null);
    assert.equal((await f.post(path,{},{host:SITE})).status,405);
  }
  const redirect=await f.request('/new-year-preview',{host:SITE});assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),SITE+'/new-year-preview/');
  assert.equal((await f.request('/staff/',{audience:'service-application'})).status,401);
  assert.equal((await f.request('/staff/',{station:'fw'})).status,200);
  assert.deepEqual(await f.DB.prepare('SELECT total_changes() AS changes').first(),before);
}));
test('staging credentialed time CORS is restricted to the exact approved website',()=>using(async f=>{
  const allowed=await f.request('/api/time',{origin:SITE});assert.equal(allowed.headers.get('Access-Control-Allow-Origin'),SITE);assert.equal(allowed.headers.get('Access-Control-Allow-Credentials'),'true');
  const forbidden=await f.request('/api/time',{origin:'https://evil.example'});assert.equal(forbidden.headers.get('Access-Control-Allow-Origin'),null);
  assert.equal((await f.request('/api/time',{method:'OPTIONS',auth:false,origin:SITE})).status,401);
}));
test('staging has no browser clock endpoints and ignores query/body/header clock claims',()=>using(async f=>{
  for(const path of ['/__lab/time','/__test/time'])assert.equal((await f.post(path,{now:E.midnight,freeze:true})).status,404);
  const state=await f.request('/api/time?now='+E.midnight+'&preview=midnight',{headers:{'X-Lab-Control':'ignored','X-Runtime-Test-Now':String(E.midnight)}});
  assert.equal(state.data.serverNow,E.start);
}));
test('staging keeps Secure host-only guest cookies and marks every issued test pass',()=>using(async f=>{
  const session=await f.post('/api/session',{});assert.match(session.headers.get('set-cookie'),/^__Host-sb_nye=/);assert.match(session.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);assert.doesNotMatch(session.headers.get('set-cookie'),/Domain=/);
  const q=await f.qualify();assert.match(q.pass.code,/^[1-9][0-9]{4}$/);assert.equal(q.pass.simulated,true);assert.equal(q.pass.testLabel,TEST_LABEL);
  f.eventTime(E.end);const state=await f.request('/api/state',{cookie:q.cookie});assert.equal(state.data.pass.code,q.pass.code);assert.equal(state.data.testLabel,TEST_LABEL);
}));
test('staging requires a distinct staff Access audience before any station lookup or asset',()=>using(async f=>{
  for(const path of ['/staff/','/staff/assets/staff.js','/api/staff/me'])assert.equal((await f.request(path,{station:'fw',audience:'service-application'})).status,401);
  f.env.STAGING_STAFF_AUD=f.env.STAGING_SERVICE_AUD;assert.equal((await f.request('/staff/',{station:'fw'})).status,503);
}));
test('staging staff audience alone cannot grant a station to an approved tester',()=>using(async f=>{
  assert.equal((await f.request('/api/staff/me')).status,403);
  assert.equal((await f.request('/staff/')).status,403);
  assert.deepEqual(f.assets,[]);
}));
test('staging uses exactly one approved active station identity per backend assignment',()=>using(async f=>{
  const fw=await f.request('/api/staff/me',{station:'fw'}),wb=await f.request('/api/staff/me',{station:'wb'});
  assert.equal(fw.data.location,'fort-worth');assert.equal(wb.data.location,'willow-bend');assert.equal(fw.data.testLabel,TEST_LABEL);
  await f.DB.prepare('UPDATE staff_users SET active=0 WHERE subject=?').bind('station-fw').run();assert.equal((await f.request('/api/staff/me',{station:'fw'})).status,403);
  await f.DB.prepare('INSERT INTO staff_locations(subject,location) VALUES(?,?)').bind('station-wb','fort-worth').run();assert.equal((await f.request('/api/staff/me',{station:'wb'})).status,403);
}));
test('staging preserves atomic two-station no-purchase redemption, retry and central single use',()=>using(async f=>{
  const q=await f.qualify();f.eventTime(E.end);
  const closed=await f.post('/api/staff/redeem',{code:q.pass.code,requestId:crypto.randomUUID()},{station:'fw'});assert.equal(closed.data.status,'outside_hours');
  for(const location of ['fort-worth','willow-bend'])await f.DB.prepare('INSERT INTO redemption_windows(location,opens_ms,closes_ms,label) VALUES(?,?,?,?)').bind(location,E.end,E.end+3600000,'ARTIFICIAL STAGING WINDOW — NOT RESTAURANT HOURS').run();
  const ids=[crypto.randomUUID(),crypto.randomUUID()];
  const results=await Promise.all(['fw','wb'].map((station,i)=>f.post('/api/staff/redeem',{code:q.pass.code,requestId:ids[i]},{station})));
  assert.equal(results.filter(r=>r.data.status==='redeemed_now').length,1);assert.equal(results.filter(r=>r.data.status==='redeemed').length,1);
  const winner=results.findIndex(r=>r.data.status==='redeemed_now');
  const retry=await f.post('/api/staff/redeem',{code:q.pass.code,requestId:ids[winner]},{station:['fw','wb'][winner]});assert.equal(retry.data.status,'already_confirmed');
  assert.equal((await f.DB.prepare('SELECT COUNT(*) n FROM redemption_audit').first()).n,1);
  assert.equal((await f.post('/api/staff/verify',{code:q.pass.code},{station:['wb','fw'][winner]})).data.status,'redeemed');
}));
test('staging keeps the documented reconnect grace and rejects late eligibility',()=>using(async f=>{
  f.eventTime(E.midnight-1000);const cookie=await f.guest();await f.presence(cookie);
  f.eventTime(E.midnight+90001);const r=await f.presence(cookie);assert.equal(r.data.accepted,false);assert.equal((await f.request('/api/state',{cookie})).data.pass,null);
}));
test('staging marks expiration at the same exact Chicago cutoff',()=>using(async f=>{
  const q=await f.qualify();f.eventTime(E.expires);
  const state=await f.request('/api/state',{cookie:q.cookie});assert.equal(state.data.pass.status,'expired');
  assert.equal((await f.post('/api/staff/redeem',{code:q.pass.code,requestId:crypto.randomUUID()},{station:'fw'})).status,410);
}));
test('staging site response CSP preserves approved font/render origins while preventing real telemetry and form writes',()=>using(async f=>{
  const response=await f.request('/contact.html',{host:SITE});assert.equal(response.status,200);
  const directives=Object.fromEntries(response.headers.get('Content-Security-Policy').split(';').map(part=>part.trim().split(/\s+/)).filter(parts=>parts[0]).map(([key,...values])=>[key,values]));
  assert.deepEqual(directives['script-src'],["'self'","'unsafe-inline'"]);
  assert.deepEqual(directives['connect-src'],["'self'",SERVICE]);
  assert.deepEqual(directives['frame-src'],[SERVICE]);
  assert.deepEqual(directives['form-action'],["'none'"]);
  assert.deepEqual(directives['style-src'],["'self'","'unsafe-inline'",'https://fonts.googleapis.com']);
  assert.deepEqual(directives['font-src'],["'self'",'https://fonts.gstatic.com']);
  assert.deepEqual(directives['img-src'],["'self'",'data:','blob:']);
  assert.doesNotMatch(response.headers.get('Content-Security-Policy'),/googletagmanager|google-analytics|formspree|supabase/);
  assert.equal(response.data.text,'<!doctype html><p>'+TEST_LABEL+'</p>');
}));
test('staging health and dependency failures retain private labels and never synthesize success',()=>using(async f=>{
  const time=await f.request('/api/time');assert.equal(time.data.mode,'staging');assert.equal(time.data.testLabel,TEST_LABEL);assert.match(time.headers.get('Cache-Control'),/no-store/);
  f.env.ASSETS.fetch=async()=>{throw new Error('Simulated asset failure with private diagnostic');};
  const site=await f.request('/',{host:SITE}),service=await f.request('/'),staffAsset=await f.request('/staff/assets/staff.js',{station:'fw'});
  for(const response of [site,service,staffAsset]) {
    assert.equal(response.status,503);assert.equal(response.data.mode,'staging');assert.equal(response.data.testLabel,TEST_LABEL);
    assert.doesNotMatch(response.data.error,/private diagnostic/);assert.equal(response.data.pass,undefined);
    assert.match(response.headers.get('Cache-Control'),/no-store/);
  }
  const DB=f.env.DB;f.env.DB={prepare(){throw new Error('Simulated database failure with private diagnostic');}};
  const database=await f.request('/api/time');f.env.DB=DB;
  assert.equal(database.status,503);assert.equal(database.data.testLabel,TEST_LABEL);assert.doesNotMatch(database.data.error,/private diagnostic/);
}));
test('staging staff JavaScript is available only through the independently protected staff asset namespace',()=>using(async f=>{
  for(const path of ['/assets/staff.js','/assets/staff-ui.js','/assets/%73taff.js','/assets/staff%2dui.js']) {
    assert.equal((await f.request(path)).status,404,path);
  }
  for(const path of ['/assets/%2573taff.js','/assets/staff%252dui.js','/assets/%252e%252e/staff/index.html','/assets/%252fstaff.js','/%2573ervice/assets/staff.js'])assert.equal((await f.request(path)).status,503,path);
  assert.deepEqual(f.assets,[]);
  assert.equal((await f.request('/staff/assets/staff.js',{audience:'service-application'})).status,401);
  assert.equal((await f.request('/staff/assets/staff.js',{station:'fw'})).status,200);
  assert.equal(f.assets.at(-1),'/service/assets/staff.js');
  assert.equal((await f.request('/staff/assets/staff-ui.js',{station:'wb'})).status,200);
  assert.equal(f.assets.at(-1),'/service/assets/staff-ui.js');
}));
test('staging internal site/service prefixes and encoded equivalents cannot expose another artifact namespace',()=>using(async f=>{
  for(const host of [SITE,SERVICE])for(const path of ['/site/index.html','/service/staff/index.html','/%73ervice/assets/staff.js','/site','/service'])assert.equal((await f.request(path,{host})).status,404,host+path);
  assert.deepEqual(f.assets,[]);
}));
test('staging staff-prefixed API transport preserves original Access authorization and canonical business handlers',()=>using(async f=>{
  const tester=await f.request('/staff/api/me',{audience:'service-application'});assert.equal(tester.status,401);
  const noStation=await f.request('/staff/api/me');assert.equal(noStation.status,403);
  const me=await f.request('/staff/api/me',{station:'fw'});assert.equal(me.status,200);assert.equal(me.data.location,'fort-worth');assert.equal(me.data.mode,'staging');assert.equal(me.data.testLabel,TEST_LABEL);
  assert.match(me.headers.get('Content-Type'),/application\/json/);
  const q=await f.qualify();f.eventTime(E.end);
  await f.DB.prepare('INSERT INTO redemption_windows(location,opens_ms,closes_ms,label) VALUES(?,?,?,?)').bind('fort-worth',E.end,E.end+3600000,'ARTIFICIAL STAGING TRANSPORT TEST ONLY').run();
  const checked=await f.post('/staff/api/verify',{code:q.pass.code},{station:'fw'});assert.equal(checked.status,200);assert.equal(checked.data.status,'valid');
  const rejected=await f.post('/staff/api/redeem',{code:q.pass.code,requestId:crypto.randomUUID()},{station:'fw',origin:SITE});assert.equal(rejected.status,403);
  const used=await f.post('/staff/api/redeem',{code:q.pass.code,requestId:crypto.randomUUID()},{station:'fw'});assert.equal(used.status,200);assert.equal(used.data.status,'redeemed_now');
  assert.equal((await f.post('/api/staff/verify',{code:q.pass.code},{station:'wb'})).data.status,'redeemed');
  assert.equal((await f.request('/api/staff/me',{station:'fw',audience:'service-application'})).status,401);
  assert.equal((await f.DB.prepare('SELECT COUNT(*) n FROM redemption_audit').first()).n,1);
}));
test('staging identity setup exposes only the current verified staff-app identity without provisioning or staff access',()=>using(async f=>{
  await f.DB.prepare('DELETE FROM staff_locations WHERE subject=?').bind('station-fw').run();
  await f.DB.prepare('DELETE FROM staff_users WHERE subject=?').bind('station-fw').run();
  const before=await f.DB.prepare('SELECT COUNT(*) n FROM staff_users').first();
  const identity=await f.request('/staff/identity',{station:'fw'});
  assert.equal(identity.status,200);
  assert.deepEqual(identity.data,{sub:'station-fw',email:'fw@example.invalid',mode:'staging',testLabel:TEST_LABEL});
  assert.match(identity.headers.get('Cache-Control'),/no-store/);
  assert.equal(identity.headers.get('Set-Cookie'),null);
  assert.equal((await f.DB.prepare('SELECT COUNT(*) n FROM staff_users').first()).n,before.n);
  assert.equal((await f.request('/staff/api/me',{station:'fw'})).status,403);
  assert.equal((await f.post('/staff/api/verify',{code:'12345'},{station:'fw'})).status,403);
  assert.equal((await f.post('/staff/api/redeem',{code:'12345',requestId:crypto.randomUUID()},{station:'fw'})).status,403);
}));
test('staging identity setup requires a valid staff audience, approved tester, GET and staging database marker',()=>using(async f=>{
  assert.equal((await f.request('/staff/identity',{auth:false})).status,401);
  assert.equal((await f.request('/staff/identity',{station:'fw',audience:'service-application'})).status,401);
  assert.equal((await f.request('/staff/identity',{claims:{email:'outsider@example.invalid'}})).status,401);
  assert.equal((await f.request('/staff/identity',{station:'fw',claims:{exp:REAL/1000}})).status,401);
  assert.equal((await f.post('/staff/identity',{location:'willow-bend',now:E.midnight},{station:'fw'})).status,405);
  assert.equal((await f.request('/staff/identity',{station:'fw',method:'HEAD'})).status,405);
  assert.equal((await f.request('/staff/identity',{host:SITE})).status,404);
  await f.DB.prepare('UPDATE staging_environment SET identifier=?').bind('unrelated-project').run();
  assert.equal((await f.request('/staff/identity',{station:'fw'})).status,503);
}));
test('identity introspection and its route remain absent from the production entrypoint and fresh bundle',async()=>{
  const production=readFileSync(new URL('../src/worker.mjs',import.meta.url),'utf8');
  assert.doesNotMatch(production,/staff\/identity|authorizeTester|STAGING_ENVIRONMENT_ID/);
  assert.match(production,/export default createApp\(\);/);
  const output=await build({entryPoints:[fileURLToPath(new URL('../src/worker.mjs',import.meta.url))],bundle:true,write:false,format:'esm',platform:'browser',target:'es2022',logLevel:'silent'});
  assert.doesNotMatch(output.outputFiles[0].text,/staff\/identity|authorizeTester|STAGING_ENVIRONMENT_ID/);
});

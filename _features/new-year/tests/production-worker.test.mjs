import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LocalD1} from '../scripts/sqlite-adapter.mjs';
import {createProductionApp,SERVICE_ORIGIN,WEBSITE_ORIGINS,DATABASE_IDENTIFIER} from '../production/worker.mjs';
import {EVENT,phaseAt} from '../src/config.mjs';
import {sha256} from '../src/crypto.mjs';

const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);Object.assign(jwk,{kid:'local-production-boundary-key',alg:'RS256',use:'sig'});
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
let fixtureId=0;
async function using(fn) {
  const DB=new LocalD1();
  const realFetch=globalThis.fetch;
  try {
    await DB.exec(readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8'));
    await DB.exec('CREATE TABLE production_environment(id INTEGER PRIMARY KEY CHECK(id=1),identifier TEXT NOT NULL)');
    await DB.prepare('INSERT INTO production_environment VALUES(1,?)').bind(DATABASE_IDENTIFIER).run();
    for(const [subject,email,location] of [['station-fw','fw@example.invalid','fort-worth'],['station-wb','wb@example.invalid','willow-bend']]) {
      await DB.prepare('INSERT INTO staff_users(subject,email) VALUES(?,?)').bind(subject,email).run();
      await DB.prepare('INSERT INTO staff_locations(subject,location) VALUES(?,?)').bind(subject,location).run();
    }
    const assets=[],jwksRequests=[];
    const env={DB,PASS_SECRET:'LOCAL-PRODUCTION-BOUNDARY-TEST-ONLY-0123456789',
      ASSETS:{fetch:async request=>{assets.push(new URL(request.url).pathname);return new Response('<!doctype html><p>Approved production asset</p>',{headers:{'Content-Type':'text/html'}});}},
      PRODUCTION_ENABLED:'true',PRODUCTION_SERVICE_ORIGIN:SERVICE_ORIGIN,WEBSITE_ORIGINS:WEBSITE_ORIGINS.join(','),
      ACCESS_ISSUER:'https://production-boundary-'+(++fixtureId)+'.cloudflareaccess.com',ACCESS_AUD:'a'.repeat(64)};
    globalThis.fetch=async url=>{jwksRequests.push(String(url));assert.equal(String(url),env.ACCESS_ISSUER+'/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};
    async function token(overrides={}) {
      const now=Date.now()/1000;
      const h=encode({alg:'RS256',kid:jwk.kid}),p=encode({iss:env.ACCESS_ISSUER,aud:[env.ACCESS_AUD],sub:'station-fw',email:'fw@example.invalid',exp:now+3600,nbf:now-10,...overrides});
      const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(h+'.'+p));
      return h+'.'+p+'.'+Buffer.from(signature).toString('base64url');
    }
    const app=createProductionApp();
    async function request(path,{host=SERVICE_ORIGIN,method='GET',body,jwt,origin=host,headers={}}={}) {
      const h={Origin:origin,...headers};
      if(jwt)h['Cf-Access-Jwt-Assertion']=jwt;
      if(body!==undefined)h['Content-Type']='application/json';
      const response=await app.fetch(new Request(host+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}),env);
      const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={text};}
      return {status:response.status,headers:response.headers,data};
    }
    await fn({DB,env,assets,jwksRequests,token,request});
  } finally {globalThis.fetch=realFetch;DB.close();}
}

test('production boundary fails closed until configuration, staff auth and isolated bindings are complete',()=>using(async f=>{
  for(const key of ['PRODUCTION_ENABLED','PRODUCTION_SERVICE_ORIGIN','WEBSITE_ORIGINS','ACCESS_ISSUER','ACCESS_AUD','PASS_SECRET','DB','ASSETS']) {
    const saved=f.env[key];delete f.env[key];
    assert.equal((await f.request('/')).status,503,key);assert.equal((await f.request('/api/time')).status,503,key);
    f.env[key]=saved;
  }
  for(const [key,value] of [['PRODUCTION_ENABLED','false'],['PRODUCTION_SERVICE_ORIGIN','https://nye-service-staging.thesourboule.com'],['WEBSITE_ORIGINS','https://nye-staging.thesourboule.com'],['ACCESS_ISSUER','https://evil.example'],['ACCESS_AUD','REPLACE_STAFF_AUD'],['ACCESS_AUD','REQUIRES_PRODUCTION_STAFF_ACCESS_AUDIENCE'],['PASS_SECRET','short']]) {
    const saved=f.env[key];f.env[key]=value;assert.equal((await f.request('/api/time')).status,503);f.env[key]=saved;
  }
  assert.deepEqual(f.assets,[]);assert.deepEqual(f.jwksRequests,[]);
}));

test('production accepts anonymous guest assets and real server time without a private tester restriction',()=>using(async f=>{
  for(const [path,asset] of [['/','/index.html'],['/?pass=1','/index.html'],['/assets/guest.js','/assets/guest.js'],['/assets/view.js','/assets/view.js'],['/assets/nye.css','/assets/nye.css']]) {
    assert.equal((await f.request(path)).status,200);assert.equal(f.assets.at(-1),asset);
  }
  const before=Date.now(),r=await f.request('/api/time'),after=Date.now();
  assert.equal(r.status,200);assert.equal(r.data.mode,'live');assert.deepEqual(r.data.event,EVENT);
  assert.ok(r.data.serverNow>=before&&r.data.serverNow<=after);assert.equal(r.data.phase,phaseAt(r.data.serverNow));
  assert.equal(r.data.testLabel,undefined);assert.deepEqual(f.jwksRequests,[]);
  const state=await f.request('/api/state');assert.equal(state.status,200);assert.equal(state.data.entry,null);assert.equal(state.data.pass,null);
}));

test('production public time CORS is pinned to the two real website origins',()=>using(async f=>{
  for(const origin of WEBSITE_ORIGINS) {
    const time=await f.request('/api/time',{origin});assert.equal(time.headers.get('Access-Control-Allow-Origin'),origin);assert.equal(time.headers.get('Access-Control-Allow-Credentials'),null);
    assert.equal((await f.request('/api/time',{origin,method:'OPTIONS'})).status,204);
  }
  for(const origin of ['https://nye-staging.thesourboule.com','https://evil.example'])assert.equal((await f.request('/api/time',{origin})).headers.get('Access-Control-Allow-Origin'),null);
  assert.equal((await f.request('/api/session',{method:'POST',body:{},origin:WEBSITE_ORIGINS[0]})).status,403);
}));

test('production rejects unknown hosts, simulation routes, arbitrary assets and unprotected staff aliases',()=>using(async f=>{
  for(const host of ['https://nye-service-staging.thesourboule.com','https://nye.worker.workers.dev','http://celebrate.thesourboule.com'])for(const path of ['/','/api/time'])assert.equal((await f.request(path,{host})).status,404);
  for(const path of ['/__lab/time','/__test/time','/new-year-preview/','/preview/preview.js','/site/index.html','/service/index.html','/anything.html','/assets/staff.js','/assets/staff-ui.js','/assets/%73taff.js','/staff/identity','/api/staff/unknown','/staff/api/unknown','/%2f..%2findex.html'])assert.equal((await f.request(path)).status,404,path);
  assert.equal((await f.request('/',{method:'POST',body:{}})).status,405);
  assert.deepEqual(f.assets,[]);assert.deepEqual(f.jwksRequests,[]);
}));

test('production rejects a staging or missing database marker before assets or guest operations',()=>using(async f=>{
  for(const identifier of ['nye-private-staging-2027','some-other-production']) {
    await f.DB.prepare('UPDATE production_environment SET identifier=?').bind(identifier).run();
    assert.equal((await f.request('/')).status,503);assert.equal((await f.request('/api/session',{method:'POST',body:{}})).status,503);
  }
  await f.DB.exec('DROP TABLE production_environment; CREATE TABLE staging_environment(id INTEGER PRIMARY KEY,identifier TEXT)');
  await f.DB.prepare('INSERT INTO staging_environment VALUES(1,?)').bind('nye-private-staging-2027').run();
  assert.equal((await f.request('/api/time')).status,503);assert.deepEqual(f.assets,[]);
  assert.equal((await f.DB.prepare('SELECT COUNT(*) n FROM sessions').first()).n,0);
}));

test('production staff pages and APIs reject missing, forged, expired and staging-audience Access tokens',()=>using(async f=>{
  const paths=['/staff','/staff/','/staff/index.html','/staff/assets/staff.js','/staff/assets/staff-ui.js','/staff/assets/nye.css','/staff/api/me','/api/staff/me'];
  const good=await f.token(),parts=good.split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);
  for(const jwt of [undefined,parts.join('.'),await f.token({aud:['staging-staff-application']}),await f.token({exp:Date.now()/1000-1}),await f.token({sub:'unassigned',email:'tester@example.invalid'})])for(const path of paths)assert.equal((await f.request(path,{jwt})).status,401,path);
  assert.deepEqual(f.assets,[]);
}));

test('production signed staff identity uses exactly its backend-fixed station and protected browser paths',()=>using(async f=>{
  const fw=await f.token(),wb=await f.token({sub:'station-wb',email:'wb@example.invalid'});
  for(const [jwt,location] of [[fw,'fort-worth'],[wb,'willow-bend']]) {
    for(const path of ['/staff/api/me','/api/staff/me']) {
      const r=await f.request(path,{jwt});assert.equal(r.status,200);assert.equal(r.data.location,location);assert.deepEqual(r.data.locations,[location]);assert.equal(r.data.mode,'live');
    }
    assert.equal((await f.request('/staff/',{jwt})).status,200);assert.equal(f.assets.at(-1),'/staff/index.html');
    assert.equal((await f.request('/staff/assets/staff.js',{jwt})).status,200);assert.equal(f.assets.at(-1),'/assets/staff.js');
    assert.equal((await f.request('/staff/assets/staff-ui.js',{jwt})).status,200);assert.equal(f.assets.at(-1),'/assets/staff-ui.js');
    const css=await f.request('/staff/assets/nye.css',{jwt});assert.equal(css.status,200);assert.equal(f.assets.at(-1),'/assets/nye.css');assert.match(css.headers.get('content-security-policy'),/frame-ancestors 'none'/);
    const wrong=location==='fort-worth'?'willow-bend':'fort-worth';
    assert.equal((await f.request('/staff/api/verify',{jwt,method:'POST',body:{code:'12345',location:wrong}})).status,403);
  }
  await f.DB.prepare('INSERT INTO staff_locations(subject,location) VALUES(?,?)').bind('station-fw','willow-bend').run();
  assert.equal((await f.request('/staff/',{jwt:fw})).status,403);assert.equal((await f.request('/staff/api/me',{jwt:fw})).status,403);
  await f.DB.prepare('UPDATE staff_users SET active=0 WHERE subject=?').bind('station-wb').run();
  assert.equal((await f.request('/staff/api/me',{jwt:wb})).status,401);
}));

test('production ignores artificial clock configuration, query strings, headers and request-body time claims',()=>using(async f=>{
  Object.assign(f.env,{STAGING_ENABLED:'true',STAGING_TESTER_EMAILS:'nobody@example.invalid',STAGING_EVENT_ANCHOR_UTC:new Date(EVENT.midnight).toISOString(),STAGING_REAL_ANCHOR_UTC:new Date().toISOString()});
  const before=Date.now(),r=await f.request('/api/time?now='+EVENT.midnight+'&preview=midnight&simulation=1',{headers:{'X-Lab-Control':'midnight','X-Runtime-Test-Now':String(EVENT.midnight)}}),after=Date.now();
  assert.equal(r.status,200);assert.ok(r.data.serverNow>=before&&r.data.serverNow<=after);assert.equal(r.data.phase,phaseAt(r.data.serverNow));assert.equal(r.data.mode,'live');
  assert.equal((await f.request('/__lab/time',{method:'POST',body:{now:EVENT.midnight}})).status,404);
  const register=await f.request('/api/register',{method:'POST',body:{firstName:'Jamie',now:EVENT.midnight,eligible:true}});assert.equal(register.status,401);
  assert.equal((await f.DB.prepare('SELECT COUNT(*) n FROM passes').first()).n,0);
}));

test('production pass recovery uses only the existing secure browser session, never names or five-digit bearer codes',()=>using(async f=>{
  // Seed one isolated local fixture directly; the Worker clock remains real.
  const raw='a'.repeat(64),now=Date.now();
  await f.DB.prepare('INSERT INTO sessions(id,token_hash,created_ms,expires_ms) VALUES(?,?,?,?)').bind('saved-session',await sha256(raw),now-1000,now+3600000).run();
  await f.DB.prepare('INSERT INTO entries(id,campaign,session_id,first_name,registered_ms,eligible_ms) VALUES(?,?,?,?,?,?)').bind('saved-entry',EVENT.id,'saved-session','Jamie',EVENT.start,EVENT.midnight).run();
  await f.DB.prepare('INSERT INTO passes(id,campaign,entry_id,short_code,issued_ms,expires_ms) VALUES(?,?,?,?,?,?)').bind('saved-pass',EVENT.id,'saved-entry','12345',EVENT.midnight,EVENT.expires).run();
  const recovered=await f.request('/api/state',{headers:{Cookie:'__Host-sb_nye='+raw}});assert.equal(recovered.status,200);assert.equal(recovered.data.pass.code,'12345');assert.equal(recovered.data.mode,'live');assert.equal(recovered.data.pass.simulated,undefined);
  const stranger=await f.request('/api/state?firstName=Jamie&code=12345');assert.equal(stranger.data.pass,null);
  assert.equal((await f.DB.prepare('SELECT COUNT(*) n FROM passes').first()).n,1);
}));

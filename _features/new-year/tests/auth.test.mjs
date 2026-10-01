import test from 'node:test';import assert from 'node:assert/strict';
import {verifyAccess} from '../src/auth.mjs';
import {LocalD1} from '../scripts/sqlite-adapter.mjs';
const now=Date.parse('2027-01-01T06:00:00Z'),issuer='https://sour-boule-test.cloudflareaccess.com';
const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk=await crypto.subtle.exportKey('jwk',keys.publicKey);jwk.kid='test-key';jwk.alg='RS256';jwk.use='sig';
const DB=new LocalD1();await DB.exec('CREATE TABLE staff_users(subject TEXT,email TEXT,active INTEGER)');await DB.prepare('INSERT INTO staff_users VALUES(?,?,?)').bind('staff-123','approved@example.invalid',1).run();
const env={DB,ACCESS_ISSUER:issuer,ACCESS_AUD:'staff-app-audience'};
const enc=o=>Buffer.from(typeof o==='string'?o:JSON.stringify(o)).toString('base64url');
async function token(claims={},header={}){const h=enc({alg:'RS256',kid:'test-key',...header}),p=enc({iss:issuer,aud:['staff-app-audience'],sub:'staff-123',email:'approved@example.invalid',exp:now/1000+60,...claims});const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(h+'.'+p));return h+'.'+p+'.'+Buffer.from(signature).toString('base64url');}
const req=t=>new Request('https://nye.example/api/staff/me',{headers:t?{'Cf-Access-Jwt-Assertion':t}:{}});
const fetcher=async()=>Response.json({keys:[jwk]});
test('45 - valid Access-signed JWT plus active staff role is accepted',async()=>{assert.equal((await verifyAccess(req(await token()),env,now,fetcher)).subject,'staff-123');});
test('46 - missing staff JWT is rejected',async()=>{await assert.rejects(()=>verifyAccess(req(),env,now,fetcher));});
test('47 - expired JWT is rejected',async()=>{await assert.rejects(()=>verifyAccess(req(),env,now,fetcher));await assert.rejects(async()=>verifyAccess(req(await token({exp:now/1000})),env,now,fetcher));});
test('48 - wrong JWT audience is rejected',async()=>{await assert.rejects(async()=>verifyAccess(req(await token({aud:'wrong'})),env,now,fetcher));});
test('49 - wrong JWT issuer is rejected',async()=>{await assert.rejects(async()=>verifyAccess(req(await token({iss:'https://evil.example'})),env,now,fetcher));});
test('50 - forged JWT signature is rejected',async()=>{const t=await token();const parts=t.split('.');parts[2]=(parts[2][0]==='A'?'B':'A')+parts[2].slice(1);await assert.rejects(()=>verifyAccess(req(parts.join('.')),env,now,fetcher));});
test('51 - algorithm downgrade is rejected',async()=>{await assert.rejects(async()=>verifyAccess(req(await token({}, {alg:'none'})),env,now,fetcher));});
test('52 - signed identity without an approved staff role is rejected',async()=>{await assert.rejects(async()=>verifyAccess(req(await token({sub:'stranger'})),env,now,fetcher));});
test('53 - JWT not-before in the future is rejected',async()=>{await assert.rejects(async()=>verifyAccess(req(await token({nbf:now/1000+10})),env,now,fetcher));});
test('54 - missing production issuer / audience fails closed',async()=>{await assert.rejects(async()=>verifyAccess(req(await token()),{...env,ACCESS_AUD:''},now,fetcher));});

test('Access rotation - an unknown key ID refreshes only the pinned issuer JWKS',async()=>{
  const rotated={...jwk,kid:'rotated-key'};const urls=[];
  const signed=await token({}, {kid:'rotated-key',jku:'https://untrusted.example/keys',x5u:'https://untrusted.example/cert'});
  const user=await verifyAccess(req(signed),env,now,async url=>{urls.push(url);return Response.json({keys:[rotated]});});
  assert.equal(user.subject,'staff-123');assert.deepEqual(urls,[issuer+'/cdn-cgi/access/certs']);
});
test('Access rotation - an unavailable JWKS service does not authorize an unknown key',async()=>{
  const signed=await token({}, {kid:'unavailable-key'});
  await assert.rejects(()=>verifyAccess(req(signed),env,now,async()=>new Response(null,{status:503})));
});
test('Access rotation - missing signing key and encryption-only keys fail closed',async()=>{
  const signed=await token({}, {kid:'not-a-signing-key'});
  await assert.rejects(()=>verifyAccess(req(signed),env,now,async()=>Response.json({keys:[]})));
  await assert.rejects(()=>verifyAccess(req(signed),env,now,async()=>Response.json({keys:[{...jwk,kid:'not-a-signing-key',use:'enc'}]})));
});
test('Access rotation - expired key cache cannot hide a JWKS outage',async()=>{
  const signed=await token({exp:now/1000+3600});
  await verifyAccess(req(signed),env,now,fetcher);
  await assert.rejects(()=>verifyAccess(req(signed),env,now+300001,async()=>{throw new Error('JWKS network outage');}));
});
test('Access - a removed identity remains denied with a cached, valid JWT',async()=>{
  await DB.prepare('UPDATE staff_users SET active=0 WHERE subject=?').bind('staff-123').run();
  try {await assert.rejects(async()=>verifyAccess(req(await token()),env,now,fetcher));}
  finally {await DB.prepare('UPDATE staff_users SET active=1 WHERE subject=?').bind('staff-123').run();}
});
test('Access - an email mismatch cannot reuse an approved subject',async()=>{
  await assert.rejects(async()=>verifyAccess(req(await token({email:'another@example.invalid'})),env,now,fetcher));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {LocalD1} from '../scripts/sqlite-adapter.mjs';
import {createApp} from '../src/worker.mjs';
import {EVENT as E,phaseAt,validName,normalizeCode} from '../src/config.mjs';
const schema=readFileSync(new URL('../migrations/0001_initial.sql',import.meta.url),'utf8');
const SECRET='LOCAL-TEST-SECRET-NOT-FOR-DEPLOYMENT-0123456789ABCDEF';
async function fixture(path=':memory:',options={}) {
  const DB=new LocalD1(path);await DB.exec(schema);let time=E.start;
  const env={DB,PASS_SECRET:SECRET,WEBSITE_ORIGINS:'https://thesourboule.com'};
  const staffAuth=async req=>{const subject=req.headers.get('authorization')?.replace('Bearer ','');if(!['staff-a','staff-b'].includes(subject))throw new Error('Staff only');return{subject,email:subject+'@example.invalid'};};
  const app=createApp({clock:()=>time,staffAuth,...options});
  for(const subject of ['staff-a','staff-b']){await DB.prepare('INSERT OR IGNORE INTO staff_users(subject,email) VALUES(?,?)').bind(subject,subject+'@example.invalid').run();await DB.prepare('INSERT OR IGNORE INTO staff_locations(subject,location) VALUES(?,?)').bind(subject,subject==='staff-a'?'fort-worth':'willow-bend').run();}
  for(const loc of ['fort-worth','willow-bend'])await DB.prepare('INSERT OR IGNORE INTO redemption_windows(location,opens_ms,closes_ms,label) VALUES(?,?,?,?)').bind(loc,E.midnight+3600000,E.expires,'TEST-ONLY WINDOW').run();
  async function request(path,{method='GET',body,cookie,staff,origin='https://nye.example',headers={}}={}) {
    const h={origin,...headers};if(body!==undefined)h['content-type']='application/json';if(cookie)h.cookie=cookie;if(staff)h.authorization='Bearer '+staff;
    const req=new Request('https://nye.example'+path,{method,headers:h,body:body!==undefined?JSON.stringify(body):undefined});
    const response=await app.fetch(req,env);const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={text};}return{status:response.status,data,headers:response.headers};
  }
  async function guest(name='Jamie'){const session=await request('/api/session',{method:'POST',body:{}});assert.equal(session.status,200);const cookie=session.headers.get('set-cookie').split(';')[0];const reg=await request('/api/register',{method:'POST',body:{firstName:name},cookie});return{cookie,reg};}
  const presence=(cookie,visible=true)=>request('/api/presence',{method:'POST',body:{visible,view:'countdown'},cookie});
  async function qualified(){time=E.midnight-15000;const g=await guest();await presence(g.cookie);time=E.midnight;const r=await presence(g.cookie);assert.equal(r.status,200);assert.ok(r.data.pass);return{...g,pass:r.data.pass};}
  async function redeem(code,options={}){time=Math.max(time,E.midnight+3600000);return request('/api/staff/redeem',{method:'POST',staff:options.staff||'staff-a',body:{code,location:options.location||'fort-worth',requestId:options.requestId||crypto.randomUUID(),...options.body}});}
  return{DB,env,app,request,guest,presence,qualified,redeem,setTime:t=>time=t,getTime:()=>time,close:()=>DB.close()};
}
async function withFixture(fn){const f=await fixture();try{await fn(f);}finally{f.close();}}

test('01 - Chicago boundaries correspond to the approved local dates',()=>{
  const format=n=>new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',dateStyle:'short',timeStyle:'medium',hour12:false}).format(n);
  assert.match(format(E.start),/12\/31\/26, 23:50:00/);assert.match(format(E.midnight),/1\/1\/27, 00:00:00/);assert.match(format(E.end),/1\/1\/27, 00:05:00/);
});
test('02 - takeover phase boundaries are inclusive/exclusive correctly',()=>{
  assert.equal(phaseAt(E.start-1),'before');assert.equal(phaseAt(E.start),'opening');assert.equal(phaseAt(E.midnight-60001),'opening');assert.equal(phaseAt(E.midnight-60000),'final');assert.equal(phaseAt(E.midnight-1),'final');assert.equal(phaseAt(E.midnight),'midnight');assert.equal(phaseAt(E.end-1),'midnight');assert.equal(phaseAt(E.end),'ended');
});
test('03 - name validation supports Unicode and rejects markup / oversized values',()=>{
  assert.equal(validName('  Jos\u00e9 '),'Jos\u00e9');assert.equal(validName("Anne-Marie"),'Anne-Marie');assert.equal(validName('<script>'),null);assert.equal(validName('A'.repeat(41)),null);assert.equal(validName(''),null);
});
test('04 - registration rejected before opening',()=>withFixture(async f=>{f.setTime(E.start-1);assert.equal((await f.guest()).reg.status,409);}));
test('05 - registration accepted exactly at opening',()=>withFixture(async f=>{f.setTime(E.start);assert.equal((await f.guest()).reg.status,200);}));
test('06 - registration rejected exactly at midnight',()=>withFixture(async f=>{f.setTime(E.midnight);assert.equal((await f.guest()).reg.status,409);}));
test('07 - duplicate entry attempts in one session create one entry',()=>withFixture(async f=>{const g=await f.guest();const rows=await Promise.all(Array.from({length:10},()=>f.request('/api/register',{method:'POST',body:{firstName:'Another'},cookie:g.cookie})));assert.ok(rows.every(r=>r.status===200));assert.equal((await f.DB.prepare('SELECT COUNT(*) AS n FROM entries').first()).n,1);assert.equal(rows[0].data.firstName,'Jamie');}));
test('08 - a name is not an identity; different sessions can have the same name',()=>withFixture(async f=>{await f.guest('Jamie');await f.guest('Jamie');assert.equal((await f.DB.prepare('SELECT COUNT(*) AS n FROM entries').first()).n,2);}));
test('09 - guest cookie is Secure HttpOnly host-only and only its hash is stored',()=>withFixture(async f=>{const r=await f.request('/api/session',{method:'POST',body:{}});const cookie=r.headers.get('set-cookie');assert.match(cookie,/__Host-/);assert.match(cookie,/HttpOnly/);assert.match(cookie,/Secure/);assert.doesNotMatch(cookie,/Domain=/);const stored=await f.DB.prepare('SELECT token_hash FROM sessions').first();assert.notEqual(stored.token_hash,cookie.split('=')[1].split(';')[0]);}));
test('10 - foreign-origin state-changing requests are rejected',()=>withFixture(async f=>{assert.equal((await f.request('/api/session',{method:'POST',body:{},origin:'https://evil.example'})).status,403);}));
test('11 - public time CORS is restricted and responses are not cached',()=>withFixture(async f=>{const r=await f.request('/api/time',{origin:'https://thesourboule.com'});assert.equal(r.headers.get('access-control-allow-origin'),'https://thesourboule.com');assert.match(r.headers.get('cache-control'),/no-store/);const b=await f.request('/api/time',{origin:'https://evil.example'});assert.equal(b.headers.get('access-control-allow-origin'),null);}));
test('12 - changing client timestamps or preview query does not change server time',()=>withFixture(async f=>{const g=await f.guest();const r=await f.request('/api/state?now='+E.midnight+'&preview=midnight',{cookie:g.cookie,headers:{'x-server-time':String(E.midnight)}});assert.equal(r.data.serverNow,E.start);const claim=await f.request('/api/claim',{method:'POST',body:{now:E.midnight,eligible:true},cookie:g.cookie});assert.equal(claim.status,409);}));
test('13 - one fresh pre- and one post-midnight presence issue a pass',()=>withFixture(async f=>{const q=await f.qualified();assert.equal(q.pass.status,'issued');assert.ok(normalizeCode(q.pass.code));assert.equal((await f.DB.prepare('SELECT COUNT(*) AS n FROM passes').first()).n,1);}));
test('14 - exact 30-second prewindow lower bound qualifies',()=>withFixture(async f=>{f.setTime(E.midnight-30000);const g=await f.guest();await f.presence(g.cookie);f.setTime(E.midnight);assert.ok((await f.presence(g.cookie)).data.pass);}));
test('15 - a stale pre-midnight presence does not qualify',()=>withFixture(async f=>{f.setTime(E.midnight-30001);const g=await f.guest();await f.presence(g.cookie);f.setTime(E.midnight);assert.equal((await f.presence(g.cookie)).data.pass,null);}));
test('16 - pre-midnight presence alone cannot issue a pass',()=>withFixture(async f=>{f.setTime(E.midnight-1000);const g=await f.guest();await f.presence(g.cookie);f.setTime(E.midnight+1);assert.equal((await f.request('/api/claim',{method:'POST',body:{},cookie:g.cookie})).status,409);}));
test('17 - post-midnight presence alone cannot issue a pass',()=>withFixture(async f=>{const g=await f.guest();f.setTime(E.midnight);assert.equal((await f.presence(g.cookie)).data.pass,null);}));
test('18 - reconnect at the exact 90-second limit is accepted with fresh pre-evidence',()=>withFixture(async f=>{f.setTime(E.midnight-5000);const g=await f.guest();await f.presence(g.cookie);f.setTime(E.midnight+90000);assert.ok((await f.presence(g.cookie)).data.pass);}));
test('19 - reconnect beyond 90 seconds is rejected',()=>withFixture(async f=>{f.setTime(E.midnight-5000);const g=await f.guest();await f.presence(g.cookie);f.setTime(E.midnight+90001);const r=await f.presence(g.cookie);assert.equal(r.data.accepted,false);assert.equal((await f.DB.prepare('SELECT COUNT(*) AS n FROM passes').first()).n,0);}));
test('20 - observed hidden state before midnight invalidates pre-evidence',()=>withFixture(async f=>{f.setTime(E.midnight-5000);const g=await f.guest();await f.presence(g.cookie);f.setTime(E.midnight-1000);await f.presence(g.cookie,false);f.setTime(E.midnight);assert.equal((await f.presence(g.cookie)).data.pass,null);}));
test('21 - returning visibly before midnight can establish fresh pre-evidence',()=>withFixture(async f=>{f.setTime(E.midnight-5000);const g=await f.guest();await f.presence(g.cookie);await f.presence(g.cookie,false);f.setTime(E.midnight-1000);await f.presence(g.cookie,true);f.setTime(E.midnight);assert.ok((await f.presence(g.cookie)).data.pass);}));
test('22 - hidden post-midnight signal never counts as visible presence',()=>withFixture(async f=>{f.setTime(E.midnight-5000);const g=await f.guest();await f.presence(g.cookie);f.setTime(E.midnight);assert.equal((await f.presence(g.cookie,false)).data.pass,null);}));
test('23 - invalid context and visibility types are rejected',()=>withFixture(async f=>{const g=await f.guest();assert.equal((await f.request('/api/presence',{method:'POST',cookie:g.cookie,body:{view:'menu',visible:true}})).status,400);assert.equal((await f.request('/api/presence',{method:'POST',cookie:g.cookie,body:{view:'countdown',visible:'true'}})).status,400);}));
test('24 - a valid late registrant can qualify',()=>withFixture(async f=>{f.setTime(E.midnight-1);const g=await f.guest();await f.presence(g.cookie);f.setTime(E.midnight);assert.ok((await f.presence(g.cookie)).data.pass);}));
test('25 - 20 simultaneous claims create exactly one stable pass',()=>withFixture(async f=>{const q=await f.qualified();const responses=await Promise.all(Array.from({length:20},()=>f.request('/api/claim',{method:'POST',body:{},cookie:q.cookie})));assert.ok(responses.every(r=>r.status===200&&r.data.pass.code===q.pass.code));assert.equal((await f.DB.prepare('SELECT COUNT(*) AS n FROM passes').first()).n,1);}));
test('26 - an earned pass survives takeover end and browser reload with its session',()=>withFixture(async f=>{const q=await f.qualified();f.setTime(E.end);const state=await f.request('/api/state',{cookie:q.cookie});assert.equal(state.data.pass.code,q.pass.code);assert.equal(state.data.phase,'ended');}));
test('27 - a different anonymous session cannot read another guest pass',()=>withFixture(async f=>{await f.qualified();const r=await f.request('/api/state');assert.equal(r.data.pass,null);assert.equal(r.data.entry,null);}));
test('28 - a server restart retains entries, eligibility and pass issuance',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'nye-test-')),path=join(dir,'state.sqlite');let f=await fixture(path);let q;
  try{q=await f.qualified();f.close();f=await fixture(path);f.setTime(E.end);const r=await f.request('/api/state',{cookie:q.cookie});assert.equal(r.data.pass.code,q.pass.code);assert.equal(r.data.entry.eligible,true);}finally{f.close();rmSync(dir,{recursive:true,force:true});}
});
test('29 - staff endpoints reject anonymous callers',()=>withFixture(async f=>{const q=await f.qualified();f.setTime(E.midnight+3600000);const r=await f.request('/api/staff/verify',{method:'POST',body:{code:q.pass.code}});assert.equal(r.status,401);}));
test('30 - a staff verify does not redeem the pass',()=>withFixture(async f=>{const q=await f.qualified();f.setTime(E.midnight+3600000);const r=await f.request('/api/staff/verify',{method:'POST',staff:'staff-a',body:{code:q.pass.code}});assert.equal(r.data.status,'valid');assert.equal((await f.DB.prepare('SELECT redeemed_ms FROM passes').first()).redeemed_ms,null);}));
test('31 - valid pass redeems with no purchase data or confirmation',()=>withFixture(async f=>{const q=await f.qualified();const r=await f.redeem(q.pass.code);assert.equal(r.status,200);assert.equal(r.data.status,'redeemed_now');}));
test('32 - redemption requires an authorized location',()=>withFixture(async f=>{const q=await f.qualified();await f.DB.prepare('DELETE FROM staff_locations WHERE subject=? AND location=?').bind('staff-a','willow-bend').run();assert.equal((await f.redeem(q.pass.code,{location:'willow-bend'})).status,403);}));
test('33 - no configured opening window fails closed',()=>withFixture(async f=>{const q=await f.qualified();await f.DB.prepare('DELETE FROM redemption_windows').run();const r=await f.redeem(q.pass.code);assert.equal(r.status,409);assert.equal(r.data.status,'outside_hours');}));
test('34 - redemption at exact opening boundary is allowed',()=>withFixture(async f=>{const q=await f.qualified();const r=await f.redeem(q.pass.code);assert.equal(r.data.status,'redeemed_now');}));
test('35 - redemption at exact closing boundary is rejected',()=>withFixture(async f=>{const q=await f.qualified();const close=E.midnight+7200000;await f.DB.prepare('UPDATE redemption_windows SET closes_ms=?').bind(close).run();f.setTime(close);const r=await f.redeem(q.pass.code);assert.equal(r.data.status,'outside_hours');}));
test('36 - simultaneous attempts at both locations have exactly one winner',()=>withFixture(async f=>{const q=await f.qualified();const responses=await Promise.all(Array.from({length:10},(_,i)=>f.redeem(q.pass.code,{staff:i%2?'staff-a':'staff-b',location:i%2?'fort-worth':'willow-bend'})));assert.equal(responses.filter(r=>r.data.status==='redeemed_now').length,1);assert.equal(responses.filter(r=>r.status===409).length,9);assert.equal((await f.DB.prepare('SELECT COUNT(*) AS n FROM redemption_audit').first()).n,1);}));
test('37 - lost-response retry returns prior success without a second redemption',()=>withFixture(async f=>{const q=await f.qualified(),id=crypto.randomUUID();const a=await f.redeem(q.pass.code,{requestId:id});const b=await f.redeem(q.pass.code,{requestId:id});assert.equal(a.data.status,'redeemed_now');assert.equal(b.data.status,'already_confirmed');assert.equal((await f.DB.prepare('SELECT COUNT(*) AS n FROM redemption_audit').first()).n,1);}));
test('38 - a second location sees that the pass is already redeemed',()=>withFixture(async f=>{const q=await f.qualified();await f.redeem(q.pass.code);const r=await f.request('/api/staff/verify',{method:'POST',staff:'staff-b',body:{code:q.pass.code}});assert.equal(r.data.status,'redeemed');assert.equal(r.data.location,'fort-worth');}));
test('39 - pass expires exactly when Jan 3 ends in Chicago',()=>withFixture(async f=>{const q=await f.qualified();f.setTime(E.expires);const r=await f.redeem(q.pass.code);assert.equal(r.status,410);assert.equal(r.data.status,'expired');assert.equal((await f.request('/api/state',{cookie:q.cookie})).data.pass.status,'expired');}));
test('40 - redeemed pass cannot be restored, and audit cannot be edited',()=>withFixture(async f=>{const q=await f.qualified();await f.redeem(q.pass.code);await assert.rejects(()=>f.DB.prepare('UPDATE passes SET redeemed_ms=NULL').run());await assert.rejects(()=>f.DB.prepare('DELETE FROM redemption_audit').run());}));
test('41 - service configuration missing fails closed',()=>withFixture(async f=>{delete f.env.PASS_SECRET;const r=await f.request('/api/state');assert.equal(r.status,503);assert.match(r.data.error,/unavailable/);}));
test('42 - session rate limiting is enforced',()=>withFixture(async f=>{const results=[];for(let i=0;i<31;i++)results.push(await f.request('/api/session',{method:'POST',body:{}}));assert.equal(results.at(-1).status,429);}));
test('43 - invalid / fabricated pass codes cannot redeem',()=>withFixture(async f=>{await f.qualified();const r=await f.redeem('DEMO-2027-NOT-VALID');assert.equal(r.status,400);}));
test('44 - production entrypoint has no query-controlled clock or local routes',()=>{const s=readFileSync(new URL('../src/worker.mjs',import.meta.url),'utf8');assert.match(s,/export default createApp\(\)/);assert.doesNotMatch(s,/__lab|x-lab-control/i);});

// v2 regression coverage: short codes and location-assigned shared staff phones.
import { issuePass } from '../src/passes.mjs';
import { randomPassCode } from '../src/crypto.mjs';
async function anotherEligibleEntry(f) {
  const id=crypto.randomUUID(),sid=crypto.randomUUID();
  await f.DB.prepare('INSERT INTO sessions(id,token_hash,created_ms,expires_ms) VALUES(?,?,?,?)').bind(sid,crypto.randomUUID(),E.start,E.sessionExpires).run();
  await f.DB.prepare('INSERT INTO entries(id,campaign,session_id,first_name,registered_ms,eligible_ms) VALUES(?,?,?,?,?,?)').bind(id,E.id,sid,'Other guest',E.start,E.midnight).run();
  return f.DB.prepare('SELECT * FROM entries WHERE id=?').bind(id).first();
}
test('v2 - five-digit codes are exact strings; demo range and malformed values rejected',()=>{
  for(const value of ['00000','04271','1234','123456','12e45','12-34','1 234',12345,null])assert.equal(normalizeCode(value),null);
  assert.equal(normalizeCode(' 48271 '),'48271');assert.equal(normalizeCode('10000'),'10000');assert.equal(normalizeCode('99999'),'99999');
});
test('v2 - generated codes stay in the 90000-code production range',()=>{
  for(let i=0;i<2000;i++)assert.match(randomPassCode(),/^[1-9][0-9]{4}$/);
});
test('v2 - stored short code is stable and no long code is returned to guest',()=>withFixture(async f=>{
  const q=await f.qualified(),row=await f.DB.prepare('SELECT * FROM passes').first();assert.equal(row.short_code,q.pass.code);assert.match(q.pass.code,/^[1-9][0-9]{4}$/);assert.ok(row.id.length>5);
  const state=(await f.request('/api/state',{cookie:q.cookie})).data;assert.equal(state.pass.code,q.pass.code);
}));
test('v2 - collision with a different pass retries without stealing its code',()=>withFixture(async f=>{
  const q=await f.qualified(),entry=await anotherEligibleEntry(f),other=q.pass.code==='10000'?'10001':'10000';let attempts=0;
  const code=await issuePass(f.env,entry,E.midnight,()=>attempts++===0?q.pass.code:other);
  assert.equal(code,other);assert.equal(attempts,2);assert.equal((await f.DB.prepare('SELECT COUNT(*) n FROM passes').first()).n,2);
}));
test('v2 - repeated collisions use the atomic free-gap fallback',()=>withFixture(async f=>{
  const q=await f.qualified(),entry=await anotherEligibleEntry(f);let attempts=0;
  const code=await issuePass(f.env,entry,E.midnight,()=>{attempts++;return q.pass.code;});
  assert.equal(attempts,12);assert.notEqual(code,q.pass.code);assert.match(code,/^[1-9][0-9]{4}$/);
  assert.equal(await issuePass(f.env,entry,E.midnight,()=>{throw Error('Must reuse persisted code');}),code);
}));
test('v2 - redeemed codes are not recycled for another guest',()=>withFixture(async f=>{
  const q=await f.qualified();await f.redeem(q.pass.code);const entry=await anotherEligibleEntry(f);
  const code=await issuePass(f.env,entry,E.midnight+3600000,()=>q.pass.code);assert.notEqual(code,q.pass.code);
}));
test('v2 - database unique constraint rejects a duplicate five-digit code',()=>withFixture(async f=>{
  const q=await f.qualified(),entry=await anotherEligibleEntry(f);
  await assert.rejects(()=>f.DB.prepare('INSERT INTO passes(id,campaign,entry_id,short_code,issued_ms,expires_ms) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),E.id,entry.id,q.pass.code,E.midnight,E.expires).run());
}));
test('v2 - five-digit code alone does not authenticate a guest or staff lookup',()=>withFixture(async f=>{
  const q=await f.qualified();const state=await f.request('/api/state?code='+q.pass.code);assert.equal(state.data.pass,null);
  assert.equal((await f.request('/api/staff/verify',{method:'POST',body:{code:q.pass.code}})).status,401);
}));
test('v2 - each station reports its server-assigned location; ambiguous assignments fail closed',()=>withFixture(async f=>{
  assert.equal((await f.request('/api/staff/me',{staff:'staff-a'})).data.location,'fort-worth');
  assert.equal((await f.request('/api/staff/me',{staff:'staff-b'})).data.location,'willow-bend');
  await f.DB.prepare('INSERT INTO staff_locations(subject,location) VALUES(?,?)').bind('staff-a','willow-bend').run();
  assert.equal((await f.request('/api/staff/me',{staff:'staff-a'})).status,403);
}));
test('v2 - redemption needs no client-selected location and records the assigned station',()=>withFixture(async f=>{
  const q=await f.qualified();f.setTime(E.midnight+3600000);
  const r=await f.request('/api/staff/redeem',{method:'POST',staff:'staff-b',body:{code:q.pass.code,requestId:crypto.randomUUID()}});
  assert.equal(r.data.status,'redeemed_now');assert.equal(r.data.location,'willow-bend');
}));
test('v2 - verification outside operating hours does not offer a usable pass',()=>withFixture(async f=>{
  const q=await f.qualified();const r=await f.request('/api/staff/verify',{method:'POST',staff:'staff-a',body:{code:q.pass.code}});
  assert.equal(r.data.status,'outside_hours');
}));
test('v2 - repeated wrong codes temporarily stop authenticated guessing',()=>withFixture(async f=>{
  f.setTime(E.midnight+3600000);
  for(let i=0;i<8;i++)assert.equal((await f.request('/api/staff/verify',{method:'POST',staff:'staff-a',body:{code:'55555'}})).status,404);
  assert.equal((await f.request('/api/staff/verify',{method:'POST',staff:'staff-a',body:{code:'55555'}})).status,429);
  f.setTime(E.midnight+3660000);assert.equal((await f.request('/api/staff/verify',{method:'POST',staff:'staff-a',body:{code:'55555'}})).status,404);
}));

// Revision 4: old purchase fields do not create a requirement or bypass validity.
test('57 - retired false purchase flag does not block a valid free cookie',()=>withFixture(async f=>{const q=await f.qualified();const r=await f.redeem(q.pass.code,{body:{purchaseConfirmed:false}});assert.equal(r.status,200);assert.equal(r.data.status,'redeemed_now');}));
test('58 - retired true purchase flag cannot bypass expiration',()=>withFixture(async f=>{const q=await f.qualified();f.setTime(E.expires);const r=await f.redeem(q.pass.code,{body:{purchaseConfirmed:true}});assert.equal(r.status,410);assert.equal(r.data.status,'expired');}));

// Implementation reconciliation: actual race/receipt regressions, not cloud claims.
function deferred() {
  let resolve; const promise = new Promise(r => { resolve = r; });
  return {promise, resolve};
}
async function delayNextPresenceBatch(f, runLater) {
  const entered = deferred(), release = deferred(), batch = f.DB.batch.bind(f.DB);
  let delayed = false;
  f.DB.batch = async statements => {
    if (!delayed) { delayed = true; entered.resolve(); await release.promise; }
    return batch(statements);
  };
  const pending = runLater();
  await entered.promise;
  return {pending, release: release.resolve};
}
function beforeNextRedemptionWrite(f, mutate) {
  const prepare = f.DB.prepare.bind(f.DB); let used = false;
  f.DB.prepare = sql => {
    const statement = prepare(sql);
    if (!used && sql.startsWith('UPDATE passes SET redeemed_ms=')) {
      used = true;
      const first = statement.first.bind(statement);
      statement.first = async () => { await mutate(); return first(); };
    }
    return statement;
  };
}
async function delayedJSON(f,path,body,{cookie,staff}={}) {
  const started = deferred(); let controller;
  const stream = new ReadableStream({start(c) {controller=c;},pull() {started.resolve();}});
  const headers = {'Origin':'https://nye.example','Content-Type':'application/json'};
  if (cookie) headers.Cookie = cookie;
  if (staff) headers.Authorization = 'Bearer '+staff;
  const request = new Request('https://nye.example'+path,{method:'POST',headers,body:stream,duplex:'half'});
  const pending = f.app.fetch(request,f.env);
  await started.promise;
  return {pending,send() {controller.enqueue(new TextEncoder().encode(JSON.stringify(body)));controller.close();}};
}

test('receipt - a registration body arriving at midnight cannot backdate entry',()=>withFixture(async f=>{
  f.setTime(E.midnight-1);
  const session=await f.request('/api/session',{method:'POST',body:{}});
  const cookie=session.headers.get('set-cookie').split(';')[0];
  const delayed=await delayedJSON(f,'/api/register',{firstName:'Jamie'},{cookie});
  f.setTime(E.midnight);delayed.send();
  assert.equal((await delayed.pending).status,409);
  assert.equal((await f.DB.prepare('SELECT COUNT(*) n FROM entries').first()).n,0);
}));
test('receipt - a delayed heartbeat body cannot fabricate a pre-midnight observation',()=>withFixture(async f=>{
  f.setTime(E.midnight-1000);const g=await f.guest();
  const delayed=await delayedJSON(f,'/api/presence',{visible:true,view:'countdown'},{cookie:g.cookie});
  f.setTime(E.midnight);delayed.send();
  const r=await (await delayed.pending).json();assert.equal(r.pass,null);
  const entry=await f.DB.prepare('SELECT pre_ms,eligible_ms FROM entries').first();
  assert.equal(entry.pre_ms,null);assert.equal(entry.eligible_ms,null);
}));
test('receipt - a delayed redeem body arriving at closing cannot use an old request timestamp',()=>withFixture(async f=>{
  const q=await f.qualified();const close=E.midnight+7200000;
  await f.DB.prepare('UPDATE redemption_windows SET closes_ms=?').bind(close).run();
  f.setTime(close-1);
  const delayed=await delayedJSON(f,'/api/staff/redeem',{code:q.pass.code,requestId:crypto.randomUUID()},{staff:'staff-a'});
  f.setTime(close);delayed.send();
  assert.equal((await (await delayed.pending).json()).status,'outside_hours');
  assert.equal((await f.DB.prepare('SELECT COUNT(*) n FROM redemption_audit').first()).n,0);
}));
test('presence - an older visible write cannot overwrite a newer hidden observation',()=>withFixture(async f=>{
  f.setTime(E.midnight-15000);const g=await f.guest();
  const delayed=await delayNextPresenceBatch(f,()=>f.presence(g.cookie));
  f.setTime(E.midnight-10000);await f.presence(g.cookie,false);
  delayed.release();await delayed.pending;
  f.setTime(E.midnight);assert.equal((await f.presence(g.cookie)).data.pass,null);
}));
test('presence - an older hidden write cannot erase a newer visible return',()=>withFixture(async f=>{
  f.setTime(E.midnight-15000);const g=await f.guest();
  const delayed=await delayNextPresenceBatch(f,()=>f.presence(g.cookie,false));
  f.setTime(E.midnight-10000);await f.presence(g.cookie);
  delayed.release();await delayed.pending;
  f.setTime(E.midnight);assert.ok((await f.presence(g.cookie)).data.pass);
}));
test('presence - same-millisecond hidden evidence wins conservatively regardless of write order',()=>withFixture(async f=>{
  f.setTime(E.midnight-1000);const g=await f.guest();await f.presence(g.cookie,false);await f.presence(g.cookie,true);
  f.setTime(E.midnight);assert.equal((await f.presence(g.cookie)).data.pass,null);
}));
for (const [label,mutate] of [
  ['revoked identity',f=>f.DB.prepare('UPDATE staff_users SET active=0 WHERE subject=?').bind('staff-a').run()],
  ['changed station',f=>f.DB.prepare('UPDATE staff_locations SET location=? WHERE subject=?').bind('willow-bend','staff-a').run()],
  ['ambiguous station',f=>f.DB.prepare('INSERT INTO staff_locations(subject,location) VALUES(?,?)').bind('staff-a','willow-bend').run()]
]) test('atomic authorization - '+label+' during redemption fails closed',()=>withFixture(async f=>{
  const q=await f.qualified();beforeNextRedemptionWrite(f,()=>mutate(f));
  const result=await f.redeem(q.pass.code);
  assert.equal(result.status,403);
  assert.equal((await f.DB.prepare('SELECT redeemed_ms FROM passes').first()).redeemed_ms,null);
  assert.equal((await f.DB.prepare('SELECT COUNT(*) n FROM redemption_audit').first()).n,0);
}));
test('issuance - simultaneous first claims all recover the same one persisted code',()=>withFixture(async f=>{
  const entry=await anotherEligibleEntry(f);
  const codes=await Promise.all(Array.from({length:20},()=>issuePass(f.env,entry,E.midnight)));
  assert.equal(new Set(codes).size,1);
  assert.equal((await f.DB.prepare('SELECT COUNT(*) n FROM passes').first()).n,1);
}));
test('issuance - exhausted 90000-code capacity preserves eligibility and fails closed',()=>withFixture(async f=>{
  const entry=await anotherEligibleEntry(f);
  await f.DB.exec(`
    CREATE TEMP TABLE capacity_codes(n INTEGER);
    WITH RECURSIVE series(n) AS (VALUES(10000) UNION ALL SELECT n+1 FROM series WHERE n<99999)
    INSERT INTO capacity_codes SELECT n FROM series;
    INSERT INTO sessions(id,token_hash,created_ms,expires_ms)
      SELECT 'capacity-session-'||n,'capacity-token-'||n,${E.start},${E.sessionExpires} FROM capacity_codes;
    INSERT INTO entries(id,campaign,session_id,first_name,registered_ms,eligible_ms)
      SELECT 'capacity-entry-'||n,'${E.id}','capacity-session-'||n,'Test guest',${E.start},${E.midnight} FROM capacity_codes;
    INSERT INTO passes(id,campaign,entry_id,short_code,issued_ms,expires_ms)
      SELECT 'capacity-pass-'||n,'${E.id}','capacity-entry-'||n,CAST(n AS TEXT),${E.midnight},${E.expires} FROM capacity_codes;
    DROP TABLE capacity_codes;
  `);
  await assert.rejects(()=>issuePass(f.env,entry,E.midnight,()=> '10000'),error=>error.status===503);
  assert.equal((await f.DB.prepare('SELECT eligible_ms FROM entries WHERE id=?').bind(entry.id).first()).eligible_ms,E.midnight);
  assert.equal((await f.DB.prepare('SELECT COUNT(*) n FROM passes').first()).n,90000);
  assert.equal(await f.DB.prepare('SELECT short_code FROM passes WHERE entry_id=?').bind(entry.id).first(),null);
}));
test('issuance - persisted eligibility survives an issuance failure and process restart',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'nye-recovery-')),path=join(dir,'state.sqlite');let f=await fixture(path);
  try {
    f.setTime(E.midnight-1000);const g=await f.guest();await f.presence(g.cookie);
    const prepare=f.DB.prepare.bind(f.DB);let failOnce=true;
    f.DB.prepare=sql=>{if(failOnce&&sql.includes('INSERT INTO passes')){failOnce=false;throw new Error('Simulated storage outage');}return prepare(sql);};
    f.setTime(E.midnight);assert.equal((await f.presence(g.cookie)).status,503);
    assert.equal((await f.DB.prepare('SELECT COUNT(*) n FROM passes').first()).n,0);
    f.close();f=await fixture(path);f.setTime(E.end);
    const recovered=await f.request('/api/state',{cookie:g.cookie});assert.equal(recovered.data.entry.eligible,true);assert.ok(recovered.data.pass);
    assert.equal((await f.request('/api/state',{cookie:g.cookie})).data.pass.code,recovered.data.pass.code);
  } finally {f.close();rmSync(dir,{recursive:true,force:true});}
});
test('local lab - loopback cookie is separate and never changes production cookie rules',async()=>{
  const f=await fixture(':memory:',{lab:true});
  try {
    const g=await f.guest();assert.match(g.cookie,/^sb_nye_lab=/);assert.equal(g.reg.status,200);
    const response=await f.request('/api/session',{method:'POST',body:{}});
    assert.match(response.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);
    assert.doesNotMatch(response.headers.get('set-cookie'),/Secure|__Host-/);
    const production=createApp();
    const state=await production.fetch(new Request('https://nye.example/api/state',{headers:{Cookie:g.cookie}}),f.env);
    assert.equal((await state.json()).entry,null);
  } finally {f.close();}
});
test('local lab - iframe ancestors permit configured loopback hosts only; production stays pinned',async()=>{
  const f=await fixture(':memory:',{lab:true});
  try {
    f.env.ASSETS={fetch:async()=>new Response('<p>Local fixture</p>')};
    f.env.WEBSITE_ORIGINS='http://127.0.0.1:8787,http://127.0.0.1:8788,https://evil.example';
    const request=new Request('http://127.0.0.1:8787/');
    const local=await f.app.fetch(request,f.env);
    assert.match(local.headers.get('content-security-policy'),/frame-ancestors http:\/\/127\.0\.0\.1:8787 http:\/\/127\.0\.0\.1:8788;/);
    assert.doesNotMatch(local.headers.get('content-security-policy'),/evil\.example/);
    const production=await createApp().fetch(request,f.env);
    assert.match(production.headers.get('content-security-policy'),/frame-ancestors https:\/\/thesourboule\.com https:\/\/www\.thesourboule\.com;/);
    assert.doesNotMatch(production.headers.get('content-security-policy'),/127\.0\.0\.1/);
  } finally {f.close();}
});

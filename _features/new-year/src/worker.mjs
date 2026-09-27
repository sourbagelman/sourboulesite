import { EVENT, phaseAt, validName, normalizeCode, displayCode } from './config.mjs';
import { sha256, randomToken } from './crypto.mjs';
import { issuePass as issue } from './passes.mjs';
import { verifyAccess } from './auth.mjs';
const COOKIE = '__Host-sb_nye';
function fail(status, message) { throw Object.assign(new Error(message), {status}); }
function cookie(request, name) { return request.headers.get('cookie')?.split(';').map(s=>s.trim()).find(s=>s.startsWith(name+'='))?.slice(name.length+1); }
const safe = {'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin'};
function json(data,status=200,extra={}) { return Response.json(data,{status,headers:{...safe,...extra}}); }
async function bodyOf(request) {
  if (!(request.headers.get('content-type') || '').startsWith('application/json')) fail(415,'JSON required');
  if (Number(request.headers.get('content-length') || 0) > 2048) fail(413,'Request too large');
  const reader=request.body?.getReader();let total=0,text='';const decoder=new TextDecoder();
  if(reader){while(true){const chunk=await reader.read();if(chunk.done)break;total+=chunk.value.byteLength;if(total>2048){await reader.cancel();fail(413,'Request too large');}text+=decoder.decode(chunk.value,{stream:true});}text+=decoder.decode();}
  try { const obj = JSON.parse(text); if (!obj || Array.isArray(obj) || typeof obj !== 'object') fail(400,'Invalid request'); return obj; }
  catch { fail(400,'Invalid JSON'); }
}
async function rate(db,key,now,limit) {
  const bucket = key + ':' + Math.floor(now / 60000);
  const row = await db.prepare('INSERT INTO rate_limits(bucket_key,count,expires_ms) VALUES(?,1,?) ON CONFLICT(bucket_key) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,now+120000).first();
  if (row.count > limit) fail(429,'Too many attempts. Please wait a minute.');
}
async function currentSession(request,env,now,cookieName) {
  const token = cookie(request,cookieName);
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  return env.DB.prepare('SELECT * FROM sessions WHERE token_hash=? AND expires_ms>?').bind(await sha256(token),now).first();
}
async function currentEntry(env,session) {
  return session ? env.DB.prepare('SELECT * FROM entries WHERE campaign=? AND session_id=?').bind(EVENT.id,session.id).first() : null;
}
async function passFor(env,entry,now) {
  if (!entry) return null;
  const p = await env.DB.prepare('SELECT * FROM passes WHERE entry_id=?').bind(entry.id).first();
  if (!p) return null;
  return {code:displayCode(p.short_code),firstName:entry.first_name,
    issuedAt:p.issued_ms,expiresAt:p.expires_ms,
    status:p.redeemed_ms != null?'redeemed':now>=p.expires_ms?'expired':'issued',
    redeemedAt:p.redeemed_ms,location:p.redeemed_location};
}
export function createApp({clock = () => Date.now(), staffAuth = verifyAccess, lab = false} = {}) {
  // The loopback harness has its own cookie namespace. Production always uses
  // the Secure, host-only cookie; no request parameter can select lab mode.
  const cookieName = lab ? 'sb_nye_lab' : COOKIE;
  return {async fetch(request,env) {
    const url = new URL(request.url), path = url.pathname;
    let now = clock(); // Authoritative SERVER clock. No query/body/header can override it.
    const allowed = new Set((env.WEBSITE_ORIGINS || 'https://thesourboule.com,https://www.thesourboule.com').split(',').map(value=>value.trim()));
    const labFrames = lab ? [...allowed].filter(value=>/^http:\/\/(?:127\.0\.0\.1|localhost|\[::1\])(?::[0-9]{1,5})?$/.test(value)) : [];
    const frameAncestors = lab ? labFrames.join(' ') || "'none'" : 'https://thesourboule.com https://www.thesourboule.com';
    const origin = request.headers.get('origin');
    const publicTime = path === '/api/time';
    try {
      if (request.method === 'OPTIONS' && publicTime && allowed.has(origin))
        return new Response(null,{status:204,headers:{...safe,'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET'}});
      // Guest and staff operations must be same-origin with the celebration service.
      if (path.startsWith('/api/') && request.method !== 'GET' && origin !== url.origin) fail(403,'Origin not allowed');
      if (publicTime && request.method === 'GET') return json({serverNow:now,event:EVENT,phase:phaseAt(now),mode:lab?'local-lab':'live'},200,
        allowed.has(origin)?{'Access-Control-Allow-Origin':origin}:{});
      if (!path.startsWith('/api/')) {
        if (path.startsWith('/staff')) await staffAuth(request,env,now);
        if (!env.ASSETS) return new Response('Not found',{status:404});
        const response = await env.ASSETS.fetch(request);
        const headers = new Headers(response.headers);
        Object.entries(safe).forEach(([k,v])=>headers.set(k,v));
        headers.set('X-Robots-Tag','noindex, nofollow');
        headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors "+frameAncestors+"; worker-src 'none'");
        return new Response(response.body,{status:response.status,headers});
      }
      if (!env.DB || !env.PASS_SECRET || env.PASS_SECRET.length < 32) fail(503,'Rewards are unavailable. No pass has been issued.');
      if (path.startsWith('/api/staff/')) {
        let body;
        if (request.method === 'POST') {
          body = await bodyOf(request);
          now = clock(); // Authenticate and check expiry after full request receipt.
        }
        let staff; try { staff = await staffAuth(request,env,now); } catch { fail(401,'Staff sign-in required or access unavailable'); }
        await rate(env.DB,'staff:'+staff.subject,now,120);
        const assignments = await env.DB.prepare('SELECT location FROM staff_locations WHERE subject=?').bind(staff.subject).all();
        if (assignments.results.length !== 1) fail(403,'Ask a manager to assign this staff phone to exactly one location');
        const station = assignments.results[0].location;
        if (path === '/api/staff/me' && request.method === 'GET')
          return json({email:staff.email,location:station,locations:[station],mode:lab?'local-lab':'live'});
        if (request.method !== 'POST') fail(405,'POST required');
        const code = normalizeCode(body.code);
        if (path !== '/api/staff/verify' && path !== '/api/staff/redeem') fail(404,'Not found');
        if (body.location && body.location !== station) fail(403,'This phone is assigned to another location');
        const missKey = 'staff-misses:'+staff.subject;
        const misses = await env.DB.prepare('SELECT count FROM rate_limits WHERE bucket_key=?').bind(missKey+':'+Math.floor(now/60000)).first();
        if ((misses?.count || 0) >= 8) fail(429,'Too many incorrect codes. Wait a minute and try again.');
        if (!code) { await rate(env.DB,missKey,now,8); fail(400,'Enter a five-digit code from a real cookie pass'); }
        await rate(env.DB,'staff-codes:'+staff.subject,now,60);
        const p = await env.DB.prepare('SELECT p.*,e.first_name FROM passes p JOIN entries e ON e.id=p.entry_id WHERE p.campaign=? AND p.short_code=?').bind(EVENT.id,code).first();
        if (!p) { await rate(env.DB,missKey,now,8); return json({status:'not_found'},404); }
        const status = p.redeemed_ms != null ? 'redeemed' : now >= p.expires_ms ? 'expired' : 'valid';
        if (path === '/api/staff/verify') {
          const open = await env.DB.prepare('SELECT 1 AS ok FROM redemption_windows WHERE location=? AND opens_ms<=? AND closes_ms>?').bind(station,now,now).first();
          return json({status:status==='valid'&&!open?'outside_hours':status,firstName:p.first_name,expiresAt:p.expires_ms,redeemedAt:p.redeemed_ms,location:p.redeemed_location,stationLocation:station});
        }
        if (path !== '/api/staff/redeem') fail(404,'Not found');

        // No purchase required. Authentication, pass validity and atomic redemption still apply.
        if (typeof body.requestId !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.requestId)) fail(400,'Valid request ID required');
        if (p.redeemed_ms != null) {
          if (p.redemption_key===body.requestId && p.redeemed_by===staff.subject && p.redeemed_location===station)
            return json({status:'already_confirmed',redeemedAt:p.redeemed_ms,location:p.redeemed_location,message:'Previously recorded. Do not hand out another cookie.'});
          return json({status:'redeemed',redeemedAt:p.redeemed_ms,location:p.redeemed_location},409);
        }
        if (status==='expired') return json({status:'expired'},410);
        // ONE conditional database write is the source of truth, NOT the prior verify.
        // The audit trigger commits in the same transaction. A parallel cashier loses.
        const changed = await env.DB.prepare(`UPDATE passes SET redeemed_ms=?,redeemed_location=?,redeemed_by=?,redemption_key=?
          WHERE id=? AND redeemed_ms IS NULL AND issued_ms<=? AND expires_ms>?
          AND EXISTS(SELECT 1 FROM redemption_windows WHERE location=? AND opens_ms<=? AND closes_ms>?)
          AND EXISTS(SELECT 1 FROM staff_users WHERE subject=? AND email=? AND active=1)
          AND (SELECT COUNT(*) FROM staff_locations WHERE subject=?)=1
          AND EXISTS(SELECT 1 FROM staff_locations WHERE subject=? AND location=?) RETURNING id`)
          .bind(now,station,staff.subject,body.requestId,p.id,now,now,station,now,now,staff.subject,staff.email,staff.subject,staff.subject,station).first();
        if (!changed) {
          const stillAuthorized = await env.DB.prepare(`SELECT 1 AS ok FROM staff_users
            WHERE subject=? AND email=? AND active=1
            AND (SELECT COUNT(*) FROM staff_locations WHERE subject=?)=1
            AND EXISTS(SELECT 1 FROM staff_locations WHERE subject=? AND location=?)`)
            .bind(staff.subject,staff.email,staff.subject,staff.subject,station).first();
          if (!stillAuthorized) fail(403,'Staff station authorization changed. Ask a manager to sign in again.');
          const fresh = await env.DB.prepare('SELECT redeemed_ms,redeemed_location,redemption_key,redeemed_by FROM passes WHERE id=?').bind(p.id).first();
          if (fresh?.redeemed_ms != null && fresh.redemption_key===body.requestId && fresh.redeemed_by===staff.subject && fresh.redeemed_location===station)
            return json({status:'already_confirmed',message:'Previously recorded. Do not hand out another cookie.'});
          return json({status:fresh?.redeemed_ms!=null?'redeemed':'outside_hours',location:fresh?.redeemed_location},409);
        }
        return json({status:'redeemed_now',redeemedAt:now,location:station,message:'Redemption recorded. Give one cookie.'});
      }
      let session = await currentSession(request,env,now,cookieName);
      if (path === '/api/session' && request.method === 'POST') {
        if (session) return json({ready:true});
        // Client bootstraps once before registration; names are never identifiers.
        const ipHash = await sha256(env.PASS_SECRET+':session-rate:'+Math.floor(now/86400000)+':'+(request.headers.get('CF-Connecting-IP') || 'unknown'));
        await rate(env.DB,'sessions:'+ipHash,now,30);
        if (now >= EVENT.sessionExpires) fail(410,'Campaign closed');
        const raw = randomToken();
        await env.DB.prepare('INSERT INTO sessions(id,token_hash,created_ms,expires_ms) VALUES(?,?,?,?)').bind(crypto.randomUUID(),await sha256(raw),now,EVENT.sessionExpires).run();
        return json({ready:true},200,{'Set-Cookie':cookieName+'='+raw+'; Path=/; HttpOnly; '+(lab?'':'Secure; ')+'SameSite=Lax; Max-Age='+Math.max(1,Math.floor((EVENT.sessionExpires-now)/1000))});
      }
      let entry = await currentEntry(env,session);
      if (path === '/api/state' && request.method === 'GET') {
        if (entry?.eligible_ms != null) await issue(env,entry,now);
        return json({serverNow:now,event:EVENT,phase:phaseAt(now),mode:lab?'local-lab':'live',
          entry:entry?{firstName:entry.first_name,eligible:entry.eligible_ms!=null}:null,pass:await passFor(env,entry,now)});
      }
      if (!session) fail(401,'Please reconnect to this browser session');
      await rate(env.DB,'guest:'+session.id,now,60);
      if (request.method !== 'POST') fail(405,'POST required');
      const body = await bodyOf(request);
      // A body delayed across midnight must not acquire an earlier receipt time.
      // Client timestamps remain ignored; this samples the server after parsing.
      now = clock();
      if (session.expires_ms <= now) fail(401,'Please reconnect to this browser session');
      if (path === '/api/register') {
        if (entry) return json({firstName:entry.first_name,alreadyRegistered:true});
        if (now < EVENT.start || now >= EVENT.midnight) fail(409,'Entry is open from 11:50 PM until midnight Central');
        const name = validName(body.firstName); if (!name) fail(400,'Enter your first name, up to 40 letters');
        await env.DB.prepare('INSERT INTO entries(id,campaign,session_id,first_name,registered_ms) VALUES(?,?,?,?,?) ON CONFLICT(campaign,session_id) DO NOTHING').bind(crypto.randomUUID(),EVENT.id,session.id,name,now).run();
        entry = await currentEntry(env,session);
        return json({firstName:entry.first_name});
      }
      if (!entry) fail(409,'No entry in this browser');
      if (path === '/api/presence') {
        if (typeof body.visible !== 'boolean' || body.view !== 'countdown') fail(400,'Invalid presence signal');
        if (now < EVENT.start || now > EVENT.midnight+EVENT.postWindow) return json({accepted:false,serverNow:now});
        const visible = body.visible ? 1 : 0;
        await env.DB.batch([
          env.DB.prepare('INSERT INTO presence(entry_id,received_ms,visible) VALUES(?,?,?)').bind(entry.id,now,visible),
          env.DB.prepare(`UPDATE entries SET pre_ms=CASE WHEN ?=1 THEN ? ELSE NULL END, pre_observed_ms=?
            WHERE id=? AND ?<? AND eligible_ms IS NULL
            AND (pre_observed_ms IS NULL OR pre_observed_ms<? OR (pre_observed_ms=? AND ?=0))`)
            .bind(visible,now,now,entry.id,now,EVENT.midnight,now,now,visible),
          env.DB.prepare(`UPDATE entries SET post_ms=? WHERE id=? AND ?=1 AND ?>=? AND ?<=?
            AND pre_ms>=? AND pre_ms<? AND eligible_ms IS NULL`).bind(now,entry.id,visible,now,EVENT.midnight,now,EVENT.midnight+EVENT.postWindow,EVENT.midnight-EVENT.preWindow,EVENT.midnight),
          env.DB.prepare('UPDATE entries SET eligible_ms=? WHERE id=? AND eligible_ms IS NULL AND post_ms IS NOT NULL AND pre_ms IS NOT NULL').bind(now,entry.id)
        ]);
        entry = await currentEntry(env,session); await issue(env,entry,now);
        return json({accepted:true,eligible:entry.eligible_ms!=null,serverNow:now,pass:await passFor(env,entry,now)});
      }
      if (path === '/api/claim') {
        await issue(env,entry,now);
        const pass = await passFor(env,entry,now);
        if (!pass) fail(409,'Midnight presence has not been verified. No pass issued.');
        return json({pass});
      }
      fail(404,'Not found');
    } catch (err) {
      const status = err.status || (path.startsWith('/staff') ? 401 : 503);
      return json({error:status===503?'Service unavailable. Please reconnect; no new reward or redemption is confirmed.':err.message},status);
    }
  }};
}
// No preview clocks, query-based time overrides or development authentication here.
export default createApp();

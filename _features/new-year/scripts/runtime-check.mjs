// LOCAL ONLY: exercise the Worker in workerd with Miniflare's persistent D1 simulator.
// This file, its generated wrapper and test database are never deployment assets.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare, convertV4MiniflareOptions} from 'miniflare';
import {mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {EVENT as E} from '../src/config.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(join(root,'.local'),{recursive:true});
const runDir=await mkdtemp(join(root,'.local','runtime-check-'));
const wrapperPath=join(runDir,'local-only-wrapper.mjs');
const localBundle=join(runDir,'local-only-worker.mjs');
const productionBundle=join(runDir,'production-worker.mjs');
const results=[];
function check(name,fn) {fn();results.push({name,result:'PASS'});}
const wrapper=`// GENERATED LOCAL TEST WRAPPER. NEVER DEPLOY.
import {createApp} from ${JSON.stringify(join(root,'src/worker.mjs'))};
export default {fetch(request,env) {
  const now=Number(request.headers.get('X-Runtime-Test-Now'));
  if (!Number.isSafeInteger(now)) return new Response('Test clock required',{status:400});
  return createApp({lab:true,clock:()=>now,staffAuth:async request=>{
    const subject=request.headers.get('X-Runtime-Test-Station');
    if (!['runtime-fw','runtime-wb'].includes(subject)) throw new Error('Local test station required');
    return {subject,email:subject+'@example.invalid'};
  }}).fetch(request,env);
}};`;
await writeFile(wrapperPath,wrapper);
await build({entryPoints:[wrapperPath],outfile:localBundle,bundle:true,format:'esm',platform:'browser',target:'es2022',logLevel:'silent'});
await build({entryPoints:[join(root,'src/worker.mjs')],outfile:productionBundle,bundle:true,format:'esm',platform:'browser',target:'es2022',logLevel:'silent'});
const common={host:'127.0.0.1',port:0,cf:false,telemetry:{enabled:false},logRequests:false,
  resourcePersistencePath:join(runDir,'storage'),unsafeDevRegistryPath:join(runDir,'registry'),
  compatibilityDate:'2026-09-01',modules:true,d1Databases:{DB:'nye-local-runtime-only'},
  bindings:{PASS_SECRET:'LOCAL-RUNTIME-TEST-ONLY-SECRET-NEVER-DEPLOY-0123456789',WEBSITE_ORIGINS:'http://127.0.0.1'}};
let runtime,production;
async function start() {
  runtime=new Miniflare(convertV4MiniflareOptions({...common,name:'nye-local-runtime-check',scriptPath:localBundle}));
  await runtime.ready;return runtime.getD1Database('DB');
}
let time=E.start;
async function request(path,{method='GET',cookie,station,body}={}) {
  const headers={Origin:'http://127.0.0.1','X-Runtime-Test-Now':String(time)};
  if(cookie)headers.Cookie=cookie;
  if(station)headers['X-Runtime-Test-Station']=station;
  if(body!==undefined)headers['Content-Type']='application/json';
  const response=await runtime.dispatchFetch('http://127.0.0.1'+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text();let data;try{data=JSON.parse(text);}catch{data={text};}
  return {status:response.status,data,headers:response.headers};
}
async function write(path,body,options={}){return request(path,{...options,body,method:'POST'});}
function migrationStatements(sql) {
  // Preserve SQLite trigger bodies as one statement; all other statements in this
  // reviewed migration end on a line. D1 exec does not parse a multi-line script.
  const out=[];let pending='',trigger=false;
  for(const line of sql.split('\n')) {
    if(!pending && (!line.trim()||line.trim().startsWith('--')))continue;
    pending+=line+'\n';
    if(/^CREATE TRIGGER\b/i.test(pending.trim()))trigger=true;
    if(line.trim().endsWith(';')&&(!trigger||/\bEND;\s*$/i.test(line))) {
      out.push(pending.trim());pending='';trigger=false;
    }
  }
  assert.equal(pending.trim(),'','Migration parser must consume every statement');return out;
}
try {
  let DB=await start();
  const schema=await readFile(join(root,'migrations/0001_initial.sql'),'utf8');
  const statements=migrationStatements(schema);
  await DB.batch(statements.map(sql=>DB.prepare(sql)));
  const initial=await DB.prepare('SELECT COUNT(*) AS n FROM redemption_windows').first();
  check('fresh D1 migration leaves real operating windows empty',()=>assert.equal(initial.n,0));
  const session=await write('/api/session',{});
  check('workerd creates a separate local-lab session',()=>{assert.equal(session.status,200);assert.match(session.headers.get('set-cookie'),/^sb_nye_lab=/);});
  const cookie=session.headers.get('set-cookie').split(';')[0];
  const registered=await write('/api/register',{firstName:'Runtime guest'},{cookie});
  check('registration persists through the D1 binding',()=>assert.equal(registered.status,200));
  time=E.midnight-1000;
  const pre=await write('/api/presence',{visible:true,view:'countdown'},{cookie});
  check('pre-midnight evidence alone issues no pass',()=>assert.equal(pre.data.pass,null));
  time=E.midnight;
  const post=await write('/api/presence',{visible:true,view:'countdown'},{cookie});
  check('D1 transactional presence qualifies and persists a five-digit pass',()=>{assert.equal(post.status,200);assert.match(post.data.pass?.code,/^[1-9][0-9]{4}$/);});
  const code=post.data.pass.code;
  const duplicate=await Promise.all(Array.from({length:8},()=>write('/api/claim',{}, {cookie})));
  check('duplicate claims recover the same persisted code',()=>assert.ok(duplicate.every(result=>result.status===200&&result.data.pass?.code===code)));
  await runtime.dispose();runtime=null;DB=await start();time=E.end;
  const recovered=await request('/api/state',{cookie});
  check('workerd restart retains D1 eligibility and the identical pass',()=>{assert.equal(recovered.data.entry?.eligible,true);assert.equal(recovered.data.pass?.code,code);});
  await DB.batch([
    DB.prepare('INSERT INTO staff_users(subject,email) VALUES(?,?)').bind('runtime-fw','runtime-fw@example.invalid'),
    DB.prepare('INSERT INTO staff_users(subject,email) VALUES(?,?)').bind('runtime-wb','runtime-wb@example.invalid'),
    DB.prepare('INSERT INTO staff_locations(subject,location) VALUES(?,?)').bind('runtime-fw','fort-worth'),
    DB.prepare('INSERT INTO staff_locations(subject,location) VALUES(?,?)').bind('runtime-wb','willow-bend')
  ]);
  const closed=await write('/api/staff/verify',{code},{station:'runtime-fw'});
  const denied=await write('/api/staff/redeem',{code,requestId:crypto.randomUUID()},{station:'runtime-fw'});
  check('no configured real hours blocks verification and atomic redemption',()=>{assert.equal(closed.data.status,'outside_hours');assert.equal(denied.status,409);assert.equal(denied.data.status,'outside_hours');});
  const artificialOpening=E.midnight+3600000;
  await DB.batch(['fort-worth','willow-bend'].map(location=>DB.prepare('INSERT INTO redemption_windows(location,opens_ms,closes_ms,label) VALUES(?,?,?,?)').bind(location,artificialOpening,artificialOpening+3600000,'LOCAL RUNTIME TEST ONLY — NOT RESTAURANT HOURS')));
  time=artificialOpening;
  const attempts=Array.from({length:8},(_,i)=>({station:i%2?'runtime-fw':'runtime-wb',requestId:crypto.randomUUID()}));
  const redeemed=await Promise.all(attempts.map(({station,requestId})=>write('/api/staff/redeem',{code,requestId},{station})));
  const winner=redeemed.findIndex(result=>result.data.status==='redeemed_now');
  check('parallel two-location redemption has exactly one winner',()=>{assert.equal(redeemed.filter(result=>result.data.status==='redeemed_now').length,1);assert.equal(redeemed.filter(result=>result.data.status==='redeemed').length,7);});
  const audit=await DB.prepare('SELECT COUNT(*) AS n FROM redemption_audit').first();
  check('atomic audit records exactly one cookie',()=>assert.equal(audit.n,1));
  const retry=await write('/api/staff/redeem',{code,requestId:attempts[winner].requestId},{station:attempts[winner].station});
  check('response-loss retry confirms the old redemption without issuing another',()=>assert.equal(retry.data.status,'already_confirmed'));
  const seen=await write('/api/staff/verify',{code},{station:attempts[winner].station==='runtime-fw'?'runtime-wb':'runtime-fw'});
  check('the other location immediately sees the central redeemed state',()=>assert.equal(seen.data.status,'redeemed'));

  // Separate default production entrypoint, with no injected clock/auth and no assets.
  production=new Miniflare(convertV4MiniflareOptions({...common,name:'nye-default-runtime-check',scriptPath:productionBundle,d1Databases:{DB:'nye-production-entrypoint-test-only'}}));
  await production.ready;
  for(const path of ['/__test/time','/__lab/time']) {
    const response=await production.dispatchFetch('http://127.0.0.1'+path,{method:'POST',headers:{Origin:'http://127.0.0.1','X-Runtime-Test-Now':String(E.midnight)}});
    check('production entrypoint excludes '+path,()=>assert.equal(response.status,404));
  }
  const realTime=await (await production.dispatchFetch('http://127.0.0.1/api/time?now='+E.midnight,{headers:{'X-Runtime-Test-Now':String(E.midnight)}})).json();
  check('production clock ignores test controls and reports live client mode',()=>{assert.equal(realTime.mode,'live');assert.ok(Math.abs(realTime.serverNow-Date.now())<10000);assert.notEqual(realTime.serverNow,E.midnight);});
  const protectedStaff=await production.dispatchFetch('http://127.0.0.1/api/staff/me',{headers:{'X-Runtime-Test-Station':'runtime-fw'}});
  check('production ignores the local station substitute and requires real Access',()=>assert.equal(protectedStaff.status,401));
  const generated=await readFile(productionBundle,'utf8');
  check('production bundle excludes the runtime wrapper controls',()=>{assert.doesNotMatch(generated,/X-Runtime-Test-Now|X-Runtime-Test-Station|__test\/time|__lab\/time/);});
  const versions={node:process.version};
  for(const name of ['wrangler','miniflare','workerd'])versions[name]=JSON.parse(await readFile(join(root,'node_modules',name,'package.json'),'utf8')).version;
  const report={layer:'LOCAL workerd + Miniflare D1 simulator; NOT remote Cloudflare D1/Access',versions,passed:results.length,failed:0,checks:results,testStorage:runDir};
  await writeFile(join(root,'.local','runtime-check-results.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
} finally {
  await Promise.all([runtime?.dispose(),production?.dispose()]);
}

// LOCAL ONLY. Real workerd + local persistent D1/assets; NOT cloud Access or D1.
// The generated wrapper substitutes only JWKS transport with a freshly generated
// local public key. JWT signature, issuer, audience, expiry and DB station checks
// remain real. No local station bypass or request-selected clock is installed.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {buildStaging} from './build.mjs';
import {EVENT as E} from '../src/config.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const SITE='https://website.staging.example.invalid',SERVICE='https://celebration.staging.example.invalid';
const ISSUER='https://local-runtime-rehearsal.cloudflareaccess.com';
const TEST_LABEL='TEST ONLY — NOT REDEEMABLE';
const TESTER_AUD='local-runtime-tester-application',STAFF_AUD='local-runtime-staff-application';
const checks=[];let active='initialization';
function check(name,verify) {active=name;verify();checks.push({name,result:'PASS'});}
const sha=value=>createHash('sha256').update(value).digest('hex');
await mkdir(join(root,'.local'),{recursive:true});
const runDir=await mkdtemp(join(root,'.local/staging-runtime-check-'));
const artifacts=await buildStaging({websiteOrigin:SITE,serviceOrigin:SERVICE});
const manifest=JSON.parse(await readFile(artifacts.manifestPath,'utf8'));
const keyPair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const publicJwk=await crypto.subtle.exportKey('jwk',keyPair.publicKey);
Object.assign(publicJwk,{kid:'local-runtime-generated-key',alg:'RS256',use:'sig'});
const wrapper=join(runDir,'LOCAL-ONLY-wrapper.mjs'),bundle=join(runDir,'LOCAL-ONLY-worker.mjs');
await writeFile(wrapper,`// GENERATED LOCAL TEST ONLY. NEVER DEPLOY. Public test key, no private key.\nimport {createStagingApp} from ${JSON.stringify(join(root,'staging/worker.mjs'))};\nexport default createStagingApp({fetcher:async url=>{\n if(url!==${JSON.stringify(ISSUER+'/cdn-cgi/access/certs')})throw new Error('Unexpected local key request');\n return Response.json({keys:[${JSON.stringify(publicJwk)}]});\n}});\n`);
await build({entryPoints:[wrapper],outfile:bundle,bundle:true,format:'esm',platform:'browser',target:'es2022',logLevel:'silent'});
const bindings={PASS_SECRET:randomBytes(32).toString('hex'),STAGING_ENABLED:'true',STAGING_SITE_ORIGIN:SITE,STAGING_SERVICE_ORIGIN:SERVICE,
  STAGING_ACCESS_ISSUER:ISSUER,STAGING_SITE_AUD:TESTER_AUD,STAGING_SERVICE_AUD:TESTER_AUD,STAGING_STAFF_AUD:STAFF_AUD,
  STAGING_TESTER_EMAILS:'guest@example.invalid,fw@example.invalid,wb@example.invalid',STAGING_ENVIRONMENT_ID:'local-runtime-isolated-fixture',
  STAGING_REAL_ANCHOR_UTC:new Date().toISOString(),STAGING_EVENT_ANCHOR_UTC:new Date(E.start).toISOString()};
let runtime;
async function start(eventAnchor=E.start) {
  bindings.STAGING_REAL_ANCHOR_UTC=new Date().toISOString();bindings.STAGING_EVENT_ANCHOR_UTC=new Date(eventAnchor).toISOString();
  const options=convertV4MiniflareOptions({name:'nye-private-staging-runtime-local-only',host:'127.0.0.1',port:0,cf:false,
    telemetry:{enabled:false},logRequests:false,resourcePersistencePath:join(runDir,'storage'),unsafeDevRegistryPath:join(runDir,'registry'),
    compatibilityDate:'2026-09-01',modules:true,scriptPath:bundle,d1Databases:{DB:'nye-staging-runtime-local-only'},bindings,
    assets:{directory:artifacts.assetsDirectory,binding:'ASSETS',run_worker_first:true,routerConfig:{has_user_worker:true},assetConfig:{html_handling:'none',not_found_handling:'none'}}});
  // Assert the v5 schema produced by the maintained v4 compatibility adapter.
  assert.deepEqual(options.workers[0].config.assets,{directory:artifacts.assetsDirectory,htmlHandling:'none',notFoundHandling:'none',runWorkerFirst:true,hasUserWorker:true});
  assert.equal(options.workers[0].config.env.ASSETS.type,'assets');
  runtime=new Miniflare(options);await runtime.ready;return runtime.getD1Database('DB');
}
function migrationStatements(sql) {
  const statements=[];let pending='',trigger=false;
  for(const line of sql.split('\n')) {
    if(!pending&&(!line.trim()||line.trim().startsWith('--')))continue;
    pending+=line+'\n';if(/^CREATE TRIGGER\b/i.test(pending.trim()))trigger=true;
    if(line.trim().endsWith(';')&&(!trigger||/\bEND;\s*$/i.test(line))) {statements.push(pending.trim());pending='';trigger=false;}
  }
  assert.equal(pending.trim(),'');return statements;
}
const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
async function jwt(role='guest',overrides={}) {
  const subject=role==='fw'?'runtime-fw':role==='wb'?'runtime-wb':'runtime-guest';
  const header=encode({alg:'RS256',kid:publicJwk.kid}),claims=encode({iss:ISSUER,aud:[role==='guest'?TESTER_AUD:STAFF_AUD],
    sub:subject,email:role+'@example.invalid',nbf:Date.now()/1000-10,exp:Date.now()/1000+3600,...overrides});
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keyPair.privateKey,new TextEncoder().encode(header+'.'+claims));
  return header+'.'+claims+'.'+Buffer.from(signature).toString('base64url');
}
async function request(host,path,{role='guest',auth=true,token,method='GET',body,cookie,origin=host}={}) {
  const headers={Origin:origin};if(auth)headers['Cf-Access-Jwt-Assertion']=token||await jwt(role);
  if(cookie)headers.Cookie=cookie;if(body!==undefined)headers['Content-Type']='application/json';
  const response=await runtime.dispatchFetch(host+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const bytes=Buffer.from(await response.arrayBuffer());let data=null;try{data=JSON.parse(bytes.toString());}catch{}
  return {status:response.status,headers:response.headers,bytes,data};
}
const post=(path,body,options={})=>request(SERVICE,path,{...options,method:'POST',body});
const reportPath=join(root,'.local/staging-runtime-check-results.json');
let failure=null;
try {
  let DB=await start();
  await DB.batch(migrationStatements(await readFile(join(root,'migrations/0001_initial.sql'),'utf8')).map(sql=>DB.prepare(sql)));
  await DB.prepare('CREATE TABLE staging_environment (id INTEGER PRIMARY KEY CHECK(id=1), identifier TEXT NOT NULL)').run();
  await DB.prepare('INSERT INTO staging_environment(id,identifier) VALUES(1,?)').bind(bindings.STAGING_ENVIRONMENT_ID).run();
  await DB.batch([
    ...['fw','wb'].map(role=>DB.prepare('INSERT INTO staff_users(subject,email) VALUES(?,?)').bind('runtime-'+role,role+'@example.invalid')),
    DB.prepare('INSERT INTO staff_locations(subject,location) VALUES(?,?)').bind('runtime-fw','fort-worth'),
    DB.prepare('INSERT INTO staff_locations(subject,location) VALUES(?,?)').bind('runtime-wb','willow-bend')
  ]);
  const windows=await DB.prepare('SELECT COUNT(*) n FROM redemption_windows').first();
  check('fresh local D1 has no real operating windows',()=>assert.equal(windows.n,0));
  for(const [host,path] of [[SITE,'/'],[SITE,'/assets/js/main.js'],[SITE,'/site/index.html'],[SITE,'/service/index.html'],[SERVICE,'/'],[SERVICE,'/assets/guest.js'],[SERVICE,'/service/assets/guest.js'],[SERVICE,'/api/time'],[SERVICE,'/staff/'],[SERVICE,'/staff/assets/staff.js']]) {
    const response=await request(host,path,{auth:false});check('anonymous runtime request denied: '+(host===SITE?'site':'service')+path,()=>{assert.equal(response.status,401);assert.equal(response.data?.testLabel,TEST_LABEL);});
  }
  for(const path of ['/staff','/staff/','/staff/assets/staff.js','/api/staff/me','/staff/api/me']) {
    const response=await request(SERVICE,path);check('tester audience cannot read station route: '+path,()=>assert.equal(response.status,401));
  }
  const noStation=await request(SERVICE,'/staff/',{token:await jwt('guest',{aud:[STAFF_AUD]})});
  check('signed staff audience still requires an active fixed station in D1',()=>assert.equal(noStation.status,403));
  for(const [name,token] of [['expired',await jwt('guest',{exp:Date.now()/1000-1})],['unapproved',await jwt('guest',{email:'outsider@example.invalid'})],['forged',(await jwt()).slice(0,-4)+'AAAA']]) {
    const response=await request(SERVICE,'/api/time',{token});check(name+' JWT is denied by workerd crypto/allowlist',()=>assert.equal(response.status,401));
  }
  for(const file of manifest.files) {
    const site=file.asset.startsWith('site/'),path='/'+file.asset.slice(site?'site/'.length:'service/'.length);
    const servedPath=!site&&['/assets/staff.js','/assets/staff-ui.js'].includes(path)?'/staff'+path:path;
    const response=await request(site?SITE:SERVICE,servedPath,{role:!site&&servedPath.startsWith('/staff/')?'fw':'guest'});
    check('built asset resolves byte-for-byte without redirect: '+file.asset,()=>{
      assert.equal(response.status,200);assert.equal(response.headers.get('Location'),null);assert.equal(sha(response.bytes),file.assetSha256);
      if(path.endsWith('.html')) {assert.match(response.headers.get('Content-Type')||'',/text\/html/);assert.ok(response.bytes.toString().includes(TEST_LABEL));}
      if(path.endsWith('.css'))assert.match(response.headers.get('Content-Type')||'',/text\/css/);
      if(path.endsWith('.js'))assert.match(response.headers.get('Content-Type')||'',/javascript|ecmascript/);
    });
  }
  for(const path of ['/','/staff','/staff/']) {
    const response=await request(SERVICE,path,{role:path.startsWith('/staff')?'fw':'guest'});
    check('service entry route serves labeled HTML without prefix redirect: '+path,()=>{assert.equal(response.status,200);assert.equal(response.headers.get('Location'),null);assert.ok(response.bytes.toString().includes(TEST_LABEL));});
  }
  for(const path of ['/staff/assets/staff.js','/staff/assets/staff-ui.js','/staff/assets/nye.css']) {
    const response=await request(SERVICE,path,{role:'fw'}),asset=manifest.files.find(file=>file.asset==='service/assets/'+path.split('/').at(-1));
    check('protected staff module/style import resolves correctly: '+path,()=>{assert.equal(response.status,200);assert.equal(sha(response.bytes),asset.assetSha256);});
  }
  const time=await request(SERVICE,'/api/time',{origin:SITE}),sitePage=await request(SITE,'/contact.html');
  check('runtime emits exact credentialed CORS and safe site CSP',()=>{
    assert.equal(time.headers.get('Access-Control-Allow-Origin'),SITE);assert.equal(time.headers.get('Access-Control-Allow-Credentials'),'true');
    assert.match(sitePage.headers.get('Content-Security-Policy'),/form-action 'none'/);assert.ok(!sitePage.headers.get('Content-Security-Policy').includes('google-analytics'));
  });
  const session=await post('/api/session',{});
  check('signed rehearsal preserves Secure host-only anonymous guest cookie',()=>{assert.equal(session.status,200);assert.match(session.headers.get('Set-Cookie')||'',/^__Host-sb_nye=.*; Path=\/; HttpOnly; Secure; SameSite=Lax;/);});
  const cookie=session.headers.get('Set-Cookie').split(';')[0];
  const registered=await post('/api/register',{firstName:'Local runtime rehearsal'},{cookie});
  check('guest registers through the real staging wrapper and local D1',()=>assert.equal(registered.status,200));
  await runtime.dispose();runtime=null;DB=await start(E.midnight-5000);
  const pre=await post('/api/presence',{visible:true,view:'countdown'},{cookie});
  check('persistent registration survives runtime restart with server-controlled rehearsal anchor',()=>{assert.equal(pre.status,200);assert.equal(pre.data.pass,null);});
  await delay(Math.max(0,Date.parse(bindings.STAGING_REAL_ANCHOR_UTC)+5100-Date.now()));
  const postMidnight=await post('/api/presence',{visible:true,view:'countdown'},{cookie});
  check('advancing real server time crosses virtual midnight and issues one marked five-digit pass',()=>{assert.equal(postMidnight.status,200);assert.match(postMidnight.data.pass?.code||'',/^[1-9][0-9]{4}$/);assert.equal(postMidnight.data.pass.testLabel,TEST_LABEL);assert.equal(postMidnight.data.pass.simulated,true);});
  const code=postMidnight.data.pass.code;
  await runtime.dispose();runtime=null;DB=await start(E.end);
  const recovered=await request(SERVICE,'/api/state',{cookie});
  check('earned pass survives another workerd restart and post-takeover recovery',()=>assert.equal(recovered.data.pass?.code,code));
  await DB.batch(['fort-worth','willow-bend'].map(location=>DB.prepare('INSERT INTO redemption_windows(location,opens_ms,closes_ms,label) VALUES(?,?,?,?)').bind(location,E.end,E.end+3600000,'LOCAL RUNTIME ARTIFICIAL WINDOW — NOT RESTAURANT HOURS')));
  const ids=[crypto.randomUUID(),crypto.randomUUID()];
  const attempts=await Promise.all(['fw','wb'].map((role,i)=>post('/staff/api/redeem',{code,requestId:ids[i]},{role})));
  check('real signed station authorization and local D1 allow exactly one parallel test redemption',()=>{assert.equal(attempts.filter(result=>result.data.status==='redeemed_now').length,1);assert.equal(attempts.filter(result=>result.data.status==='redeemed').length,1);});
  const winner=attempts.findIndex(result=>result.data.status==='redeemed_now');
  const retry=await post('/staff/api/redeem',{code,requestId:ids[winner]},{role:['fw','wb'][winner]});
  check('same-key retry confirms the prior test redemption',()=>assert.equal(retry.data.status,'already_confirmed'));
  await DB.prepare('UPDATE staff_users SET active=0 WHERE subject=?').bind('runtime-fw').run();
  const revoked=await request(SERVICE,'/staff/assets/staff.js',{role:'fw'});
  check('revoked station is blocked from protected assets despite a valid signed JWT',()=>assert.equal(revoked.status,403));
} catch(error) {failure={check:active,type:error.name};process.exitCode=1;console.error('Local staging runtime check failed at:',active);console.error(error.message);}
finally {
  await runtime?.dispose();
  const versions={node:process.version};for(const name of ['miniflare','workerd'])versions[name]=JSON.parse(await readFile(join(root,'node_modules',name,'package.json'),'utf8')).version;
  const report={layer:'LOCAL workerd + Miniflare persistent D1/static assets; locally generated signed JWTs and mocked JWKS transport; NOT real cloud Access or D1',versions,
    builtAssets:manifest.files.length,passed:checks.length,failed:failure?1:0,checks,failure,artifactDirectory:artifacts.outputDirectory,localStorage:runDir};
  await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,failed:report.failed,builtAssets:report.builtAssets,reportPath},null,2));
}

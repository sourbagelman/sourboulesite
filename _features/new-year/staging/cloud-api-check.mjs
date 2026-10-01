// Real-cloud rehearsal only: use existing genuine Access browser storage states.
// Never substitutes JWTs, adds clock controls, provisions resources or logs credentials.
import {readFile,writeFile,mkdir,rename,chmod,realpath} from 'node:fs/promises';
import {dirname,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {Resolver} from 'node:dns/promises';
import {isIP} from 'node:net';
import {request as playwrightRequest,chromium} from 'playwright';
import {stagingOrigin} from './client-transform.mjs';
import {EVENT} from '../src/config.mjs';
const feature=fileURLToPath(new URL('../',import.meta.url));
const local=resolve(feature,'.local');
const label='TEST ONLY — NOT REDEEMABLE';
const phases=new Set(['eligibility','redemption','outside-hours','expired','revoked-fw']);
function requireTrue(condition,message){if(!condition)throw new Error(message);}
export function localPath(value) {
  requireTrue(typeof value==='string'&&value.length>0,'A private .local file is required');
  const path=resolve(feature,value);
  requireTrue(path.startsWith(local+sep)&&path.endsWith('.json'),'State and reports must remain JSON files inside .local');
  return path;
}
export function optionsFrom(argv) {
  const out={execute:false,browserDns:false};const names=new Set(['phase','service','guest-state','fw-state','wb-state','run-file']);
  for(let i=0;i<argv.length;i++) {
    if(argv[i]==='--execute'){requireTrue(!out.execute,'Duplicate execution flag');out.execute=true;continue;}
    if(argv[i]==='--browser-dns'){requireTrue(!out.browserDns,'Duplicate browser DNS flag');out.browserDns=true;continue;}
    requireTrue(argv[i]?.startsWith('--')&&names.has(argv[i].slice(2)),'Unsupported argument');
    const key=argv[i].slice(2);requireTrue(!Object.hasOwn(out,key)&&argv[i+1]&&!argv[i+1].startsWith('--'),'Missing or duplicate option');out[key]=argv[++i];
  }
  requireTrue(phases.has(out.phase),'Choose a supported rehearsal phase');out.service=stagingOrigin(out.service);
  for(const key of ['guest-state','fw-state','wb-state','run-file'])out[key]=localPath(out[key]);
  requireTrue(out['fw-state']!==out['wb-state'],'Use separate station browser states');
  out.report=out['run-file'].replace(/\.json$/,'.'+out.phase+'.report.json');
  requireTrue(['guest-state','fw-state','wb-state'].every(key=>out[key]!==out['run-file']&&out[key]!==out.report),'Private output must not replace browser credentials');
  return out;
}
export function anonymousPromotionState(state) {
  requireTrue(state&&Array.isArray(state.cookies)&&Array.isArray(state.origins),'Invalid browser storage state');
  // Keep real Cloudflare Access cookies untouched; only the anonymous promotion
  // session is isolated so names do not become identifiers across test entries.
  return {...state,cookies:state.cookies.filter(cookie=>cookie.name!=='__Host-sb_nye')};
}
export function checkedTime(data) {
  requireTrue(data?.mode==='staging'&&data.testLabel===label,'A verified staging response is required');
  requireTrue(Number.isSafeInteger(data.serverNow)&&Object.entries(EVENT).every(([key,value])=>data.event?.[key]===value),'The locked staging event schedule did not match');
  return data.serverNow;
}
async function privateRead(path) {
  const canonical=await realpath(path);requireTrue(canonical.startsWith((await realpath(local))+sep),'Private state path cannot leave .local');
  try{return JSON.parse(await readFile(canonical,'utf8'));}catch{throw new Error('Could not read the private JSON state file');}
}
async function privateWrite(path,data) {
  await mkdir(dirname(path),{recursive:true});
  const parent=await realpath(dirname(path)),root=await realpath(local);
  requireTrue(parent===root||parent.startsWith(root+sep),'Private output directory cannot leave .local');
  const temp=path+'.tmp-'+crypto.randomUUID();await writeFile(temp,JSON.stringify(data,null,2)+'\n',{mode:0o600,flag:'wx'});await chmod(temp,0o600);await rename(temp,path);
}
export function browserLaunchOptions(service,ip) {
  const host=new URL(stagingOrigin(service)).hostname;
  requireTrue(isIP(ip)===4,'A verified IPv4 DNS answer is required');
  return {headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),args:['--host-resolver-rules=MAP '+host+' '+ip+',EXCLUDE localhost']};
}
export async function nativeBrowserFactory(service,{resolver=new Resolver(),launcher=chromium}={}) {
  service=stagingOrigin(service);resolver.setServers(['1.1.1.1']);
  const answers=await resolver.resolve4(new URL(service).hostname);
  requireTrue(answers.length>0,'The approved service hostname must resolve');
  const browser=await launcher.launch(browserLaunchOptions(service,answers[0]));
  const stats={readOnlyAccessPreflights:0};
  return {
    async newContext({storageState}) {
      const context=await browser.newContext({storageState,ignoreHTTPSErrors:false});
      const page=await context.newPage();
      if(storageState.cookies.length>0) {
        // A genuine saved Access session may need its ordinary top-level SSO
        // redirect before an API fetch can use it. JSON navigation runs no app
        // script and changes no promotion state. Empty anonymous states skip it.
        stats.readOnlyAccessPreflights++;
        const response=await page.goto(service+'/api/time',{waitUntil:'domcontentloaded',timeout:20000});
        if(!response||response.status()!==200||page.url()!==service+'/api/time'||!(response.headers()['content-type']||'').includes('application/json')) {
          await context.close();throw new Error('The real Access JSON preflight did not complete');
        }
      }
      const transport=service+'/__cloud_rehearsal_transport_'+crypto.randomUUID();
      // This one document exists only inside this client. No server route, Access
      // bypass, production CSP change or app JavaScript is used. Subsequent API
      // fetches are real HTTPS requests with the browser's genuine cookie jar.
      await page.route(transport,route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; connect-src \'self\'"><title>Private API rehearsal transport</title>'}));
      await page.goto(transport,{waitUntil:'domcontentloaded'});
      return {
        async fetch(url,options) {
          requireTrue(new URL(url).origin===service,'Native transport cannot leave the approved service');
          const response=await page.evaluate(async ({url,method,body})=>{
            const result=await fetch(url,{method,credentials:'include',redirect:'manual',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
            return {status:result.status,type:result.type,headers:Object.fromEntries(result.headers.entries()),text:await result.text()};
          },{url,method:options.method,body:options.data});
          return {status:()=>response.status,headers:()=>response.headers,json:async()=>JSON.parse(response.text),isOpaqueRedirect:()=>response.type==='opaqueredirect',dispose:async()=>{}};
        },
        storageState:()=>context.storageState(),
        dispose:()=>context.close()
      };
    },
    stats:()=>({...stats}),
    dispose:()=>browser.close()
  };
}
export async function runCloudPhase(options,{requestFactory,onProgress=message=>console.log(message)}={}) {
  requireTrue(options.execute===true,'Execution requires --execute');
  const report={layer:'Real remote Worker, D1 and Cloudflare Access through genuine browser cookies',phase:options.phase,serviceOrigin:options.service,transport:options.browserDns?'Native headless Chromium HTTPS fetch; DNS-only override from 1.1.1.1; real Access JSON preflight; synthetic client transport document':'Playwright APIRequestContext',requestCount:0,checks:[],limitations:['Request count covers explicit API calls; the separate preflight-navigation count excludes automatic Access SSO redirect hops','Automated HTTP transport, not physical iPhone Safari','Discarded-response recovery is a client simulation against real cloud state','No claim of actual Access session expiry unless observed separately']};
  const contexts=[];
  let ownedFactory;
  let active='initialize';
  function check(name,condition) {active=name;requireTrue(condition,'Rehearsal assertion failed');report.checks.push({name,result:'PASS'});}
  async function context(storageState) {
    const result=await requestFactory.newContext({storageState,ignoreHTTPSErrors:false,timeout:20000});contexts.push(result);return result;
  }
  async function api(client,path,body,{discard=false}={}) {
    active='HTTPS '+(body===undefined?'GET ':'POST ')+path;
    requireTrue(++report.requestCount<=200,'Bounded rehearsal request allowance exceeded');
    let response;
    try {response=await client.fetch(options.service+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{Accept:'application/json'}:{Accept:'application/json',Origin:options.service},data:body,maxRedirects:0,failOnStatusCode:false});}
    catch {throw new Error('Cloud request failed or timed out; no result is confirmed');}
    const status=response.status();let data=null;
    if(!discard&&(response.headers()['content-type']||'').includes('application/json')) {
      try{data=await response.json();}catch{await response.dispose();throw new Error('Cloud returned invalid JSON');}
    }
    const opaqueRedirect=response.isOpaqueRedirect?.()===true;
    await response.dispose();return {status,data,opaqueRedirect};
  }
  let run;
  try {
    requestFactory??=options.browserDns?(ownedFactory=await nativeBrowserFactory(options.service)):playwrightRequest;
    const guestState=await privateRead(options['guest-state']);
    const guest=await context(guestState);
    const now=async()=>{const response=await api(guest,'/api/time');requireTrue(response.status===200,'Real tester Access session is missing or expired');return checkedTime(response.data);};
    const startTime=await now();report.startedAtEventTime=new Date(startTime).toISOString();
    if(options.phase==='eligibility') {
      try {await privateRead(options['run-file']);throw new Error('Use a new private run file for a new eligibility rehearsal');}
      catch(error){if(error.code!=='ENOENT')throw error;}
      check('Actual server clock is in the preparation window',startTime>=EVENT.midnight-60000&&startTime<=EVENT.midnight-15000);
      run={version:1,serviceOrigin:options.service,testLabel:label,guests:{},phases:{}};
      const names=['normal','responseLoss','reconnect','late','hidden','postOnly'];
      const clients=Object.fromEntries(await Promise.all(names.map(async name=>[name,await context(anonymousPromotionState(guestState))])));
      await Promise.all(names.map(async name=>{
        const session=await api(clients[name],'/api/session',{});requireTrue(session.status===200,'Guest bootstrap failed');
        const register=await api(clients[name],'/api/register',{firstName:'Rehearsal guest'});requireTrue(register.status===200,'Guest registration missed the server window');
        run.guests[name]={state:await clients[name].storageState()};
      }));
      check('Six separate anonymous promotion sessions register under real Access',Object.keys(run.guests).length===6);
      await privateWrite(options['run-file'],run);
      const deadline=performance.now()+240000;
      async function until(target) {
        while(true){requireTrue(performance.now()<deadline,'Eligibility rehearsal exceeded four minutes');const current=await now();if(current>=target)return current;await new Promise(done=>setTimeout(done,Math.min(1500,Math.max(100,target-current))));}
      }
      onProgress('Registered cloud test guests; waiting for genuine server receipt boundaries. No clock overrides are sent.');
      const preAt=await until(EVENT.midnight-12000);check('Pre-midnight receipt opportunity remains inside the final thirty seconds',preAt<EVENT.midnight-1000);
      await Promise.all(names.filter(name=>name!=='postOnly').map(async name=>{const r=await api(clients[name],'/api/presence',{visible:true,view:'countdown'});requireTrue(r.status===200&&!r.data?.pass,'Pre-midnight presence unexpectedly issued a pass');}));
      const hidden=await api(clients.hidden,'/api/presence',{visible:false,view:'countdown'});check('Observed hidden signal is accepted before midnight',hidden.status===200&&hidden.data?.serverNow<EVENT.midnight);
      await until(EVENT.midnight+1000);
      const parallel=await Promise.all(Array.from({length:3},()=>api(clients.normal,'/api/presence',{visible:true,view:'countdown'})));
      const code=parallel[0].data?.pass?.code;
      check('Concurrent first qualification resolves to one persisted five-digit code',parallel.every(result=>result.status===200&&result.data?.pass?.code===code)&&/^[1-9][0-9]{4}$/.test(code||''));
      run.guests.normal.code=code;
      const lost=await api(clients.responseLoss,'/api/presence',{visible:true,view:'countdown'},{discard:true});
      check('Cloud processed the discarded-response request',lost.status===200);
      await clients.responseLoss.dispose();
      const recoveredClient=await context(run.guests.responseLoss.state);
      const recovered=await api(recoveredClient,'/api/state');run.guests.responseLoss.code=recovered.data?.pass?.code;
      check('A fresh HTTP client recovers issuance after discarding the original body',recovered.status===200&&/^[1-9][0-9]{4}$/.test(run.guests.responseLoss.code||''));
      for(const name of ['hidden','postOnly']) {
        const result=await api(clients[name],'/api/presence',{visible:true,view:'countdown'});
        check(name==='hidden'?'Leaving before midnight prevents eligibility':'Post-midnight presence alone prevents eligibility',result.status===200&&result.data?.eligible===false&&!result.data.pass);
      }
      const lateRegistrant=await context(anonymousPromotionState(guestState));await api(lateRegistrant,'/api/session',{});
      const lateRegistration=await api(lateRegistrant,'/api/register',{firstName:'Late guest'});check('Registration arriving after midnight is rejected',lateRegistration.status===409);
      await until(EVENT.midnight+45000);
      const reconnect=await api(clients.reconnect,'/api/presence',{visible:true,view:'countdown'});run.guests.reconnect.code=reconnect.data?.pass?.code;
      check('Visible reconnection forty-five seconds after midnight qualifies with recorded pre-evidence',reconnect.status===200&&/^[1-9][0-9]{4}$/.test(run.guests.reconnect.code||''));
      check('Equal display names in separate sessions receive unique persisted codes',new Set(['normal','responseLoss','reconnect'].map(name=>run.guests[name].code)).size===3);
      await privateWrite(options['run-file'],run);
      onProgress('Issued test passes are stored privately; waiting beyond the ninety-second reconnect cutoff.');
      await until(EVENT.midnight+93000);
      const late=await api(clients.late,'/api/presence',{visible:true,view:'countdown'});
      const lateState=await api(clients.late,'/api/state');check('Reconnection beyond ninety seconds cannot invent eligibility',late.status===200&&late.data?.accepted===false&&!lateState.data?.pass);
      const duplicate=await Promise.all(Array.from({length:6},()=>api(clients.normal,'/api/claim',{})));
      check('Repeated claims keep the same existing pass',duplicate.every(result=>result.status===200&&result.data?.pass?.code===code));
      const spoof=await api(clients.late,'/api/claim',{now:EVENT.midnight,eligible:true});check('Client-selected eligibility and timestamps do not unlock an ineligible pass',spoof.status===409);
      run.phases.eligibility=true;
    } else {
      run=await privateRead(options['run-file']);requireTrue(run.serviceOrigin===options.service&&run.testLabel===label&&run.phases?.eligibility,'A matching completed private eligibility run is required');
      const fw=await context(await privateRead(options['fw-state'])),wb=await context(await privateRead(options['wb-state']));
      const meFW=await api(fw,'/staff/api/me'),meWB=await api(wb,'/staff/api/me');
      if(options.phase==='revoked-fw') {
        check('Revoked Fort Worth station is denied while Willow Bend remains assigned',meFW.status===403&&meWB.status===200&&meWB.data?.location==='willow-bend');
        for(const action of ['verify','redeem']){const response=await api(fw,'/staff/api/'+action,{code:run.guests.reconnect.code,...(action==='redeem'?{requestId:crypto.randomUUID()}:{})});check('Revoked station cannot '+action,response.status===403);}
      } else {
        check('Real signed-in stations retain their fixed backend locations',meFW.status===200&&meFW.data?.location==='fort-worth'&&meWB.status===200&&meWB.data?.location==='willow-bend');
        const identities=await Promise.all([api(fw,'/staff/identity'),api(wb,'/staff/identity')]);
        check('The two stations use distinct verified Access identities',identities.every(result=>result.status===200&&result.data?.mode==='staging'&&result.data?.testLabel===label&&typeof result.data?.sub==='string'&&result.data.sub.length>0&&typeof result.data?.email==='string'&&result.data.email.length>0)&&identities[0].data.sub!==identities[1].data.sub&&identities[0].data.email!==identities[1].data.email);
        const reserved=await context(run.guests.reconnect.state);
        const reserveState=await api(reserved,'/api/state');
        check('Saved session retrieves the identical reserved code after the earlier cloud phase',reserveState.status===200&&reserveState.data?.pass?.code===run.guests.reconnect.code);
        if(options.phase==='redemption') {
          requireTrue(!run.phases.redemption,'Redemption phase already completed; use the saved report');
          check('Cloud clock is after takeover and within the artificial open window',startTime>=EVENT.end&&startTime<EVENT.midnight+3600000);
          const invalid=await api(fw,'/staff/api/verify',{code:'04271'});check('Demo-range invalid code is rejected by the real API',invalid.status===400);
          const ids=[crypto.randomUUID(),crypto.randomUUID()];run.redemptionRequests={parallel:ids,doubleTap:crypto.randomUUID()};await privateWrite(options['run-file'],run);
          const checked=await api(fw,'/staff/api/verify',{code:run.guests.normal.code});check('Earned code verifies without consuming it',checked.status===200&&checked.data?.status==='valid');
          const attempts=await Promise.all([fw,wb].map((client,index)=>api(client,'/staff/api/redeem',{code:run.guests.normal.code,requestId:ids[index]})));
          const winner=attempts.findIndex(response=>response.status===200&&response.data?.status==='redeemed_now');
          check('Simultaneous two-location attempts produce exactly one redemption winner',winner>=0&&attempts.filter(response=>response.data?.status==='redeemed_now').length===1&&attempts.filter(response=>response.status===409&&response.data?.status==='redeemed').length===1);
          const retried=await api([fw,wb][winner],'/staff/api/redeem',{code:run.guests.normal.code,requestId:ids[winner]});check('Response-loss retry confirms prior redemption without another cookie',retried.status===200&&retried.data?.status==='already_confirmed');
          const used=await api([wb,fw][winner],'/staff/api/verify',{code:run.guests.normal.code});check('The other location sees the same code already used',used.status===200&&used.data?.status==='redeemed');
          const repeated=await Promise.all(Array.from({length:2},()=>api(fw,'/staff/api/redeem',{code:run.guests.responseLoss.code,requestId:run.redemptionRequests.doubleTap})));
          check('Double taps using one request ID remain idempotent with no purchase payload',repeated.every(result=>result.status===200)&&repeated.filter(result=>result.data?.status==='redeemed_now').length===1&&repeated.filter(result=>result.data?.status==='already_confirmed').length===1);
          const anonymous=await context({cookies:[],origins:[]});const denied=await api(anonymous,'/staff/api/me');check('Anonymous staff API request returns no direct success; Access redirect classification is a separate privacy check',[301,302,303,307,308,401,403].includes(denied.status)||(denied.status===0&&denied.opaqueRedirect));
        } else if(options.phase==='outside-hours') {
          check('Cloud clock is past the artificial closing time but before expiration',startTime>=EVENT.midnight+3600000&&startTime<EVENT.expires);
          for(const [station,client] of [['Fort Worth',fw],['Willow Bend',wb]]) {
            const verify=await api(client,'/staff/api/verify',{code:run.guests.reconnect.code});
            const redeem=await api(client,'/staff/api/redeem',{code:run.guests.reconnect.code,requestId:crypto.randomUUID()});
            check(station+' rejects verify and redeem outside its artificial hours',verify.status===200&&verify.data?.status==='outside_hours'&&redeem.status===409&&redeem.data?.status==='outside_hours');
          }
        } else if(options.phase==='expired') {
          check('Cloud clock is past the locked Chicago expiration',startTime>=EVENT.expires&&startTime<EVENT.sessionExpires);
          check('Saved unredeemed pass is now expired',reserveState.data?.pass?.status==='expired');
          const verify=await api(fw,'/staff/api/verify',{code:run.guests.reconnect.code});
          const redeem=await api(wb,'/staff/api/redeem',{code:run.guests.reconnect.code,requestId:crypto.randomUUID()});
          check('Both locations enforce expiry without a purchase override',verify.status===200&&verify.data?.status==='expired'&&redeem.status===410&&redeem.data?.status==='expired');
        }
      }
      run.phases[options.phase]=true;
    }
    await privateWrite(options['run-file'],run);report.result='PASS';report.passed=report.checks.length;report.failed=0;
  } catch(error) {
    report.result='FAIL';report.failed=1;report.passed=report.checks.length;
    // Deliberately omit exception text: browser/network errors can contain tokens.
    report.failure={step:active,message:'Phase did not complete. No unobserved success is claimed; inspect authentication/configuration privately.'};
  } finally {
    for(const client of contexts){try{await client.dispose();}catch{}}
    if(ownedFactory){report.transportPreflights=ownedFactory.stats();try{await ownedFactory.dispose();}catch{}}
  }
  await privateWrite(options.report,report);return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const options=optionsFrom(process.argv.slice(2));
    if(!options.execute)console.log(JSON.stringify({execute:false,phase:options.phase,serviceOrigin:options.service,message:'Dry run only. No network requests, test passes, redemptions or clock changes.'},null,2));
    else {const report=await runCloudPhase(options);console.log(JSON.stringify(report,null,2));if(report.result!=='PASS')process.exitCode=1;}
  } catch {console.error('Rehearsal setup failed. Check explicit phase/origin and private .local JSON files; credentials are never printed.');process.exitCode=1;}
}

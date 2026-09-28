/** Explicitly invoked private-cloud rehearsal. Never deploys or bypasses Access. */
import {mkdir,readFile,writeFile,lstat,chmod,realpath} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isIP} from 'node:net';
import {stagingOrigin,STAGING_LABEL} from './client-transform.mjs';
import {EVENT} from '../src/config.mjs';

const feature=fileURLToPath(new URL('../',import.meta.url));
const local=resolve(feature,'.local');
const scenarios=['opening','active','continue','midnight','ending','recovery','failure-time','failure-frame','device-clock'];
const pages=['index','brand-home','fort-worth','willow-bend','menu','willow-bend-menu','menus-order','locations','about','catering','events','contact'];
const viewports=['320x568','375x812','768x1024','1366x768','1440x900'];
class RehearsalError extends Error {}
export function browserConfiguration(input) {
  const websiteOrigin=stagingOrigin(input.websiteOrigin),serviceOrigin=stagingOrigin(input.serviceOrigin);
  const a=new URL(websiteOrigin).hostname,b=new URL(serviceOrigin).hostname;
  if(a===b||a.split('.').length<3||a.split('.').slice(1).join('.')!==b.split('.').slice(1).join('.'))throw Error('Require distinct approved sibling staging origins');
  return {websiteOrigin,serviceOrigin};
}
export function browserOptions(args) {
  const [mode,configPath,...flags]=args;
  if(!['login','run'].includes(mode)||!configPath)throw Error('Usage: node staging/cloud-browser-check.mjs login|run .local/approved-staging.json --profile NAME [--staff] [--resolve-ip PUBLIC_IPV4]');
  const options={mode,configPath,profile:'',staff:false};
  for(let i=0;i<flags.length;i++) {
    const flag=flags[i];
    if(flag==='--staff')options.staff=true;
    else if(['--profile','--resolve-ip','--scenario','--page','--viewport'].includes(flag)) {
      if(!flags[i+1]||flags[i+1].startsWith('--'))throw Error('Missing option value');
      options[flag.slice(2)]=flags[++i];
    } else throw Error('Unknown option: '+flag);
  }
  if(!/^[a-z][a-z0-9-]{0,39}$/.test(options.profile))throw Error('Use a simple private browser profile name');
  if(options['resolve-ip']&&isIP(options['resolve-ip'])!==4)throw Error('Resolver override requires the owner-verified public IPv4 address; TLS verification stays enabled');
  options.page??='index';options.viewport??='1366x768';
  if(!pages.includes(options.page)||!viewports.includes(options.viewport))throw Error('Use a current website page and one of the five documented viewport sizes');
  if(mode==='run'&&!scenarios.includes(options.scenario))throw Error('Select one documented rehearsal scenario with --scenario');
  return options;
}
export async function privateProfile(name) {
  if(!/^[a-z][a-z0-9-]{0,39}$/.test(name))throw Error('Invalid browser profile name');
  await mkdir(local,{recursive:true,mode:0o700});
  if((await lstat(local)).isSymbolicLink()||await realpath(local)!==local)throw Error('Private profile directory cannot be a symlink');
  const path=resolve(local,'cloud-browser-'+name);
  await mkdir(path,{recursive:true,mode:0o700});
  if((await lstat(path)).isSymbolicLink()||await realpath(path)!==path)throw Error('Private profile cannot be a symlink');
  await chmod(path,0o700);
  return path;
}
async function privateJson(path,value) {
  // These paths are inside an already checked private profile directory.
  try {if((await lstat(path)).isSymbolicLink())throw Error('Private output cannot be a symlink');}catch(error){if(error.code!=='ENOENT')throw error;}
  await writeFile(path,JSON.stringify(value,null,2)+'\n',{mode:0o600});await chmod(path,0o600);
}
async function saveState(context,profile) {
  await privateJson(resolve(profile,'storage-state.json'),await context.storageState());
}
async function launch(options,config,profile) {
  const {chromium}=await import('playwright');
  const args=[];
  if(options['resolve-ip'])args.push('--host-resolver-rules='+[config.websiteOrigin,config.serviceOrigin].map(origin=>'MAP '+new URL(origin).hostname+' '+options['resolve-ip']).join(', '));
  const [width,height]=options.viewport.split('x').map(Number);
  return chromium.launchPersistentContext(profile,{headless:false,acceptDownloads:true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{}),
    args,viewport:{width,height}});
}
async function nativeJson(page,path) {
  return page.evaluate(async path=>{
    try {const response=await fetch(path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(8000)});if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))return null;return await response.json();}catch{return null;}
  },path).catch(()=>null);
}
export function parsedIdentity(text) {
  try {const data=JSON.parse(text);return staged(data)&&typeof data.sub==='string'&&typeof data.email==='string'?data:null;}catch{return null;}
}
function staged(data){return data?.mode==='staging'&&data.testLabel===STAGING_LABEL;}
function validClock(data){return staged(data)&&Number.isFinite(data.serverNow)&&Object.entries(EVENT).every(([key,value])=>data.event?.[key]===value);}
export function freshPromotionSession(data){return validClock(data)&&data.entry===null&&data.pass===null;}
export function continuedWithinWindow(data) {
  if(!validClock(data))throw new RehearsalError('Authenticated staging clock metadata is missing or differs from the locked event');
  if(data.serverNow<EVENT.start||data.serverNow>=EVENT.end)throw new RehearsalError('TIMING_PREREQUISITE: the active window ended or changed during Continue; rerun with sufficient time remaining');
  return true;
}
export function checkTime(scenario,data) {
  if(!validClock(data))throw new RehearsalError('Authenticated staging clock metadata is missing or differs from the locked event');
  const n=data.serverNow;
  const boundary={opening:EVENT.start,midnight:EVENT.midnight,ending:EVENT.end}[scenario];
  if(boundary!==undefined&&(boundary-n<12000||boundary-n>125000))throw new RehearsalError('TIMING_PREREQUISITE: operator must set the server anchor 12–125 seconds before this boundary, then rerun');
  if(['active','continue','failure-time','failure-frame'].includes(scenario)&&(n<EVENT.start||n>EVENT.end-20000))throw new RehearsalError('TIMING_PREREQUISITE: this scenario requires an active takeover window with at least 20 seconds remaining');
  if(scenario==='recovery'&&(n<EVENT.midnight||n>=EVENT.sessionExpires))throw new RehearsalError('TIMING_PREREQUISITE: pass recovery requires the post-midnight recovery window');
  if(scenario==='device-clock'&&(n<EVENT.start||n>EVENT.midnight-20000))throw new RehearsalError('TIMING_PREREQUISITE: device-clock simulation requires the active pre-midnight window with at least 20 seconds remaining');
  return boundary===undefined?20000:Math.ceil(boundary-n+20000);
}
async function login(context,config,profile,staff) {
  const stages=[
    {name:'private countdown',url:config.serviceOrigin+'/?pass=1',path:'/api/time',valid:staged},
    {name:'private website',url:config.websiteOrigin+'/',valid:async page=>await page.locator('[data-nye-staging-notice]').textContent().then(text=>text.includes(STAGING_LABEL)).catch(()=>false)},
    ...(staff?[{name:'protected staff identity',url:config.serviceOrigin+'/staff/identity',path:'/staff/identity',valid:data=>staged(data)&&typeof data.sub==='string'&&typeof data.email==='string',identity:true}]:[])
  ];
  for(const stage of stages) {
    console.log('Complete real Cloudflare Access sign-in in the browser for '+stage.name+'. Never paste a PIN, password, or cookie into chat.');
    const page=await context.newPage();await page.goto(stage.url,{waitUntil:'domcontentloaded',timeout:60000});await page.bringToFront();
    const deadline=Date.now()+15*60*1000;let success=false;
    while(Date.now()<deadline&&!page.isClosed()) {
      if(new URL(page.url()).origin===new URL(stage.url).origin) {
        // The read-only identity JSON deliberately has default-src 'none'.
        // Read its actual rendered response, never issue fetch from that page.
        const data=stage.identity&&new URL(page.url()).pathname==='/staff/identity'
          ?parsedIdentity(await page.evaluate(()=>document.querySelector('pre')?.textContent||document.body.innerText).catch(()=>''))
          :stage.path&&!stage.identity?await nativeJson(page,stage.path):null;
        if(stage.path?stage.valid(data):await stage.valid(page)) {
          if(stage.identity)await privateJson(resolve(profile,'verified-identity.json'),{sub:data.sub,email:data.email});
          await saveState(context,profile);success=true;break;
        }
      }
      await new Promise(done=>setTimeout(done,1000));
    }
    if(!success)throw Error('AUTH_REQUIRED: complete real Access sign-in before rehearsal');
    console.log('Authenticated '+stage.name+'; private browser state saved.');
    await page.close();
  }
  console.log('Login complete. Private native session: '+resolve(profile,'storage-state.json'));
  if(staff)console.log('Verified identity is saved privately beside browser state; no station assignment was changed.');
}
async function timeFromSession(context,config,foreground) {
  let data;
  if(foreground) {
    // Keep the actual countdown document visible across midnight. A new tab
    // here could correctly invalidate presence and would corrupt this test.
    data=await foreground.evaluate(async url=>{try{const r=await fetch(url,{credentials:'include',cache:'no-store',signal:AbortSignal.timeout(8000)});return r.ok&&r.headers.get('content-type')?.includes('application/json')?await r.json():null;}catch{return null;}},config.serviceOrigin+'/api/time');
  } else {
    // Browser transport honors its native Access cookies and optional exact
    // DNS mapping. Opening the read-only API document has no guest side effect.
    const tab=await context.newPage();
    try {const response=await tab.goto(config.serviceOrigin+'/api/time',{waitUntil:'domcontentloaded',timeout:30000});
      if(new URL(tab.url()).origin===config.serviceOrigin&&response?.ok()&&response.headers()['content-type']?.includes('application/json'))data=await response.json();
    } finally {await tab.close();}
  }
  if(!staged(data))throw new RehearsalError('AUTH_REQUIRED: run login with this profile; the response is not the protected staging API');return data;
}
async function originalSite(page) {
  return page.evaluate(()=>{
    const selectors=['main','.site-header','.site-footer','[data-seasonal-anchor]','[data-seasonal-art]','[data-seasonal-year]','[data-seasonal-trim]'];
    window.__nyeCloudOriginalNodes=selectors.map(s=>document.querySelector(s));
    const markup=['main','.site-header','.site-footer'].map(s=>{const node=document.querySelector(s)?.cloneNode(true);node?.querySelectorAll('#sb-nye-pass-recovery').forEach(e=>e.remove());return node?.outerHTML||null;});
    return {markup,theme:document.documentElement.dataset.sbSeason,year:document.querySelector('[data-seasonal-year]')?.textContent,
      order:[...document.querySelectorAll('a[href*="cash.app"],a[href*="square"]')].map(e=>e.getAttribute('href')),
      canonical:document.querySelector('link[rel="canonical"]')?.href,
      seasonal:[...document.querySelectorAll('link[href*="seasonal"],script[src*="seasonal"]')].map(e=>e.outerHTML)};
  });
}
async function sitePreserved(page,before,check) {
  check(await page.evaluate(()=>['main','.site-header','.site-footer','[data-seasonal-anchor]','[data-seasonal-art]','[data-seasonal-year]','[data-seasonal-trim]'].every((s,i)=>document.querySelector(s)===window.__nyeCloudOriginalNodes[i])),'Original current-page and seasonal nodes survived');
  check(JSON.stringify(await originalSite(page))===JSON.stringify(before),'Original content, order links, canonical and approved seasonal markup stayed unchanged');
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Current page has no horizontal overflow');
}
async function guestFrame(page,config,timeout=20000) {
  await page.waitForFunction(()=>!!document.querySelector('#sb-nye-isolated-host'),null,{timeout});
  const until=Date.now()+20000;
  while(Date.now()<until) {
    const frame=page.frames().find(frame=>frame!==page.mainFrame()&&frame.url().startsWith(config.serviceOrigin+'/?embed='));
    if(frame){await frame.locator('#sb-title').waitFor({timeout:15000});return frame;}
    await new Promise(done=>setTimeout(done,200));
  }
  throw new RehearsalError('IFRAME_AUTH_OR_LOAD_FAILURE: authenticate both top-level apps; do not bypass Access or cookie policy');
}
async function exitParent(page) {
  const point=await page.evaluate(()=>{const box=window.__nyeCloudRoot?.querySelector('button')?.getBoundingClientRect();return box?{x:box.x+box.width/2,y:box.y+box.height/2}:null;});
  if(!point)throw new RehearsalError('Independent parent Continue button is unavailable');
  await page.mouse.click(point.x,point.y);await page.waitForFunction(()=>!document.querySelector('#sb-nye-isolated-host'));
}
async function visibleExperience(page,frame,check) {
  check(await page.evaluate(label=>window.__nyeCloudRoot?.querySelector('button')?.textContent.includes(label),STAGING_LABEL),'Independent parent control retains the exact staging label');
  check((await frame.locator('[data-nye-staging-notice]').innerText()).includes(STAGING_LABEL),'Guest screen retains the exact staging label');
  check(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.body.scrollWidth<=innerWidth),'Guest iframe has no horizontal overflow');
  check(await frame.locator('.sb-year').evaluate(e=>getComputedStyle(e).color)==='rgb(245, 240, 230)','Prominent year keeps the approved ivory color');
  check(await frame.evaluate(()=>document.visibilityState==='visible'),'Guest document is foreground visible');
}
export async function installNetworkFailure(page,config,scenario,report) {
  const abort=route=>{report.injectedNetworkFailures++;return route.abort('failed');};
  if(scenario==='failure-time')await page.route(config.serviceOrigin+'/api/time',abort);
  if(scenario==='failure-frame')await page.route(url=>url.origin===config.serviceOrigin&&url.searchParams.has('embed'),abort);
}
export async function installDeviceDateSimulation(context,config) {
  await context.addInitScript(({origins,epoch})=>{
    if(!origins.includes(location.origin))return;
    const NativeDate=Date,offset=epoch-NativeDate.now();
    window.Date=class SimulatedDeviceDate extends NativeDate {
      constructor(...args){super(...(args.length?args:[NativeDate.now()+offset]));}
      static now(){return NativeDate.now()+offset;}
    };
  },{origins:[config.websiteOrigin,config.serviceOrigin],epoch:EVENT.midnight+86400000});
}
export function freshAccessState(state) {
  return {...state,cookies:state.cookies.filter(cookie=>cookie.name!=='__Host-sb_nye')};
}
async function run(context,config,profile,options) {
  const clock=await timeFromSession(context,config),wait=checkTime(options.scenario,clock);
  const report={scenario:options.scenario,page:options.page,viewport:options.viewport,startedAt:new Date().toISOString(),serverNow:clock.serverNow,
    environment:'Authenticated private cloud staging; native Chromium profile and real server-anchored time',checks:[],
    limitations:['Desktop emulation does not verify a physical iPhone.','No server clock override, deployment, station setup or production change is performed by this helper.'],
    javaScriptErrors:0,unexpectedCspErrors:0,expectedBlockedAnalytics:0,injectedNetworkFailures:0};
  const out=resolve(profile,'run-'+options.scenario+'-'+Date.now());await mkdir(out,{mode:0o700});
  const check=(condition,label)=>{report.checks.push({label,passed:!!condition});if(!condition)throw new RehearsalError('CHECK_FAILED: '+label);};
  // Observation only: retain the actual closed shadow root without changing its
  // mode, timing, origin, messages, native input events, or app behavior.
  await context.addInitScript(()=>{const original=Element.prototype.attachShadow;Element.prototype.attachShadow=function(options){const root=original.call(this,options);if(this.id==='sb-nye-isolated-host')window.__nyeCloudRoot=root;return root;};});
  if(options.scenario==='device-clock') {
    report.clientDateSimulation='Browser Date is advanced to one day after event midnight only on staging origins; real server and performance clocks remain unchanged.';
    await installDeviceDateSimulation(context,config);
  }
  const page=await context.newPage();
  page.on('pageerror',()=>report.javaScriptErrors++);
  page.on('console',message=>{if(message.type()==='error'&&/Content Security Policy|CSP|Refused to|violates.*directive/i.test(message.text())){
    if(/googletagmanager|google-analytics/i.test(message.text()))report.expectedBlockedAnalytics++;else report.unexpectedCspErrors++;
  }});
  // Failure scenarios inject only browser network loss against an authenticated
  // staging resource. They do not replace responses or add authorization.
  await installNetworkFailure(page,config,options.scenario,report);
  try {
    console.log('Running '+options.scenario+' at '+options.viewport+'. Keep the headed browser foreground; waiting uses the real server clock.');
    await page.goto(config.websiteOrigin+'/'+options.page+'.html',{waitUntil:'load',timeout:45000});await page.bringToFront();
    check(new URL(page.url()).origin===config.websiteOrigin,'Website was reached through its real Access session');
    check((await page.locator('[data-nye-staging-notice]').innerText()).includes(STAGING_LABEL),'Actual current website displays the exact staging label');
    await page.evaluate(()=>document.fonts.ready);const before=await originalSite(page),originalUrl=page.url();
    if(options.scenario==='recovery') {
      const recovery=page.locator('#sb-nye-pass-recovery');await recovery.waitFor({state:'visible',timeout:15000});
      check(await recovery.getAttribute('href')===config.serviceOrigin+'/?pass=1','Current website recovery link points to the same protected service');
      // Use a real top-level visit with the existing native cookie jar.
      await page.goto(await recovery.getAttribute('href'),{waitUntil:'load'});
      await page.locator('.sb-ticket').waitFor({timeout:15000});
      const code=await page.locator('.sb-ticket code').innerText();
      check(/^[1-9]\d{4}$/.test(code),'Native cookie recovers a five-digit test pass');
      check((await page.locator('.sb-ticket').innerText()).includes(STAGING_LABEL),'Recovered pass is explicitly non-redeemable');
      check((await page.locator('.sb-ticket').innerText()).includes('No purchase required.'),'Recovered pass preserves the no-purchase offer');
      await page.reload({waitUntil:'load'});await page.locator('.sb-ticket').waitFor({timeout:15000});
      check(await page.locator('.sb-ticket code').innerText()===code,'Refresh recovers the same persistent pass');
      const download=page.waitForEvent('download');await page.getByRole('button',{name:/Save test pass as an image/}).click();
      const saved=await download;await saved.saveAs(resolve(out,'TEST-ONLY-pass.png'));
      check((await lstat(resolve(out,'TEST-ONLY-pass.png'))).size>1000,'Native save-image download succeeds (inspect watermark in the private artifact)');
      await page.screenshot({path:resolve(out,'recovered-TEST-ONLY-pass.png')});
    } else if(options.scenario==='failure-time') {
      await page.waitForTimeout(6500);check(report.injectedNetworkFailures>0,'A real browser request to the time API was intercepted and failed');
      check(await page.locator('#sb-nye-isolated-host').count()===0,'Time service failure leaves the actual website available');
      await sitePreserved(page,before,check);
      await page.locator('.site-order summary').click();check(await page.locator('.site-order').getAttribute('open')!==null,'Current Order Online disclosure remains usable without following an ordering URL');
    } else if(options.scenario==='failure-frame') {
      await page.waitForFunction(()=>!!document.querySelector('#sb-nye-isolated-host'),null,{timeout:15000});
      check(report.injectedNetworkFailures>0,'A real browser request for the embedded document was intercepted and failed');
      check(await page.evaluate(label=>window.__nyeCloudRoot.querySelector('button').textContent.includes(label),STAGING_LABEL),'Failed iframe still has the exact staging label and independent Continue');
      await exitParent(page);await sitePreserved(page,before,check);
    } else {
      if(options.scenario==='opening')check(await page.locator('#sb-nye-isolated-host').count()===0,'Already-open current website is visible before 11:50 PM');
      const frame=await guestFrame(page,config,wait);await visibleExperience(page,frame,check);
      if(options.scenario==='opening')check((await timeFromSession(context,config,frame)).serverNow>=EVENT.start,'Takeover opened naturally only after the server opening boundary');
      if(options.scenario==='device-clock') {
        check(await frame.evaluate(()=>Date.now())>EVENT.midnight,'Explicit simulated browser Date is past event midnight');
        check(await frame.locator('.sb-year').innerText()==='2026','Server-anchored prominent year remains 2026 despite simulated future device Date');
        check(freshPromotionSession(await nativeJson(frame,'/api/state')),'Separate native Access context starts with an authenticated fresh promotion session');
        await frame.getByRole('textbox',{name:'Your first name'}).fill('Device Clock Test');await frame.getByRole('button',{name:/^Count me in/}).click();
        await frame.waitForFunction(()=>document.querySelector('#sb-card-holder h2')?.textContent.includes('Device Clock Test'));
        const state=await nativeJson(frame,'/api/state');
        if(!validClock(state)||state.serverNow>=EVENT.midnight)throw new RehearsalError('TIMING_PREREQUISITE: server must remain pre-midnight throughout the device-Date simulation');
        check(state.entry?.eligible===false&&state.pass===null,'Future browser Date does not grant midnight eligibility or issue a pass');
        check(await frame.locator('.sb-ticket').count()===0,'No premature pass is displayed');
      } else if(options.scenario==='midnight') {
        check(await frame.locator('.sb-year').innerText()==='2026','Prominent year is 2026 before midnight');
        const state=await nativeJson(frame,'/api/state');check(freshPromotionSession(state),'Authenticated staging explicitly confirms a fresh promotion session with null entry and pass');
        await frame.getByRole('textbox',{name:'Your first name'}).fill('Cloud Rehearsal');await frame.getByRole('button',{name:/^Count me in/}).click();
        await frame.waitForFunction(()=>document.querySelector('#sb-card-holder h2')?.textContent.includes('Cloud Rehearsal'));
        await frame.waitForFunction(()=>document.querySelector('.sb-year')?.textContent==='2027',null,{timeout:wait});
        check((await timeFromSession(context,config,frame)).serverNow>=EVENT.midnight,'Year switches to 2027 on the real server midnight boundary');
        check((await frame.locator('#sb-title').innerText()).replace(/\s+/g,' ')==='Happy New Year!','Happy New Year appears at midnight');
        check(await frame.locator('.sb-fireworks').evaluate(e=>getComputedStyle(e).display!=='none'&&e.width>0),'Approved fireworks canvas remains available (visual inspection required)');
        await frame.locator('.sb-ticket').waitFor({timeout:15000});
        check((await frame.locator('.sb-ticket').innerText()).includes(STAGING_LABEL),'Server-issued midnight pass retains exact non-redeemable label');
        check((await frame.locator('.sb-ticket').innerText()).includes('No purchase required.'),'Server-issued pass retains the no-purchase offer');
        const cookie=(await context.cookies(config.serviceOrigin)).find(c=>c.name==='__Host-sb_nye');
        check(cookie?.secure&&cookie.httpOnly&&cookie.path==='/'&&cookie.sameSite==='Lax','Real HTTPS guest cookie keeps Secure, HttpOnly and host-prefix policy');
      } else if(options.scenario==='ending') {
        await page.waitForFunction(()=>!document.querySelector('#sb-nye-isolated-host'),null,{timeout:wait});
        check(page.url()===originalUrl,'12:05 AM returns to the exact original page URL');await sitePreserved(page,before,check);
        check((await timeFromSession(context,config,page)).serverNow>=EVENT.end,'Takeover closes naturally at the server ending boundary');
      } else if(options.scenario==='continue') {
        await frame.getByRole('button',{name:/Continue to the website/}).click();await page.waitForFunction(()=>!document.querySelector('#sb-nye-isolated-host'));
        check(page.url()===originalUrl,'Guest Continue reveals the exact original page');await sitePreserved(page,before,check);
        await page.reload({waitUntil:'load'});await page.waitForTimeout(2500);
        check(continuedWithinWindow(await timeFromSession(context,config,page)),'Server clock remains inside the active window after reload');
        check(await page.locator('#sb-nye-isolated-host').count()===0,'Continue stays dismissed after reload in the same tab');
        const next=options.page==='about'?'contact':'about';await page.goto(config.websiteOrigin+'/'+next+'.html',{waitUntil:'load'});await page.waitForTimeout(2500);
        check(continuedWithinWindow(await timeFromSession(context,config,page)),'Server clock remains inside the active window after internal navigation');
        check(await page.locator('#sb-nye-isolated-host').count()===0,'Continue stays dismissed after internal same-tab navigation');
      } else {
        check(await frame.locator('.sb-year').innerText()===((await timeFromSession(context,config,frame)).serverNow<EVENT.midnight?'2026':'2027'),'Active-window arrival displays the server-appropriate year');
      }
      await page.screenshot({path:resolve(out,'TEST-ONLY-'+options.scenario+'.png')});
    }
    check(report.javaScriptErrors===0,'No uncaught JavaScript errors');
    check(report.unexpectedCspErrors===0,'No unexpected CSP violations (staging intentionally blocks production analytics)');
    report.passed=true;
  } catch(error) {
    report.passed=false;report.failure=error instanceof RehearsalError?error.message:'Browser step failed or timed out; inspect the private browser and prerequisite state, never bypass Access';
    throw new RehearsalError(report.failure);
  } finally {
    report.completedAt=new Date().toISOString();await privateJson(resolve(out,'report.json'),report);
    if(options.scenario!=='device-clock')await saveState(context,profile);
    console.log(JSON.stringify({scenario:options.scenario,passed:report.passed,assertions:report.checks.length,privateReport:resolve(out,'report.json')}));
  }
}
export async function main(args=process.argv.slice(2)) {
  const options=browserOptions(args),config=browserConfiguration(JSON.parse(await readFile(resolve(options.configPath),'utf8')));
  const profile=await privateProfile(options.profile),context=await launch(options,config,profile);
  try {
    if(options.mode==='login')await login(context,config,profile,options.staff);
    else if(options.scenario==='device-clock') {
      const [width,height]=options.viewport.split('x').map(Number);
      const isolated=await context.browser().newContext({storageState:freshAccessState(await context.storageState()),viewport:{width,height},acceptDownloads:true});
      try {await run(isolated,config,profile,options);}finally {await isolated.close();}
    } else await run(context,config,profile,options);
  } finally {await saveState(context,profile).catch(()=>{});await context.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error instanceof RehearsalError?error.message:'Browser helper could not complete. Check the documented arguments, native browser sign-in and local profile permissions. No credentials are logged.');process.exitCode=1;});

/* Loopback-only browser integration checks. No cloud services or real rewards. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const SITE = process.env.NYE_SITE_ORIGIN || 'http://127.0.0.1:8788';
const SERVICE = process.env.NYE_SERVICE_ORIGIN || 'http://127.0.0.1:8787';
const OUT = path.resolve(process.env.NYE_QA_DIR || '.local/browser-integration-qa');
const CONTROL = process.env.NYE_CONTROL_TOKEN || 'local-test-control-token';
const STAFF = process.env.NYE_STAFF_TOKEN || 'local-test-staff-token';
const WILLOW = process.env.NYE_WB_STAFF_TOKEN || 'local-test-wb-token';
const DISABLED_REFERENCE = path.resolve(__dirname, '../src/integration-loader.js');
const SIZES = [[320,568],[375,812],[768,1024],[1366,768],[1440,900]].filter(([width])=>!process.env.NYE_QA_WIDTHS||process.env.NYE_QA_WIDTHS.split(',').includes(String(width)));
const PAGES = ['index','brand-home','fort-worth','willow-bend','menu','willow-bend-menu','menus-order','locations','about','catering','events','contact'].filter(name=>!process.env.NYE_QA_PAGES||process.env.NYE_QA_PAGES.split(',').includes(name));
if(!SIZES.length||!PAGES.length)throw Error('No recognized widths or pages selected.');
const START = Date.parse('2027-01-01T05:50:00.000Z');
const MIDNIGHT = Date.parse('2027-01-01T06:00:00.000Z');
const END = Date.parse('2027-01-01T06:05:00.000Z');
const EXPIRES = Date.parse('2027-01-11T06:00:00.000Z');
const rows = [];
const errors = [];
const securityErrors = [];
const unexpectedRequests = [];
const scope = process.env.NYE_QA_SCOPE || 'all';
for (const origin of [SITE,SERVICE]) {
  const u = new URL(origin);
  if (u.protocol !== 'http:' || !['127.0.0.1','localhost','[::1]'].includes(u.hostname)) throw Error('This harness accepts loopback HTTP origins only.');
}
fs.mkdirSync(OUT, {recursive:true});
function check(row, condition, label, detail) {
  row.checks++;
  if (row.assertions) row.assertions.push({label,passed:!!condition,...(detail===undefined?{}:{detail})});
  if (!condition) row.findings.push({label, ...(detail === undefined ? {} : {detail})});
}
function save() {
  const summary = {environment:'Native local HTTP, cross-origin iframe, native Chromium cookies, local SQLite and test-only station authentication; no fetch bridge or cloud services.',
    scenarios:rows.length, checks:rows.reduce((n,r)=>n+r.checks,0), findings:rows.flatMap(r=>r.findings.map(f=>({scenario:r.name,...f}))), errors, securityErrors, unexpectedRequests,
    limitations:['Desktop Chromium mobile emulation is not a physical iPhone or Android test.','Loopback ports exercise distinct origins but share a hostname and site. Production HTTPS cookie policy and Cloudflare Access remain unverified.','Server time is controlled only through the loopback laboratory endpoint. No production promotion was tested.']};
  fs.writeFileSync(path.join(OUT,'browser-integration-results.json'),JSON.stringify(rows,null,2));
  fs.writeFileSync(path.join(OUT,'browser-integration-summary.json'),JSON.stringify(summary,null,2));
  return summary;
}
async function scenario(name, fn) {
  const row={name,checks:0,findings:[]}; rows.push(row);
  try { await fn(row); } catch (error) {row.findings.push({label:'Scenario exception',detail:String(error.stack || error)});}
  save(); console.log(JSON.stringify({scenario:name,checks:row.checks,findings:row.findings.length}));
}
async function clock(now, freeze=true) {
  const response=await fetch(SERVICE+'/__lab/time',{method:'POST',headers:{Origin:SERVICE,'Content-Type':'application/json','X-Lab-Control':CONTROL},body:JSON.stringify({now,freeze})});
  if (!response.ok) throw Error('Local clock control failed: '+response.status);
}
async function context(browser,options={}) {
  const c=await browser.newContext({acceptDownloads:true,...options});
  await c.addInitScript(()=>{
    const original=Element.prototype.attachShadow;
    Element.prototype.attachShadow=function(options){
      const root=original.call(this,options);
      if(this.id==='sb-nye-isolated-host')window.__nyeQaClosedRoot=root;
      return root;
    };
  });
  await c.route('**/*',route=>{
    const u=new URL(route.request().url());
    if([new URL(SITE).origin,new URL(SERVICE).origin].includes(u.origin)||['fonts.googleapis.com','fonts.gstatic.com'].includes(u.hostname)||['data:','blob:','about:'].includes(u.protocol))return route.continue();
    if(!/googletagmanager|google-analytics|formspree\.io/.test(u.hostname))unexpectedRequests.push({origin:u.origin,path:u.pathname});
    return route.abort();
  });
  c.on('page',p=>{
    p.on('pageerror',e=>errors.push({url:p.url(),message:String(e)}));
    p.on('console',message=>{if(message.type()==='error'&&/Content Security Policy|CSP|Refused to|violates.*directive/i.test(message.text()))securityErrors.push({url:p.url(),message:message.text()});});
  });
  return c;
}
async function load(page,name='index') {
  await page.goto(SITE+'/'+name+'.html',{waitUntil:'load',timeout:20000});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(100);
}
async function sync(page) {
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
}
async function guestFrame(page) {
  await page.waitForFunction(()=>document.querySelector('#sb-nye-isolated-host'),null,{timeout:10000});
  const frame=await new Promise((resolve,reject)=>{
    const end=Date.now()+10000;
    const poll=()=>{const f=page.frames().find(f=>f!==page.mainFrame()&&f.url().startsWith(SERVICE+'/'));if(f)resolve(f);else if(Date.now()>end)reject(Error('No local cross-origin guest iframe'));else setTimeout(poll,50);};poll();
  });
  await frame.waitForSelector('#sb-title',{timeout:15000});
  return frame;
}
async function savedSite(page) {
  return page.evaluate(()=>{
    const copy=selector=>{const e=document.querySelector(selector);if(!e)return null;const clone=e.cloneNode(true);clone.querySelectorAll('#sb-nye-pass-recovery').forEach(e=>e.remove());return clone.outerHTML;};
    const selectors=['main','.site-header','.site-footer','[data-seasonal-anchor]','[data-seasonal-art]','[data-seasonal-year]','[data-seasonal-trim]'];
    window.__nyeQaOriginalNodes=selectors.map(s=>document.querySelector(s));
    return {markup:['main','.site-header','.site-footer'].map(copy),theme:document.documentElement.dataset.sbSeason||'off',year:document.querySelector('[data-seasonal-year]')?.textContent,
      order:[...document.querySelectorAll('a[href*="cash.app"]')].map(a=>a.getAttribute('href')),
      seasonalIncludes:[...document.querySelectorAll('link[href*="seasonal"],script[src*="seasonal"]')].map(e=>e.outerHTML),
      canonical:document.querySelector('link[rel="canonical"]')?.href,
      foreground:getComputedStyle(document.querySelector('main h1')).color,
      background:getComputedStyle(document.querySelector('[data-seasonal-anchor]')).backgroundImage};
  });
}
async function preserved(page,before,row) {
  const result=await page.evaluate(()=>{
    const selectors=['main','.site-header','.site-footer','[data-seasonal-anchor]','[data-seasonal-art]','[data-seasonal-year]','[data-seasonal-trim]'];
    return selectors.every((s,i)=>document.querySelector(s)===window.__nyeQaOriginalNodes[i]);
  });
  check(row,result,'Actual current website and seasonal DOM nodes are retained');
  const after=await savedSite(page);
  check(row,JSON.stringify(after)===JSON.stringify(before),'Current business markup, ordering URLs, canonical, seasonal includes, palette and year unchanged');
  check(row,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Restored current website has no horizontal overflow');
}
async function parentExit(page) {
  const point=await page.evaluate(()=>{const r=window.__nyeQaClosedRoot.querySelector('button').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
  await page.mouse.click(point.x,point.y);
  await page.waitForFunction(()=>!document.querySelector('#sb-nye-isolated-host'));
}
async function geometry(page,frame,row) {
  const d=await page.evaluate(()=>{const root=window.__nyeQaClosedRoot,dialog=root.querySelector('dialog'),b=dialog.getBoundingClientRect(),button=root.querySelector('button').getBoundingClientRect();return{closed:document.querySelector('#sb-nye-isolated-host').shadowRoot===null,open:dialog.open,x:b.x,y:b.y,w:b.width,h:b.height,viewport:[innerWidth,innerHeight],exitHeight:button.height,focus:root.activeElement===root.querySelector('button')};});
  check(row,d.closed&&d.open,'Takeover uses a closed shadow root and native modal dialog');
  check(row,Math.abs(d.x)<1&&Math.abs(d.y)<1&&Math.abs(d.w-d.viewport[0])<1&&Math.abs(d.h-d.viewport[1])<1,'Dialog fills the viewport without clipping',d);
  check(row,d.exitHeight>=44&&d.focus,'Continue control is reachable and receives initial focus');
  const f=await frame.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,body:document.body.scrollWidth,year:document.querySelector('.sb-year')?.textContent,color:getComputedStyle(document.querySelector('.sb-year')).color,offer:document.querySelector('.sb-offer')?.textContent,inputs:[...document.querySelectorAll('#sb-register input')].map(e=>e.name),motion:document.querySelector('.sb-app')?.dataset.motion}));
  check(row,f.width<=f.viewport&&f.body<=f.viewport,'Native iframe content has no horizontal overflow',f);
  check(row,f.year==='2026'&&f.color==='rgb(245, 240, 230)','Before midnight the prominent year is ivory 2026');
  check(row,f.offer==='Ring in the New Year with us! Enter your name and stay until midnight to unlock one free cookie. No purchase required. Redeem at either Sour Boule location through January 3, 2027.','Locked no-purchase offer is reproduced exactly');
  check(row,JSON.stringify(f.inputs)==='["firstName"]','Registration requests first name only');
}
async function matrix(browser) {
  for(const [width,height] of SIZES){
    const c=await context(browser,{viewport:{width,height}});
    for(const name of PAGES)await scenario(`Current ${name} at ${width}x${height}`,async row=>{
      await clock(START-60000);const page=await c.newPage();
      try {
        await load(page,name);check(row,await page.locator('#sb-nye-isolated-host').count()===0,'No takeover before 11:50 PM Chicago');
        await page.locator('.site-order summary').focus();const before=await savedSite(page);
        await clock(START);await sync(page);const frame=await guestFrame(page);await geometry(page,frame,row);
        if(['index','willow-bend-menu'].includes(name))await page.screenshot({path:path.join(OUT,`${name}-opening-${width}.png`)});
        check(row,await frame.evaluate(()=>location.origin)!==await page.evaluate(()=>location.origin),'Guest runs in a genuinely different origin');
        for(let n=0;n<9;n++)await page.keyboard.press('Tab');
        check(row,await page.evaluate(()=>document.activeElement===document.querySelector('#sb-nye-isolated-host')),'Native modal retains keyboard focus through the iframe');
        await parentExit(page);await preserved(page,before,row);
        check(row,await page.locator('.site-order summary').evaluate(e=>e===document.activeElement),'Continue restores the previously focused website control');
        await page.locator('.site-order summary').press('Enter');
        check(row,await page.locator('.site-order').getAttribute('open')!==null,'Current Order Online disclosure still opens');
        await page.keyboard.press('Escape');
        await page.reload({waitUntil:'load'});await page.waitForTimeout(600);
        check(row,await page.locator('#sb-nye-isolated-host').count()===0,'Session dismissal survives a page reload');
      } finally {await page.close();}
    });
    await c.close();
  }
}
async function flow(browser) {
  for(const [width,height] of SIZES)await scenario(`Native guest/staff flow at ${width}x${height}`,async row=>{
    const c=await context(browser,{viewport:{width,height}});const page=await c.newPage();
    try {
      await clock(START-1000);await load(page,'index');const before=await savedSite(page);
      await clock(MIDNIGHT-15000);await sync(page);const frame=await guestFrame(page);
      await frame.getByRole('textbox',{name:'Your first name'}).fill('Integration Guest');
      await frame.getByRole('button',{name:/^Count me in/}).click();
      await frame.waitForFunction(()=>document.querySelector('#sb-card-holder h2')?.textContent.includes('Integration Guest'));
      const cookies=await c.cookies(SERVICE);const cookie=cookies.find(v=>v.name.includes('sb_nye'));
      check(row,!!cookie&&cookie.httpOnly,'Browser accepts the real local HttpOnly guest cookie');
      check(row,await frame.evaluate(()=>!document.cookie.includes('sb_nye')),'Guest session cookie is not exposed to JavaScript');
      const pre=await frame.evaluate(async()=>{const r=await fetch('/api/state',{cache:'no-store'});return r.json();});
      check(row,pre.entry?.firstName==='Integration Guest'&&!pre.pass,'Native iframe registration persisted without premature pass');
      await clock(MIDNIGHT);await sync(frame);
      await frame.waitForSelector('.sb-ticket',{timeout:12000});
      const code=await frame.locator('.sb-ticket code').innerText();
      check(row,/^[1-9]\d{4}$/.test(code),'Eligible native session receives one real five-digit local test code');
      check(row,await frame.locator('.sb-year').innerText()==='2027','Server-anchored midnight switches the prominent year to 2027');
      check(row,(await frame.locator('.sb-ticket').innerText()).includes('No purchase required.'),'Earned pass retains the locked no-purchase offer');
      check(row,(await frame.locator('.sb-ticket').innerText()).includes('TEST ONLY'),'Local reward is clearly marked as a test');
      if(width===375){const download=page.waitForEvent('download');await frame.getByRole('button',{name:/Save sample pass as an image/}).click();await(await download).saveAs(path.join(OUT,'native-local-sample-pass.png'));check(row,fs.statSync(path.join(OUT,'native-local-sample-pass.png')).size>1000,'Native browser saves a watermarked sample pass image');}
      await page.screenshot({path:path.join(OUT,`native-midnight-${width}.png`)});
      await clock(END);await sync(page);await page.waitForFunction(()=>!document.querySelector('#sb-nye-isolated-host'),null,{timeout:4000});
      await preserved(page,before,row);
      const recovery=page.locator('#sb-nye-pass-recovery');await recovery.waitFor({state:'visible'});
      check(row,await recovery.getAttribute('href')===SERVICE+'/?pass=1','Post-takeover recovery link uses the same service origin');
      const recoveryPage=await c.newPage();await recoveryPage.goto(await recovery.getAttribute('href'),{waitUntil:'load'});
      try {await recoveryPage.waitForSelector('.sb-ticket',{timeout:10000});}
      catch(error){
        const diagnosis=await recoveryPage.evaluate(async()=>{const r=await fetch('/api/state',{cache:'no-store'}),d=await r.json();return{text:document.body.innerText,state:{entry:!!d.entry,pass:!!d.pass,eligible:d.entry?.eligible,phase:d.phase,mode:d.mode},url:location.href};});
        fs.writeFileSync(path.join(OUT,`recovery-diagnosis-${width}.json`),JSON.stringify(diagnosis,null,2));
        await recoveryPage.screenshot({path:path.join(OUT,`recovery-failure-${width}.png`)});
        throw error;
      }
      check(row,await recoveryPage.locator('.sb-ticket code').innerText()===code,'Top-level recovery returns the same persistent native-cookie pass');
      await recoveryPage.close();
      await clock(MIDNIGHT+3600000);
      const staffContexts=[];
      try {
        for(const [token,location] of [[STAFF,'Fort Worth'],[WILLOW,'Willow Bend']]){
          const sc=await context(browser,{viewport:{width,height}});staffContexts.push(sc);const sp=await sc.newPage();let payloadKeys;
          sp.on('request',request=>{if(new URL(request.url()).pathname==='/api/staff/redeem')payloadKeys=Object.keys(request.postDataJSON()).sort();});
          await sp.goto(SERVICE+'/__lab/login',{waitUntil:'load'});await sp.locator('#token').fill(token);await sp.getByRole('button',{name:'Open local redemption lab'}).click();
          await sp.waitForFunction(()=>document.querySelector('#station-location')?.textContent!=='Checking station');
          check(row,await sp.locator('#station-location').innerText()===location,`${location} station identity is fixed by local authentication`);
          check(row,await sp.locator('select,input[type="checkbox"]').count()===0,'Staff has no location picker or purchase checkbox');
          check(row,await sp.locator('#code').getAttribute('inputmode')==='numeric'&&await sp.locator('#code').getAttribute('maxlength')==='5','Staff input requests five numeric digits');
          await sp.locator('#code').fill(code);await sp.getByRole('button',{name:'Check code',exact:true}).click();
          await sp.waitForFunction(()=>document.querySelector('#result')?.textContent.trim().length>0);
          if(location==='Fort Worth'){
            check(row,(await sp.locator('#result').innerText()).includes('Ready to redeem'),'Protected staff verifies the persisted eligible pass');
            await sp.getByRole('button',{name:'Redeem cookie',exact:true}).click();await sp.waitForFunction(()=>document.querySelector('#result')?.textContent.includes('Give one cookie.'));
            check(row,JSON.stringify(payloadKeys)==='["code","requestId"]','Native redemption sends only code and idempotency key');
            await sp.getByRole('button',{name:'Next guest',exact:true}).click();
            check(row,await sp.locator('#code').inputValue()===''&&await sp.locator('#code').evaluate(e=>e===document.activeElement),'Next guest resets and focuses the five-digit field');
          } else check(row,(await sp.locator('#result').innerText()).includes('Already used')&&await sp.getByRole('button',{name:'Redeem cookie',exact:true}).count()===0,'Willow Bend immediately sees centrally used pass and cannot redeem twice');
          check(row,await sp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Staff page has no horizontal overflow');
          await sp.screenshot({path:path.join(OUT,`staff-${location.replaceAll(' ','-')}-${width}.png`),fullPage:true});
        }
      } finally {for(const sc of staffContexts)await sc.close();}
    } finally {await c.close();}
  });
}
async function boundaries(browser) {
  await scenario('Escape and guest Continue restore the actual current page',async row=>{
    for(const method of ['escape','guest']){
      const c=await context(browser,{viewport:{width:375,height:812}}),p=await c.newPage();
      try{await clock(START-60000);await load(p,'willow-bend');await p.locator('.site-order summary').focus();const before=await savedSite(p);await clock(START);await sync(p);const f=await guestFrame(p);
        if(method==='escape'){await f.locator('#sb-first-name').focus();await p.keyboard.press('Escape');}else await f.getByRole('button',{name:/Continue to the website/}).click();
        await p.waitForFunction(()=>!document.querySelector('#sb-nye-isolated-host'),null,{timeout:4000});await preserved(p,before,row);check(row,await p.locator('.site-order summary').evaluate(e=>e===document.activeElement),method+' restores prior focus');
      }finally{await c.close();}
    }
  });
  await scenario('Cross-origin messages are checked by both origin and source',async row=>{
    const c=await context(browser),p=await c.newPage();try{await clock(START);await load(p);const f=await guestFrame(p);
      await p.evaluate(service=>{window.dispatchEvent(new MessageEvent('message',{origin:service,source:window,data:{type:'sb-nye-close',reason:'dismissed'}}));const source=window.__nyeQaClosedRoot.querySelector('iframe').contentWindow;window.dispatchEvent(new MessageEvent('message',{origin:'https://invalid.example',source,data:{type:'sb-nye-close',reason:'dismissed'}}));},SERVICE);
      check(row,await p.locator('#sb-nye-isolated-host').count()===1,'Forged origin or wrong frame source cannot dismiss takeover');
      await f.evaluate(parentOrigin=>parent.postMessage({type:'sb-nye-close',reason:'dismissed'},parentOrigin),SITE);await p.waitForFunction(()=>!document.querySelector('#sb-nye-isolated-host'));check(row,true,'Message from the real service iframe is accepted');
    }finally{await c.close();}
  });
  await scenario('Long-open event reaches 12:05 and recovery expiry without reload',async row=>{
    const c=await context(browser),p=await c.newPage();try{await clock(END-3000);await load(p);await guestFrame(p);await p.waitForFunction(()=>!document.querySelector('#sb-nye-isolated-host'),null,{timeout:6000});check(row,true,'Server-anchored clock automatically removes takeover at 12:05');
      check(row,await p.locator('#sb-nye-pass-recovery').isVisible(),'Recovery remains accessible after automatic removal');
      await clock(EXPIRES-1500);await sync(p);await p.waitForFunction(()=>document.querySelector('#sb-nye-pass-recovery')?.hidden,null,{timeout:4000});check(row,true,'Recovery visibility updates at support expiry without a page reload');
    }finally{await c.close();}
  });
  await scenario('Reduced motion preserves the year transition and accessible controls',async row=>{
    const c=await context(browser,{viewport:{width:320,height:568},reducedMotion:'reduce'}),p=await c.newPage();try{await clock(MIDNIGHT-10000);await load(p);const f=await guestFrame(p);check(row,await f.locator('.sb-app').getAttribute('data-motion')==='off','System reduced-motion preference is honored');
      check(row,await f.locator('.sb-year').innerText()==='2026','Reduced-motion final countdown remains 2026');await clock(MIDNIGHT);await sync(f);await f.waitForFunction(()=>document.querySelector('.sb-year')?.textContent==='2027');check(row,true,'Reduced-motion midnight immediately shows 2027');
      check(row,await f.evaluate(()=>document.getAnimations().every(a=>a.playState!=='running')),'Reduced-motion presentation has no running CSS animations');
      const clear=await f.evaluate(()=>{const c=document.querySelector('.sb-fireworks');return !c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0);});check(row,clear,'Reduced motion suppresses canvas fireworks');
      await p.screenshot({path:path.join(OUT,'reduced-motion-midnight-320.png')});await parentExit(p);
    }finally{await c.close();}
  });
}
async function failures(browser) {
  await scenario('Disabled source reference performs no integration requests or DOM changes',async row=>{
    const c=await context(browser),p=await c.newPage();const calls=[];
    try{await c.route(SITE+'/assets/js/new-year-2027.js',r=>r.fulfill({status:200,contentType:'text/javascript',body:fs.readFileSync(DISABLED_REFERENCE,'utf8')}));p.on('request',r=>{if(r.url().startsWith(SERVICE))calls.push(r.url());});await clock(START);await load(p);await p.waitForTimeout(400);
      check(row,calls.length===0,'Disabled source reference makes zero service requests');check(row,await p.locator('#sb-nye-isolated-host,#sb-nye-pass-recovery').count()===0,'Disabled source reference adds no modal or recovery link');check(row,await p.locator('main h1').isVisible(),'Current website remains usable');
    }finally{await c.close();}
  });
  await scenario('Time-service failure leaves the website usable',async row=>{
    const c=await context(browser),p=await c.newPage();try{await c.route(SERVICE+'/api/time',r=>r.abort());await clock(START);await load(p,'contact');await p.waitForTimeout(600);check(row,await p.locator('#sb-nye-isolated-host').count()===0,'Unavailable event clock cannot cover the website');check(row,await p.locator('main h1').isVisible(),'Original content remains visible');await p.locator('.site-order summary').click();check(row,await p.locator('.site-order a').first().isVisible(),'Original order links remain usable');}finally{await c.close();}
  });
  await scenario('Iframe failure retains an independent parent Continue control',async row=>{
    const c=await context(browser),p=await c.newPage();try{await c.route(SERVICE+'/?embed=1*',r=>r.abort());await clock(START-60000);await load(p);const before=await savedSite(p);await clock(START);await sync(p);await p.waitForFunction(()=>document.querySelector('#sb-nye-isolated-host'));await parentExit(p);await preserved(p,before,row);}finally{await c.close();}
  });
  await scenario('JavaScript-disabled site retains ordinary content and ordering links',async row=>{
    const c=await context(browser,{javaScriptEnabled:false,viewport:{width:320,height:568}}),p=await c.newPage();try{await clock(START);await p.goto(SITE+'/willow-bend.html');check(row,await p.locator('main h1').isVisible(),'Business content is visible without JavaScript');check(row,await p.locator('#sb-nye-isolated-host').count()===0,'No takeover is injected without JavaScript');await p.locator('.site-order summary').click();check(row,await p.locator('.site-order a').count()===2,'Native ordering disclosure retains both direct ordering links');}finally{await c.close();}
  });
  await scenario('Repeated loader inclusion cannot create duplicate integration layers',async row=>{
    const c=await context(browser),p=await c.newPage();try{await clock(START);await load(p);await guestFrame(p);await p.addScriptTag({url:SITE+'/assets/js/new-year-2027.js'});check(row,await p.locator('#sb-nye-isolated-host').count()===1,'One native modal host after duplicate inclusion');check(row,await p.locator('#sb-nye-pass-recovery').count()===1,'One recovery link after duplicate inclusion');await parentExit(p);}finally{await c.close();}
  });
}
async function checkpoint(browser) {
  // Observe ordinary navigation and lifecycle events without invoking application callbacks.
  async function observe(page) {
    const audit={timeRequests:[],navigations:[],started:performance.now()};
    await page.addInitScript(()=>{
      window.__nyeQaCheckpointDocument=document;
      window.__nyeQaLifecycle=[];
      for(const type of ['pageshow','visibilitychange'])addEventListener(type,event=>window.__nyeQaLifecycle.push({type,trusted:event.isTrusted}));
    });
    page.on('request',request=>{
      if(request.frame()!==page.mainFrame())return;
      if(request.url()===SERVICE+'/api/time')audit.timeRequests.push(Math.round(performance.now()-audit.started));
      if(request.isNavigationRequest())audit.navigations.push(request.url());
    });
    return audit;
  }
  async function uninterrupted(page,audit,row) {
    check(row,audit.navigations.length===1,'Boundary crossed without reloading or navigating the current document',audit.navigations);
    const lifecycle=await page.evaluate(()=>({sameDocument:window.__nyeQaCheckpointDocument===document,events:window.__nyeQaLifecycle}));
    check(row,lifecycle.sameDocument,'The original browser Document object is retained');
    check(row,lifecycle.events.every(event=>event.trusted),'No synthetic pageshow or visibilitychange event triggered synchronization',lifecycle.events);
  }
  await scenario('Already-open homepage crosses 23:50 automatically; Continue persists through ticks and same-tab navigation',async row=>{
    row.assertions=[];
    const c=await context(browser,{viewport:{width:1366,height:768}}),p=await c.newPage();
    try {
      const audit=await observe(p);
      await clock(START-70000,false);audit.started=performance.now();
      await load(p);await p.locator('.site-order summary').focus();const before=await savedSite(p);
      check(row,await p.locator('#sb-nye-isolated-host').count()===0,'Ordinary homepage is visible before the event window');
      console.log('Checkpoint: waiting for the real 60-second periodic refresh and 70-second automatic opening.');
      await p.waitForRequest(request=>request.frame()===p.mainFrame()&&request.url()===SERVICE+'/api/time'&&performance.now()-audit.started>55000,{timeout:67000});
      check(row,audit.timeRequests.some(elapsed=>elapsed>55000),'Already-open page makes its scheduled time-service refresh without user activity',audit.timeRequests);
      check(row,await p.locator('#sb-nye-isolated-host').count()===0,'Scheduled refresh before 23:50 does not open the celebration early');
      await p.waitForFunction(()=>document.querySelector('#sb-nye-isolated-host'),null,{timeout:16000});
      const openedAfterMs=Math.round(performance.now()-audit.started),frame=await guestFrame(p);
      row.timing={clockMode:'advancing loopback server; real browser timers',secondsBeforeStart:70,openedAfterMs,timeRequestOffsetsMs:audit.timeRequests};
      check(row,openedAfterMs>=69000&&openedAfterMs<78000,'Takeover opens naturally at 23:50 after the 70-second pre-event wait',openedAfterMs);
      await geometry(p,frame,row);await uninterrupted(p,audit,row);
      await p.screenshot({path:path.join(OUT,'checkpoint-automatic-opening-1366.png')});
      await parentExit(p);await preserved(p,before,row);
      check(row,await p.locator('.site-order summary').evaluate(e=>e===document.activeElement),'Continue restores the previously focused current-site control');
      await p.waitForTimeout(1800);
      check(row,await p.locator('#sb-nye-isolated-host').count()===0,'Continue prevents reopening across subsequent automatic event-window ticks');
      await p.locator('.site-nav > a[href="locations.html"]').click();
      await p.waitForURL(SITE+'/locations.html');await p.waitForLoadState('load');await p.waitForTimeout(1800);
      check(row,await p.locator('main h1').isVisible(),'Same-tab Locations navigation reaches the real current website');
      check(row,await p.locator('#sb-nye-isolated-host').count()===0,'Event-window arrival on another page in the dismissed tab cannot force reopening');
      check(row,await p.evaluate(()=>sessionStorage.getItem('sb-nye-2027-dismissed'))==='1','Dismissal remains scoped to the same tab browsing session');
      await p.locator('.site-order summary').click();
      check(row,await p.locator('.site-order a').count()===2&&await p.locator('.site-order a').first().isVisible(),'Ordinary ordering disclosure remains usable after same-tab navigation');
    } finally {await c.close();}
  });
  await scenario('Active-window arrival naturally changes the prominent year from 2026 to 2027 at midnight',async row=>{
    row.assertions=[];
    const c=await context(browser,{viewport:{width:375,height:812}}),p=await c.newPage();
    try {
      const audit=await observe(p);await clock(MIDNIGHT-7000,false);audit.started=performance.now();
      await load(p,'willow-bend');const before=await savedSite(p),frame=await guestFrame(p);
      check(row,await p.locator('#sb-nye-isolated-host').count()===1,'A fresh visitor arriving inside the event window opens automatically');
      check(row,await frame.locator('.sb-year').innerText()==='2026','The prominent year remains 2026 before Chicago midnight');
      check(row,await frame.locator('.sb-app').getAttribute('data-phase')==='final','Arrival during the final minute reaches the final-countdown phase');
      check(row,await p.locator('#sb-nye-pass-recovery').isHidden(),'Pass-recovery utility stays hidden before midnight');
      await frame.waitForFunction(()=>document.querySelector('.sb-year')?.textContent==='2027',null,{timeout:12000});
      row.timing={clockMode:'advancing loopback server; real browser timers',secondsBeforeMidnight:7,yearChangedAfterMs:Math.round(performance.now()-audit.started)};
      check(row,await frame.locator('.sb-year').getAttribute('aria-label')==='2027','Natural midnight updates both visible and accessible year to 2027');
      check(row,await frame.locator('.sb-app').getAttribute('data-phase')==='midnight','Natural midnight enters the celebration phase');
      await p.waitForFunction(()=>document.querySelector('#sb-nye-pass-recovery')?.hidden===false,null,{timeout:2000});
      check(row,true,'Parent recovery link updates at midnight on its own timer');
      await uninterrupted(p,audit,row);
      await p.screenshot({path:path.join(OUT,'checkpoint-natural-midnight-375.png')});
      await parentExit(p);await preserved(p,before,row);
    } finally {await c.close();}
  });
  await scenario('Natural 00:05 removal reveals the same original current-page DOM',async row=>{
    row.assertions=[];
    const c=await context(browser,{viewport:{width:320,height:568}}),p=await c.newPage();
    try {
      const audit=await observe(p);await clock(END-7000,false);audit.started=performance.now();
      await load(p,'contact');const before=await savedSite(p),frame=await guestFrame(p);
      check(row,await p.locator('#sb-nye-isolated-host').count()===1,'Fresh active-window arrival shortly before 00:05 opens automatically');
      check(row,await frame.locator('.sb-year').innerText()==='2027','Post-midnight arrival displays 2027 before automatic removal');
      await p.waitForFunction(()=>!document.querySelector('#sb-nye-isolated-host'),null,{timeout:12000});
      row.timing={clockMode:'advancing loopback server; real browser timers',secondsBeforeEnd:7,removedAfterMs:Math.round(performance.now()-audit.started)};
      check(row,row.timing.removedAfterMs>=6000&&row.timing.removedAfterMs<10000,'Automatic event-end timer removes the modal at 00:05',row.timing.removedAfterMs);
      await uninterrupted(p,audit,row);await preserved(p,before,row);
      check(row,await p.locator('main h1').isVisible(),'The same current Contact page is visible after automatic removal');
      check(row,await p.locator('#sb-nye-pass-recovery').isVisible(),'Recovery link remains accessible after the natural event end');
      check(row,await p.locator('#sb-nye-pass-recovery').getAttribute('href')===SERVICE+'/?pass=1','Post-event recovery points to the persistent pass service');
      await p.locator('.site-order summary').click();
      check(row,await p.locator('.site-order a').first().isVisible(),'The original website ordering disclosure works after automatic removal');
      await p.screenshot({path:path.join(OUT,'checkpoint-natural-end-320.png')});
    } finally {await c.close();}
  });
}
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});
  try {
    if(scope==='all'||scope==='matrix')await matrix(browser);
    if(scope==='all'||scope==='flow')await flow(browser);
    if(scope==='all'||scope==='boundaries')await boundaries(browser);
    if(scope==='all'||scope==='failures')await failures(browser);
    if(scope==='all'||scope==='checkpoint')await checkpoint(browser);
  } finally {await browser.close();}
  const summary=save();console.log(JSON.stringify({scenarios:summary.scenarios,checks:summary.checks,findings:summary.findings.length,errors:errors.length,securityErrors:securityErrors.length,unexpectedRequests:unexpectedRequests.length}));
  if(summary.findings.length||errors.length||securityErrors.length||unexpectedRequests.length)process.exitCode=1;
})().catch(error=>{errors.push({message:String(error.stack||error)});save();console.error(error);process.exitCode=1;});

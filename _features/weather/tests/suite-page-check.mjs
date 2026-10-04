/* Isolated current-page network/performance/layout checks. Only the fixed Worker
 * origin is redirected to this local HTTPS fixture server; no forcing is shipped. */
import assert from 'node:assert/strict';
import {createServer} from 'node:https';
import {readFile,writeFile,mkdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,extname} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {brotliCompressSync,gzipSync} from 'node:zlib';
import {observation} from '../provider.mjs';
import {publicSnapshotV3,publicSnapshotV2} from '../backend.mjs';
import {sceneObservation} from './suite-fixtures.mjs';
const require=createRequire(new URL('../../new-year/package.json',import.meta.url));
const {chromium}=require(process.env.SB_PLAYWRIGHT||'playwright');
const root=fileURLToPath(new URL('../../../',import.meta.url));
const baseline=resolve(process.env.SB_WEATHER_BASELINE);
const out=resolve(process.env.SB_WEATHER_QA_OUTPUT||'/tmp/sb-weather-suite-page');
const section=process.env.SB_QA_SECTION||'comparison';
const origin='https://sour-boule-weather.lance-c84.workers.dev';
const scenes=JSON.parse(await readFile(new URL('./fixtures/suite-scenes.json',import.meta.url)));
await mkdir(out,{recursive:true});
execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-keyout',out+'/key.pem','-out',out+'/cert.pem','-days','1','-nodes','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
const publicKey=execFileSync('openssl',['x509','-in',out+'/cert.pem','-pubkey','-noout']);
const der=execFileSync('openssl',['pkey','-pubin','-outform','DER'],{input:publicKey});
const pin=createHash('sha256').update(der).digest('base64');
let base,mode='new',scene=scenes.find(s=>s.id==='rain-mist-day')||scenes.find(s=>s.precip==='rain'&&s.mist==='fog_mist'&&s.daypart==='day'),now;
let longLabel=false;
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.jpg':'image/jpeg','.png':'image/png','.ico':'image/x-icon'};
const server=createServer({key:await readFile(out+'/key.pem'),cert:await readFile(out+'/cert.pem')},async(req,res)=>{
 try{
  const url=new URL(req.url,base);let body,type,path;
  if(url.pathname.startsWith('/weather/')){
   const loc=url.pathname.endsWith('willow-bend')?'willow-bend':'fort-worth';
   const record=sceneObservation(scene,now);const snapshot=observation(record,'KFTW',now);
   assert.ok(snapshot,'Fixture observation accepted by actual provider');
   const value=url.pathname.includes('/v3/')?publicSnapshotV3({...snapshot,refreshSource:'scheduled'},loc,now,{enhanced:mode!=='off',readout:mode!=='off',lighting:true}):publicSnapshotV2({...snapshot,refreshSource:'scheduled'},loc,now);
   assert.ok(value,'Actual backend projection');
   if(longLabel&&value.version===3)value.conditionLabel='Freezing rain and fog with strong gusts and low visibility';
   body=Buffer.from(JSON.stringify(value));type='application/json';
  }else{
   const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
   path=url.pathname.startsWith('/textures/')?resolve(root,'_features/weather/textures-v3',name):resolve(root,name);
   if(mode==='legacy'&&name==='index.html')path=resolve(baseline,name);
   if(!(path.startsWith(root)||path.startsWith(baseline+'/'))||!(await stat(path)).isFile())throw Error('missing');
   body=await readFile(path);type=types[extname(path)]||'application/octet-stream';
   if(/\.(?:html|js)$/.test(path))body=Buffer.from(body.toString().replaceAll(origin,base));
  }
  const headers={'Content-Type':type,'Cache-Control':url.pathname.startsWith('/textures/')?'public, max-age=31536000, immutable':'public, max-age=300',Vary:'Accept-Encoding','Timing-Allow-Origin':'*'};
  if(type==='application/json'||/text|svg/.test(type)){body=brotliCompressSync(body);headers['Content-Encoding']='br';}
  headers['Content-Length']=body.length;res.writeHead(200,headers);res.end(body);
 }catch(e){res.writeHead(404);res.end('Not found');console.error('Local fixture request failed',req.url,e.message);}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));base='https://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,executablePath:process.env.SB_CHROME,args:['--ignore-certificate-errors-spki-list='+pin]});
const profiles=[{name:'desktop',width:1440,height:900,dpr:1,cpu:1},{name:'mobile390',width:390,height:844,dpr:2,cpu:4},{name:'mobile320',width:320,height:568,dpr:2,cpu:6}].filter(p=>!process.env.SB_QA_PROFILES||process.env.SB_QA_PROFILES.split(',').includes(p.name));
const evidence={kind:'Local fixture origin only; actual current page and generated runtime; CPU/network emulation, not physical devices',browser:browser.version(),startedAt:new Date().toISOString(),network:{latency:150,downloadMbps:1.6,uploadMbps:.75},section,runs:[],sizes:{}};
const weatherURL=url=>/\/(?:weather(?:[^/]*\.(?:js|css)|\/)|textures\/)/.test(url);
const pct=(a,p)=>a.length?[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*p))]:0;
async function newPage(context,profile){
 const page=await context.newPage();
 // Advance only wall time for the test observation; keep native performance,
 // Resource Timing, animation frames and timers for honest measurements.
 await page.addInitScript(fixed=>{const NativeDate=Date,offset=fixed-NativeDate.now();function FixtureDate(...args){if(!new.target)return new NativeDate(NativeDate.now()+offset).toString();return new NativeDate(...(args.length?args:[NativeDate.now()+offset]));}Object.setPrototypeOf(FixtureDate,NativeDate);FixtureDate.prototype=NativeDate.prototype;FixtureDate.now=()=>NativeDate.now()+offset;window.Date=FixtureDate;},now);
 const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Performance.enable');
 await cdp.send('Network.setBlockedURLs',{urls:['*googletagmanager.com/*','*google-analytics.com/*','*celebrate.thesourboule.com/*']});
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.cpu});
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1600000/8,uploadThroughput:750000/8,connectionType:'cellular4g'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 return{context,page,cdp,errors};
}
async function makeContext(profile){
 const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},deviceScaleFactor:profile.dpr,isMobile:profile.cpu!==1,hasTouch:profile.cpu!==1,ignoreHTTPSErrors:true});
 await context.addInitScript(off=>{
  if(off)localStorage.setItem('sb-weather-disabled-v1','1');
  const q=window.__suiteQA={nativeSlow:[],added:0,removed:0,paint:{},cls:0,shifts:[],longTasks:[],longFrames:[],costs:[],frames:[]};
  for(const type of['paint','largest-contentful-paint','layout-shift','longtask','long-animation-frame'])try{
   new PerformanceObserver(list=>{for(const e of list.getEntries()){
    if(type==='paint')q.paint[e.name]=e.startTime;
    else if(type==='largest-contentful-paint')q.lcp=e.startTime;
    else if(type==='layout-shift'){q.shifts.push({at:e.startTime,value:e.value,input:e.hadRecentInput,sources:e.sources?.map(s=>({node:s.node?.tagName,cls:s.node?.className,previous:s.previousRect,current:s.currentRect}))});if(!e.hadRecentInput)q.cls+=e.value;}
    else if(type==='longtask')q.longTasks.push({at:e.startTime,duration:e.duration});
    else q.longFrames.push({at:e.startTime,duration:e.duration,scripts:e.scripts?.map(s=>({url:s.sourceURL,duration:s.duration,fn:s.sourceFunctionName}))});
   }}).observe({type,buffered:true});
  }catch{}
  const original=requestAnimationFrame.bind(window),known=new WeakMap();
  window.requestAnimationFrame=fn=>{let match=known.get(fn);if(match===undefined){match=new Error().stack.includes('weather-renderer');known.set(fn,match);}return match?original(t=>{const b=performance.now();fn(t);q.costs.push(performance.now()-b);q.frames.push(t);}):original(fn);};
  new MutationObserver(()=>{const c=document.querySelector('canvas[data-sb-weather]');if(c&&!q.added){q.added=performance.now();q.canvasPixels=c.width*c.height;}if(!c&&q.added&&!q.removed)q.removed=performance.now();}).observe(document,{childList:true,subtree:true});
 },mode==='off');
 if(process.env.SB_QA_NATIVE==='1')await context.addInitScript(()=>{for(const name of['clearRect','drawImage','fillRect','stroke','fill']){const original=CanvasRenderingContext2D.prototype[name];CanvasRenderingContext2D.prototype[name]=function(...args){const begin=performance.now();try{return original.apply(this,args);}finally{const elapsed=performance.now()-begin;if(elapsed>10&&this.canvas.matches('[data-sb-weather]'))window.__suiteQA.nativeSlow.push({name,begin,elapsed});}};}});
 return newPage(context,profile);
}
async function visit(t,profile,kind,expected,{screenshots=false}={}){
 const responses=[],cacheResponses=[],cacheIds=new Set(),heap={};
 const sampleHeap=async()=>{if(process.env.SB_QA_HEAP==='0')return{};const begin=await t.page.evaluate(()=>performance.now());const values=Object.fromEntries((await t.cdp.send('Performance.getMetrics')).metrics.filter(m=>['JSHeapUsedSize','JSHeapTotalSize','Nodes','Documents'].includes(m.name)).map(m=>[m.name,m.value]));return{...values,inspectorBegin:begin,inspectorEnd:await t.page.evaluate(()=>performance.now())};};heap.beforeNavigation=await sampleHeap();
 const onResponse=r=>{if(weatherURL(r.url()))responses.push({url:r.url(),status:r.status(),headers:r.headers()});};t.page.on('response',onResponse);
 const onCached=e=>cacheIds.add(e.requestId),onNetwork=e=>{if(weatherURL(e.response.url))cacheResponses.push({id:e.requestId,url:e.response.url,disk:e.response.fromDiskCache===true});};
 t.cdp.on('Network.requestServedFromCache',onCached);t.cdp.on('Network.responseReceived',onNetwork);
 if(process.env.SB_QA_PROFILE==='1'){await t.cdp.send('Profiler.enable');await t.cdp.send('Profiler.start');}
 assert.equal((await t.page.goto(base+'/',{waitUntil:'load'})).status(),200);
 if(mode==='new')await t.page.waitForSelector('.sb-home-weather:not([hidden])',{timeout:6000});
 if(expected)await t.page.waitForSelector('canvas[data-sb-weather]',{timeout:12000});else await t.page.waitForTimeout(600);
 heap.activeOrSuppressed=await sampleHeap();
 const order=t.page.locator('.site-header__order summary'),before=await t.page.evaluate(()=>performance.now());
 if(profile.cpu===1)await order.click();else await order.tap();
 const tapMs=await t.page.evaluate(b=>performance.now()-b,before);
 assert.equal(await t.page.locator('.site-header__order').evaluate(n=>n.open),true);assert.equal(await t.page.locator('#header-order-options a').count(),2);
 if(profile.cpu===1)await order.click();else await order.tap();
 if(screenshots){await t.page.waitForTimeout(700);await t.page.screenshot({path:out+'/'+profile.name+'-'+scene.id+'-'+kind+'.png'});}
 await t.page.evaluate(()=>scrollTo(0,450));assert.ok(await t.page.evaluate(()=>scrollY>0));await t.page.evaluate(()=>scrollTo(0,0));
 if(expected)await t.page.waitForSelector('canvas[data-sb-weather]',{state:'detached',timeout:6000});
 await t.page.waitForTimeout(150);heap.afterCleanup=await sampleHeap();
 const data=await t.page.evaluate(()=>({
  ...window.__suiteQA,load:performance.getEntriesByType('navigation')[0].loadEventEnd,
  resources:performance.getEntriesByType('resource').filter(r=>/\/(?:weather(?:[^/]*\.(?:js|css)|\/)|textures\/)/.test(r.name)).map(r=>({url:r.name,transfer:r.transferSize,encoded:r.encodedBodySize,decoded:r.decodedBodySize,duration:r.duration})),
  remaining:document.querySelectorAll('canvas[data-sb-weather]').length,overflow:document.documentElement.scrollWidth>innerWidth,
  status:window.SourBouleWeatherStatus,readout:document.querySelector('.sb-home-weather')?.hidden===false,readoutText:document.querySelector('.sb-home-weather')?.innerText,
  session:sessionStorage.getItem('sb-weather-session-played-v1')
 }));
 assert.equal(data.remaining,0);assert.equal(data.overflow,false);assert.deepEqual(t.errors,[]);assert.equal(!!data.added,expected);
 const json=data.resources.filter(r=>r.url.includes('/weather/')),renderer=data.resources.filter(r=>r.url.includes('weather-renderer')),textures=data.resources.filter(r=>r.url.includes('/textures/'));
 assert.equal(json.length,mode==='legacy'&&!expected?0:1);assert.equal(renderer.length,expected?1:0);assert.equal(data.readout,mode==='new');
 if(expected){assert.ok(data.removed-data.added>=((mode==='legacy'?4:5)*1000)-100);assert.ok(data.removed-data.added<(mode==='legacy'?4100:5100));assert.ok(data.canvasPixels<=(mode==='legacy'?3000000:2000000));}
 assert.ok(json.every(r=>r.decoded<2048));assert.ok(textures.reduce((s,r)=>s+r.encoded,0)<=131072,'Texture bytes');
 assert.ok(data.resources.reduce((s,r)=>s+r.encoded,0)<=163840,'Total cold body budget');
 const weatherLong=data.longFrames.flatMap(f=>(f.scripts||[]).filter(s=>s.url.includes('/weather')).map(s=>({frameAt:f.at,...s})));
 assert.ok(!weatherLong.some(s=>s.duration>=50),'No weather-attributable >=50ms task');
 const shifts=data.shifts.filter(s=>s.at>=data.added&&s.at<=data.removed&&!s.input);assert.deepEqual(shifts,[],'No layout shifts during weather');
 if(process.env.SB_QA_PROFILE==='1'){const cpu=await t.cdp.send('Profiler.stop');await writeFile(out+'/'+evidence.runs.length+'-'+kind+'.cpuprofile',JSON.stringify(cpu.profile));}
 const result={heap,profile:profile.name,cpu:profile.cpu,mode,scene:scene.id,kind,tapMs,p95:pct(data.costs,.95),worst:Math.max(0,...data.costs),frameP95:pct(data.frames.slice(1).map((n,i)=>n-data.frames[i]),.95),responses,cacheEvidence:cacheResponses.map(r=>({...r,cached:r.disk||cacheIds.has(r.id)})),weatherLong,...data};
 assert.ok(result.p95<(profile.cpu===6?8:4),'Drawing p95');
 t.page.off('response',onResponse);t.cdp.off('Network.requestServedFromCache',onCached);t.cdp.off('Network.responseReceived',onNetwork);
 evidence.runs.push(result);await save();assert.ok(result.worst<50,'No weather drawing callback >=50ms');console.log(JSON.stringify({profile:profile.name,mode,scene:scene.id,kind,load:data.load,p95:result.p95,worst:result.worst,lifetime:data.removed-data.added,requests:data.resources.length,bytes:data.resources.reduce((s,r)=>s+r.encoded,0)}));return result;
}
async function save(){await writeFile(out+'/'+section+'-results.json',JSON.stringify(evidence,null,2));}
try{
 for(const name of['assets/js/weather-v2.js','assets/js/weather-renderer-v2.js','assets/js/weather-v3.js','assets/js/weather-renderer-v3.js','assets/js/weather-fallback-v3.js','assets/css/weather-v3.css']){try{const body=await readFile(root+name);evidence.sizes[name]={bytes:body.length,gzip:gzipSync(body).length,br:brotliCompressSync(body).length};}catch{}}
 assert.ok(evidence.sizes['assets/js/weather-v3.js'].gzip<=8192);
 assert.ok(Object.entries(evidence.sizes).filter(([k])=>k.endsWith('v3.js')).reduce((sum,[,v])=>sum+v.gzip,0)<=25600);
 if(section==='comparison')for(const profile of profiles)for(let repeat=0;repeat<3;repeat++)for(const variant of['off','legacy','new']){
  mode=variant;scene=scenes.find(s=>s.precip==='rain'&&s.mist==='fog_mist'&&s.daypart==='day');now=Date.parse('2026-10-04T18:00:00Z');const t=await makeContext(profile);
  for(const kind of['cold','consumed'])await visit(t,profile,kind,variant!=='off'&&kind==='cold');await t.context.close();
 }
 if(section==='scenes')for(const profile of profiles)for(const selected of['clear-day','overcast-night','rain-mist-day','heavy-thunder-rain-day','hail-storm-night','freezing-rain-day','blowing-snow-night']){
  scene=scenes.find(s=>s.id===selected);if(!scene)throw Error('Fixture id '+selected);mode='new';now=Date.parse(scene.daypart==='night'?'2026-10-05T03:00:00Z':'2026-10-04T18:00:00Z');const t=await makeContext(profile);await visit(t,profile,'cold',true,{screenshots:true});await t.context.close();
 }
 if(section==='cache')for(const profile of profiles)for(let repeat=0;repeat<Number(process.env.SB_QA_REPEATS||1);repeat++){
  mode='new';scene=scenes.find(s=>s.precip==='rain'&&s.mist==='fog_mist'&&s.daypart==='day');now=Date.parse('2026-10-04T18:00:00Z');let t=await makeContext(profile);
  await visit(t,profile,'cold',true);const context=t.context;await t.page.close();t=await newPage(context,profile);
  const warm=await visit(t,profile,'warm-new-tab',true);assert.ok(warm.cacheEvidence.some(r=>r.url.includes('/textures/')&&r.cached),'Texture HTTP caching');
  await visit(t,profile,'consumed',false);await context.close();
 }
 if(section==='a11y')for(const path of['','fort-worth.html','willow-bend.html']){
  const profile={name:'a11y-'+(path||'home'),width:320,height:568,dpr:2,cpu:1};mode='new';scene=scenes.find(s=>s.id==='rain-mist-day');now=Date.parse('2026-10-04T18:00:00Z');const t=await makeContext(profile);await t.page.emulateMedia({reducedMotion:'reduce'});await t.page.goto(base+'/'+path,{waitUntil:'load'});await t.page.waitForTimeout(400);
  const controls=[];for(const selector of['[data-sb-weather-lighting]','[data-sb-weather-toggle]']){const c=t.page.locator(selector);await c.scrollIntoViewIfNeeded();const rect=await c.boundingBox();assert.ok(rect.height>=44);await c.focus();await t.page.keyboard.press('Space');assert.equal(await c.getAttribute('aria-pressed'),'false');controls.push({selector,rect,text:await c.innerText()});}
  const state=await t.page.evaluate(()=>({light:localStorage.getItem('sb-weather-lighting-disabled-v1'),off:localStorage.getItem('sb-weather-disabled-v1'),overflow:document.documentElement.scrollWidth>innerWidth,canvas:document.querySelectorAll('canvas[data-sb-weather]').length,readout:document.querySelector('.sb-home-weather')?.innerText,live:document.querySelector('.sb-home-weather')?.getAttribute('aria-live'),status:window.SourBouleWeatherStatus}));assert.equal(state.light,'1');assert.equal(state.off,'1');assert.equal(state.overflow,false);assert.equal(state.canvas,0);if(!path){assert.ok(state.readout.includes('Fort Worth area'));assert.equal(state.live,null);}else assert.equal(state.readout,undefined);assert.deepEqual(t.errors,[]);evidence.runs.push({profile:profile.name,controls,state});await save();await t.context.close();
 }
 if(section==='backgrounds')for(const width of[320,390,1440]){
  const profile={name:'background'+width,width,height:width===320?568:width===390?844:900,dpr:1,cpu:1};mode='new';scene=scenes.find(s=>s.id==='clear-day');now=Date.parse('2026-10-04T18:00:00Z');const t=await makeContext(profile);await t.page.emulateMedia({reducedMotion:'reduce'});await t.page.goto(base+'/',{waitUntil:'load'});await t.page.waitForTimeout(700);await t.page.screenshot({path:out+'/'+profile.name+'.png'});await t.context.close();
 }
 if(section==='layout')for(const width of[320,390,768,1440])for(const label of[false,true]){
  const profile={name:'layout'+width+(label?'long':''),width,height:900,dpr:1,cpu:1};
  mode='new';scene=scenes.find(s=>s.id==='freezing-rain-day');now=Date.parse('2026-10-04T18:00:00Z');longLabel=label;
  const t=await makeContext(profile);await t.page.emulateMedia({reducedMotion:'reduce'});
  await t.page.goto(base+'/',{waitUntil:'load'});await t.page.waitForFunction(()=>window.SourBouleWeatherStatus?.readout==='fresh');
  const initiallyHidden=await t.page.locator('.sb-home-weather').isHidden();
  if(initiallyHidden){await t.page.screenshot({path:out+'/'+profile.name+'-collision.png'});await t.page.evaluate(()=>scrollTo(0,100));}
  await t.page.waitForSelector('.sb-home-weather:not([hidden])');
  const result=await t.page.evaluate(()=>{const card=document.querySelector('.sb-home-weather'),slot=document.querySelector('[data-sb-home-weather]'),header=document.querySelector('.site-header'),main=document.querySelector('main'),r=n=>JSON.parse(JSON.stringify(n.getBoundingClientRect()));return{card:r(card),slot:r(slot),header:r(header),main:r(main),text:card.innerText,aria:card.getAttribute('aria-live'),overflow:document.documentElement.scrollWidth>innerWidth,resources:performance.getEntriesByType('resource').map(r=>r.name),status:window.SourBouleWeatherStatus,shifts:window.__suiteQA.shifts};});
  assert.equal(result.overflow,false);assert.equal(result.aria,null);assert.ok(!result.resources.some(r=>r.includes('weather-renderer')||r.includes('/textures/')));assert.ok(result.text.includes('Fort Worth area'));
  if(width<768){assert.ok(result.slot.top>=result.header.bottom-1);assert.ok(result.card.bottom<=result.main.top+1,'Inline readout remains above main');}else assert.ok(result.card.left<60&&result.card.bottom<=900);
  await t.page.screenshot({path:out+'/'+profile.name+'-background.png'});await t.page.locator('.site-header__order summary').click();await t.page.waitForFunction(()=>document.querySelector('.sb-home-weather').hidden||getComputedStyle(document.querySelector('.sb-home-weather')).visibility==='hidden',{},{timeout:1000});assert.equal(await t.page.locator('.sb-home-weather').isVisible(),false);assert.equal(await t.page.locator('#header-order-options a').count(),2);await t.page.locator('.site-header__order summary').click();await t.page.waitForSelector('.sb-home-weather:not([hidden])');
  await t.page.screenshot({path:out+'/'+profile.name+'.png'});
  await t.page.evaluate(()=>{document.documentElement.style.zoom='2';});await t.page.waitForTimeout(150);
  const zoom=await t.page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,card:JSON.parse(JSON.stringify(document.querySelector('.sb-home-weather').getBoundingClientRect())),main:JSON.parse(JSON.stringify(document.querySelector('main').getBoundingClientRect()))}));
  assert.equal(zoom.overflow,false,'200% CSS zoom layout');if(width<768)assert.ok(zoom.card.bottom<=zoom.main.top+1);
  await t.page.screenshot({path:out+'/'+profile.name+'-zoom200.png'});
  assert.deepEqual(t.errors,[]);evidence.runs.push({profile:profile.name,kind:'Static reduced-motion, navigation collision, 200% CSS zoom',initiallyHidden,result,zoom});await save();await t.context.close();
 }
 evidence.completedAt=new Date().toISOString();await save();console.log('Complete '+section);
}finally{await browser.close();await new Promise(r=>server.close(r));}

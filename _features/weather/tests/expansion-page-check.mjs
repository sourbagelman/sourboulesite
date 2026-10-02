/* Local-only whole-page performance comparison. No fixture is published.
 * Uses the actual website and built assets; only local responses supply weather.
 * Pass SB_WEATHER_BASELINE to the saved baseline directory (index and old assets).
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, extname, sep } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { brotliCompressSync, gzipSync } from 'node:zlib';
const require = createRequire(new URL('../../new-year/package.json', import.meta.url));
const { chromium } = require(process.env.SB_PLAYWRIGHT || 'playwright');
const root = fileURLToPath(new URL('../../../', import.meta.url));
const baseline = resolve(process.env.SB_WEATHER_BASELINE);
const section = process.env.SB_QA_SECTION || 'all';
const out = resolve(process.env.SB_WEATHER_QA_OUTPUT || '/tmp/sb-weather-expansion-page');
await mkdir(out, { recursive: true });
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', out+'/key.pem', '-out', out+'/cert.pem', '-days', '1', '-nodes', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
const scenes = [
  { name: 'fog', effect: 'fog' }, { name: 'drizzle', effect: 'drizzle' },
  { name: 'storm', effect: 'storm' }, { name: 'rain-mist', effect: 'rain', mist: true },
  { name: 'drizzle-mist', effect: 'drizzle', mist: true }, { name: 'fog-night', effect: 'fog', night: true }
];
let mode = 'new', scene = scenes[3], base;
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.svg':'image/svg+xml', '.webp':'image/webp', '.jpg':'image/jpeg', '.png':'image/png', '.ico':'image/x-icon' };
const server = createServer({ key: await readFile(out+'/key.pem'), cert: await readFile(out+'/cert.pem') }, async (req, res) => {
  try {
    const url = new URL(req.url, base);
    if (url.pathname.startsWith('/weather/')) {
      const now=Date.now(), v2=url.pathname.includes('/v2/'), H=3600000;
      const rise=scene.night?now+H:now-6*H, set=scene.night?now+5*H:now+6*H;
      const body={ version:v2?2:1, provider:'NWS', location:'fort-worth', station:'KFTW', timezone:'America/Chicago',
        condition:v2?scene.effect:'rain', effect:v2?scene.effect:'rain',
        observedAt:new Date(now-60000).toISOString(), fetchedAt:new Date(now).toISOString(), validUntil:new Date(now+3590000).toISOString(),
        sunrise:new Date(rise).toISOString(), sunset:new Date(set).toISOString(), refreshSource:'scheduled',
        ...(v2?{mist:!!scene.mist,night:!!scene.night}:{}) };
      const bytes=brotliCompressSync(Buffer.from(JSON.stringify(body)));
      res.writeHead(200, {'Content-Type':'application/json','Content-Encoding':'br','Content-Length':bytes.length,'Cache-Control':'public, max-age=300'});res.end(bytes);return;
    }
    const name=url.pathname==='/'?'index.html':url.pathname.slice(1);
    let path=resolve(root,name);
    if (mode==='legacy' && name==='index.html') path=resolve(baseline,name);
    if ((!path.startsWith(root)&&!path.startsWith(baseline+sep))||!(await stat(path)).isFile()) throw Error('missing');
    let body=await readFile(path);
    if(extname(path)==='.html') body=Buffer.from(body.toString().replaceAll('https://sour-boule-weather.lance-c84.workers.dev',base));
    const tag='"'+createHash('sha256').update(body).digest('hex')+'"';
    const headers={'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'public, max-age=300',ETag:tag,Vary:'Accept-Encoding'};
    if(req.headers['if-none-match']===tag){res.writeHead(304,headers);res.end();return;}
    if(/\.(js|html|css|svg)$/.test(path)) {body=brotliCompressSync(body);headers['Content-Encoding']='br';}
    headers['Content-Length']=body.length;res.writeHead(200,headers);res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));base='https://127.0.0.1:'+server.address().port;
// Ignoring a certificate error alone prevents Chromium from caching these local
// HTTPS responses. For the explicit cache test only, allow this ephemeral public
// key in this browser process; no system trust or production setting is changed.
const cacheArgs=[];
if(section==='cache'){
  const publicKey=execFileSync('openssl',['x509','-in',out+'/cert.pem','-pubkey','-noout']);
  const der=execFileSync('openssl',['pkey','-pubin','-outform','DER'],{input:publicKey});
  cacheArgs.push('--ignore-certificate-errors-spki-list='+createHash('sha256').update(der).digest('base64'));
}
const browser=await chromium.launch({headless:true,executablePath:process.env.SB_CHROME,args:cacheArgs});
const profiles=[{name:'desktop',width:1440,height:900,cpu:1,dpr:1},{name:'mobile390',width:390,height:844,cpu:4,dpr:2},{name:'mobile320',width:320,height:568,cpu:6,dpr:2}];
const evidence={kind:'LOCAL FIXTURES, Chromium CPU/network emulation, not physical devices',browser:browser.version(),startedAt:new Date().toISOString(),network:{rtt:150,downloadMbps:1.6,uploadMbps:.75},runs:[],scenes:[],sizes:{}};
for(const name of ['weather.js','weather-renderer.js','weather-v2.js','weather-renderer-v2.js']){
  const body=await readFile(root+'assets/js/'+name);evidence.sizes[name]={bytes:body.length,gzip:gzipSync(body).length,br:brotliCompressSync(body).length,sha256:createHash('sha256').update(body).digest('hex')};
}
assert.ok(evidence.sizes['weather-v2.js'].gzip+evidence.sizes['weather-renderer-v2.js'].gzip<=10240,'Cold weather JS gzip budget');
async function contextFor(profile, off){
  const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},deviceScaleFactor:profile.dpr,isMobile:profile.cpu!==1,hasTouch:profile.cpu!==1,ignoreHTTPSErrors:true,reducedMotion:'no-preference'});
  await context.addInitScript(({off})=>{
    localStorage.setItem('sb-weather-disabled-v1',off?'1':'0');
    const q=window.__weatherQA={paint:{},lcp:0,cls:0,shifts:[],longTasks:[],longFrames:[],costs:[],frames:[],added:0,removed:0};
    for(const type of ['paint','largest-contentful-paint','layout-shift','longtask','long-animation-frame'])try{
      new PerformanceObserver(list=>{for(const e of list.getEntries()){
        if(type==='paint')q.paint[e.name]=e.startTime;
        else if(type==='largest-contentful-paint')q.lcp=e.startTime;
        else if(type==='layout-shift'){q.shifts.push({at:e.startTime,value:e.value,input:e.hadRecentInput});if(!e.hadRecentInput)q.cls+=e.value;}
        else if(type==='longtask')q.longTasks.push({at:e.startTime,duration:e.duration});
        else q.longFrames.push({at:e.startTime,duration:e.duration,scripts:e.scripts?.map(s=>({url:s.sourceURL,duration:s.duration,fn:s.sourceFunctionName}))});
      }}).observe({type,buffered:true});
    }catch{}
    const raf=window.requestAnimationFrame.bind(window), known=new WeakMap();
    window.requestAnimationFrame=fn=>{
      let isWeather=known.get(fn);if(isWeather===undefined){isWeather=new Error().stack.includes('weather-renderer');known.set(fn,isWeather);}
      return isWeather?raf(t=>{const start=performance.now();fn(t);q.costs.push(performance.now()-start);q.frames.push(t);}):raf(fn);
    };
    new MutationObserver(()=>{const c=document.querySelector('canvas[data-sb-weather]');if(c&&!q.added)q.added=performance.now();if(!c&&q.added&&!q.removed)q.removed=performance.now();}).observe(document,{childList:true,subtree:true});
  },{off});
  const page=await context.newPage(),cdp=await context.newCDPSession(page);
  await cdp.send('Network.enable');await cdp.send('Network.setBlockedURLs',{urls:['*googletagmanager.com/*','*google-analytics.com/*','*celebrate.thesourboule.com/*']});
  await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.cpu});
  await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1600000/8,uploadThroughput:750000/8,connectionType:'cellular4g'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));return{context,page,errors};
}
async function run(t,profile,cache,expected,screenshot){
  const responses=[];const onResponse=r=>{if(/\/weather(?:[^/]*\.js|\/)/.test(r.url()))responses.push({url:r.url(),status:r.status(),headers:r.headers()});};t.page.on('response',onResponse);
  assert.equal((await t.page.goto(base+'/',{waitUntil:'load',timeout:60000})).status(),200);
  if(expected) await t.page.waitForSelector('canvas[data-sb-weather]',{timeout:8000});else await t.page.waitForTimeout(750);
  const order=t.page.locator('.site-header__order summary'),start=await t.page.evaluate(()=>performance.now());
  if(profile.cpu===1)await order.click();else await order.tap();
  const tap=await t.page.evaluate(s=>performance.now()-s,start);
  assert.equal(await t.page.locator('.site-header__order').evaluate(n=>n.open),true);assert.equal(await t.page.locator('#header-order-options a').count(),2);
  if(profile.cpu===1)await order.click();else await order.tap();
  if(screenshot){await t.page.waitForTimeout(700);await t.page.screenshot({path:out+'/'+profile.name+'-'+scene.name+'-active.png'});}
  await t.page.evaluate(()=>scrollTo(0,400));assert.ok(await t.page.evaluate(()=>scrollY>0));await t.page.evaluate(()=>scrollTo(0,0));
  if(expected)await t.page.waitForSelector('canvas[data-sb-weather]',{state:'detached',timeout:5500});
  await t.page.waitForTimeout(150);
  const result=await t.page.evaluate(()=>{
    const resources=performance.getEntriesByType('resource').filter(r=>/\/weather(?:[^/]*\.js|\/)/.test(r.name)).map(r=>({name:r.name,transfer:r.transferSize,encoded:r.encodedBodySize,decoded:r.decodedBodySize,duration:r.duration}));
    const nav=performance.getEntriesByType('navigation')[0];return{...window.__weatherQA,resources,load:nav.loadEventEnd,remaining:document.querySelectorAll('canvas[data-sb-weather]').length,overflow:document.documentElement.scrollWidth>innerWidth};
  });
  assert.equal(result.remaining,0);assert.equal(result.overflow,false);assert.deepEqual(t.errors,[]);
  assert.equal(!!result.added,expected);
  const jsons=result.resources.filter(r=>r.name.includes('/weather/')),renderers=result.resources.filter(r=>r.name.includes('weather-renderer'));
  assert.equal(jsons.length,expected?1:0);assert.equal(renderers.length,expected?1:0);
  if(expected){assert.ok(jsons[0].decoded<2048);assert.ok(result.removed-result.added<=4100,'four-second deadline including scheduler tolerance');}
  const activeShifts=result.shifts.filter(s=>s.at>=result.added&&s.at<=result.removed&&!s.input);assert.deepEqual(activeShifts,[],'No weather-added layout shifts');
  const weatherLong=result.longFrames.flatMap(f=>(f.scripts||[]).filter(s=>s.url.includes('/weather')).map(s=>({frameAt:f.at,...s})));
  assert.ok(!weatherLong.some(s=>s.duration>=50),'No weather-attributable long task >=50ms');
  const sorted=[...result.costs].sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*.95)]||0;
  t.page.off('response',onResponse);
  return{profile:profile.name,cpu:profile.cpu,mode,cache,scene:scene.name,tapMs:tap,p95,worst:Math.max(0,...sorted),responses,weatherLong,...result};
}
async function save(){await writeFile(out+(section==='all'?'/results.json':'/'+section+'-results.json'),JSON.stringify(evidence,null,2));}
try{
  if(section==='all')for(const profile of profiles)for(let repeat=0;repeat<3;repeat++)for(const variant of ['off','legacy','new']){
    mode=variant;scene=scenes[3];const t=await contextFor(profile,mode==='off');
    for(const cache of ['cold','consumed']){
      const result=await run(t,profile,cache,mode!=='off'&&cache==='cold',false);evidence.runs.push({repeat,...result});await save();
      console.log(JSON.stringify({profile:profile.name,repeat,mode,cache,p95:result.p95,worst:result.worst,load:result.load,weatherRequests:result.resources.length}));
    }
    await t.context.close();
  }
  if(section==='all'){mode='new';for(const profile of profiles)for(const selected of scenes){scene=selected;const t=await contextFor(profile,false);const result=await run(t,profile,'cold',true,true);evidence.scenes.push(result);await save();await t.context.close();console.log(JSON.stringify({profile:profile.name,scene:scene.name,p95:result.p95,worst:result.worst,weatherLong:result.weatherLong}));}}
  // A distinct new tab retains the HTTP cache, but has a genuinely fresh tab
  // session. No session key is cleared or overridden to create this test.
  if(section==='warm')for(const profile of profiles)for(const variant of ['off','legacy','new']){
    mode=variant;scene=scenes[3];const t=await contextFor(profile,mode==='off');
    const cold=await run(t,profile,'cold',mode!=='off',false);evidence.runs.push(cold);
    await t.page.close();t.page=await t.context.newPage();
    const cdp=await t.context.newCDPSession(t.page);
    await cdp.send('Network.enable');await cdp.send('Network.setBlockedURLs',{urls:['*googletagmanager.com/*','*google-analytics.com/*','*celebrate.thesourboule.com/*']});
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.cpu});
    await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1600000/8,uploadThroughput:750000/8,connectionType:'cellular4g'});
    t.page.on('pageerror',e=>t.errors.push(e.message));
    const warm=await run(t,profile,'warm-fresh-tab',mode!=='off',false);evidence.runs.push(warm);await save();
    const consumed=await run(t,profile,'consumed',false,false);evidence.runs.push(consumed);await save();
    await t.context.close();console.log(JSON.stringify({profile:profile.name,mode,warmPlayed:!!warm.added,p95:warm.p95,warmRequests:warm.resources.length}));
  }
  // Explicit HTTP-cache priming is isolated test setup, not shipped client code.
  // This additionally proves cached JSON/JS in a still-unconsumed tab, independent
  // of whether a browser shares its memory cache between distinct tab processes.
  if(section==='cache')for(const profile of profiles){
    mode='new';scene=scenes[3];const t=await contextFor(profile,false);
    const cacheCDP=await t.context.newCDPSession(t.page),cacheResponses=[],servedFromCache=new Set();
    await cacheCDP.send('Network.enable');
    cacheCDP.on('Network.requestServedFromCache',e=>servedFromCache.add(e.requestId));
    cacheCDP.on('Network.responseReceived',e=>{if(/\/weather(?:[^/]*\.js|\/)/.test(e.response.url))cacheResponses.push({id:e.requestId,url:e.response.url,disk:e.response.fromDiskCache===true});});
    await t.page.goto(base+'/about.html',{waitUntil:'load'});
    await t.page.evaluate(async paths=>{for(const path of paths)await(await fetch(path)).arrayBuffer();},['/assets/js/weather-v2.js','/assets/js/weather-renderer-v2.js','/weather/v2/fort-worth']);
    assert.equal(await t.page.evaluate(()=>sessionStorage.getItem('sb-weather-session-played-v1')),null);
    cacheResponses.length=0;servedFromCache.clear();
    const warm=await run(t,profile,'primed-http-cache',true,false);evidence.runs.push(warm);
    assert.ok(warm.resources.every(r=>r.transfer===0),'Primed JSON and scripts should come from HTTP cache');
    warm.cacheEvidence=cacheResponses.map(r=>({url:r.url,fromDiskCache:r.disk,servedFromCache:servedFromCache.has(r.id)}));
    assert.equal(warm.cacheEvidence.length,3);
    assert.ok(warm.cacheEvidence.every(r=>r.fromDiskCache||r.servedFromCache),'CDP independently confirms all three cache hits');
    const consumed=await run(t,profile,'consumed',false,false);evidence.runs.push(consumed);await save();
    await t.context.close();console.log(JSON.stringify({profile:profile.name,cacheHits:warm.resources.length,p95:warm.p95}));
  }
  evidence.completedAt=new Date().toISOString();await save();console.log('Complete: '+out+'/results.json');
}finally{await browser.close();await new Promise(r=>server.close(r));}

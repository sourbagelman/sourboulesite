/** Private deterministic source comparison and draw/setup benchmark; no production hooks.
 * node renderer-v3-visual.mjs <approved package root> <private output directory> [--visual-only|--bench-only]
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import {suitePlugin} from '../build-client-v3.mjs';
const[packageArg,outArg,mode]=process.argv.slice(2);assert.ok(packageArg&&outArg);
const archive=resolve(packageArg),out=resolve(outArg);await mkdir(out,{recursive:true});
const require=createRequire(new URL('../../new-year/package.json',import.meta.url));
const{chromium}=require(process.env.SB_PLAYWRIGHT||'playwright'),{build}=require(process.env.SB_ESBUILD||'esbuild');
const root=new URL('../../../',import.meta.url).pathname;
const scenes=JSON.parse(await readFile(new URL('./scene-fixtures-v3.json',import.meta.url)));
const manifest=JSON.parse(await readFile(new URL('../texture-manifest-v3.json',import.meta.url)));
const server=createServer(async(req,res)=>{const name=decodeURIComponent(req.url.split('/').at(-1));if(Object.values(manifest).some(v=>v.file===name)){res.writeHead(200,{'Content-Type':'image/webp','Cache-Control':'public,max-age=31536000,immutable','Access-Control-Allow-Origin':'*'});res.end(await readFile(root+'_features/weather/textures-v3/textures/'+name));}else{res.writeHead(200,{'Content-Type':'text/html'});res.end('<body style="margin:0;background:#f6f3eb">');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const opts={bundle:true,format:'iife',globalName:'fixtureRenderer',target:['safari15.4','chrome100'],minify:true,legalComments:'none',write:false};
const current=(await build({...opts,stdin:{contents:"export * from './renderer-v3.mjs';export {makeAtmosphere} from './approved-renderer-v3.js';",resolveDir:root+'_features/weather',loader:'js'},plugins:[suitePlugin]})).outputFiles[0].text.replaceAll('https://sour-boule-weather.lance-c84.workers.dev',origin);
const approved=(await Promise.all(['mapping.js','timing.js','renderer.js'].map(f=>readFile(archive+'/source/'+f,'utf8')))).join('\n')+'\nwindow.reference={makeAtmosphere};';
const browser=await chromium.launch({headless:true,...(process.env.SB_CHROME?{executablePath:process.env.SB_CHROME}:{})});
const profiles=[{width:1440,height:900,dpr:1,cpu:1},{width:390,height:844,dpr:2,cpu:4},{width:320,height:568,dpr:2,cpu:6}];
const comparisons=[],metrics=[],loading=[];
try{
for(const profile of profiles){
 const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},deviceScaleFactor:profile.dpr});
 const page=await context.newPage();await page.goto(origin);await page.addScriptTag({content:approved});await page.addScriptTag({content:current});
 await page.evaluate(async({manifest,origin})=>{window.nativeNow=performance.now.bind(performance);window.textures={};await Promise.all(Object.entries(manifest).map(async([name,v])=>{const im=new Image();im.src=origin+'/textures/'+v.file;await im.decode();textures[name]=im;}));
  window.clock=0;window.jobs=new Map();window.serial=0;Object.defineProperty(performance,'now',{value:()=>clock});window.requestAnimationFrame=fn=>{jobs.set(++serial,fn);return serial;};window.cancelAnimationFrame=id=>jobs.delete(id);
  window.tick=t=>{clock=t;const list=[...jobs.values()];jobs.clear();list.forEach(fn=>fn(t));};
 },{manifest,origin});
 if(mode!=='--bench-only')for(const {id,scene}of scenes){
  const result=await page.evaluate(async({scene})=>{
   clock=0;let reason;const starter=await fixtureRenderer.prepareWeather({scene,lighting:true});if(!starter)throw Error('Preparation failed');const stop=starter({onFinish:r=>reason=r});if(!stop)throw Error('Start failed');
   const current=document.querySelector('[data-sb-weather]'),ref=document.createElement('canvas');const r=reference.makeAtmosphere(ref,innerWidth,innerHeight,scene,textures,{lightning:true});const frames=[];
   for(const t of [.3,1.9,3.5,4.25,4.8]){tick(t*1000-16);tick(t*1000);r.draw(t);frames.push({time:t,current:current.toDataURL(),reference:ref.toDataURL()});}
   tick(5000);r.draw(5);const clear=!r.stats||!ref.getContext('2d').getImageData(0,0,ref.width,ref.height).data.some(Boolean);r.dispose();return{frames,cleanup:!document.querySelector('[data-sb-weather]')&&!jobs.size,reason,referenceClear:clear};
  },{scene});
  assert.equal(result.cleanup,true,id+' cleanup');assert.equal(result.reason,'complete');assert.equal(result.referenceClear,true);
  for(const f of result.frames){const a=Buffer.from(f.current.split(',')[1],'base64'),b=Buffer.from(f.reference.split(',')[1],'base64');const label=`${profile.width}-${id}-${f.time}`;assert.deepEqual(a,b,label);await writeFile(out+'/'+label+'.png',a);comparisons.push({width:profile.width,dpr:profile.dpr,scene:id,time:f.time,identical:true,pngSha256:createHash('sha256').update(a).digest('hex')});}
 }
 if(mode!=='--visual-only'){
  const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.cpu});
  for(const{id,scene}of scenes)for(let repeat=0;repeat<3;repeat++){
   const result=await page.evaluate(async scene=>{
    clock=0;let reason;const canvas=document.createElement('canvas');const began=nativeNow();const atmosphere=fixtureRenderer.makeAtmosphere(canvas,innerWidth,innerHeight,scene,textures,{lightning:true});const setupMs=nativeNow()-began;const frames=[];
    for(let i=1;i<=299;i++){const before=nativeNow();atmosphere.draw(i/60);frames.push(nativeNow()-before);}const stats=atmosphere.stats;atmosphere.dispose();canvas.width=canvas.height=0;frames.sort((a,b)=>a-b);
    return{setupMs,p95DrawMs:frames[Math.floor(frames.length*.95)],worstDrawMs:frames.at(-1),stats};
   },scene);assert.ok(result.setupMs<50,id+' setup');if(profile.cpu===4)assert.ok(result.p95DrawMs<4,id+'4x p95');if(profile.cpu===6)assert.ok(result.p95DrawMs<8,id+'6x p95');metrics.push({profile,scene:id,repeat,...result});
  }
  for(const{id,scene}of scenes){const result=await page.evaluate(async scene=>{
   let setupStart=0;const decode=[],originalCreate=document.createElement.bind(document),originalDecode=HTMLImageElement.prototype.decode;
   document.createElement=function(name,...args){if(name==='canvas'&&!setupStart)setupStart=nativeNow();return originalCreate(name,...args);};
   HTMLImageElement.prototype.decode=function(){const start=nativeNow();return originalDecode.call(this).then(()=>decode.push(nativeNow()-start));};
   const start=nativeNow();const starter=await fixtureRenderer.prepareWeather({scene,lighting:true});const done=nativeNow();const stop=starter?.();stop?.();document.createElement=originalCreate;HTMLImageElement.prototype.decode=originalDecode;return{prepareMs:done-start,setupMs:done-setupStart,decodeMs:decode,success:!!starter};
  },scene);assert.ok(result.success);loading.push({profile,scene:id,...result});}
 }
 await context.close();console.log('Completed '+profile.width+' '+mode);
}
const report={mode,comparisonCount:comparisons.length,comparisons,metrics,loading};await writeFile(out+'/renderer-v3-results.json',JSON.stringify(report,null,2));
console.log(`${comparisons.length} exact frame comparisons, ${metrics.length} setup/draw benchmarks, ${loading.length} selected-decode measurements`);
for(const profile of profiles){const rows=metrics.filter(x=>x.profile.width===profile.width);if(rows.length)console.log(JSON.stringify({width:profile.width,cpu:profile.cpu,maxSetupMs:Math.max(...rows.map(x=>x.setupMs)),maxP95Ms:Math.max(...rows.map(x=>x.p95DrawMs)),worstDrawMs:Math.max(...rows.map(x=>x.worstDrawMs))}));}
}finally{await browser.close();server.close();}

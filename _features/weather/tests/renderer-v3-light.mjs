/** Read-only rendered-light assessment, not a clinical or whole-site WCAG certification.
 * Samples the actual supplied compositor, light on versus off,60fps/5s, at CSS pixel resolution.
 * Uses W3C SC2.3.1 linear-sRGB luminance and conservative .1 opposing-change thresholds.
 */
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {suitePlugin,fallbackPlugin} from '../build-client-v3.mjs';
const require=createRequire(new URL('../../new-year/package.json',import.meta.url));
const{chromium}=require(process.env.SB_PLAYWRIGHT||'playwright'),{build}=require(process.env.SB_ESBUILD||'esbuild');
const red=process.argv.includes('--red');
const root=new URL('../../../',import.meta.url).pathname,out=resolve(process.argv[2]);await mkdir(out,{recursive:true});
const scenes=JSON.parse(await readFile(new URL('./scene-fixtures-v3.json',import.meta.url))),manifest=JSON.parse(await readFile(new URL('../texture-manifest-v3.json',import.meta.url)));
const source=(await build({stdin:{contents:"export {makeAtmosphere} from './approved-renderer-v3.js';",resolveDir:root+'_features/weather',loader:'js'},bundle:true,format:'iife',globalName:'renderer',write:false,plugins:[suitePlugin]})).outputFiles[0].text;
const fallback=(await build({entryPoints:[root+'_features/weather/renderer.mjs'],bundle:true,format:'iife',globalName:'fallback',write:false,plugins:[fallbackPlugin]})).outputFiles[0].text;
const server=createServer(async(req,res)=>{const name=req.url.split('/').at(-1);if(/^background(320|390|1440)\.png$/.test(name)&&process.env.SB_LIGHT_BACKGROUNDS){res.writeHead(200,{'Content-Type':'image/png'});res.end(await readFile(resolve(process.env.SB_LIGHT_BACKGROUNDS,name)));return;}if(Object.values(manifest).some(v=>v.file===name)){res.writeHead(200,{'Content-Type':'image/webp'});res.end(await readFile(root+'_features/weather/textures-v3/textures/'+name));}else res.end('<body>');});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,...(process.env.SB_CHROME?{executablePath:process.env.SB_CHROME}:{})});const results=[],fallbackResults=[];
try{for(const[width,height]of[[320,568],[390,844],[1440,900]]){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1});const page=await context.newPage();await page.goto(origin);await page.addScriptTag({content:source});await page.addScriptTag({content:fallback});
 await page.evaluate(async({manifest,origin,backgrounds})=>{window.textures={};await Promise.all(Object.entries(manifest).map(async([name,v])=>{const im=new Image();im.src=origin+'/'+v.file;await im.decode();textures[name]=im;}));window.backgroundPixels=null;if(backgrounds){const im=new Image();im.src=origin+'/background'+innerWidth+'.png';await im.decode();const c=document.createElement('canvas');c.width=innerWidth;c.height=innerHeight;const g=c.getContext('2d');g.drawImage(im,0,0);backgroundPixels=g.getImageData(0,0,c.width,c.height).data;c.width=c.height=0;}},{manifest,origin,backgrounds:!!process.env.SB_LIGHT_BACKGROUNDS});
 for(const{id,scene}of scenes.filter(s=>s.scene.thunder)){
 const result=await page.evaluate(async({scene,red})=>{
  const W=innerWidth,H=innerHeight,a=document.createElement('canvas'),b=document.createElement('canvas');
  const on=renderer.makeAtmosphere(a,W,H,scene,textures,{lightning:true}),off=renderer.makeAtmosphere(b,W,H,scene,textures,{lightning:false});
  const [x0,,ww,hh]=on.stats.lightningBounds;const x=Math.max(0,Math.floor(x0)),y=0,w=Math.min(W-x,Math.ceil(ww+14)),h=Math.ceil(hh+4),n=w*h;
  const ca=a.getContext('2d',{willReadFrequently:true}),cb=b.getContext('2d',{willReadFrequently:true});
  const lut=Array.from({length:256},(_,v)=>{const s=v/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});
  const backgrounds=[...(red?[[255,0,0]]:[[0,0,0],[246,246,246],[255,255,255]]),...(backgroundPixels?['page']:[])].map(bg=>({bg,extreme:new Float32Array(n),direction:new Int8Array(n),count:new Uint8Array(n),times:new Uint16Array(n*8),maxDelta:0,maxWindowTransitions:0,maxHighFrequencyArea:0,maxThresholdArea:0,anyRedContribution:false}));
  let maxActive=0,firstActive=null,lastActive=null;
  for(let frame=0;frame<=300;frame++){
   const t=frame/60;on.draw(t);off.draw(t);const p=ca.getImageData(x,y,w,h).data,q=cb.getImageData(x,y,w,h).data;
   let active=0;for(let k=0;k<p.length;k+=4)if(p[k]!==q[k]||p[k+1]!==q[k+1]||p[k+2]!==q[k+2]||p[k+3]!==q[k+3])active++;
   if(active){firstActive??=t;lastActive=t;}maxActive=Math.max(maxActive,active);
   for(const s of backgrounds){let thresholdArea=0,highFrequencyArea=0;
    for(let i=0;i<n;i++){const k=i*4,aa=p[k+3]/255,ab=q[k+3]/255;
     const bk=((y+Math.floor(i/w))*W+x+i%w)*4;
     const b0=s.bg==='page'?backgroundPixels[bk]:s.bg[0],b1=s.bg==='page'?backgroundPixels[bk+1]:s.bg[1],b2=s.bg==='page'?backgroundPixels[bk+2]:s.bg[2];
     const ar=Math.round(p[k]*aa+b0*(1-aa)),ag=Math.round(p[k+1]*aa+b1*(1-aa)),az=Math.round(p[k+2]*aa+b2*(1-aa));
     const br=Math.round(q[k]*ab+b0*(1-ab)),bg=Math.round(q[k+1]*ab+b1*(1-ab)),bz=Math.round(q[k+2]*ab+b2*(1-ab));
     const saturated=lut[ar]/(lut[ar]+lut[ag]+lut[az])>=.8||lut[br]/(lut[br]+lut[bg]+lut[bz])>=.8;
     let v=Math.abs(.2126*(lut[ar]-lut[br])+.7152*(lut[ag]-lut[bg])+.0722*(lut[az]-lut[bz]));
     if(red){
      const X=.4124564*lut[ar]+.3575761*lut[ag]+.1804375*lut[az],Y=.2126729*lut[ar]+.7151522*lut[ag]+.072175*lut[az],Z=.0193339*lut[ar]+.119192*lut[ag]+.9503041*lut[az],d=X+15*Y+3*Z;
      const XX=.4124564*lut[br]+.3575761*lut[bg]+.1804375*lut[bz],YY=.2126729*lut[br]+.7151522*lut[bg]+.072175*lut[bz],ZZ=.0193339*lut[br]+.119192*lut[bg]+.9503041*lut[bz],dd=XX+15*YY+3*ZZ;
      v=saturated&&d&&dd?Math.hypot(4*X/d-4*XX/dd,9*Y/d-9*YY/dd):0;
     }
     const threshold=red?.2:.1;
     s.maxDelta=Math.max(s.maxDelta,v);if(v>=threshold)thresholdArea++;
     if((lut[ar]/(lut[ar]+lut[ag]+lut[az])>=.8||lut[br]/(lut[br]+lut[bg]+lut[bz])>=.8)&&Math.abs(v)>.001)s.anyRedContribution=true;
     let transition=false;
     if(s.direction[i]===0){if(v>=threshold){s.direction[i]=1;s.extreme[i]=v;transition=true;}}
     else if(s.direction[i]>0){if(v>s.extreme[i])s.extreme[i]=v;else if(s.extreme[i]-v>=threshold){s.direction[i]=-1;s.extreme[i]=v;transition=true;}}
     else if(v<s.extreme[i])s.extreme[i]=v;else if(v-s.extreme[i]>=threshold){s.direction[i]=1;s.extreme[i]=v;transition=true;}
     if(transition){const count=s.count[i]++;s.times[i*8+count%8]=frame+1;}
     const count=s.count[i];let windowTransitions=0;for(let z=Math.max(0,count-8);z<count;z++){const f=s.times[i*8+z%8];if(f&&frame+1-f<=60)windowTransitions++;}
     s.maxWindowTransitions=Math.max(s.maxWindowTransitions,windowTransitions);if(windowTransitions>=7)highFrequencyArea++;
    }
    s.maxThresholdArea=Math.max(s.maxThresholdArea,thresholdArea);s.maxHighFrequencyArea=Math.max(s.maxHighFrequencyArea,highFrequencyArea);
   }
   if(frame%20===0)await new Promise(r=>setTimeout(r,0));
  }
  on.dispose();off.dispose();return{width:W,height:H,scene,lightBounds:[x,y,w,h],maxActivePixels:maxActive,firstActive,lastActive,samples:301,backgrounds:backgrounds.map(({bg,maxDelta,maxWindowTransitions,maxHighFrequencyArea,maxThresholdArea,anyRedContribution})=>({bg,maxDelta,maxWindowTransitions,maxHighFrequencyArea,maxThresholdArea,anyRedContribution}))};
 },{scene,red});
 for(const bg of result.backgrounds){assert.ok(bg.maxWindowTransitions<=6||bg.maxHighFrequencyArea<21824,'General flash frequency/area criterion');if(!red&&bg.bg!=='page')assert.equal(bg.anyRedContribution,false,'No saturated red state over tested neutral backgrounds');}
 results.push({id,...result});console.log(width+' '+id+' '+JSON.stringify(result.backgrounds.map(b=>({bg:b.bg,maxTransition:b.maxWindowTransitions,area:b.maxHighFrequencyArea,peakDelta:b.maxDelta}))));
 }
 const fall=await page.evaluate(()=>{let clock=0,id=0;const jobs=new Map();Object.defineProperty(performance,'now',{value:()=>clock});window.requestAnimationFrame=fn=>{jobs.set(++id,fn);return id;};window.cancelAnimationFrame=id=>jobs.delete(id);const tick=t=>{clock=t;const list=[...jobs.values()];jobs.clear();list.forEach(f=>f(t));};const results=[];for(const options of [{effect:'rain'},{effect:'rain',mist:true},{effect:'fog'},{effect:'storm'}]){clock=0;let reason;const stop=fallback.startWeather({...options,onFinish:r=>reason=r});const canvas=document.querySelector('[data-sb-weather]');for(const t of [4250,4800]){tick(t-16);tick(t);results.push({options,time:t,painted:canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some(Boolean)});}tick(5000);results.push({options,time:5000,clean:!document.querySelector('[data-sb-weather]')&&!jobs.size,reason});stop();}return results;});for(const r of fall)assert.ok(r.time<5000?r.painted:r.clean&&r.reason==='complete');fallbackResults.push({width,results:fall});
 await context.close();}
 await writeFile(out+(red?'/rendered-red-light-assessment.json':'/rendered-light-assessment.json'),JSON.stringify({method:red?'60fps actual rendered-light on/off CIE1976 UCS distance on saturatedred and actual homepage backgrounds; .2 opposing-transition threshold, actual state R/(R+G+B)>=.8; same approved drawing source. Not whole-site/clinical/device certification.':'60fps actual rendered-light on/off absolute linear-sRGB delta; CSS pixel resolution; black/cream/white and actual homepage backgrounds; .1 reversal criterion, conservatively no darker-state exclusion; same approved drawing source. Not whole-site/clinical/device certification.',sources:['https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html','https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html'],results,fallbackResults},null,2));
}finally{await browser.close();server.close();}

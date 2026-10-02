/** Local-only approval comparison. Never included in the public build.
 * node renderer-visual.mjs /path/to/approved-v2.html /private/output-directory
 * SB_PLAYWRIGHT and SB_CHROMIUM may select an existing local browser toolchain.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const [baseline,output]=process.argv.slice(2);
assert.ok(baseline&&output,'Pass the immutable approved HTML and a private output directory');
const require=createRequire(new URL('../../new-year/package.json',import.meta.url));
const { chromium }=await import(pathToFileURL(process.env.SB_PLAYWRIGHT||require.resolve('playwright')).href);
const html=await readFile(baseline,'utf8');
const { build }=require(process.env.SB_ESBUILD||'esbuild');
const built=await build({entryPoints:[new URL('../renderer.mjs',import.meta.url).pathname],bundle:true,format:'iife',globalName:'fixtureRenderer',write:false});
const source=built.outputFiles[0].text+';window.startWeather=fixtureRenderer.startWeather;';
const out=resolve(output);await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.SB_CHROMIUM?{executablePath:process.env.SB_CHROMIUM}:{})});
const results=[];
try {
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  const context=await browser.newContext({viewport,deviceScaleFactor:viewport.width===390?2:1});
  const reference=await context.newPage();await reference.setContent(html);await reference.evaluate(()=>weatherDemo.clear());
  const candidate=await context.newPage();await candidate.setContent('<body style="margin:0;background:#f6f3eb">');
  await candidate.evaluate(()=>{window.testTime=0;window.jobs=new Map();window.jobId=0;Object.defineProperty(performance,'now',{value:()=>window.testTime});window.requestAnimationFrame=fn=>{window.jobs.set(++window.jobId,fn);return window.jobId;};window.cancelAnimationFrame=id=>window.jobs.delete(id);});
  // Test clock/API injection exists only in this isolated page, never the shipped module.
  await candidate.addScriptTag({content:source});
  for(const effect of ['rain','snow','wind','cloud','sun','night'])for(const elapsed of [.3,1.5,3.5]){
   const approved=await reference.evaluate(({effect,elapsed})=>{weatherDemo.set(effect,elapsed);return weatherDemo.canvas.toDataURL();},{effect,elapsed});
   const actual=await candidate.evaluate(async({effect,elapsed,approved})=>{
    window.testTime=0;window.stop?.();window.stop=window.startWeather({effect,autumnLeaves:true});window.testTime=elapsed*1000;
    const jobs=[...window.jobs.values()];window.jobs.clear();jobs.forEach(fn=>fn(window.testTime));
    const canvas=document.querySelector('canvas');if(!canvas)throw new Error('Renderer did not start');
    const image=new Image();image.src=approved;await image.decode();const baseline=document.createElement('canvas');baseline.width=image.width;baseline.height=image.height;baseline.getContext('2d').drawImage(image,0,0);
    const a=baseline.getContext('2d').getImageData(0,0,image.width,image.height).data,b=canvas.getContext('2d').getImageData(0,0,image.width,image.height).data;
    const paper=[246,243,235];let difference=0,over10=0,alphaA=0,alphaB=0;
    for(let i=0;i<a.length;i+=4){let max=0;alphaA+=a[i+3];alphaB+=b[i+3];for(let c=0;c<3;c++){const x=a[i+c]*a[i+3]/255+paper[c]*(1-a[i+3]/255),y=b[i+c]*b[i+3]/255+paper[c]*(1-b[i+3]/255),delta=Math.abs(x-y);difference+=delta;max=Math.max(max,delta);}if(max>10)over10++;}
    return {png:canvas.toDataURL(),meanPixelChannelDifference:difference/(a.length/4*3),pixelsOver10:over10/(a.length/4),alphaRatio:alphaB/alphaA};
   },{effect,elapsed,approved});
   const stem=`${viewport.width}-${effect}-${elapsed}`;
   assert.ok(actual.meanPixelChannelDifference<1,`${stem}: unexpected visual regression`);
   for(const [suffix,data] of [['approved',approved],['optimized',actual.png]])await writeFile(`${out}/${stem}-${suffix}.png`,Buffer.from(data.split(',')[1],'base64'));
   delete actual.png;results.push({viewport,effect,elapsed,...actual});
  }
  await context.close();
 }
 await writeFile(out+'/renderer-visual-results.json',JSON.stringify(results,null,2));
 console.log(`${results.length} matched viewport/time comparisons passed; images and numeric deltas in ${out}`);
}finally{await browser.close();}

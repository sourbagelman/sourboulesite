/** Private fixture only: exact original/new scene comparison and bounded CPU setup/draw benchmark.
 * Usage: node renderer-expansion-visual.mjs <approved-package-root> <private-output-dir> [baseline-commit]
 * Uses installed esbuild/Playwright through SB_ESBUILD/SB_PLAYWRIGHT and SB_CHROME as needed.
 */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const [archive,outArg,baseline='d96ad6e045a87ec0b07bdb46ffdb789c0cd6aa19']=process.argv.slice(2);
assert.ok(archive&&outArg,'Approved package root and private output directory are required');
const out=resolve(outArg);await mkdir(out,{recursive:true});
const require=createRequire(new URL('../../new-year/package.json',import.meta.url));
const { chromium }=require(process.env.SB_PLAYWRIGHT||'playwright');const {build}=require(process.env.SB_ESBUILD||'esbuild');
const root=new URL('../../../',import.meta.url).pathname;
const settings={bundle:true,format:'iife',globalName:'fixtureRenderer',target:['safari15.4','chrome100'],minify:true,legalComments:'none',write:false};
const current=(await build({...settings,entryPoints:[root+'_features/weather/renderer.mjs']})).outputFiles[0].text;
const oldSource=execFileSync('git',['show',baseline+':_features/weather/renderer.mjs'],{cwd:root,encoding:'utf8'});
const old=(await build({...settings,stdin:{contents:oldSource,resolveDir:root,loader:'js'}})).outputFiles[0].text;
const approved=(await build({...settings,entryPoints:[resolve(archive,'source/weather-additions.mjs')]})).outputFiles[0].text;
const scenes=JSON.parse(await readFile(resolve(archive,'source/scenes.json'),'utf8'));
const originals=['rain','snow','wind','cloud','sun','night'].map(effect=>({id:effect,effect,autumnLeaves:true}));
const profiles=[{width:1440,height:900,dpr:1,cpu:1},{width:390,height:844,dpr:2,cpu:4},{width:320,height:568,dpr:2,cpu:6}];
const browser=await chromium.launch({headless:true,...(process.env.SB_CHROME?{executablePath:process.env.SB_CHROME}:{})});
const comparisons=[],metrics=[];
async function page(context,source,addition=false){const page=await context.newPage();await page.setContent('<body style="margin:0;background:#f6f3eb">');await page.evaluate(()=>{window.nativeNow=performance.now.bind(performance);window.testTime=0;window.jobs=new Map();window.jobId=0;Object.defineProperty(performance,'now',{value:()=>window.testTime});window.requestAnimationFrame=fn=>{window.jobs.set(++window.jobId,fn);return window.jobId;};window.cancelAnimationFrame=id=>window.jobs.delete(id);});await page.addScriptTag({content:source});await page.evaluate(addition=>window.isAddition=addition,addition);return page;}
async function frame(page,options,time){return page.evaluate(({options,time})=>{window.stop?.();window.addition?.dispose();document.querySelectorAll('canvas').forEach(c=>c.remove());window.testTime=0;
 if(window.isAddition){const canvas=document.createElement('canvas');document.body.append(canvas);window.addition=fixtureRenderer.createWeatherAddition({canvas,width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio,...options});window.addition.draw(time);}
 else{window.stop=fixtureRenderer.startWeather(options);if(!window.stop)throw Error('Renderer did not start');window.testTime=time*1000;const jobs=[...window.jobs.values()];window.jobs.clear();jobs.forEach(fn=>fn(window.testTime));}
 return document.querySelector('canvas').toDataURL();},{options,time});}
try{
 for(const profile of profiles){
  const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},deviceScaleFactor:profile.dpr});
  const candidate=await page(context,current),previous=await page(context,old),supplied=await page(context,approved,true);
  for(const [group,cases,reference]of [['original',originals,previous],['addition',scenes,supplied]])for(const options of cases)for(const time of [.3,1.5,3.5]){
   const expected=await frame(reference,options,time),actual=await frame(candidate,options,time);const stem=`${profile.width}-${group}-${options.id}-${time}`;
   const left=Buffer.from(expected.split(',')[1],'base64'),right=Buffer.from(actual.split(',')[1],'base64');assert.deepEqual(right,left,stem+' must preserve every pixel');
   await writeFile(out+'/'+stem+'-reference.png',left);await writeFile(out+'/'+stem+'-production.png',right);comparisons.push({profile,group,scene:options.id,time,identical:true});
  }
  const cdp=await context.newCDPSession(candidate);await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.cpu});
  for(const options of [...originals,...scenes])for(let repeat=0;repeat<3;repeat++){
   const metric=await candidate.evaluate(options=>{window.stop?.();window.testTime=0;const before=window.nativeNow();let reason;window.stop=fixtureRenderer.startWeather({...options,onFinish:r=>reason=r});const setupMs=window.nativeNow()-before;const frames=[];if(!window.stop)throw Error('Renderer did not start');
    for(let i=1;i<=239;i++){window.testTime=i*16.6667;const jobs=[...window.jobs.values()];window.jobs.clear();const start=window.nativeNow();jobs.forEach(fn=>fn(window.testTime));frames.push(window.nativeNow()-start);}
    window.testTime=4000;const jobs=[...window.jobs.values()];window.jobs.clear();jobs.forEach(fn=>fn(window.testTime));frames.sort((a,b)=>a-b);return {setupMs,p95DrawMs:frames[Math.floor(frames.length*.95)],worstDrawMs:frames.at(-1),cleanup:!document.querySelector('canvas')&&!window.jobs.size,reason};
   },options);
   assert.ok(metric.cleanup,'Complete cleanup');assert.ok(metric.setupMs<50,'No >=50ms setup task in this controlled profile');if(profile.cpu===4)assert.ok(metric.p95DrawMs<4,'4x p95 below 4ms');if(profile.cpu===6)assert.ok(metric.p95DrawMs<8,'6x p95 below 8ms');metrics.push({profile,scene:options.id,repeat,...metric});
  }
  await context.close();
 }
 await writeFile(out+'/renderer-expansion-results.json',JSON.stringify({baseline,comparisonCount:comparisons.length,comparisons,metrics},null,2));
 console.log(`${comparisons.length} exact PNG comparisons and ${metrics.length} bounded setup/draw benchmarks passed`);
 for(const profile of profiles){const rows=metrics.filter(x=>x.profile.width===profile.width);console.log(JSON.stringify({width:profile.width,cpu:profile.cpu,maxSetupMs:Math.max(...rows.map(x=>x.setupMs)),worstP95Ms:Math.max(...rows.map(x=>x.p95DrawMs)),worstDrawMs:Math.max(...rows.map(x=>x.worstDrawMs)),allCleanup:rows.every(x=>x.cleanup)}));}
}finally{await browser.close();}

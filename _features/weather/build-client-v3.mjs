// Versioned production assets; retained v1/v2 source and bytes are never rewritten.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require=createRequire(new URL('../new-year/package.json',import.meta.url));
const {build}=require(process.env.SB_ESBUILD||'esbuild');
const root=fileURLToPath(new URL('../../',import.meta.url));
export const suitePlugin={name:'approved-weather-source',setup(build){
 build.onLoad({filter:/approved-timing-v3\.js$/},async args=>({contents:(await readFile(args.path,'utf8')).replace('const WEATHER_TIMING','export const WEATHER_TIMING'),loader:'js'}));
 build.onLoad({filter:/approved-renderer-v3\.js$/},async args=>{
  let contents=await readFile(args.path,'utf8');
  // Omit the unobserved sky layer; known approved scenes are pixel-identical.
  contents=contents.replace('function atmosphericLight(t){','function atmosphericLight(t){\n   if(S.sky===null)return;');
  // Floor only oversized backing stores: obey the supplied two-million-pixel contract.
  contents=contents.replace('Math.round(W*ratio)','Math.floor(W*ratio)').replace('Math.round(H*ratio)','Math.floor(H*ratio)');
  contents="import { validScene } from './components-v3.mjs';\nimport { WEATHER_TIMING } from './approved-timing-v3.js';\nconst SKY_COVER={SKC:0,CLR:0,FEW:.18,SCT:.44,BKN:.77,OVC:1,VV:1};\nconst validateScene=s=>({ok:validScene(s),reason:'Invalid weather scene'});\n"+contents+'\nexport { makeAtmosphere };\n';
  return {contents,loader:'js'};
 });
}};
export const fallbackPlugin={name:'five-second-legacy-fallback',setup(build){
 build.onLoad({filter:/\/(renderer|weather-additions)\.mjs$/},async args=>{
  let contents=await readFile(args.path,'utf8');
  contents=contents.replaceAll('t>=4','t>=5').replaceAll('smooth(0,.6,t)*(1-smooth(3.15,4,t))','smooth(0,.55,t)*(1-smooth(4.1,5,t))').replaceAll('>=4000','>=5000').replaceAll("'complete'),4000","'complete'),5000").replace('devicePixelRatio||1,2,Math.sqrt(3000000','devicePixelRatio||1,1.5,Math.sqrt(2000000').replace('Math.min(Math.max(0.25, Number(pixelRatio) || 1), 2, Math.sqrt(3000000 / (width * height)))','Math.min(Number(pixelRatio) || 1, 1.5, Math.sqrt(2000000 / (width * height)))').replace('Math.round(width*dpr)','Math.floor(width*dpr)').replace('Math.round(height*dpr)','Math.floor(height*dpr)');
  return {contents,loader:'js'};
 });
}};
export async function buildV3(){
 const retained=new Map();
 for(const name of ['weather.js','weather-renderer.js','weather-v2.js','weather-renderer-v2.js'])retained.set(name,createHash('sha256').update(await readFile(root+'assets/js/'+name)).digest('hex'));
 const opts={bundle:true,target:['safari15.4','chrome100'],minify:true,legalComments:'none'};
 await build({...opts,entryPoints:[root+'_features/weather/client-v3.mjs'],outfile:root+'assets/js/weather-v3.js',external:['/assets/js/weather-renderer-v3.js','/assets/js/weather-fallback-v3.js'],format:'iife'});
 await build({...opts,entryPoints:[root+'_features/weather/renderer-v3.mjs'],outfile:root+'assets/js/weather-renderer-v3.js',format:'esm',plugins:[suitePlugin]});
 await build({...opts,entryPoints:[root+'_features/weather/renderer.mjs'],outfile:root+'assets/js/weather-fallback-v3.js',format:'esm',plugins:[fallbackPlugin]});
 for(const[name,hash]of retained)if(createHash('sha256').update(await readFile(root+'assets/js/'+name)).digest('hex')!==hash)throw Error('Retained asset changed: '+name);
 console.log('Built weather-v3.js, weather-renderer-v3.js, weather-fallback-v3.js; retained four old assets unchanged.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await buildV3();

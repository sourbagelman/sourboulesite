/* Private test-only stage marks. Never imported by a shipped asset. */
import {readFile} from 'node:fs/promises';
import {suitePlugin} from '../build-client-v3.mjs';
export async function stageBundle(build,root){
 const instrument={name:'private-weather-stage-marks',setup(b){
  suitePlugin.setup({onLoad(options,load){b.onLoad(options,async args=>{
   const result=await load(args);
   if(args.path.endsWith('approved-renderer-v3.js')){
    result.contents=result.contents.replace('const particles=','performance.mark("weather:particles:start"); const particles=').replace('const spriteMoon=','performance.mark("weather:particles:end"); const spriteMoon=');
    result.contents=result.contents.replace('const sky=','performance.mark("weather:gradients:start"); const sky=').replace('const snowSprites=[];','performance.mark("weather:gradients:end"); performance.mark("weather:sprites:start"); const snowSprites=[];');
    result.contents=result.contents.replace('function iceGlaze(t){','performance.mark("weather:sprites:end"); function iceGlaze(t){');
   }
   return result;
  });}});
  b.onLoad({filter:/\/renderer-v3\.mjs$/},async args=>{
   let contents=await readFile(args.path,'utf8');
   contents=contents.replace("if(!validScene(scene)",'performance.mark("weather:prepare:start"); if(!validScene(scene)');
   contents=contents.replace('const response=await fetch','performance.mark("weather:fetch:"+name+":start"); const response=await fetch');
   contents=contents.replace('const blob=await response.blob();','performance.mark("weather:fetch:"+name+":response"); const blob=await response.blob(); performance.mark("weather:blob:"+name+":end");');
   contents=contents.replace('await Promise.race([image.decode()', 'performance.mark("weather:decode:"+name+":start"); await Promise.race([image.decode()');
   contents=contents.replace('if(released||image.naturalWidth','performance.mark("weather:decode:"+name+":end"); if(released||image.naturalWidth');
   contents=contents.replace("canvas=document.createElement('canvas');",'performance.mark("weather:setup:start"); canvas=document.createElement("canvas");');
   contents=contents.replace('// Rounded source','performance.mark("weather:setup:end"); // Rounded source');
   contents=contents.replace('return function start(', 'performance.mark("weather:prepare:end"); return function start(');
   contents=contents.replace('document.body.append(canvas);','performance.mark("weather:append:start"); document.body.append(canvas); performance.mark("weather:append:end");');
   contents=contents.replace('const start=performance.now();','performance.mark("weather:clock:start"); const start=performance.now();');
   contents=contents.replace('const began=performance.now();','const marked=(window.__suiteQA?.frames.length??99)<3; if(marked)performance.mark("weather:draw:start"); const began=performance.now();');
   contents=contents.replace('drawSlow=performance.now()-began','if(marked)performance.mark("weather:draw:end"); drawSlow=performance.now()-began');
   return{contents,loader:'js'};
  });
 }};
 return(await build({entryPoints:[root+'_features/weather/renderer-v3.mjs'],bundle:true,minify:true,target:['safari15.4','chrome100'],format:'esm',write:false,plugins:[instrument],banner:{js:'performance.mark("weather:module:start");'},footer:{js:'performance.mark("weather:module:end");'}})).outputFiles[0].text;
}

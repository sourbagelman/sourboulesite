import { makeAtmosphere } from './approved-renderer-v3.js';
import { WEATHER_TIMING } from './approved-timing-v3.js';
import { validScene } from './components-v3.mjs';
import { TEXTURES } from './texture-manifest-v3.mjs';
export { WEATHER_TIMING } from './approved-timing-v3.js';
const ORIGIN='https://sour-boule-weather.lance-c84.workers.dev';
const COVER={SKC:0,CLR:0,FEW:.18,SCT:.44,BKN:.77,OVC:1,VV:1};
/** Only resources actually stamped by this composition. Browser HTTP cache owns reuse. */
export function textureNames(scene,lighting=false){
 const night=scene.daypart==='night',cover=COVER[scene.sky],palette=night?'night':scene.thunder?'storm':'day';
 const fog=['fog','fog_mist','dense_fog'].includes(scene.mist),names=[];
 if(cover){names.push('bank-'+palette,'bank-detail-'+palette);if(cover>=.7)names.push('blanket-'+palette);}
 if(fog||['blowing_snow','drifting_snow'].includes(scene.precip))names.push('fog-'+(night?'night':'day'));
 if(night&&cover<.8&&!fog&&scene.mist!=='haze'&&scene.precip==='none'&&!scene.thunder)names.push('moon');
 if(scene.thunder&&lighting&&cover>0)names.push('cloud-light');
 return names;
}
/** No canvas is attached and no playback clock starts while resources are loading. */
export async function prepareWeather({scene,signal,lighting=false}={}){
 if(!validScene(scene)||typeof lighting!=='boolean'||signal?.aborted||document.hidden)return null;
 const width=innerWidth,height=innerHeight;
 if(!(width>0&&height>0)||(scene.sky===null&&scene.precip==='none'&&scene.mist==='none'))return null;
 lighting=lighting&&COVER[scene.sky]>0;
 const aborter=new AbortController(),textures={},urls=new Set(),images=new Set();
 let released=false,started=false,stopPlayback=null,atmosphere=null,canvas=null;
 const release=()=>{
  if(released)return;released=true;aborter.abort();signal?.removeEventListener('abort',abort);
  atmosphere?.dispose();atmosphere=null;
  if(canvas){canvas.remove();canvas.width=canvas.height=0;canvas=null;}
  for(const image of images)image.src='';images.clear();
  for(const url of urls)URL.revokeObjectURL(url);urls.clear();
  for(const key of Object.keys(textures))delete textures[key];
 };
 const abort=()=>stopPlayback?stopPlayback('aborted'):release();
 signal?.addEventListener('abort',abort,{once:true});
 const deadline=setTimeout(release,3000);
 const names=textureNames(scene,lighting);
 if(names.reduce((sum,name)=>sum+TEXTURES[name][1],0)>131072){clearTimeout(deadline);release();return null;}
 try{
  await Promise.all(names.map(async name=>{
   const [file,bytes,w,h]=TEXTURES[name];
   const response=await fetch(ORIGIN+'/textures/'+file,{signal:aborter.signal,mode:'cors',credentials:'omit',cache:'force-cache',redirect:'error'});
   if(!response.ok||!response.headers.get('content-type')?.startsWith('image/webp'))throw Error('Weather texture unavailable');
   const blob=await response.blob();if(released||blob.size!==bytes)throw Error('Weather texture size');
   const url=URL.createObjectURL(blob),image=new Image();urls.add(url);images.add(image);
   image.src=url;
   await Promise.race([image.decode(),new Promise((_,reject)=>{if(aborter.signal.aborted)reject(Error('Weather preparation cancelled'));else aborter.signal.addEventListener('abort',()=>reject(Error('Weather preparation cancelled')),{once:true});})]);
   if(released||image.naturalWidth!==w||image.naturalHeight!==h)throw Error('Weather texture dimensions');
   textures[name]=image;URL.revokeObjectURL(url);urls.delete(url);
  }));
  if(released||signal?.aborted||document.hidden||width!==innerWidth||height!==innerHeight){release();return null;}
  canvas=document.createElement('canvas');
  atmosphere=makeAtmosphere(canvas,width,height,scene,textures,{lightning:lighting});
  // Rounded source dimensions are unchanged at standard viewports. The transform uses floor at a cap.
  if(canvas.width*canvas.height>2000000)throw Error('Weather canvas pixel budget');
  clearTimeout(deadline);
  return function start({onFinish=()=>{}}={}){
   if(started||released||signal?.aborted||document.hidden||width!==innerWidth||height!==innerHeight){release();return null;}
   started=true;let frame=0,timer=0,stopped=false;
   const visibility=()=>{if(document.hidden)stop('hidden');},leave=()=>stop('pagehide'),resize=()=>stop('resize');
   function stop(reason='cancelled'){
    if(stopped)return;stopped=true;cancelAnimationFrame(frame);clearTimeout(timer);
    document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',leave);window.removeEventListener('resize',resize);
    release();onFinish(reason);
   }
   stopPlayback=stop;
   canvas.setAttribute('aria-hidden','true');canvas.setAttribute('data-sb-weather','');
   canvas.style.cssText=`position:fixed;inset:0;width:${width}px;height:${height}px;pointer-events:none;z-index:20;contain:strict;`;
   document.body.append(canvas);
   document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',leave);window.addEventListener('resize',resize);
   const start=performance.now();let prior=start,slow=0,drawSlow=0;
   function step(now){
    if(stopped)return;
    if(now-start>=WEATHER_TIMING.durationMs){stop('complete');return;}
    slow=now-prior>80?slow+1:0;prior=now;if(slow>=3){stop('busy');return;}
    const began=performance.now();
    try{atmosphere.draw((now-start)/1000);}catch{stop('unavailable');return;}
    drawSlow=performance.now()-began>12?drawSlow+1:0;
    if(drawSlow>=6){stop('busy');return;}frame=requestAnimationFrame(step);
   }
   timer=setTimeout(()=>stop('complete'),WEATHER_TIMING.durationMs);frame=requestAnimationFrame(step);
   return stop;
  };
 }catch{release();return null;}finally{clearTimeout(deadline);}
}

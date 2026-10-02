import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { startWeather } from '../renderer.mjs';

function environment({width=390,height=844,dpr=2,unsupported=false}={}){
 const previous=new Map(),canvases=[],raf=new Map(),timers=new Map(),events=new Map();let serial=0,now=0,gradients=0,shadows=0,draws=0,drawCost=0;
 function install(key,value){previous.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{configurable:true,value,writable:true});}
 const listeners=(target)=>({addEventListener(name,fn){events.set(target+name,fn);},removeEventListener(name,fn){if(events.get(target+name)===fn)events.delete(target+name);}});
 install('innerWidth',width);install('innerHeight',height);install('devicePixelRatio',dpr);
 install('performance',{now:()=>now});install('requestAnimationFrame',fn=>{const id=++serial;raf.set(id,fn);return id;});install('cancelAnimationFrame',id=>raf.delete(id));
 install('setTimeout',(fn,delay)=>{const id=++serial;timers.set(id,{fn,delay});return id;});install('clearTimeout',id=>timers.delete(id));
 install('window',listeners('window'));
 const document={hidden:false,...listeners('document'),body:{append(c){c.attached=true;}},createElement(name){assert.equal(name,'canvas');const canvas={width:300,height:150,attached:false,style:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},remove(){this.attached=false;},getContext(){if(unsupported)return null;const context=new Proxy({globalAlpha:1,createLinearGradient(){gradients++;return {addColorStop(){}};},createRadialGradient(){gradients++;return {addColorStop(){}};},drawImage(){draws++;now+=drawCost;}},{get(o,k){return k in o?o[k]:()=>{};},set(o,k,v){if(k==='shadowBlur'||k==='filter')shadows++;o[k]=v;return true;}});return context;}};canvases.push(canvas);return canvas;}};install('document',document);
 return {canvases,raf,timers,events,document,setDrawCost(value){drawCost=value;},stats:()=>({gradients,shadows,draws}),frame(t){now=t;const jobs=[...raf.values()];raf.clear();jobs.forEach(fn=>fn(now));},fire(key){events.get(key)?.();},dispose(){for(const[k,d]of previous)d?Object.defineProperty(globalThis,k,d):delete globalThis[k];}};
}

for(const effect of ['rain','snow','wind','cloud','sun','night'])test(`${effect}: cached gradients/shadows, decorative canvas, four-second cleanup`,()=>{
 const e=environment();try{let finished;const stop=startWeather({effect,autumnLeaves:true,onFinish:r=>finished=r});assert.equal(typeof stop,'function');const c=e.canvases[0];assert.equal(c.attached,true);assert.equal(c.attributes['aria-hidden'],'true');assert.match(c.style.cssText,/pointer-events:none/);const before=e.stats();
 for(const t of [16,32,48,64,80])e.frame(t);const after=e.stats();assert.equal(after.gradients,before.gradients,'all gradients are created during preparation');assert.equal(after.shadows,before.shadows,'no per-frame blur/shadow initialization');assert.ok(after.draws>before.draws||effect==='wind');
 e.frame(3999);assert.equal(c.attached,true);e.frame(4000);assert.equal(finished,'complete');assert.equal(c.attached,false);assert.equal(e.raf.size,0);assert.equal(e.timers.size,0);assert.equal(e.events.size,0);assert.ok(e.canvases.every(c=>c.width===0&&c.height===0),'all backing stores released');e.frame(4200);stop();assert.equal(e.raf.size,0);
 }finally{e.dispose();}
});
for(const action of ['pagehide','hidden','resize','cancelled'])test(`${action}: stopped runs cannot restart after visibility/BFCache/resize`,()=>{
 const e=environment();try{const stop=startWeather({effect:'night'});e.frame(16);if(action==='hidden'){e.document.hidden=true;e.fire('documentvisibilitychange');}else if(action==='cancelled')stop();else e.fire('window'+action);assert.equal(e.canvases[0].attached,false);e.document.hidden=false;e.fire('documentvisibilitychange');e.fire('windowresize');e.fire('windowpageshow');e.frame(100);assert.equal(e.raf.size,0);assert.equal(e.events.size,0);assert.equal(e.timers.size,0);}finally{e.dispose();}
});
test('sustained jank skips decoration without changing its opacity',()=>{const e=environment();try{let reason;startWeather({effect:'cloud',onFinish:r=>reason=r});e.frame(100);e.frame(200);e.frame(300);assert.equal(reason,'busy');assert.equal(e.raf.size,0);}finally{e.dispose();}});
test('selected effect resources only; autumn leaves opt in',()=>{const e=environment();try{const stop=startWeather({effect:'wind'});assert.equal(e.canvases.length,1);stop();const withLeaves=startWeather({effect:'wind',autumnLeaves:true});assert.equal(e.canvases.length,14);withLeaves();}finally{e.dispose();}});
test('canvas backing pixel cap on large retina screens',()=>{const e=environment({width:3840,height:2160,dpr:3});try{const stop=startWeather({effect:'wind'});assert.ok(e.canvases[0].width*e.canvases[0].height<=3004000);stop();}finally{e.dispose();}});
test('unsupported canvas and unknown condition never start',()=>{const e=environment({unsupported:true});try{assert.equal(startWeather({effect:'cloud'}),null);assert.equal(startWeather({effect:'hail'}),null);assert.equal(e.raf.size,0);}finally{e.dispose();}});
test('production source has no forcing/demo/global hooks',async()=>{const source=await readFile(new URL('../renderer.mjs',import.meta.url),'utf8');assert.doesNotMatch(source,/weatherDemo|URLSearchParams|localStorage|OffscreenCanvas/);assert.match(source,/smooth\(0,\.6,t\)\*\(1-smooth\(3\.15,4,t\)\)/);});

const additions=[{effect:'fog'},{effect:'drizzle'},{effect:'storm'},{effect:'rain',mist:true},{effect:'drizzle',mist:true},{effect:'fog',night:true}];
for(const options of additions)test(`addition ${JSON.stringify(options)}: one visible canvas/RAF, preparation-only gradients, full cleanup`,()=>{
 const e=environment();try{let finished;const stop=startWeather({...options,onFinish:r=>finished=r});assert.equal(typeof stop,'function');assert.equal(e.canvases.filter(c=>c.attached).length,1);assert.equal(e.raf.size,1);const before=e.stats();
 for(const t of [16,32,48,64,80]){e.frame(t);assert.equal(e.raf.size,1);}
 const after=e.stats();assert.equal(after.gradients,before.gradients);assert.equal(after.shadows,before.shadows);assert.ok(after.draws>before.draws);
 assert.ok(e.canvases.slice(1).reduce((sum,c)=>sum+c.width*c.height,0)<=7000000);e.frame(4000);assert.equal(finished,'complete');assert.equal(e.events.size,0);assert.equal(e.raf.size,0);assert.equal(e.timers.size,0);assert.ok(e.canvases.every(c=>c.width===0&&c.height===0));stop();
 }finally{e.dispose();}
});
test('addition combinations are validated before allocating drawing resources',()=>{const e=environment();try{for(const options of [{effect:'sun',mist:true},{effect:'storm',mist:true},{effect:'rain',night:true},{effect:'night',night:true},{effect:'fog',mist:true},{effect:'fog',night:'yes'},{effect:'rain',mist:1}])assert.equal(startWeather(options),null);assert.equal(e.canvases.length,0);}finally{e.dispose();}});
test('addition interruption releases every sprite and never restarts',()=>{const e=environment();try{startWeather({effect:'storm'});e.frame(16);e.fire('windowpagehide');assert.ok(e.canvases.every(c=>!c.attached&&c.width===0&&c.height===0));e.fire('windowresize');e.fire('windowpageshow');e.frame(100);assert.equal(e.raf.size,0);assert.equal(e.events.size,0);}finally{e.dispose();}});


test('isolated slow RAF gaps reset rather than suppressing otherwise usable playback',()=>{const e=environment();try{let reason;const stop=startWeather({effect:'cloud',onFinish:r=>reason=r});for(const t of [100,200,216,316,416,432])e.frame(t);assert.equal(reason,undefined);assert.equal(e.canvases[0].attached,true);stop();}finally{e.dispose();}});
test('six sustained expensive draws stop with busy reason and release every resource',()=>{const e=environment();try{let reason;startWeather({effect:'night',onFinish:r=>reason=r});e.setDrawCost(.5);for(const t of [40,80,120,160,200])e.frame(t);assert.equal(reason,undefined);e.frame(240);assert.equal(reason,'busy');assert.equal(e.raf.size,0);assert.equal(e.timers.size,0);assert.equal(e.events.size,0);assert.ok(e.canvases.every(c=>!c.attached&&c.width===0&&c.height===0));}finally{e.dispose();}});
test('a recovered draw budget resets the consecutive slow-draw counter',()=>{const e=environment();try{let reason;const stop=startWeather({effect:'night',onFinish:r=>reason=r});e.setDrawCost(.5);for(const t of [40,80,120,160,200])e.frame(t);e.setDrawCost(0);e.frame(240);e.setDrawCost(.5);for(const t of [280,320,360,400,440])e.frame(t);assert.equal(reason,undefined);assert.equal(e.canvases[0].attached,true);stop();}finally{e.dispose();}});

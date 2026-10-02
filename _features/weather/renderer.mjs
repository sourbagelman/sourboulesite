import { createWeatherAddition } from './weather-additions.mjs';
/** Approved v2 geometry. Temporary sprites cache repeated raster work for this run only. */
const TYPES = new Set(['rain','snow','wind','cloud','sun','night','fog','drizzle','storm']);
const rnd=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
const smooth=(a,b,t)=>{const v=Math.max(0,Math.min(1,(t-a)/(b-a)));return v*v*(3-2*v);};

export function startWeather({effect,autumnLeaves=false,mist=false,night=false,onFinish=()=>{}}={}) {
 if(!TYPES.has(effect)||document.hidden||typeof mist!=='boolean'||typeof night!=='boolean'||(mist&&!['rain','drizzle'].includes(effect))||(night&&effect!=='fog'))return null;
 const expanded=['fog','drizzle','storm'].includes(effect)||mist;
 const width=innerWidth,height=innerHeight;
 if(!(width>0&&height>0))return null;
 // Bound backing pixels, including large/retina displays; never reduce opacity.
 const dpr=Math.min(devicePixelRatio||1,2,Math.sqrt(3000000/(width*height)));
 const c=document.createElement('canvas'),resources=[];
 let ctx=c.getContext('2d'),raf=0,timer=0,stopped=false,started=false;
 if(!ctx)return null;
 const particles=Array.from({length:expanded?0:110},(_,i)=>({a:rnd(i+1),b:rnd(i+401),r:rnd(i+901),s:rnd(i+2001),d:rnd(i+3001)}));
 const rain=[],snow=[],flakes=[],stars=[],clouds=[],glows=new Map(),leaves=new Map();
 let moon,rays,dusk,pixels=0,addition=null;
 function sprite(left,top,right,bottom,paint) {
  const canvas=document.createElement('canvas');
  canvas.width=Math.ceil((right-left)*dpr);canvas.height=Math.ceil((bottom-top)*dpr);
  pixels+=canvas.width*canvas.height;
  if(pixels>7000000)throw new Error('Weather sprite budget');
  const target=canvas.getContext('2d');if(!target)throw new Error('Canvas unavailable');
  resources.push(canvas);const previous=ctx;ctx=target;
  ctx.setTransform(dpr,0,0,dpr,-left*dpr,-top*dpr);
  try{paint();}finally{ctx=previous;}
  return {canvas,left,top,width:canvas.width/dpr,height:canvas.height/dpr};
 }
 function stamp(s,x,y){ctx.drawImage(s.canvas,x+s.left,y+s.top,s.width,s.height);}
 function glow(x,y,rx,ry,color){const key=[rx,ry,color].join(':');let s=glows.get(key);if(!s){s=sprite(-rx,-ry,rx,ry,()=>rawGlow(0,0,rx,ry,color));glows.set(key,s);}stamp(s,x,y);}
 function leaf(x,y,size,angle,alpha){const s=leaves.get(size);ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha*=alpha;stamp(s,0,0);ctx.restore();}
 function cloudStamp(i,x,y){stamp(clouds[i],x,y);}
function rawGlow(x,y,rx,ry,rgba){ctx.save();ctx.translate(x,y);ctx.scale(rx,ry);const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,rgba);g.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();ctx.restore();}
function rawLeaf(x,y,size,angle,alpha){ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha*=alpha;ctx.fillStyle='#b5894e';ctx.beginPath();ctx.moveTo(-size,0);ctx.bezierCurveTo(-size*.3,-size*.75,size*.55,-size*.65,size,0);ctx.bezierCurveTo(size*.4,size*.65,-size*.4,size*.7,-size,0);ctx.fill();ctx.strokeStyle='rgba(91,69,39,.6)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(-size,0);ctx.lineTo(size*1.3,0);ctx.stroke();ctx.restore();}
// Revision 02: more visible on a phone, with the original four-second timing.
// Clouds have shaped, shaded silhouettes; night has a crescent and distinct stars.
function rawCloudBank(x,y,scale,alpha) {
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale*.82);ctx.globalAlpha*=alpha;if("filter" in ctx)ctx.filter="blur(3px)";
 const g=ctx.createLinearGradient(0,-64,0,40);
 g.addColorStop(0,'rgba(247,252,254,.88)');
 g.addColorStop(.46,'rgba(210,228,235,.80)');
 g.addColorStop(1,'rgba(115,145,160,.55)');
 ctx.fillStyle=g;ctx.shadowColor='rgba(43,72,92,.22)';ctx.shadowBlur=13;ctx.shadowOffsetY=5;
 ctx.beginPath();ctx.moveTo(-134,25);
 ctx.bezierCurveTo(-166,24,-170,-12,-143,-24);
 ctx.bezierCurveTo(-127,-34,-108,-31,-100,-22);
 ctx.bezierCurveTo(-100,-66,-54,-77,-27,-43);
 ctx.bezierCurveTo(-12,-67,29,-67,47,-39);
 ctx.bezierCurveTo(72,-51,104,-27,99,-6);
 ctx.bezierCurveTo(136,-22,163,2,146,25);
 ctx.bezierCurveTo(119,44,-99,44,-134,25);ctx.closePath();ctx.fill();
 ctx.shadowBlur=0;ctx.shadowOffsetY=0;ctx.lineWidth=.9;
 ctx.restore();
}
function rawCrescent(x,y,r) {
 ctx.save();ctx.translate(x,y);ctx.rotate(-.28);
 rawGlow(0,0,r*2.7,r*2.7,'rgba(219,235,255,.44)');
 ctx.shadowColor='rgba(198,225,255,.85)';ctx.shadowBlur=18;
 const g=ctx.createLinearGradient(-r,-r,r,r);
 g.addColorStop(0,'#fffbe6');g.addColorStop(.7,'#e3edfb');g.addColorStop(1,'#adc8e0');
 ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,-r);
 ctx.bezierCurveTo(-r*1.40,-r*.76,-r*1.40,r*.81,0,r);
 ctx.bezierCurveTo(r*.61,r*1.01,r*1.01,r*.54,r*.99,r*.02);
 ctx.bezierCurveTo(r*.23,r*.57,-r*.58,-r*.13,0,-r);
 ctx.closePath();ctx.fill();ctx.shadowBlur=0;
 ctx.strokeStyle='rgba(82,119,153,.48)';ctx.lineWidth=.9;ctx.stroke();ctx.restore();
}
function draw(type,t){
 ctx.clearRect(0,0,width,height);if(t<0||t>=4)return;
 const f=smooth(0,.6,t)*(1-smooth(3.15,4,t));ctx.globalAlpha=f;
 const area=Math.min(width/430,2);
 if(type==='rain'){
  const count=Math.round(84*area);
  for(let i=0;i<count;i++){
   const p=particles[i%110],speed=430+p.s*460;
   const y=(p.b*(height+240)+t*speed)%(height+220)-110;
   const x=((p.a*(width+180)+t*speed*.13)%(width+180))-90,len=15+p.r*26;
   stamp(rain[i%110],x,y);
  }
  for(let i=0;i<7;i++){
   const u=(t*1.45+particles[i].a)%1;
   ctx.strokeStyle='rgba(105,161,188,'+(.36*(1-u))+')';ctx.lineWidth=1.1;
   ctx.beginPath();ctx.ellipse(particles[i].a*width,height*(.30+particles[i].b*.48),2+u*14,1+u*3.5,0,0,Math.PI);ctx.stroke();
  }
 }else if(type==='snow'){
  for(let i=0;i<68*area;i++){
   const p=particles[i%110],x=(p.a*(width+80)+Math.sin(t*.8+p.b*12)*18+t*12)%(width+80)-40;
   const y=(p.b*(height+130)+t*(26+p.s*55))%(height+130)-65,r=1.7+p.r*3.2;
   stamp(snow[i%110],x,y);
   if(i%8===0){ctx.save();ctx.translate(x,y);ctx.rotate(t*.3+p.a*5);stamp(flakes[i%110],0,0);ctx.restore();}
  }
 }else if(type==='wind'){
  for(let i=0;i<5;i++){
   const p=particles[i+8],x=-180+((t*(220+i*25)+p.a*(width+480))%(width+480));
   const y=height*(.13+i*.16)+Math.sin(t*1.6+i)*20;
   ctx.strokeStyle='rgba(91,134,134,.43)';ctx.lineWidth=1.65;
   ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+55,y-17,x+90,y+17,x+160,y);ctx.stroke();
   ctx.strokeStyle='rgba(134,161,133,.32)';ctx.lineWidth=1.25;
   ctx.beginPath();ctx.moveTo(x-35,y+7);ctx.bezierCurveTo(x+15,y-4,x+50,y+20,x+100,y+10);ctx.stroke();
  }
  for(let i=0;i<(autumnLeaves?12:0);i++){
   const p=particles[i+20],x=-55+((p.a*(width+120)+t*(100+p.s*85))%(width+120));
   const y=p.b*height+Math.sin(t*2+p.a*8)*28+t*5;
   leaf(x,y,6+p.r*6,t*(1+p.s*2)+p.a*6,.64+p.r*.28);
  }
 }else if(type==='cloud'){
  // Banks cross the edges, leaving the central headline and buttons readable.
  const scale=Math.min(Math.max(width/450,.78),1.6);
  cloudStamp(0,width*.01+t*24,height*.10,.70);
  cloudStamp(1,width*1.04-t*27,height*.24,.69);
  cloudStamp(2,-width*.28+t*27,height*.47,.51);
  glow(width*.92-t*18,height*.52,width*.50,30,'rgba(176,201,210,.32)');
 }else if(type==='sun'){
  glow(width*.88-t*12,height*.15,265,350,'rgba(255,210,105,.43)');
  ctx.save();ctx.translate(width*.9,-100);ctx.rotate(.27+Math.sin(t*.45)*.035);
  stamp(rays,0,0);ctx.restore();
  for(let i=0;i<20;i++){
   const p=particles[i+60],x=p.a*width+Math.sin(t+p.b*5)*10,y=(p.b*height-t*(4+p.s*10)+height)%height;
   ctx.fillStyle='rgba(210,170,81,'+(.32+p.r*.32)+')';ctx.beginPath();ctx.arc(x,y,.85+p.r*1.2,0,Math.PI*2);ctx.fill();
  }
 }else if(type==='night'){
  // A restrained dusk wash gives silver stars contrast on the light page, too.
  ctx.fillStyle=dusk;ctx.fillRect(0,0,width,height*.67);
  glow(width*.80,height*.22,180,200,'rgba(134,182,227,.30)');
  stamp(moon,width*.83,height*.235);
  for(let i=0;i<40;i++){
   const p=particles[i+70],x=p.a*width,y=height*(.075+p.b*.53);
   const a=.48+.47*smooth(0,1,Math.sin(t*1.05+p.s*6)*.5+.5),r=1.9+p.r*2.8;
   ctx.save();ctx.globalAlpha*=a;
   stamp(stars[i],x,y);ctx.restore();
  }
 }ctx.globalAlpha=1;
}

 function prepare(){
  if(effect==='rain')for(const p of particles){const len=15+p.r*26;rain.push(sprite(-3,-3,len*.16+3,len+3,()=>{
   ctx.lineWidth=.95+p.r*1.15;const g=ctx.createLinearGradient(0,0,len*.16,len);
   g.addColorStop(0,'rgba(94,149,180,0)');g.addColorStop(.7,'rgba(94,149,180,'+(.42+p.r*.33)+')');g.addColorStop(1,'rgba(185,221,239,'+(.50+p.r*.32)+')');
   ctx.strokeStyle=g;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(len*.16,len);ctx.stroke();
  }));}
  if(effect==='snow')for(const p of particles){const r=1.7+p.r*3.2;
   snow.push(sprite(-r-9,-r-9,r+9,r+9,()=>{ctx.globalAlpha=.58+p.r*.40;ctx.shadowColor='rgba(54,80,96,.82)';ctx.shadowBlur=4;ctx.fillStyle='#fffef7';ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(126,160,172,.36)';ctx.lineWidth=.65;ctx.stroke();}));
   flakes.push(sprite(-r*2-7,-r*2-7,r*2+7,r*2+7,()=>{ctx.strokeStyle='#fffef6';ctx.shadowColor='rgba(65,104,128,.6)';ctx.shadowBlur=3;ctx.lineWidth=1;for(let j=0;j<3;j++){ctx.rotate(Math.PI/3);ctx.beginPath();ctx.moveTo(-r*1.9,0);ctx.lineTo(r*1.9,0);ctx.stroke();}}));
  }
  if(effect==='wind'&&autumnLeaves)for(let i=0;i<12;i++){const size=6+particles[i+20].r*6;leaves.set(size,sprite(-size-2,-size-2,size*1.3+2,size+2,()=>rawLeaf(0,0,size,0,1)));}
  if(effect==='cloud'){
   const scale=Math.min(Math.max(width/450,.78),1.6);
   for(const [factor,alpha] of [[.84,.70],[1.02,.69],[1.15,.51]]){const s=scale*factor;clouds.push(sprite(-180*s-25,-90*s-25,180*s+25,60*s+25,()=>rawCloudBank(0,0,s,alpha)));}
   glow(0,0,width*.50,30,'rgba(176,201,210,.32)');
  }
  if(effect==='sun'){
   glow(0,0,265,350,'rgba(255,210,105,.43)');
   rays=sprite(-290,-2,55,height*1.2+2,()=>{const g=ctx.createLinearGradient(0,0,0,height*1.25);g.addColorStop(0,'rgba(255,216,120,.19)');g.addColorStop(.5,'rgba(255,224,147,.23)');g.addColorStop(1,'rgba(255,243,210,0)');ctx.fillStyle=g;
    for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo((i-3)*20,0);ctx.lineTo((i-3)*95,height*1.2);ctx.lineTo((i-3)*95+48,height*1.2);ctx.lineTo((i-3)*20+8,0);ctx.fill();}
   });
  }
  if(effect==='night'){
   dusk=ctx.createLinearGradient(0,0,0,height*.67);dusk.addColorStop(0,'rgba(29,47,78,.27)');dusk.addColorStop(.46,'rgba(40,65,102,.16)');dusk.addColorStop(1,'rgba(40,65,102,0)');
   glow(0,0,180,200,'rgba(134,182,227,.30)');
   const r=Math.min(29,22+width*.012);moon=sprite(-r*3.7,-r*3.7,r*3.7,r*3.7,()=>rawCrescent(0,0,r));
   for(let i=0;i<40;i++){const p=particles[i+70],r=1.9+p.r*2.8;stars.push(sprite(-r*4,-r*4,r*4,r*4,()=>{
    rawGlow(0,0,r*4,r*4,'rgba(226,241,255,.40)');
    if(i%3===0){ctx.beginPath();ctx.moveTo(0,-r*1.65);ctx.lineTo(r*.32,-r*.32);ctx.lineTo(r*1.1,0);ctx.lineTo(r*.32,r*.32);ctx.lineTo(0,r*1.65);ctx.lineTo(-r*.32,r*.32);ctx.lineTo(-r*1.1,0);ctx.lineTo(-r*.32,-r*.32);ctx.closePath();ctx.fillStyle='#f3f8ff';ctx.fill();ctx.strokeStyle='rgba(78,118,155,.70)';ctx.lineWidth=.7;ctx.stroke();}
    else{ctx.beginPath();ctx.arc(0,0,1.15+p.r*1.25,0,Math.PI*2);ctx.fillStyle='#f5f7ff';ctx.fill();ctx.strokeStyle='rgba(88,125,160,.76)';ctx.lineWidth=.85;ctx.stroke();}
   }));}
  }
 }
 const visibility=()=>{if(document.hidden)stop('hidden');};
 const leave=()=>stop('pagehide'),resize=()=>stop('resize');
 function stop(reason='cancelled'){
  if(stopped)return;stopped=true;cancelAnimationFrame(raf);clearTimeout(timer);
  window.removeEventListener('pagehide',leave);window.removeEventListener('resize',resize);document.removeEventListener('visibilitychange',visibility);
  addition?.dispose();addition=null;
  c.remove();c.width=c.height=0;for(const resource of resources)resource.width=resource.height=0;
  resources.length=0;glows.clear();leaves.clear();particles.length=rain.length=snow.length=flakes.length=stars.length=clouds.length=0;moon=rays=dusk=ctx=null;
  if(started)onFinish(reason);
 }
 try{
  c.width=Math.round(width*dpr);c.height=Math.round(height*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
  if(expanded)addition=createWeatherAddition({canvas:c,width,height,pixelRatio:dpr,effect,mist,night});
  else prepare();
  ctx.clearRect(0,0,width,height);
  c.setAttribute('aria-hidden','true');c.setAttribute('data-sb-weather','');
  c.style.cssText=`position:fixed;inset:0;width:${width}px;height:${height}px;pointer-events:none;z-index:20;contain:strict;`;
  document.body.append(c);started=true;
  window.addEventListener('pagehide',leave);window.addEventListener('resize',resize);document.addEventListener('visibilitychange',visibility);
  const start=performance.now();let prior=start,slow=0,drawSlow=0;
  function step(now){
   if(stopped)return;if(now-start>=4000){stop('complete');return;}
   slow=now-prior>80?slow+1:0;prior=now;if(slow>=3){stop('busy');return;}
   const began=performance.now();if(addition)addition.draw((now-start)/1000);else draw(effect,(now-start)/1000);drawSlow=performance.now()-began>12?drawSlow+1:0;
   if(drawSlow>=6){stop('busy');return;}raf=requestAnimationFrame(step);
  }
  timer=setTimeout(()=>stop('complete'),4000);raf=requestAnimationFrame(step);
  return stop;
 }catch{stop('unavailable');return null;}
}

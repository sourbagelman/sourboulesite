/* Final suite - reviewed lightning plus winter and mixed-weather extension. Offline experimental compositor, not the production renderer.
   One visible Canvas2D and one RAF managed by the host. Textures are embedded study
   assets; their bytes and setup cost count toward any later production review. */
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x);};
const mod=(x,n)=>((x%n)+n)%n;
function rand(n){const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);}
async function loadTextures(data){
 const pairs=await Promise.all(Object.entries(data).map(async([k,v])=>{const i=new Image();i.src=v;await i.decode();return[k,i];}));
 return Object.fromEntries(pairs);
}
function makeAtmosphere(canvas,W,H,scene,textures,{seed=7,view='page',strength=.90,lightning=true,reduced=false}={}){
 const test=validateScene(scene);if(!test.ok)throw Error(test.reason);
 const ratio=Math.min(devicePixelRatio||1,1.5,Math.sqrt(2000000/(W*H)));
 canvas.width=Math.max(1,Math.round(W*ratio));canvas.height=Math.max(1,Math.round(H*ratio));
 const g=canvas.getContext('2d',{alpha:true});if(!g)throw Error('Canvas unavailable');
 const S={...scene},night=S.daypart==='night',cover=SKY_COVER[S.sky],fog=['fog','fog_mist','dense_fog'].includes(S.mist),haze=S.mist==='haze';
 const particles=Array.from({length:512},(_,i)=>({x:rand(i+seed*43),y:rand(i+310+seed*17),z:rand(i+711),a:rand(i+1600),r:rand(i+2341)}));
 const spriteMoon=textures.moon;
 const palette=night?'night':S.thunder?'storm':'day';
 const bank=textures['bank-'+palette],detailBank=textures['bank-detail-'+palette];
 const blanket=textures['blanket-'+palette];
 const mistTex=textures['fog-'+(night?'night':'day')];
 let disposed=false;
 // Gradients are created once per scene, never allocated per particle per frame.
 const sky=g.createLinearGradient(0,0,0,H*.62);
 if(night){sky.addColorStop(0,'rgba(7,17,36,.96)');sky.addColorStop(.23,'rgba(22,42,65,.63)');sky.addColorStop(.60,'rgba(32,53,72,.17)');sky.addColorStop(1,'rgba(38,57,72,0)');}
 else if(cover>.7){sky.addColorStop(0,S.thunder?'rgba(53,70,84,.78)':'rgba(131,155,172,.52)');sky.addColorStop(.4,'rgba(181,200,209,.19)');sky.addColorStop(1,'rgba(211,224,228,0)');}
 else{sky.addColorStop(0,'rgba(66,128,166,.44)');sky.addColorStop(.4,'rgba(154,198,220,.15)');sky.addColorStop(1,'rgba(224,239,246,0)');}
 function rad(x,y,r,color){const a=g.createRadialGradient(x,y,0,x,y,r);a.addColorStop(0,color);a.addColorStop(1,'rgba(255,255,255,0)');return a;}
 const moonX=W*.81,moonY=Math.min(90,H*.14),moonR=W<500?16:23;
 const lunar=rad(moonX,moonY,W<500?95:165,'rgba(180,215,249,.35)');
 const sunlight=rad(W*.84,H*.07,Math.min(410,W*.60),'rgba(255,221,150,.46)');
 const beam=g.createLinearGradient(0,0,0,H*.85);beam.addColorStop(0,'rgba(255,233,184,.16)');beam.addColorStop(1,'rgba(255,241,202,0)');
 const rainPaint=[0,1,2].map(b=>{const q=g.createLinearGradient(0,0,0,H*.65);q.addColorStop(0,night?['rgba(174,201,226,.33)','rgba(193,218,241,.53)','rgba(219,236,250,.76)'][b]:['rgba(92,120,141,.25)','rgba(105,136,157,.38)','rgba(148,177,195,.57)'][b]);q.addColorStop(1,['rgba(76,110,135,.26)','rgba(88,123,150,.40)','rgba(124,160,182,.59)'][b]);return q;});
 const moonVisible=night&&cover<.8&&!fog&&!haze&&S.precip==='none'&&!S.thunder;
 const area=Math.min(1.8,Math.max(.64,W/500));
 const wind=Math.min(45,S.wind),gust=Math.min(55,S.gust??wind);
 const gustDelta=Math.max(0,gust-wind);
 const glowAllowed=Boolean(S.thunder&&lightning&&!reduced);
 const glowWidth=Math.min(W*.64,520),glowHeight=Math.min(195,H*.26);
 const glowX=W*.60-glowWidth*.5,glowY=-Math.min(8,H*.012);
 // Center mask is prepared once. No per-frame gradient allocation.
 const safe=g.createRadialGradient(0,0,.04,0,0,1);safe.addColorStop(0,'rgba(0,0,0,.82)');safe.addColorStop(.49,'rgba(0,0,0,.74)');safe.addColorStop(.79,'rgba(0,0,0,.22)');safe.addColorStop(1,'rgba(0,0,0,0)');
 const hazeGradient=g.createLinearGradient(0,0,0,H*.80);
 hazeGradient.addColorStop(0,night?'rgba(90,110,133,.20)':'rgba(217,192,148,.22)');
 hazeGradient.addColorStop(.45,night?'rgba(132,151,166,.14)':'rgba(231,206,170,.29)');
 hazeGradient.addColorStop(1,'rgba(201,196,177,0)');
 // One visible, localized light bloom: a 0.35 s rise and 0.80 s decay.
 // No repeated pulse, full-screen exposure change, or bolt. The maximum is at 1.90 s.
 function glowAt(t){
   if(!glowAllowed||t<=1.55||t>=2.70)return 0;
   return t<=1.90?ease((t-1.55)/.35):1-ease((t-1.90)/.80);
 }
 const lightTex=textures['cloud-light'];
 const drops=[[],[],[]];
 const count=S.precip==='none'?0:Math.round((S.precip==='drizzle'?58:S.precip==='snow'?80:140)*area*({light:.70,moderate:1,heavy:1.48}[S.intensity]));
 const snowSprites=[];
 if(['snow','rain_snow','blowing_snow','drifting_snow'].includes(S.precip))for(let i=0;i<3;i++){
   const c=document.createElement('canvas');c.width=c.height=32;const z=c.getContext('2d');
   const grad=z.createRadialGradient(16,16,0,16,16,14);grad.addColorStop(0,night?'rgba(239,246,255,.98)':'rgba(255,255,255,.98)');grad.addColorStop(i===2?.2:.42,'rgba(225,236,246,.82)');grad.addColorStop(1,'rgba(165,190,211,0)');
   z.fillStyle=grad;z.fillRect(0,0,32,32);snowSprites.push(c);
 }

 const winterResources=[];
 const icy=S.modifier==='freezing';
 const pellets=['ice_pellets','hail','rain_hail'].includes(S.precip);
 const hail=S.precip==='hail'||S.precip==='rain_hail';
 const iceSprites=[];
 if(pellets)for(let j=0;j<4;j++){
   const c=document.createElement('canvas');c.width=c.height=48;winterResources.push(c);iceSprites.push(c);
   const z=c.getContext('2d'),cx=24,cy=24,r=hail?15:12;
   z.beginPath();
   for(let k=0;k<13;k++){const a=k/13*Math.PI*2,q=r*(hail?.83+.17*rand(k+j*37):.95+.05*rand(k+j*37));const x=cx+Math.cos(a)*q,y=cy+Math.sin(a)*q;k?z.lineTo(x,y):z.moveTo(x,y);}
   z.closePath();
   const a=z.createRadialGradient(19,17,1,24,24,18);
   a.addColorStop(0,hail?'rgba(255,255,253,.98)':'rgba(237,251,255,.93)');
   a.addColorStop(.48,hail?'rgba(226,237,243,.97)':'rgba(188,222,239,.59)');
   a.addColorStop(1,hail?'rgba(113,146,166,.90)':'rgba(91,144,174,.74)');
   z.fillStyle=a;z.fill();z.strokeStyle=night?'rgba(203,229,251,.75)':'rgba(68,106,132,.66)';z.lineWidth=1.4;z.stroke();
   z.beginPath();z.ellipse(19,18,hail?4.2:3,2.2,-.6,0,Math.PI*2);z.fillStyle='rgba(255,255,255,.7)';z.fill();
 }
 let glaze=null;
 if(icy){
   glaze=document.createElement('canvas');glaze.width=112;glaze.height=640;winterResources.push(glaze);
   const z=glaze.getContext('2d'),fine=S.precip==='drizzle';
   const wash=z.createLinearGradient(0,0,112,0);wash.addColorStop(0,night?'rgba(159,206,232,.40)':'rgba(135,191,213,.30)');wash.addColorStop(.48,'rgba(195,225,234,.12)');wash.addColorStop(1,'rgba(202,227,237,0)');z.fillStyle=wash;z.fillRect(0,0,112,640);
   // Smooth transparent glaze along an imaginary peripheral edge, not snowflake frost.
   for(let j=0;j<(fine?8:12);j++){
     const x=4+rand(j+411)*42,y=rand(j+914)*590,len=18+rand(j+517)*(fine?30:70),wid=1.8+rand(j+632)*4;
     z.beginPath();z.moveTo(x,y);z.bezierCurveTo(x+wid,y+len*.3,x-wid*.25,y+len*.8,x+1,y+len);z.bezierCurveTo(x-3,y+len*.92,x-wid*.6,y+len*.35,x,y);z.closePath();
     const q=z.createLinearGradient(x-wid,y,x+wid,y);q.addColorStop(0,'rgba(76,122,150,.10)');q.addColorStop(.5,'rgba(239,253,255,.63)');q.addColorStop(1,'rgba(81,138,168,.35)');z.fillStyle=q;z.fill();z.strokeStyle='rgba(211,239,253,.36)';z.lineWidth=.65;z.stroke();
   }
   for(let j=0;j<43;j++){
     const x=3+rand(j+491)*65,y=rand(j+382)*640,rr=.8+rand(j+719)*2.1;
     z.beginPath();z.ellipse(x,y,rr,rr*1.25,0,0,Math.PI*2);z.strokeStyle=night?'rgba(223,244,255,.31)':'rgba(91,151,177,.25)';z.lineWidth=.6;z.stroke();
   }
 }
 function iceGlaze(t){
   if(!glaze)return;
   const a=.42+.23*ease(t/2.8),w=Math.min(W*.10,72),hh=H*.75;
   stamp(glaze,-w*.12,H*.12,w,hh,a);
   g.save();g.translate(W,H*.15);g.scale(-1,1);stamp(glaze,-w*.10,0,w,hh,a*.88);g.restore();
 }
 function mixedRain(t,front,density=.54){
   const n=Math.round(140*area*({light:.70,moderate:1,heavy:1.48}[S.intensity])*density);
   for(let band=0;band<3;band++){
     if(front!==(band===2))continue;
     const d=[.34,.65,1][band];g.strokeStyle=rainPaint[band];g.lineWidth=.52+band*.34;g.lineCap='round';g.beginPath();
     for(let i=0;i<n;i++){
       const p=particles[i%512],b=p.z<.48?0:p.z<.88?1:2;if(b!==band)continue;
       const speed=520*(d*.8+.3)*(1+p.a*.35),slope=.035+wind*.011;
       const x=mod(p.x*(W+220)+t*speed*slope+gustDelta*.65*(1-Math.cos(t*.85+p.a*.35)),W+220)-110;
       const y=mod(p.y*(H+200)+t*speed,H+200)-100,len=14*(d*.85+.24)*(1+p.r*.9);
       g.moveTo(x,y);g.lineTo(x+len*slope,y+len);
     }g.stroke();
   }
 }
 function mixedSnow(t,front){
   const n=Math.round(68*area*({light:.8,moderate:1,heavy:1.4}[S.intensity]));
   for(let i=0;i<n;i++){
     const p=particles[(i+211)%512],near=p.z>.77;if(front!==near)continue;
     const d=.2+p.z*.8,x=mod(p.x*(W+130)+t*(wind*1.5+7)*d+Math.sin(t*(.5+p.a)+p.r*9)*(5+14*p.z),W+130)-65;
     const y=mod(p.y*(H+100)+t*(13+42*d),H+100)-50,r=near?3.6+p.r*3.8:1+p.r*1.6;
     stamp(snowSprites[near?2:p.z>.35?1:0],x-r,y-r,2*r,2*r,.44+d*.45);
   }
 }
 function pelletField(t,front){
   const n=Math.round((hail?61:103)*area*({light:.72,moderate:1,heavy:1.35}[S.intensity]));
   for(let i=0;i<n;i++){
     const p=particles[(i+177)%512],near=p.z>.75;if(near!==front)continue;
     const depth=.45+p.z*.55,speed=(hail?480:365)*depth*(.85+p.a*.4),slope=.022+wind*.008;
     const y=mod(p.y*(H+140)+t*speed,H+140)-70;
     const x=mod(p.x*(W+170)+t*speed*slope+gustDelta*.3*Math.sin(t*.7),W+170)-85;
     const r=(hail?(near?3.4:1.8):(near?1.9:.85))*(.76+p.r*.62);
     g.strokeStyle=night?'rgba(193,220,241,.15)':'rgba(88,129,157,.15)';g.lineWidth=Math.max(.6,r*.35);g.beginPath();g.moveTo(x-speed*slope*.012,y-speed*.012);g.lineTo(x,y);g.stroke();
     g.save();g.translate(x,y);g.rotate(p.a*6+t*(hail?1.5:.45));stamp(iceSprites[i%4],-r*1.6,-r*1.6,r*3.2,r*3.2,near?.96:.78);g.restore();
   }
   if(front)for(let i=0;i<(hail?7:9);i++){
     const p=particles[420+i],phase=mod(t*(hail?1.2:1.65)+p.a,1);
     const x=(i%2?W*(.91+p.x*.08):W*(.01+p.x*.08))+phase*(8+wind*.2)*(i%2?-1:1);
     const y=H-8-Math.sin(Math.PI*phase)*(hail?13:7),r=hail?2.5+p.r:1.3+p.r*.5;
     stamp(iceSprites[i%4],x-r*1.6,y-r*1.6,r*3.2,r*3.2,.60*(1-phase));
   }
 }
 function groundSnow(t,front){
   const low=S.precip==='drifting_snow',n=Math.round((low?84:116)*area);
   for(let i=0;i<n;i++){
     const p=particles[(i+91)%512],near=p.z>.67;if(front!==near)continue;
     const d=.35+.65*p.z,advection=t*(30+wind*5)*d+gustDelta*2*(1-Math.cos(t*.65));
     const x=mod(p.x*(W+140)+advection,W+140)-70;
     const lane=low?H*(.94+p.y*.057):H*(.61+p.y*.34);
     const wave=Math.sin(x/(low?65:145)+t*(low?1.6:.7)+p.r*5)*(low?3+p.z*5:9+p.z*30);
     const y=lane+wave,r=low?(.58+p.r*.92):(near?1.5+p.r*1.5:.6+p.r*1.1);
     stamp(snowSprites[near?2:0],x-r*1.5,y-r,3*r,2*r,near?.82:.60);
   }
   if(!front){
     // Reuse the atmospheric texture for a snow veil only in these snow-specific scenes.
     const fw=Math.max(460,W*.83),fh=low?H*.08:H*.19;
     stamp(mistTex,-fw*.40+t*(11+wind*.7),low?H*.935:H*.76,fw,fh,low?.23:.34);
     stamp(mistTex,W-fw*.37+t*(7+wind*.5),low?H*.962:H*.88,fw,fh*.60,low?.20:.30);
   }
 }

 function stamp(image,x,y,w,h,a=1){g.save();g.globalAlpha*=a;g.drawImage(image,x,y,w,h);g.restore();}
 function clouds(t){
   if(!cover)return;
   const scale=W<500?1.22:1.03;
   const cw=Math.max(420,W*.63)*scale;
   const ch=cw*.418;const drift=(4+wind*.24)*t+gustDelta*.08*(1-Math.cos(t*.75));
   if(cover>=.74){
     // An overlapping stratiform ceiling. Soft edges fade to the page, not to rectangles.
     stamp(blanket,-W*.24+drift*.55,-ch*.51,W*1.50,ch*1.02,night?.81:.78);
     stamp(blanket,-W*.18+drift*.30,-ch*.36,W*1.43,ch*.98,night?.48:.39);
   }
   const op=cover>.8?.75:.91;
   stamp(bank,-cw*.48+drift,-ch*.42,cw,ch,op);
   stamp(detailBank,W-cw*.52+drift*.72,-ch*.25,cw*.99,ch*.98,op*.92);
   if(cover>=.4){
     stamp(detailBank,W*.33+drift*.54,-ch*.57,cw*.70,ch*.72,night?.58:.56);
     stamp(bank,-cw*.70+drift*.9,H*.27,cw*.85,ch*.65,op*.32);
   }
   if(cover>=.7)stamp(blanket,W-cw*.13+drift*.45,H*.29,cw*.74,ch*.57,night?.35:.25);
 }
 function stars(t){
   if(!moonVisible)return;
   const n=cover>.3?24:48;
   for(let i=0;i<n;i++){
     const p=particles[i],x=p.x*W,y=15+p.y*Math.min(160,H*.23);
     // Small, distant points. No cross-shaped icons or flashing.
     g.fillStyle='rgba(227,238,249,'+(.22+p.z*.52)+')';g.beginPath();g.arc(x,y,.4+p.r*.70,0,Math.PI*2);g.fill();
   }
   g.fillStyle=lunar;g.fillRect(0,0,W,Math.min(270,H*.4));
   stamp(spriteMoon,moonX-moonR,moonY-moonR,moonR*2,moonR*2,.91);
 }
 function atmosphericLight(t){
   g.fillStyle=sky;g.fillRect(0,0,W,H*.62);
   if(!night&&cover<.75&&!fog&&!haze){
     g.fillStyle=sunlight;g.fillRect(0,0,W,H*.64);
     // Very soft, slow-changing light at the upper edge; no giant sun icon.
     g.save();g.translate(W*.87,-70);g.rotate(.20+Math.sin(t*.26)*.018);
     g.fillStyle=beam;g.beginPath();g.moveTo(-10,0);g.lineTo(-W*.43,H*.9);g.lineTo(-W*.06,H*.9);g.lineTo(19,0);g.fill();g.restore();
   }
 }
 function fogLayer(t,front){
   if(!fog)return;
   const dense=S.mist==='fog'||S.mist==='dense_fog',veryDense=S.mist==='dense_fog';
   const fw=Math.max(480,W*.95),fh=fw*.281;
   const a=(veryDense?.91:dense?.70:.38)*(front?1:.62);
   const shallow=S.modifier==='shallow',patchy=S.modifier==='patches';
   const y=shallow?H*(front?.86:.72):front?H*.70:H*.40;
   if(patchy)g.globalAlpha*=.78;
   stamp(mistTex,-fw*.45+t*(4+S.wind*.20),y,fw,fh*.8,a);
   stamp(mistTex,W-fw*.49-t*(5+S.wind*.17),y+H*.065,fw,fh*.67,a*.87);
   if(dense)stamp(mistTex,-W*.17+t*3,H*.86,W*1.35,fh*.54,a*.58);
   if(veryDense)stamp(mistTex,-W*.04+t*2,H*.53,W*1.1,fh*.77,a*.52);
   if(patchy)g.globalAlpha/=.78;
 }
 function precipitation(t,front){
   if(S.precip==='none')return;
   if(S.precip==='rain_snow'){mixedRain(t,front);mixedSnow(t,front);return;}
   if(['ice_pellets','hail','rain_hail'].includes(S.precip)){if(S.precip==='rain_hail')mixedRain(t,front,.83);pelletField(t,front);return;}
   if(['blowing_snow','drifting_snow'].includes(S.precip)){groundSnow(t,front);return;}
   if(S.precip==='snow'){
     for(let i=0;i<count;i++){
       const p=particles[i%512],near=p.z>.77;if(front!==near)continue;
       const d=.2+p.z*.8;const sx=((t*(wind*1.5+7)+gustDelta*.4*(1-Math.cos(t*.8)))*d+Math.sin(t*(.5+p.a)+p.r*9)*(5+14*p.z));
       const x=mod(p.x*(W+130)+sx,W+130)-65;
       const y=mod(p.y*(H+100)+t*(13+42*d),H+100)-50;
       const r=near?3.6+p.r*3.8:1+p.r*1.6;
       stamp(snowSprites[near?2:p.z>.35?1:0],x-r,y-r,2*r,2*r,.44+d*.45);
     }
     return;
   }
   const fine=S.precip==='drizzle';
   // Three depth bands share direction and lighting. No rain stuck to a virtual screen.
   for(let band=0;band<3;band++){
     if(front!==(band===2))continue;
     const d=[.34,.65,1][band];
     g.strokeStyle=rainPaint[band];
     g.lineWidth=fine?.55+band*.19:.52+band*.34;g.lineCap='round';g.beginPath();
     for(let i=0;i<count;i++){
       const p=particles[i%512],b=p.z<.48?0:p.z<.88?1:2;if(b!==band)continue;
       const speed=(fine?170:520)*(d*.8+.3)*(1+p.a*.35);
       const slope=.035+wind*.011;
       const gustShift=gustDelta*.65*(1-Math.cos(t*.85+p.a*.35));
       const x=mod(p.x*(W+220)+t*speed*slope+gustShift,W+220)-110;
       const y=mod(p.y*(H+200)+t*speed,H+200)-100;
       const len=(fine?4:14)*(d*.85+.24)*(1+p.r*.9);
       g.moveTo(x,y);g.lineTo(x+len*slope,y+len);
     }g.stroke();
   }
 }
 function protectPage(){
   if(view==='sky')return;
   // Transparent central reading zone; atmospheric edges remain visible.
   g.save();g.globalCompositeOperation='destination-out';
   g.translate(W*.49,H*.49);g.scale(W*.48,H*.44);
   // Reuse the prepared reading-zone mask.
   g.fillStyle=safe;g.fillRect(-1,-1,2,2);g.restore();
 }
 function draw(t,{hold=false}={}){
   if(disposed)return;
   g.setTransform(ratio,0,0,ratio,0,0);g.globalAlpha=1;g.clearRect(0,0,W,H);
   if(!Number.isFinite(t)||t<0||t>=WEATHER_TIMING.durationSeconds)return;
   const fade=ease(t/WEATHER_TIMING.fadeInSeconds)*(1-ease((t-WEATHER_TIMING.fadeOutStartSeconds)/WEATHER_TIMING.fadeOutSeconds));
   // Build alpha once for the whole composed scene, rather than multiplying layers independently.
   atmosphericLight(t);stars(t);clouds(t);
   const pulse=glowAt(t);
   if(pulse>0){
     // Local cloud interior only. No global exposure/filter or page brightness changes.
     stamp(lightTex,glowX+t*2.5,glowY,glowWidth,glowHeight,pulse*(night?.88:.78));
     // A faint second texture at the same envelope/time is one light event, not a second pulse.
     stamp(lightTex,glowX+glowWidth*.22+t*2.5,glowY+glowHeight*.11,glowWidth*.52,glowHeight*.53,pulse*(night?.25:.21));
   }
   if(haze){g.fillStyle=hazeGradient;g.fillRect(0,0,W,H*.8);}
   fogLayer(t,false);precipitation(t,false);fogLayer(t,true);precipitation(t,true);
   iceGlaze(t);
   protectPage();
   g.save();g.globalCompositeOperation='destination-in';g.fillStyle='rgba(0,0,0,'+(fade*strength)+')';g.fillRect(0,0,W,H);g.restore();
 }
 return {draw,stats:{durationSeconds:WEATHER_TIMING.durationSeconds,canvasPixels:canvas.width*canvas.height,particleCount:count,pixelRatio:ratio,textureCount:Object.keys(textures).length,winterSpriteCount:winterResources.length,precipitationMode:S.precip,freezingEdge:icy,lightningEnabled:glowAllowed,lightningEvents:glowAllowed?1:0,lightningEnvelope:[1.55,2.70],lightningPeak:1.90,lightningBounds:[glowX,Math.max(0,glowY),glowWidth,glowHeight],renderer:'Canvas2D / procedural texture study'},glowAt,dispose(){if(disposed)return;disposed=true;g.clearRect(0,0,W,H);for(const c of [...snowSprites,...winterResources]){c.width=0;c.height=0;}}};
}

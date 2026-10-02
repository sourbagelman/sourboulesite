/**
 * The Sour Boule - Weather Update 2, visual study 01.
 * Preview candidate only. No live-weather fetching, storage, timers or DOM mounts.
 * Call draw(elapsedSeconds) from ONE shared animation loop, then dispose().
 * Rain geometry/colors/timing are copied from the approved v2 visual baseline.
 */
const random = n => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const smooth = (a, b, t) => {
  const v = Math.max(0, Math.min(1, (t - a) / (b - a)));
  return v * v * (3 - 2 * v);
};

export function createWeatherAddition({canvas, width, height, pixelRatio = 1,
  effect = 'fog', mist = false, night = false} = {}) {
  if (!canvas || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
    throw new TypeError('A canvas and positive viewport dimensions are required.');
  if (!['fog', 'drizzle', 'rain', 'storm'].includes(effect) ||
      (mist && !['rain', 'drizzle'].includes(effect)) || (night && effect !== 'fog'))
    throw new TypeError('Unsupported visual combination.');
  const dpr = Math.min(Math.max(0.25, Number(pixelRatio) || 1), 2, Math.sqrt(3000000 / (width * height)));
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable.');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const resources = [], drops = [], fog = [], clouds = [];
  const p = Array.from({length: 110}, (_, i) => ({a: random(i+1), b: random(i+401),
    r: random(i+901), s: random(i+2001), d: random(i+3001)}));
  let spritePixels = 0, disposed = false;
  const area = Math.min(width / 430, 2);

  function sprite(w, h, paint) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(w * dpr); c.height = Math.ceil(h * dpr);
    spritePixels += c.width * c.height;
    if (spritePixels > 7000000) throw new Error('Sprite pixel limit.');
    resources.push(c);
    const g = c.getContext('2d');
    if (!g) throw new Error('Sprite unavailable.');
    g.setTransform(dpr, 0, 0, dpr, 0, 0); paint(g, w, h);
    return {canvas: c, w: c.width / dpr, h: c.height / dpr};
  }
  function stamp(s, x, y, scaleX = 1, scaleY = scaleX, opacity = 1) {
    ctx.save(); ctx.globalAlpha *= opacity;
    ctx.drawImage(s.canvas, x, y, s.w * scaleX, s.h * scaleY); ctx.restore();
  }
  function createDrop(item, fine) {
    const length = fine ? 6 + item.r * 9 : 15 + item.r * 26;
    const slope = fine ? .10 : .16;
    return sprite(length * slope + 6, length + 6, g => {
      g.translate(3, 3);
      g.lineWidth = fine ? .85 + item.r * .42 : .95 + item.r * 1.15;
      const grad = g.createLinearGradient(0, 0, length * slope, length);
      grad.addColorStop(0, 'rgba(94,149,180,0)');
      grad.addColorStop(.7, `rgba(94,149,180,${fine ? .60 + item.r * .18 : .42 + item.r * .33})`);
      grad.addColorStop(1, `rgba(185,221,239,${fine ? .70 + item.r * .16 : .50 + item.r * .32})`);
      g.strokeStyle = grad; g.beginPath();g.moveTo(0,0);g.lineTo(length * slope,length);g.stroke();
    });
  }
  function createWisp(variant) {
    // Long, tapered ribbons, not cloudy circular blobs. Blur is preparation-only.
    return sprite(560, 136, (g, w, h) => {
      const y = 55 + variant * 6;
      g.save(); if ('filter' in g) g.filter = 'blur(5px)';
      const shade = g.createLinearGradient(0, y - 31, 0, y + 46);
      shade.addColorStop(0, night ? 'rgba(172,200,230,0)' : 'rgba(237,246,246,0)');
      shade.addColorStop(.30, night ? 'rgba(204,227,245,.64)' : 'rgba(222,239,241,.75)');
      shade.addColorStop(.58, night ? 'rgba(121,157,195,.62)' : 'rgba(141,176,189,.56)');
      shade.addColorStop(.84, night ? 'rgba(81,115,158,.31)' : 'rgba(111,147,165,.22)');
      shade.addColorStop(1, 'rgba(111,147,165,0)');
      g.fillStyle = shade;
      g.beginPath();g.moveTo(-15,y+7);
      g.bezierCurveTo(39,y-6,65,y-5,98,y-16);
      g.bezierCurveTo(155,y-30,192,y-11,241,y-19);
      g.bezierCurveTo(293,y-33,330,y-12,368,y-9);
      g.bezierCurveTo(422,y-6,467,y+8,574,y+10);
      g.bezierCurveTo(464,y+19,410,y+37,351,y+31);
      g.bezierCurveTo(296,y+28,279,y+42,210,y+34);
      g.bezierCurveTo(161,y+29,111,y+20,72,y+24);
      g.bezierCurveTo(27,y+26,3,y+18,-15,y+7);g.closePath();g.fill();
      const silver = g.createLinearGradient(0,y-7,0,y+8);
      silver.addColorStop(0,'rgba(239,250,255,0)');
      silver.addColorStop(.5,night?'rgba(221,242,255,.40)':'rgba(246,251,249,.48)');
      silver.addColorStop(1,'rgba(225,242,245,0)');
      g.fillStyle=silver;g.beginPath();g.moveTo(23,y+2);
      g.bezierCurveTo(126,y-18,160,y-2,244,y-6);
      g.bezierCurveTo(331,y-15,423,y+11,533,y+10);
      g.bezierCurveTo(395,y+13,321,y+2,241,y+7);
      g.bezierCurveTo(137,y+9,94,y-3,23,y+2);g.closePath();g.fill();
      g.restore();
      // Fade both lateral ends once, rather than masking the whole page per frame.
      g.globalCompositeOperation='destination-in';
      const mask=g.createLinearGradient(0,0,w,0);
      mask.addColorStop(0,'rgba(0,0,0,0)');mask.addColorStop(.16,'rgba(0,0,0,1)');
      mask.addColorStop(.72,'rgba(0,0,0,1)');mask.addColorStop(1,'rgba(0,0,0,0)');
      g.fillStyle=mask;g.fillRect(0,0,w,h);g.globalCompositeOperation='source-over';
    });
  }
  function createStormCloud(scale, alpha) {
    // Original v2 cloud outline. This new scene changes only its palette.
    return sprite(360*scale+50, 150*scale+50, g => {
      g.translate(180*scale+25,90*scale+25);g.scale(scale,scale*.82);g.globalAlpha=alpha;
      if ('filter' in g) g.filter='blur(3px)';
      const color=g.createLinearGradient(0,-64,0,40);
      color.addColorStop(0,'rgba(186,205,217,.91)');
      color.addColorStop(.46,'rgba(126,154,173,.84)');
      color.addColorStop(1,'rgba(62,92,112,.65)');
      g.fillStyle=color;g.shadowColor='rgba(43,72,92,.20)';g.shadowBlur=13;g.shadowOffsetY=5;
      g.beginPath();g.moveTo(-134,25);
      g.bezierCurveTo(-166,24,-170,-12,-143,-24);
      g.bezierCurveTo(-127,-34,-108,-31,-100,-22);
      g.bezierCurveTo(-100,-66,-54,-77,-27,-43);
      g.bezierCurveTo(-12,-67,29,-67,47,-39);
      g.bezierCurveTo(72,-51,104,-27,99,-6);
      g.bezierCurveTo(136,-22,163,2,146,25);
      g.bezierCurveTo(119,44,-99,44,-134,25);g.closePath();g.fill();
    });
  }
  try {
    if (effect !== 'fog') for (const item of p) drops.push(createDrop(item, effect === 'drizzle'));
    if (effect === 'fog' || mist) for(let i=0;i<2;i++) fog.push(createWisp(i));
    if (effect === 'storm') {
      const scale=Math.min(Math.max(width/450,.78),1.6);
      clouds.push(createStormCloud(scale*.84,.74),createStormCloud(scale*1.02,.71));
    }
  } catch (error) { for(const c of resources) {c.width=0;c.height=0;} throw error; }

  function drawFog(t, accent) {
    const scale=Math.min(width/530,1.26), w=560*scale;
    if (accent) {
      stamp(fog[0],-w*.55 + t*9,height*.55,scale,.66*scale,.65);
      stamp(fog[1],width-w*.39 - t*10,height*.78,scale,.62*scale,.66);
      return;
    }
    const points=[[-.46,.13,11,1,.84],[.72,.32,-10,.93,.86],[-.42,.57,14,1.18,.93],[.64,.80,-12,1.05,.87]];
    for (let i=0;i<points.length;i++) {
      const [x,y,speed,size,a]=points[i];
      const xx=i%2 ? width - w*(1-x) + t*speed : w*x + t*speed;
      stamp(fog[i%2],xx,height*y + Math.sin(t*.65+i)*5,scale*size,scale*.92,a);
    }
    // A low, long counter-moving ribbon gives fog a recognizable horizontal drift.
    stamp(fog[1],width*.08-t*8,height*.87,Math.min(width/440,1.55),scale*.65,.47);
  }
  function drawRain(t, fine) {
    const count=Math.round((fine?43:84)*area);
    for(let i=0;i<count;i++) {
      const item=p[i%110],speed=fine ? 155+item.s*185 : 430+item.s*460;
      const y=(item.b*(height+240)+t*speed)%(height+220)-110;
      const x=((item.a*(width+180)+t*speed*(fine?.085:.13))%(width+180))-90;
      stamp(drops[i%110],x-3,y-3);
    }
    const number=fine?3:7;
    for(let i=0;i<number;i++) {
      const u=(t*(fine?.90:1.45)+p[i].a)%1;
      ctx.strokeStyle=`rgba(105,161,188,${(fine?.32:.36)*(1-u)})`;ctx.lineWidth=fine?.85:1.1;
      ctx.beginPath();ctx.ellipse(p[i].a*width,height*(.30+p[i].b*.48),
        (fine?1.5:2)+u*(fine?8:14),1+u*(fine?2:3.5),0,0,Math.PI);ctx.stroke();
    }
  }
  function draw(t) {
    if(disposed)return;
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.globalAlpha=1;ctx.clearRect(0,0,width,height);
    if(!Number.isFinite(t)||t<0||t>=4)return;
    ctx.globalAlpha=smooth(0,.6,t)*(1-smooth(3.15,4,t));
    if(effect==='fog')drawFog(t,false);
    else {
      if(effect==='storm') {
        const scale=Math.min(Math.max(width/450,.78),1.6);
        stamp(clouds[0],width*.01+t*24-(180*scale*.84+25),height*.10-(90*scale*.84+25));
        stamp(clouds[1],width*1.04-t*27-(180*scale*1.02+25),height*.24-(90*scale*1.02+25));
      }
      if(mist)drawFog(t,true);
      drawRain(t,effect==='drizzle');
    }
    ctx.globalAlpha=1;
  }
  return {
    draw,
    stats: Object.freeze({spriteCount:resources.length,spritePixels,canvasPixels:canvas.width*canvas.height,pixelRatio:dpr}),
    dispose(){if(disposed)return;disposed=true;ctx.clearRect(0,0,width,height);
      for(const c of resources){c.width=0;c.height=0;}resources.length=0;}
  };
}

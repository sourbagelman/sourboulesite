const OFFER = 'Ring in the New Year with us! Enter your name and stay until midnight to unlock one free cookie. No purchase required. Redeem at either Sour Boule location through January 3, 2027.';
const ESC = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cookieIcon = `<svg class="sb-cookie" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M12 13l3-1 2 3-3 2zM25 11l3 3-2 3-3-2zM10 24l4-2 3 3-2 3zM24 24l3-2 3 3-2 3z" fill="currentColor" opacity=".8"/><circle cx="21" cy="20" r="1.5" fill="currentColor"/></svg>`;
function ballSvg() {
  // A projected, subdivided icosahedron: real curved facets, not a flat tile texture.
  const phi=(1+Math.sqrt(5))/2;
  const unit=v=>{const n=Math.hypot(...v);return v.map(x=>x/n);};
  const raw=[[-1,phi,0],[1,phi,0],[-1,-phi,0],[1,-phi,0],[0,-1,phi],[0,1,phi],[0,-1,-phi],[0,1,-phi],[phi,0,-1],[phi,0,1],[-phi,0,-1],[-phi,0,1]].map(unit);
  let faces=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]].map(f=>f.map(i=>raw[i]));
  const mid=(a,b)=>unit(a.map((v,i)=>(v+b[i])/2));
  for(let k=0;k<2;k++)faces=faces.flatMap(([a,b,c])=>{const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);return [[a,ab,ca],[b,bc,ab],[c,ca,bc],[ab,bc,ca]];});
  const rotate=([x,y,z])=>{const xx=x*Math.cos(.31)+z*Math.sin(.31),zz=-x*Math.sin(.31)+z*Math.cos(.31);return [xx,y*Math.cos(.21)-zz*Math.sin(.21),y*Math.sin(.21)+zz*Math.cos(.21)];};
  const project=v=>[120+v[0]*100,120+v[1]*100];
  const path=points=>'M'+points.map(v=>v.map(x=>x.toFixed(2)).join(' ')).join('L')+'Z';
  let mesh='',lights='',seen=new Set();
  faces.map(f=>f.map(rotate)).filter(f=>f.reduce((t,v)=>t+v[2],0)>0).sort((a,b)=>a[0][2]-b[0][2]).forEach((f,i)=>{
    const n=unit(f[0].map((v,k)=>v+f[1][k]+f[2][k])),L=Math.max(0,n[0]*-.38+n[1]*-.45+n[2]*.81),shine=Math.pow(L,22),jitter=((i*37)%19)/19;
    const rgb=[25+L*133+jitter*53+shine*65,55+L*133+jitter*44+shine*50,85+L*119+jitter*35+shine*36].map(v=>Math.min(250,Math.round(v)));
    const pts=f.map(project),center=pts[0].map((v,k)=>(v+pts[1][k]+pts[2][k])/3);
    mesh+=`<path d="${path(pts)}" fill="rgb(${rgb})" stroke="#d2e8f2" stroke-opacity=".75" stroke-width=".48"/>`;
    mesh+=`<path d="${path([pts[0],pts[1],center])}" fill="#f5fbff" opacity="${(.09+jitter*.27).toFixed(2)}"/><path d="${path([pts[1],pts[2],center])}" fill="#061b36" opacity=".23"/><path d="${path(pts.map(v=>v.map((x,k)=>center[k]+(x-center[k])*.58)))}" fill="none" stroke="#f1faff" stroke-width=".35" opacity=".55"/>`;
    for(const v of f){const key=v.map(x=>x.toFixed(3)).join(',');if(v[2]<.08||seen.has(key))continue;seen.add(key);const [x,y]=project(v);lights+=`<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${v[2]>.6?'.95':'.65'}" fill="#eefbff"/>`;}
  });
  const stars=[[79,50,7],[52,105,4],[109,83,5],[161,63,5],[181,113,6],[123,162,5],[65,159,3],[159,182,4]];
  const glints=stars.map(([x,y,q])=>`<g class="sb-crystal-twinkle"><circle cx="${x}" cy="${y}" r="${q*1.6}" fill="url(#sb-star-glow)"/><path d="M${x-q} ${y}Q${x} ${y-1} ${x} ${y-q*1.8}Q${x+1} ${y} ${x+q} ${y}Q${x} ${y+1} ${x} ${y+q*1.8}Q${x-1} ${y} ${x-q} ${y}" fill="#fffdf3"/></g>`).join('');
  return `<svg viewBox="0 0 240 240" aria-hidden="true"><defs><clipPath id="sb-sphere-clip"><circle cx="120" cy="120" r="100"/></clipPath><radialGradient id="sb-halo"><stop stop-color="#a8d7ff" stop-opacity=".65"/><stop offset=".72" stop-color="#78b9ec" stop-opacity=".18"/><stop offset="1" stop-color="#65a8ec" stop-opacity="0"/></radialGradient><radialGradient id="sb-star-glow"><stop stop-color="#fff" stop-opacity=".85"/><stop offset=".24" stop-color="#c5eaff" stop-opacity=".36"/><stop offset="1" stop-color="#c5eaff" stop-opacity="0"/></radialGradient><radialGradient id="sb-sphere-core" cx=".28" cy=".25" r=".86"><stop stop-color="#c1e5fb"/><stop offset=".48" stop-color="#527e9a"/><stop offset="1" stop-color="#0a2038"/></radialGradient><radialGradient id="sb-edge-shade" cx=".38" cy=".3" r=".72"><stop offset=".48" stop-color="#001733" stop-opacity="0"/><stop offset="1" stop-color="#02152f" stop-opacity=".6"/></radialGradient><linearGradient id="sb-glass-sweep" x1="0" x2="1"><stop stop-color="#fff" stop-opacity="0"/><stop offset=".48" stop-color="#ddf3ff" stop-opacity=".23"/><stop offset=".52" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><filter id="sb-led-bloom" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.8"/></filter></defs><circle cx="120" cy="120" r="120" fill="url(#sb-halo)"/><circle cx="120" cy="120" r="100" fill="url(#sb-sphere-core)"/><g clip-path="url(#sb-sphere-clip)">${mesh}<circle cx="120" cy="120" r="100" fill="url(#sb-edge-shade)"/><g filter="url(#sb-led-bloom)" opacity=".85">${lights}</g><g>${lights}</g><ellipse class="sb-glass-sweep" cx="81" cy="105" rx="23" ry="116" fill="url(#sb-glass-sweep)" transform="rotate(27 120 120)"/></g><circle cx="120" cy="120" r="100" fill="none" stroke="#cde8fa" stroke-width="1.2"/><path d="M28 83A100 100 0 0 1 160 28" fill="none" stroke="#f0fbff" stroke-width="1.7" opacity=".8"/><rect x="116" y="15" width="8" height="6" rx="2" fill="#c9deed"/>${glints}</svg>`;
}
function phase(now,e) {return now<e.start?'before':now<e.midnight-60000?'opening':now<e.midnight?'final':now<e.end?'midnight':'ended';}
export function mountExperience(root, adapter, options={}) {
  let data = null, anchor=0, perfAnchor=performance.now(), view=options.passPage?'pass':'celebration', dismissed=false;
  let lastCard='', lastPass='', lastPhase='', busy=false, online=true, forceReduce=false, destroyed=false, syncVersion=0;
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  let reduce = media.matches, wakeLock=null, raf=0, fireworksUntil=0, particles=[], rockets=[], particleTime=0, lastBurst=0, fireworkStart=0, launchIndex=0;
  const demo=!!options.demo;
  const eventAbort=new AbortController();
  root.innerHTML = `<div class="sb-app" id="sb-experience" data-motion="${reduce?'off':'on'}"><canvas class="sb-fireworks" aria-hidden="true"></canvas><header class="sb-header"><div class="sb-brand"><span class="sb-brandmark" aria-hidden="true">b</span><span>The Sour Boule</span></div><div class="sb-header-actions"><button class="sb-motion" data-action="motion" aria-pressed="${!reduce}">${reduce?'Motion off':'Motion on'}</button><button class="sb-linkbtn" data-action="exit">Continue to the website <span aria-hidden="true">&rarr;</span></button></div></header><div id="sb-content"></div><footer class="sb-footer"><span>Two locations. One community.<br>Fort Worth &amp; Willow Bend</span><span id="sb-network" class="sb-connected" data-online="true">${demo?'Preview only':'Connecting to server'}</span><button class="sb-linkbtn" data-action="pass">My cookie pass</button></footer><div class="sb-sr" id="sb-announcer" role="status" aria-live="polite" aria-atomic="true"></div></div>`;
  const app=root.querySelector('.sb-app'),content=root.querySelector('#sb-content'),announcer=root.querySelector('#sb-announcer');
  function announce(text){announcer.textContent=text;}
  function now(){return anchor+(performance.now()-perfAnchor);}
  function stamp(){return demo||data?.mode==='local-lab';}
  // The hero year follows the same server-anchored event clock as the ball drop.
  // Never use the phone's calendar or alter reward dates to choose this label.
  function displayYear(){return now()<data.event.midnight?'2026':'2027';}
  function updateYear(){
    const el=root.querySelector('.sb-year');if(!el||!data)return;
    const year=displayYear();
    if(el.textContent!==year)el.textContent=year;
    if(el.getAttribute('aria-label')!==year)el.setAttribute('aria-label',year);
  }
  function showError(text){const el=root.querySelector('#sb-error');if(el)el.textContent=text;announce(text);}
  const connectionError='Connection interrupted. Keep this page open while we reconnect. No reward is confirmed yet.';
  function network(value){online=value;const el=root.querySelector('#sb-network');el.dataset.online=String(value);el.textContent=value?(demo?'Preview only':data?.mode==='local-lab'?'Local test server':'Server connected'):'Reconnecting'; if(!value)showError(connectionError);else{const error=root.querySelector('#sb-error');if(error?.textContent===connectionError)error.textContent='';}}
  function layout() {
    content.innerHTML=`<main class="sb-layout"><section class="sb-scene" aria-labelledby="sb-title"><p class="sb-eyebrow">December 31 &middot; A midnight moment, together</p><div class="sb-year" aria-label="${displayYear()}">${displayYear()}</div><div class="sb-story"><h1 id="sb-title">Here&rsquo;s to a<br>sweeter year.</h1><p id="sb-subtitle">A little sparkle. A fresh beginning.<br>Ring in the New Year with us.</p></div><div class="sb-stage-art" aria-hidden="true"><div class="sb-orbit"></div><div class="sb-pole"></div><div class="sb-ball">${ballSvg()}</div><div class="sb-base"></div><div class="sb-art-label">The Sour Boule &middot; Midnight Central</div></div><div class="sb-clockblock"><div class="sb-clocklabel"><span class="sb-dot"></span><span id="sb-clocklabel">${demo?'Simulated countdown':'Countdown to midnight'}</span></div><div class="sb-clock" role="timer" aria-label="Countdown to midnight" aria-live="off"><div><span class="sb-clocknumber" id="sb-minutes">10</span><span class="sb-clockunit">Minutes</span></div><span class="sb-colon" aria-hidden="true">:</span><div><span class="sb-clocknumber" id="sb-seconds">00</span><span class="sb-clockunit">Seconds</span></div></div><p class="sb-clockmeta" id="sb-clockmeta">December 31, 2026 &middot; America/Chicago</p></div></section><aside class="sb-side" id="sb-card-holder" aria-label="Cookie promotion"></aside></main>`;
    lastCard='';lastPhase='';
  }
  function ticket(p) {
    return `<article class="sb-ticket" aria-label="Cookie pass"><div class="sb-card-kicker">${cookieIcon}Your midnight reward</div><span class="sb-ticket-badge">${stamp()?'SIMULATED PASS':p.status==='issued'?'Cookie unlocked':ESC(p.status)}</span><h2>One sweet<br>start to 2027.</h2><p class="sb-ticket-name">For ${ESC(p.firstName)}</p><p><strong>One free cookie</strong><br>No purchase required.</p><p>Either Sour Boule location.<br>Through <strong>January 3, 2027</strong>, during that location&rsquo;s operating hours.</p><div class="sb-ticket-code"><p class="sb-eyebrow sb-ticket-code-label">Your five-digit code</p><code>${ESC(p.code)}</code><p class="sb-ticket-status">${p.status==='redeemed'?'Already redeemed. Not valid for another cookie.':p.status==='expired'?'Expired. Redemption has ended.':'Staff must verify this code before redemption.'}</p></div>${stamp()?'<div class="sb-demo-stamp">TEST ONLY &middot; NOT VALID FOR REDEMPTION</div>':''}</article><button class="sb-primary" data-action="save">Save ${stamp()?'sample ':''}pass as an image <span aria-hidden="true">&darr;</span></button><button class="sb-secondary" data-action="copy">Copy pass code</button><p class="sb-side-note">A screenshot works, too. Keep your code private.<br>A copied pass can still be redeemed only once.</p><p id="sb-error" class="sb-error" role="status"></p>`;
  }
  function card(p) {
    const holder=root.querySelector('#sb-card-holder');if(!holder)return;
    const cardPhase=p==='before'?'before':(p==='midnight'||p==='ended')?'after':'before-midnight';
    const signature=JSON.stringify([data?.entry,data?.pass,cardPhase,data?.entry?online:null,!!data?.entry&&now()>data.event.midnight+data.event.postWindow]);if(signature===lastCard)return;lastCard=signature;
    if(data?.pass){holder.innerHTML=ticket(data.pass);return;}
    if(data?.entry) {
      const waiting=p==='midnight'||p==='ended';
      const missed=now()>data.event.midnight+data.event.postWindow&&!data.entry.eligible;
      holder.innerHTML=`<div class="sb-card"><p class="sb-card-kicker">${cookieIcon}${waiting?'Your midnight moment':'Your spot is saved'}</p><h2>${missed?'Thanks for joining us.':waiting?'Happy New Year,<br>'+ESC(data.entry.firstName)+'!':'You&rsquo;re in,<br>'+ESC(data.entry.firstName)+'.'}</h2><div class="sb-status ${missed||!online?'warn':''}">${missed?'We could not verify your presence around midnight. No cookie pass was issued.':waiting?'Checking your midnight presence. Your pass appears here only after verification.':online?'Stay on this countdown page until midnight. Your cookie pass will unlock here once your presence is verified.':'Connection interrupted. We will try to reconnect automatically.'}</div><p class="sb-small">Keep this tab visible and your phone unlocked. Switching apps or locking your phone can prevent qualification.</p>${!waiting?'<button class="sb-secondary" data-action="wake">Keep my screen awake</button>':''}<div class="sb-rules"><span aria-hidden="true">01</span><div>One free cookie. No purchase required.<br>Either location, through January 3, 2027.</div></div><p id="sb-error" class="sb-error" role="status"></p></div><p class="sb-side-note">${demo?'Simulation only. No real entry has been stored.':'No email. No guest account. Just a first name.'}</p>`;
      return;
    }
    if(p==='midnight'||p==='ended') {
      holder.innerHTML=`<div class="sb-card"><p class="sb-card-kicker">${cookieIcon}Hello, 2027</p><h2>Thanks for celebrating with us.</h2><p class="sb-offer">Cookie entry closed at midnight. Enjoy the fireworks and a fresh start to the year.</p><button class="sb-primary" data-action="pass">Check for an earned pass</button><p class="sb-small">Already joined on another device? Open your saved pass there. A name alone cannot recover a pass.</p><p id="sb-error" class="sb-error" role="status"></p></div>`;return;
    }
    holder.innerHTML=`<div class="sb-card"><p class="sb-card-kicker">${cookieIcon}A little midnight treat</p><h2>Make midnight<br>a little sweeter.</h2><p class="sb-offer">${OFFER}</p><form id="sb-register"><label class="sb-label" for="sb-first-name">Your first name</label><input class="sb-input" id="sb-first-name" name="firstName" autocomplete="given-name" maxlength="40" required placeholder="First name" ${p==='before'?'disabled':''}><button class="sb-primary" type="submit" ${p==='before'?'disabled':''}>${p==='before'?'Entry opens at 11:50 PM':'Count me in'} <span aria-hidden="true">&rarr;</span></button></form><p class="sb-small">No email. No account. Keep this page visible until midnight.</p><div class="sb-rules"><span aria-hidden="true">01</span><div>One free cookie. No purchase required.<br>A sweet start at either location.</div></div><p id="sb-error" class="sb-error" role="status"></p></div><p class="sb-side-note">${demo?'PREVIEW ONLY &middot; No real rewards are issued.':'Secure anonymous browser session. Save your pass.'}</p>`;
  }
  function returned() {
    view='website';
    content.innerHTML=`<main class="sb-return"><p class="sb-eyebrow">${dismissed?'Celebration minimized':'12:05 AM &middot; The takeover has ended'}</p><div class="sb-year" aria-label="${displayYear()}">${displayYear()}</div><h1>Back to The Sour Boule.</h1><p>The celebration steps away. Your earned cookie pass stays available.</p><div class="sb-placeholder"><p class="sb-eyebrow">Website integration placeholder</p><p>Your current website and its <strong>already-approved New Year&rsquo;s theme</strong> remain underneath. They are intentionally not reproduced or redesigned in this preview.</p><p>No menu, hours, prices, or ordering links are replaced.</p></div><div class="sb-inline-actions"><button class="sb-primary" data-action="pass">My cookie pass</button><a class="sb-secondary" href="https://thesourboule.com" target="_blank" rel="noopener noreferrer">Open existing website &rarr;</a></div>${now()<data.event.end?'<button class="sb-linkbtn" data-action="resume">Return to countdown</button>':''}</main>`;
  }
  function showPass() {
    const beforeEnd=now()<data.event.end,signature=JSON.stringify([data?.pass,beforeEnd]);
    if(view==='pass'&&root.querySelector('.sb-pass-page')&&signature===lastPass)return;
    view='pass';lastPass=signature;
    content.innerHTML=`<main class="sb-return"><p class="sb-eyebrow">The Sour Boule &middot; New Year 2027</p><h1>Your cookie pass.</h1><div class="sb-pass-page">${data?.pass?ticket(data.pass):'<div class="sb-card"><h2>No pass in this browser.</h2><p class="sb-offer">An earned pass appears here after midnight presence is verified. Open a saved pass or use the browser where you joined.</p><p class="sb-small">Without an account or email, a lost session cannot be recovered by name alone.</p></div>'}</div><button class="sb-linkbtn" data-action="${beforeEnd?'resume':'exit'}">${beforeEnd?'Back to countdown':stamp()?'Back to website preview':'Continue to the website'}</button></main>`;
  }
  function fireworks() {
    if(reduce)return;
    fireworkStart=performance.now();fireworksUntil=fireworkStart+32000;lastBurst=0;launchIndex=0;particles=[];rockets=[];particleTime=fireworkStart;
  }
  function drawFireworks(t) {
    const canvas=root.querySelector('.sb-fireworks');if(!canvas)return;
    const ctx=canvas.getContext('2d');
    if(reduce||t>fireworksUntil||view!=='celebration'||document.visibilityState==='hidden'){
      if(particles.length||rockets.length){ctx.clearRect(0,0,canvas.width,canvas.height);particles=[];rockets=[];}return;
    }
    const w=app.clientWidth,h=Math.min(app.clientHeight,w<600?720:1000),dpr=Math.min(window.devicePixelRatio||1,1.5),mobile=w<600;
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.height=h+'px';}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    const dt=Math.min((t-particleTime)/1000,.04)||.016;particleTime=t;
    const elapsed=t-fireworkStart,finale=elapsed>22500&&elapsed<27800;
    // A staggered opening, mixed shells, and a denser finale. No full-screen flashes.
    if(elapsed<27500 && (lastBurst===0||t-lastBurst>(finale?420:850))){
      lastBurst=t;
      const positions=[.21,.57,.83,.34,.72,.11,.47,.88];
      const x=w*positions[launchIndex%positions.length],y=h*(.26+(launchIndex%3)*.09);
      rockets.push({x0:w*(.1+Math.random()*.8),y0:h*.86,x,y,start:t,duration:800+Math.random()*400,type:launchIndex%3,tail:[]});launchIndex++;
      if(launchIndex===1)rockets.push({x0:w*.9,y0:h*.85,x:w*.78,y:h*.3,start:t+180,duration:930,type:1,tail:[]});
    }
    function burst(x,y,type){
      const count=mobile?(type===1?95:115):(type===1?185:235),max=mobile?800:2000;
      const colors=type===0?['#f4dfa7','#d6ac60','#fff3cf']:type===1?['#d3a15c','#ebc880','#fff0b3']:['#badff6','#ecf8ff','#a9c6de'];
      for(let i=0;i<count&&particles.length<max;i++){
        const a=(i/count)*Math.PI*2+Math.random()*.028,outer=i%3!==0,speed=(mobile?152:220)*(outer?.6+Math.random()*.4:.12+Math.random()*.59),life=type===1?4.5+Math.random()*1.2:2.5+Math.random()*1.1;
        particles.push({x,y,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,life,total:life,type,color:colors[i%3],size:i%7===0?1.55:1.05,tail:[]});
      }
    }
    ctx.lineCap='round';
    rockets=rockets.filter(r=>{
      const progress=(t-r.start)/r.duration;if(progress<0)return true;
      if(progress>=1){burst(r.x,r.y,r.type);return false;}
      const eased=1-Math.pow(1-progress,1.65),x=r.x0+(r.x-r.x0)*progress,y=r.y0+(r.y-r.y0)*eased;
      r.tail.push([x,y]);if(r.tail.length>12)r.tail.shift();
      ctx.strokeStyle='#e6c689';ctx.globalAlpha=.55;ctx.lineWidth=1.3;ctx.beginPath();r.tail.forEach(([a,b],i)=>i?ctx.lineTo(a,b):ctx.moveTo(a,b));ctx.stroke();
      ctx.globalAlpha=.95;ctx.fillStyle='#fff4d1';ctx.beginPath();ctx.arc(x,y,1.6,0,Math.PI*2);ctx.fill();return true;
    });
    particles=particles.filter(p=>p.life>0);
    for(const p of particles){
      p.life-=dt;const age=p.total-p.life,drag=Math.exp(-(p.type===1?.42:.62)*dt);
      p.vx*=drag;p.vy=p.vy*drag+(p.type===1?29:20)*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;
      p.tail.push([p.x,p.y]);if(p.tail.length>(p.type===1?36:25))p.tail.shift();
      const alpha=Math.pow(Math.max(0,p.life/p.total),.65)*Math.min(1,age*7);
      ctx.strokeStyle=p.color;ctx.lineWidth=p.type===1?1.15:.95;ctx.globalAlpha=alpha*.82;ctx.beginPath();p.tail.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.stroke();
      ctx.globalAlpha=alpha;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();
      if(p.size>1.4&&alpha>.6){ctx.globalAlpha=alpha*.12;ctx.beginPath();ctx.arc(p.x,p.y,4,0,Math.PI*2);ctx.fill();}
    }
    ctx.globalAlpha=1;
  }
  function tick(t) {
    if(data&&view==='celebration') {
      const n=now(),p=phase(n,data.event),seconds=p==='before'?600:Math.max(0,Math.ceil((data.event.midnight-n)/1000));
      if(p==='ended'){returned();adapter.exit?.(true);}
      else {
        if(!root.querySelector('#sb-title'))layout();
        const mins=root.querySelector('#sb-minutes'),secs=root.querySelector('#sb-seconds');
        if(mins)mins.textContent=String(Math.floor(seconds/60)).padStart(2,'0');if(secs)secs.textContent=String(seconds%60).padStart(2,'0');
        const ball=root.querySelector('.sb-ball');if(ball)ball.style.transform=`translateY(${Math.max(0,Math.min(1,1-(data.event.midnight-n)/60000))*126}px)`;
        if(p!==lastPhase){
          app.dataset.phase=p;
          const title=root.querySelector('#sb-title'),sub=root.querySelector('#sb-subtitle'),label=root.querySelector('#sb-clocklabel');
          title.innerHTML=p==='midnight'?'Happy<br>New Year!':p==='final'?'One minute.<br>A fresh start.':'Here&rsquo;s to a<br>sweeter year.';
          sub.innerHTML=p==='midnight'?'Here&rsquo;s to good bread, good company,<br>and a sweeter year together.':p==='final'?'The ball is on its way down.<br>Keep this page open. We&rsquo;re almost there.':'A little sparkle. A fresh beginning.<br>Ring in the New Year with us.';
          label.textContent=p==='midnight'?'Welcome to 2027':p==='final'?'The final minute':p==='before'?'Countdown opens at 11:50 PM':demo?'Simulated countdown':'Countdown to midnight';
          root.querySelector('#sb-clockmeta').textContent=p==='midnight'?'January 1, 2027 / America/Chicago':'December 31, 2026 / America/Chicago';
          if(p==='midnight'){fireworks();void heartbeat();announce('Happy New Year! Checking eligible cookie passes.');}
          if(p==='final')announce('One minute until midnight. The ball is descending.');
          lastPhase=p;
        }
        card(p);
      }
    }
    updateYear();drawFireworks(t);raf=requestAnimationFrame(tick);
  }
  async function sync(){const version=++syncVersion;try{const d=await adapter.state();if(destroyed||version!==syncVersion)return false;setState(d);network(true);return true;}catch{if(!destroyed&&version===syncVersion)network(false);return false;}}
  function setState(d){if(destroyed)return;data=d;anchor=d.serverNow;perfAnchor=performance.now();if(!content.children.length)layout();if(view==='pass')showPass();}
  async function heartbeat(visible=document.visibilityState==='visible') {
    if(!data?.entry || view!=='celebration' || dismissed)return;
    try{const result=await adapter.presence(visible);if(destroyed)return;if(result?.pass){data.pass=result.pass;data.entry.eligible=true;lastCard='';announce(stamp()?'Simulated cookie pass unlocked. Not valid for redemption.':'Your cookie pass is unlocked. Save it now.');}network(true);}catch{if(!destroyed)network(false);}
  }
  function setMotion(){reduce=media.matches||forceReduce;app.dataset.motion=reduce?'off':'on';const b=root.querySelector('[data-action="motion"]');b.textContent=reduce?'Motion off':'Motion on';b.setAttribute('aria-pressed',String(!reduce));}
  media.addEventListener('change',setMotion);
  root.addEventListener('submit',async event=>{
    if(event.target.id!=='sb-register')return;event.preventDefault();if(busy)return;busy=true;
    const button=event.target.querySelector('button');button.disabled=true;button.textContent='Joining...';
    try{await adapter.register(new FormData(event.target).get('firstName'));if(destroyed)return;if(!await sync())throw new Error('Your entry may have been saved. Reconnect and try again to recover it.');lastCard='';await heartbeat();announce('You are registered. Stay on this page until midnight.');}
    catch(err){if(destroyed)return;showError(err.message||'Unable to register. Please try again.');button.disabled=false;button.textContent='Count me in';}finally{busy=false;}
  },{signal:eventAbort.signal});
  root.addEventListener('click',async event=>{
    const button=event.target.closest('[data-action]');if(!button)return;
    const action=button.dataset.action;
    if(action==='motion'){forceReduce=!reduce;setMotion();if(media.matches)announce('Reduced motion follows your device setting.');}
    if(action==='wake'){
      try{if(!navigator.wakeLock)throw new Error('Not supported');wakeLock=await navigator.wakeLock.request('screen');button.textContent='Screen will stay awake';announce('Keep this page visible. Screen wake lock is active.');wakeLock.addEventListener('release',()=>{if(button.isConnected)button.textContent='Keep my screen awake';});}
      catch{showError('Automatic screen wake is unavailable. Keep your phone unlocked and this page visible.');}
    }
    if(action==='exit'){if(!data){adapter.exit?.(false);return;}void heartbeat(false);dismissed=true;returned();adapter.exit?.(false);wakeLock?.release();}
    if(action==='resume'){dismissed=false;if(now()>=data.event.end)returned();else{view='celebration';layout();void heartbeat();}}
    if(action==='pass'){void heartbeat(false);if(data)showPass();await sync();}
    if(action==='retry')void sync();
    if(action==='save'&&data?.pass)savePassImage(data.pass,stamp());
    if(action==='copy'&&data?.pass){try{await navigator.clipboard.writeText(data.pass.code);announce('Pass code copied.');button.textContent='Code copied';}catch{showError('Copy is unavailable here. Save or screenshot the pass instead.');}}
  },{signal:eventAbort.signal});
  // Escape pressed inside an iframe never reaches the parent dialog's cancel
  // event. Use the same dismissal/leave path as the visible Continue control.
  document.addEventListener('keydown',event=>{if(options.embedded&&event.key==='Escape'&&!event.isComposing){event.preventDefault();root.querySelector('[data-action="exit"]')?.click();}},{signal:eventAbort.signal});
  function visibility(){if(document.visibilityState==='hidden'){void heartbeat(false);}else{void sync().then(()=>heartbeat(true));}}
  document.addEventListener('visibilitychange',visibility);
  const onOnline=()=>void sync().then(()=>heartbeat());window.addEventListener('online',onOnline);
  const onOffline=()=>network(false);window.addEventListener('offline',onOffline);
  const onPageShow=()=>void sync().then(()=>heartbeat());window.addEventListener('pageshow',onPageShow);
  const onPageHide=()=>{void heartbeat(false);wakeLock?.release();};window.addEventListener('pagehide',onPageHide);
  const beat=setInterval(()=>{if(document.visibilityState==='visible')void heartbeat();},5000);
  const syncer=setInterval(()=>{if(document.visibilityState==='visible')void sync();},15000);
  content.innerHTML='<main class="sb-return"><h1>Connecting to the celebration.</h1><p>The regular website is always available.</p><p id="sb-error" class="sb-error" role="status"></p><button class="sb-secondary" data-action="retry">Try again</button></main>';
  // The requested initial view belongs to the controller, not to one request:
  // pageshow/reconnect may supersede the bootstrap state request.
  void sync();raf=requestAnimationFrame(tick);
  return {sync,setState,showPass,showWebsite:()=>{dismissed=true;returned();},resetView:()=>{dismissed=false;view='celebration';layout();},fireworks,
    destroy(){destroyed=true;syncVersion++;eventAbort.abort();cancelAnimationFrame(raf);clearInterval(beat);clearInterval(syncer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);window.removeEventListener('pageshow',onPageShow);window.removeEventListener('pagehide',onPageHide);media.removeEventListener('change',setMotion);wakeLock?.release();}}
}
function savePassImage(pass,demo){
  const c=document.createElement('canvas');c.width=1000;c.height=1300;const x=c.getContext('2d');
  x.fillStyle='#f5f0e6';x.fillRect(0,0,1000,1300);x.strokeStyle='#a4b1b7';x.lineWidth=2;x.strokeRect(45,45,910,1210);x.fillStyle='#243742';x.textAlign='center';
  x.font='22px Arial';x.fillText('THE SOUR BOULE / NEW YEAR',500,130);x.font='130px Georgia';x.fillText('2027',500,285);
  x.font='64px Georgia';x.fillText('One free cookie.',500,405);x.font='30px Arial';x.fillText('No purchase required.',500,480);
  x.font='26px Arial';const name=[...pass.firstName].slice(0,40).join('');x.fillText('For '+name,500,565,850);
  x.font='25px Arial';x.fillText('Either Sour Boule location.',500,650);x.fillText('Through January 3, 2027,',500,695);x.fillText('during that location\'s operating hours.',500,737);
  x.setLineDash([6,8]);x.beginPath();x.moveTo(100,820);x.lineTo(900,820);x.stroke();x.setLineDash([]);
  x.font='22px Arial';x.fillText('SINGLE-USE PASS / STAFF MUST VERIFY',500,885);
  x.font='bold 115px monospace';x.fillText(pass.code,500,1010,810);
  x.font='20px Arial';x.fillText('Keep your code private. A screenshot cannot be used twice.',500,1095,850);
  x.fillStyle=demo?'#8f4b29':'#385e4d';x.font='bold 26px Arial';x.fillText(demo?'TEST ONLY - NOT VALID FOR REDEMPTION':pass.status==='issued'?'ONE COOKIE. ONE REDEMPTION.':pass.status.toUpperCase(),500,1190,860);
  c.toBlob(blob=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=demo?'Sour-Boule-SAMPLE-pass.png':'Sour-Boule-cookie-pass.png';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);},'image/png');
}

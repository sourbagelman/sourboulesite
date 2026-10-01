// Shared station UI. Production uses the protected API; preview uses a marked fake adapter.
export function mountStaff(root, adapter, {demo=false}={}) {
  let station=null, busy=false, ready=false, checked=null, requestId=null, destroyed=false;
  const abort=new AbortController();
  const label=loc=>loc==='fort-worth'?'Fort Worth':loc==='willow-bend'?'Willow Bend':'Checking station';
  root.innerHTML=`<div class="sb-app sb-staff-app"><header class="sb-header"><div class="sb-brand"><span class="sb-brandmark" aria-hidden="true">b</span>The Sour Boule</div><span class="sb-station-lock">Staff only</span></header><main class="sb-staff sb-station"><div class="sb-station-heading"><p class="sb-eyebrow">Cookie pass redemption</p><p class="sb-station-location" id="station-location">Checking station</p></div><h1>Cookie passes.</h1><p id="staff-identity" class="sb-small">Checking protected session</p><div class="sb-card"><form id="verify"><label class="sb-label" for="code">Guest's five-digit code</label><input class="sb-input sb-numeric-code" id="code" name="code" type="text" inputmode="numeric" pattern="[0-9]{5}" maxlength="5" placeholder="12345" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go" aria-describedby="code-help" required><p class="sb-small" id="code-help">Enter the five numbers on their cookie pass.</p><button class="sb-primary" type="submit" disabled>Check code</button></form><div class="sb-staff-result" id="result" role="status" aria-live="polite" aria-atomic="true"></div></div><p class="sb-station-note">One free cookie. No purchase required.<br>Only give a cookie after redemption is confirmed.</p>${demo?'<p class="sb-demo-notice">SIMULATION ONLY. No real pass is verified or redeemed.</p>':''}</main></div>`;
  const form=root.querySelector('#verify'),input=root.querySelector('#code'),checkButton=form.querySelector('button'),result=root.querySelector('#result');
  function controls() {checkButton.hidden=!!checked;input.disabled=busy||!ready;checkButton.disabled=busy||!ready||!/^\d{5}$/.test(input.value);checkButton.textContent=busy?'Checking...':'Check code';}
  function panel(title,description,tone='warn') {
    result.replaceChildren();const box=document.createElement('div');box.className='sb-station-result '+tone;
    const symbol=document.createElement('span');symbol.className='sb-result-mark';symbol.setAttribute('aria-hidden','true');symbol.textContent=tone==='good'?'\u2713':'!';
    const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=description;box.append(symbol,h,p);result.append(box);return box;
  }
  function next() {form.hidden=false;checked=null;requestId=null;result.replaceChildren();input.value='';controls();input.focus();}
  function nextButton() {const b=document.createElement('button');b.className='sb-secondary';b.type='button';b.textContent='Next guest';b.onclick=next;result.append(b);}
  function stamp(ms) {return ms?new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(ms):'';}
  function unavailable(d={}) {
    checked=null;requestId=null;
    if(d.status==='redeemed')panel('Already used',`Redeemed${d.location?' at '+label(d.location):''}${d.redeemedAt?' / '+stamp(d.redeemedAt):''}. Do not give another cookie.`);
    else if(d.status==='expired')panel('Pass expired','This cookie offer has ended.');
    else if(d.status==='outside_hours')panel('Redemption is closed','This pass cannot be redeemed outside this location\'s configured operating hours. Ask a manager.');
    else panel('Code not found','Check all five digits and try again.');
  }
  async function redeem(button) {
    if(busy||!checked)return;busy=true;controls();button.disabled=true;button.textContent='Redeeming...';
    try {
      // Redeem the verified pass. No purchase or order details are required.
      const d=await adapter.redeem({code:checked,requestId});
      if(destroyed)return;
      if(d.status==='redeemed_now')panel('Redeemed',`Give one cookie. Recorded at ${label(station)}${d.redeemedAt?' / '+stamp(d.redeemedAt):''}.`,'good');
      else if(d.status==='already_confirmed')panel('Already recorded','Your previous redemption was saved. Do not give a second cookie.','good');
      else unavailable(d);
      checked=null;requestId=null;form.hidden=true;nextButton();
    } catch(err) {
      if(destroyed)return;
      if(err.data?.status) {unavailable(err.data);nextButton();}
      else if(err.data) {panel('Unable to redeem',err.message);checked=null;requestId=null;nextButton();}
      else {panel('Confirmation interrupted','Do not give a cookie yet. Retry the same redemption to check its status.');button.textContent='Retry confirmation';button.disabled=false;result.append(button);}
    } finally {busy=false;if(!destroyed)controls();}
  }
  input.addEventListener('input',()=>{input.value=input.value.replace(/[^0-9]/g,'').slice(0,5);checked=null;requestId=null;result.replaceChildren();controls();},{signal:abort.signal});
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(busy||!ready||!/^\d{5}$/.test(input.value))return;
    busy=true;checked=null;requestId=null;controls();input.blur();result.replaceChildren();
    try {
      const code=input.value,d=await adapter.verify({code});if(destroyed)return;
      if(d.status!=='valid'){unavailable(d);return;}
      checked=code;
      requestId=crypto.randomUUID?crypto.randomUUID():Array.from(crypto.getRandomValues(new Uint8Array(16)),b=>b.toString(16).padStart(2,'0')).join('').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/,'$1-$2-$3-$4-$5');
      panel('Ready to redeem',`For ${d.firstName}. One free cookie.`,'good');
      const note=document.createElement('p');note.className='sb-small';note.textContent='Tap Redeem, then give one cookie after confirmation.';
      const b=document.createElement('button');b.type='button';b.className='sb-primary sb-redeem';b.textContent='Redeem cookie';b.onclick=()=>redeem(b);result.append(note,b);
    } catch(err) {if(!destroyed){if(err.data?.status)unavailable(err.data);else panel('Check unavailable',err.message||'Reconnect and try again. No redemption is confirmed.');}}
    finally {busy=false;if(!destroyed)controls();}
  },{signal:abort.signal});
  const loaded=adapter.me().then(me=>{if(destroyed)return;station=me.location;if(!['fort-worth','willow-bend'].includes(station))throw Error('Ask a manager to assign this phone to one location.');ready=true;root.querySelector('#station-location').textContent=label(station);root.querySelector('#staff-identity').textContent=demo?'Simulated signed-in location phone':me.mode==='local-lab'?'LOCAL TEST ONLY / '+label(station)+' station':'This phone is assigned to '+label(station)+'.';controls();}).catch(err=>{if(!destroyed){panel('Manager sign-in needed',err.message||'Ask a manager to sign in on this phone.');controls();}});
  return {loaded,destroy(){destroyed=true;abort.abort();}};
}

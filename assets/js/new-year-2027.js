/* Additive integration reference. Disabled until October release approval.
 * Install as its OWN deferred asset on the CURRENT live pages; never replace HTML
 * with preview copies. No seasonal stylesheet, menu data or ordering code is used.
 */
(()=>{
  'use strict';
  const ENABLED=false; // Release gate: do not change without owner approval.
  if(!ENABLED||window.__sbNyeLoader)return;
  window.__sbNyeLoader=true;
  const SERVICE='https://celebrate.thesourboule.com'; // Permanent production promotion service.
  const DISMISS='sb-nye-2027-dismissed';
  let state=null,anchor=0,synced=0,host=null,dialog=null,frame=null,previousFocus=null,requestSequence=0;
  let inMemoryDismiss=false;
  const dismissed=()=>{try{return sessionStorage.getItem(DISMISS)==='1'||inMemoryDismiss;}catch{return inMemoryDismiss;}};
  function close(reason){
    inMemoryDismiss=true;try{sessionStorage.setItem(DISMISS,'1');}catch{}
    if(!host)return;dialog.close();host.remove();host=dialog=frame=null;
    if(previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
  }
  function open(){
    if(host||dismissed()||!('HTMLDialogElement' in window))return;
    previousFocus=document.activeElement;host=document.createElement('div');host.id='sb-nye-isolated-host';
    const shadow=host.attachShadow({mode:'closed'}),style=document.createElement('style');
    style.textContent='dialog{box-sizing:border-box;inset:0;border:0;padding:0;margin:0;width:100%;max-width:none;height:100vh;height:100dvh;max-height:none;background:#101b25;color:#f5f0e6}iframe{width:100%;height:calc(100% - 48px - env(safe-area-inset-top,0px));border:0;display:block}button{box-sizing:border-box;height:calc(48px + env(safe-area-inset-top,0px));padding-top:env(safe-area-inset-top,0px);width:100%;border:0;background:#162631;color:#f5f0e6;font:14px Arial;cursor:pointer}button:focus-visible{outline:3px solid #bddce8;outline-offset:-4px}dialog::backdrop{background:#101b25}';
    dialog=document.createElement('dialog');dialog.setAttribute('aria-label','The Sour Boule New Year celebration');
    const exit=document.createElement('button');exit.textContent='Continue to the website';exit.onclick=()=>close('dismissed');
    frame=document.createElement('iframe');frame.title='New Year countdown and cookie promotion';frame.src=SERVICE+'/?embed=1&parent='+encodeURIComponent(location.origin);frame.allow='screen-wake-lock';
    dialog.append(exit,frame);shadow.append(style,dialog);document.body.append(host);
    dialog.addEventListener('cancel',e=>{e.preventDefault();close('dismissed');});dialog.showModal();exit.focus();
  }
  window.addEventListener('message',event=>{
    if(event.origin!==SERVICE||event.source!==frame?.contentWindow)return;
    if(event.data?.type==='sb-nye-close')close(event.data.reason);
  });
  // Recovery is a top-level visit to the same service origin that owns the session.
  // Add only to an existing utility area; no replacement of website content.
  const recovery=document.createElement('a');recovery.href=SERVICE+'/?pass=1';recovery.textContent='My New Year cookie pass';
  recovery.id='sb-nye-pass-recovery';recovery.hidden=true;
  (document.querySelector('.site-footer__bottom')||document.querySelector('footer')||document.body).append(recovery);
  function validTime(value){
    const e=value?.event;
    return Number.isFinite(value?.serverNow)&&e?.id==='sb-nye-2027'&&e.timezone==='America/Chicago'&&
      e.start===1798782600000&&e.midnight===1798783200000&&e.end===1798783500000&&e.sessionExpires===1799647200000;
  }
  async function sync(){
    const sequence=++requestSequence;
    try{
      const sent=performance.now();
      const r=await fetch(SERVICE+'/api/time',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(5000)});
      if(!r.ok)return;
      const value=await r.json();
      if(sequence!==requestSequence||!validTime(value))return;
      state=value;anchor=state.serverNow+(performance.now()-sent)/2;synced=performance.now();
    }catch{/* Fail open: the regular website remains usable. */}
  }
  function tick(){
    if(!state)return;
    const n=anchor+performance.now()-synced;
    recovery.hidden=n<state.event.midnight||n>=state.event.sessionExpires;
    if(n>=state.event.end){if(host)close('ended');return;}
    if(n>=state.event.start&&performance.now()-synced<90000)open();
  }
  void sync().then(tick);setInterval(tick,500);setInterval(()=>void sync(),60000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void sync().then(tick);});
  window.addEventListener('pageshow',()=>void sync().then(tick));
})();

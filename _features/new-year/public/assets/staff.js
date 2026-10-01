import { mountStaff } from './staff-ui.js';
async function api(path,body) {
  const r=await fetch('/api/staff/'+path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000)});
  let d;try{d=await r.json();}catch{if(r.status>=500)throw new Error('Confirmation unavailable. Reconnect and retry.');throw Object.assign(new Error('Staff session unavailable. Ask a manager to sign in again.'),{data:{error:'session'}});}
  // A server failure may have happened after the write committed. Preserve the
  // same redemption request ID for a safe confirmation retry.
  if(r.status>=500)throw new Error(d.error||'Confirmation unavailable. Reconnect and retry.');
  if(!r.ok)throw Object.assign(new Error(d.error||d.status||'Verification unavailable'),{data:d});return d;
}
mountStaff(document.querySelector('#staff-app'),{me:()=>api('me'),verify:body=>api('verify',body),redeem:body=>api('redeem',body)});

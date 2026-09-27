import { mountExperience } from './view.js';
let sessionPromise;
async function api(path,body){const r=await fetch('/api/'+path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,keepalive:!!body,signal:AbortSignal.timeout(10000)});const d=await r.json();if(!r.ok)throw new Error(d.error||d.status||'Request failed');return d;}
function session(){return sessionPromise??=(api('session',{}).catch(e=>{sessionPromise=null;throw e;}));}
let mode,exitSent=false;
const params=new URLSearchParams(location.search);
const parentOrigins=new Set(['https://thesourboule.com','https://www.thesourboule.com']);
const adapter={
  async state(){const sent=performance.now();const d=await api('state');d.serverNow+=(performance.now()-sent)/2;mode=d.mode;if(mode==='local-lab')document.querySelector('#lab-banner').innerHTML='<div class="sb-lab-banner"><strong>LOCAL BACKEND LAB</strong> &middot; Server time is simulated. Entries and test redemptions persist in local SQLite only. Not a live promotion.</div>';return d;},
  async register(firstName){await session();return api('register',{firstName});},
  presence(visible){return api('presence',{visible,view:'countdown'});},
  exit(ended){
    if((ended&&params.has('pass'))||exitSent)return;
    exitSent=true;
    const returnOrigin=params.get('parent');
    // Only the loopback lab may communicate with a loopback parent during local QA.
    let localParent=false;
    if(mode==='local-lab'&&['127.0.0.1','localhost'].includes(location.hostname)){try{const url=new URL(returnOrigin);localParent=url.origin===returnOrigin&&['http://127.0.0.1:8788','http://localhost:8788'].includes(url.origin);}catch{}}
    if(window.parent!==window&&(parentOrigins.has(returnOrigin)||localParent))window.parent.postMessage({type:'sb-nye-close',reason:ended?'ended':'dismissed'},returnOrigin);
    else if(mode!=='local-lab')location.assign('https://thesourboule.com/');
  }
};
mountExperience(document.querySelector('#app'),adapter,{passPage:params.has('pass'),embedded:window.parent!==window});

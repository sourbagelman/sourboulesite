// SIMULATION ONLY. This adapter never calls the production API or issues a reward.
import { mountExperience } from '../public/assets/view.js';
import { mountStaff } from '../public/assets/staff-ui.js';
const E={start:Date.parse('2027-01-01T05:50:00Z'),midnight:Date.parse('2027-01-01T06:00:00Z'),end:Date.parse('2027-01-01T06:05:00Z'),expires:Date.parse('2027-01-04T06:00:00Z'),preWindow:30000,postWindow:90000};
const KEY='sb-nye-preview-only-v2';
let saved=null;try{saved=JSON.parse(localStorage.getItem(KEY));}catch{}
let entry=saved?.entry||null,pass=saved?.pass||null,offline=false,server=E.start,anchor=performance.now(),controller,screen='opening',staffStation='fort-worth';
const now=()=>server+(performance.now()-anchor);
function persist(){try{localStorage.setItem(KEY,JSON.stringify({entry,pass}));}catch{}}
function reward(){entry ||= {firstName:'Jamie',eligible:true};entry.eligible=true;pass||={code:'04271',firstName:entry.firstName,status:'issued',issuedAt:E.midnight,expiresAt:E.expires};persist();}
const adapter={async state(){if(offline)throw new Error('Simulated connection loss');return{serverNow:now(),event:E,entry,pass,mode:'simulation'};},async register(firstName){if(offline)throw new Error('Simulated connection loss');firstName=String(firstName).trim();if(!firstName||[...firstName].length>40)throw new Error('Enter your first name.');entry||={firstName,eligible:false};persist();},async presence(visible){if(offline)throw new Error('Simulated connection loss');if(visible&&entry&&now()>=E.midnight&&now()<=E.midnight+E.postWindow)reward();return{pass};}};
function mount(){controller?.destroy();document.querySelector('#app').innerHTML='';controller=mountExperience(document.querySelector('#app'),adapter,{demo:true});}
function pick(value){screen=value;offline=false;document.querySelector('[data-sim="offline"]').setAttribute('aria-pressed','false');server=value==='final'?E.midnight-60000:value==='last10'?E.midnight-10000:value==='midnight'?E.midnight:value==='reward'?E.midnight+15000:value==='return'?E.end:E.start;anchor=performance.now();if(value==='reward')reward();if(value==='staff'){controller?.destroy();renderStaff();}else{mount();if(value==='return')void controller.sync().then(()=>controller.showWebsite());}document.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.stage===value)));}
function renderStaff(){
  reward();
  const app=document.querySelector('#app');
  app.innerHTML='<div class="sb-staff-demo-controls"><span>STAFF SIMULATION / try code <strong>04271</strong></span><div><button type="button" data-station="fort-worth">Fort Worth phone</button><button type="button" data-station="willow-bend">Willow Bend phone</button></div><span>Demo codes begin with 0 and cannot be live passes.</span></div><div id="demo-staff-root"></div>';
  app.querySelectorAll('[data-station]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.station===staffStation));b.onclick=()=>{controller?.destroy();staffStation=b.dataset.station;renderStaff();};});
  controller=mountStaff(app.querySelector('#demo-staff-root'),{
    async me(){return {location:staffStation,mode:'simulation'};},
    async verify({code}){if(offline)throw Error('Simulated connection loss.');if(code!==pass?.code)return {status:'not_found'};return {status:pass.status==='redeemed'?'redeemed':'valid',firstName:pass.firstName,location:pass.location,redeemedAt:pass.redeemedAt};},
    async redeem({code,requestId}){if(offline)throw Error('Simulated connection loss.');if(code!==pass?.code)return {status:'not_found'};if(pass.status==='redeemed')return {status:'redeemed',location:pass.location,redeemedAt:pass.redeemedAt};pass.status='redeemed';pass.location=staffStation;pass.redeemedAt=E.midnight+43200000;persist();return {status:'redeemed_now',location:staffStation,redeemedAt:pass.redeemedAt};}
  },{demo:true});
}
document.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>pick(b.dataset.stage));
document.querySelector('[data-sim="offline"]').onclick=()=>{offline=!offline;document.querySelector('[data-sim="offline"]').setAttribute('aria-pressed',String(offline));if(screen!=='staff')void controller.sync?.();};
document.querySelector('[data-sim="reset"]').onclick=()=>{entry=null;pass=null;persist();staffStation='fort-worth';pick('opening');};
mount();

/** Derive the approved simulation for private staging; never alter shipped source. */
import {STAGING_LABEL,stagingOrigin} from './client-transform.mjs';

export const PREVIEW_FILES=Object.freeze({
  'preview/index.html':'index.html',
  'preview/preview.js':'preview.js',
  'public/assets/view.js':'view.js',
  'public/assets/staff-ui.js':'staff-ui.js',
  'public/assets/nye.css':'nye.css'
});
function once(source,anchor,replacement) {
  const count=source.split(anchor).length-1;
  if(count!==1)throw new Error(`Visual preview source drift: expected one ${anchor}, found ${count}`);
  return source.replace(anchor,()=>replacement);
}
const html=value=>value.replace(/[&<>"'`$]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;','`':'&#96;','$':'&#36;'}[c]));

export function transformVisualPreview(path,source,{websiteOrigin}={}) {
  const origin=stagingOrigin(websiteOrigin);
  if(!Object.hasOwn(PREVIEW_FILES,path)||typeof source!=='string')throw new Error('Expected an allowlisted UTF-8 visual preview source');
  let out=source;
  if(path==='preview/index.html') {
    out=once(out,'New Year 2027 - Working Preview','New Year 2027 - Private TEST ONLY Preview');
    out=once(out,'href="../public/assets/nye.css"','href="./nye.css"');
    out=once(out,'EXPERIENCE PREVIEW<small>Simulated time. No real rewards.</small>',STAGING_LABEL+'<small>Visual simulation. Independent of the event clock. No real rewards.</small>');
  } else if(path==='preview/preview.js') {
    out=once(out,"'../public/assets/view.js'","'./view.js'");
    out=once(out,"'../public/assets/staff-ui.js'","'./staff-ui.js'");
    out=once(out,'STAFF SIMULATION / try code',STAGING_LABEL+' / STAFF SIMULATION / try code');
  } else if(path==='public/assets/view.js') {
    out=once(out,"'SIMULATED PASS'",JSON.stringify(STAGING_LABEL));
    out=once(out,'TEST ONLY &middot; NOT VALID FOR REDEMPTION',STAGING_LABEL);
    out=once(out,'TEST ONLY - NOT VALID FOR REDEMPTION',STAGING_LABEL);
    out=once(out,'Simulated cookie pass unlocked. Not valid for redemption.',STAGING_LABEL+'.');
    out=once(out,'href="https://thesourboule.com"','href="'+html(origin)+'/"');
    out=once(out,'Open existing website &rarr;','Open private website &rarr;');
  } else if(path==='public/assets/staff-ui.js') {
    out=once(out,'Only give a cookie after redemption is confirmed.',STAGING_LABEL+'. Do not give a real cookie.');
    out=once(out,'Give one cookie. Recorded at','Simulated redemption recorded at');
    out=once(out,'Tap Redeem, then give one cookie after confirmation.','Tap Redeem to simulate this test. Do not give a real cookie.');
    out=once(out,'SIMULATION ONLY. No real pass is verified or redeemed.',STAGING_LABEL+'. No real pass is verified or redeemed.');
  }
  return out;
}

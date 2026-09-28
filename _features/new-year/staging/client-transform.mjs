/** Staging artifact transforms only. Never write their output over public/ or site source. */
export const STAGING_LABEL = 'TEST ONLY — NOT REDEEMABLE';
const RESERVED_HOSTS = new Set(['thesourboule.com','www.thesourboule.com','celebrate.thesourboule.com']);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function stagingOrigin(value) {
  let url;try {url=new URL(value);} catch {throw new Error('An exact approved HTTPS staging origin is required');}
  if(url.protocol!=='https:'||url.origin!==value||url.username||url.password||url.search||url.hash||
    url.port||url.hostname.endsWith('.')||url.hostname==='workers.dev'||url.hostname.endsWith('.workers.dev')||url.hostname.includes('*')||RESERVED_HOSTS.has(url.hostname))
    throw new Error('Use an exact isolated HTTPS staging origin, never the production host');
  return url.origin;
}
function optionsOf(options={}) {
  const websiteOrigin=stagingOrigin(options.websiteOrigin),serviceOrigin=stagingOrigin(options.serviceOrigin);
  if(websiteOrigin===serviceOrigin)throw new Error('The website and celebration must have distinct staging origins');
  return {websiteOrigin,serviceOrigin};
}
function replaceOnce(source, find, replacement, name) {
  const count=typeof find==='string'?source.split(find).length-1:[...source.matchAll(new RegExp(find.source,find.flags.includes('g')?find.flags:find.flags+'g'))].length;
  if(count!==1)throw new Error(`Staging transform ${name}: expected one source anchor, found ${count}`);
  return source.replace(find,()=>replacement);
}
function banner(html,markup) {
  if(html.includes('data-nye-staging-notice'))throw new Error('Staging label was already installed');
  return replaceOnce(html,/<body\b[^>]*>/i,html.match(/<body\b[^>]*>/i)?.[0]+markup,'HTML body');
}
export function addStagingWebsiteBanner(html,options={}) {
  const serviceOrigin=stagingOrigin(options.serviceOrigin);
  const markup='<aside data-nye-staging-notice role="note"><mark><strong>'+STAGING_LABEL+'</strong></mark> '+
    '<a href="'+escapeHtml(serviceOrigin+'/?pass=1')+'" target="_blank" rel="noopener noreferrer">Sign in to the private countdown</a> '+
    '<span>in a separate tab before the rehearsal. This private copy does not change the live website.</span></aside>';
  return banner(html,markup);
}
export function transformServiceAsset(relativePath,source,options={}) {
  const {websiteOrigin,serviceOrigin}=optionsOf(options);
  if(typeof relativePath!=='string'||relativePath.startsWith('/')||relativePath.includes('..'))throw new Error('Expected a service-relative asset path');
  if(typeof source!=='string')throw new Error('Expected UTF-8 service asset source');
  let out=source;
  if(relativePath.endsWith('.html')) {
    out=banner(out,'<aside class="sb-lab-banner" data-nye-staging-notice role="note"><strong>'+STAGING_LABEL+'</strong></aside>');
    if(relativePath==='index.html')out=replaceOnce(out,'href="https://thesourboule.com"','href="'+escapeHtml(websiteOrigin)+'/"','guest noscript return');
    if(relativePath==='staff/index.html') {
      out=replaceOnce(out,'href="/assets/nye.css"','href="/staff/assets/nye.css"','protected staff stylesheet');
      out=replaceOnce(out,'src="/assets/staff.js"','src="/staff/assets/staff.js"','protected staff entrypoint');
    }
  } else if(relativePath==='assets/view.js') {
    out=replaceOnce(out,"function stamp(){return demo||data?.mode==='local-lab';}",'function stamp(){return true;}','always stamp staging pass');
    out=replaceOnce(out,"data?.mode==='local-lab'?'Local test server'","data?.mode==='staging'?'Private staging server'",'staging server status');
    out=replaceOnce(out,"'SIMULATED PASS'",JSON.stringify(STAGING_LABEL),'pass badge');
    out=replaceOnce(out,'TEST ONLY &middot; NOT VALID FOR REDEMPTION',STAGING_LABEL,'visible pass watermark');
    out=replaceOnce(out,'TEST ONLY - NOT VALID FOR REDEMPTION',STAGING_LABEL,'PNG watermark');
    out=replaceOnce(out,'Simulated cookie pass unlocked. Not valid for redemption.',STAGING_LABEL+'.','pass announcement');
    out=replaceOnce(out,"stamp()?'sample '","stamp()?'test '",'saved pass label');
    out=replaceOnce(out,'Back to website preview','Back to private staging website','post-event return label');
    out=replaceOnce(out,'href="https://thesourboule.com"','href="'+escapeHtml(websiteOrigin)+'"','return destination');
  } else if(relativePath==='assets/guest.js') {
    out=replaceOnce(out,"const parentOrigins=new Set(['https://thesourboule.com','https://www.thesourboule.com']);",'const parentOrigins=new Set('+JSON.stringify([websiteOrigin])+');','staging parent allowlist');
    out=replaceOnce(out,"mode=d.mode;","mode=d.mode;if(mode!=='staging'||d.testLabel!=="+JSON.stringify(STAGING_LABEL)+")throw new Error('Private staging is unavailable.');",'required staging response');
    out=replaceOnce(out,/if\(mode==='local-lab'\)document\.querySelector\('#lab-banner'\)\.innerHTML=.*?;return d;/,'return d;','remove loopback banner');
    out=replaceOnce(out,/    \/\/ Only the loopback lab[^\n]*\n    let localParent=false;\n    if\(mode==='local-lab'[^\n]*\n/,'','remove loopback parent allowance');
    out=replaceOnce(out,'(parentOrigins.has(returnOrigin)||localParent)','parentOrigins.has(returnOrigin)','exact staging parent check');
    out=replaceOnce(out,"else if(mode!=='local-lab')location.assign('https://thesourboule.com/');",'else location.assign('+JSON.stringify(websiteOrigin+'/')+');','private website return');
    // The exact origin also prevents an accidentally copied staging guest asset
    // from silently using a different origin's session or backend.
    out=replaceOnce(out,'let sessionPromise;','if(location.origin!=='+JSON.stringify(serviceOrigin)+")throw new Error('Private staging origin mismatch');\nlet sessionPromise;",'guest origin guard');
  } else if(relativePath==='assets/staff.js') {
    out=replaceOnce(out,"fetch('/api/staff/'+path","fetch('/staff/api/'+path",'staff API shares the protected page cookie path');
    if(out.includes('/api/staff/'))throw new Error('Unexpected staging staff API source drift');
  } else if(relativePath==='assets/staff-ui.js') {
    out=replaceOnce(out,'Only give a cookie after redemption is confirmed.',STAGING_LABEL+'. Do not give a real cookie.','staff instruction');
    out=replaceOnce(out,'Give one cookie. Recorded at','Test redemption recorded at','test redemption success');
    out=replaceOnce(out,'Tap Redeem, then give one cookie after confirmation.','Tap Redeem to record this test. Do not give a real cookie.','test redemption instruction');
    out=replaceOnce(out,'station=me.location;',"if(me.mode!=='staging'||me.testLabel!=="+JSON.stringify(STAGING_LABEL)+")throw Error('Private staging station unavailable.');station=me.location;",'required staging staff response');
  }
  return out;
}

// The public artifact is the current repository source, never a review export.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const PAGES=['about.html','brand-home.html','catering.html','contact.html','events.html','fort-worth.html','index.html','locations.html','menu.html','menus-order.html','willow-bend-menu.html','willow-bend.html'];
export const LOADER='assets/js/new-year-2027.js';
export const REFERENCE='_features/new-year/src/integration-loader.js';
export const HEALTH_FILES=[...PAGES,LOADER,'assets/js/seasonal-config.js','assets/js/seasonal.js','assets/css/seasonal.css'];
export const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function validateArtifact(read){
  const reference=await read(REFERENCE),generated=await read(LOADER);
  assert.equal(reference.split('const ENABLED=false;').length,2,'Disabled reference gate changed');
  assert.equal(generated,reference.replace('const ENABLED=false;','const ENABLED=true;'),'Release loader must be exactly the enabled production reference');
  assert(reference.includes("const SERVICE='https://celebrate.thesourboule.com';"),'Production endpoint required');
  assert(reference.includes('e.start===1798782600000&&e.midnight===1798783200000&&e.end===1798783500000'),'Locked event instants required');
  for(const path of PAGES){
    const html=await read(path);
    for(const asset of ['new-year-2027.js','seasonal-config.js','seasonal.js','seasonal.css'])assert.equal(html.split(asset).length,2,path+': exactly one '+asset);
    assert(html.includes('data-seasonal-anchor')&&html.includes('data-seasonal-art'),path+': seasonal hooks required');
    assert(!/data-allow-preview|data-nye-staging-notice|nye-service-staging|nye-staging/.test(html),path+': private export cannot be published');
  }
  assert.equal((await read('CNAME')).trim(),'thesourboule.com');
  return Object.fromEntries(await Promise.all(HEALTH_FILES.map(async path=>[path,hash(await read(path))])));
}

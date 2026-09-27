import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = path => readFileSync(new URL('../'+path, import.meta.url),'utf8');
const offer = "Ring in the New Year with us! Enter your name and stay until midnight to unlock one free cookie. No purchase required. Redeem at either Sour Boule location through January 3, 2027.";

test('final offer is identical in guest view and handoff',()=>{
  assert.ok(read('public/assets/view.js').includes(offer));
  assert.ok(read('CODEX_HANDOFF.md').includes(offer));
});
test('staff and Worker have no purchase-confirmation request gate',()=>{
  for(const path of ['public/assets/staff-ui.js','src/worker.mjs'])
    assert.ok(!read(path).includes('purchaseConfirmed'),path);
});
test('guest, staff and saved-image copy contain no superseded purchase minimum',()=>{
  for(const path of ['public/assets/view.js','public/assets/staff-ui.js']) {
    const text=read(path);
    assert.ok(text.includes('No purchase required.'),path);
    assert.doesNotMatch(text,/with a purchase|\$5(?: or more|\+)/i,path);
  }
});
test('standalone preview was rebuilt with the final no-purchase terms',()=>{
  const html=read('Sour-Boule-New-Year-Preview.html');
  assert.ok(html.includes(offer));
  assert.ok(!html.includes('purchaseConfirmed'));
  assert.doesNotMatch(html,/with a purchase|\$5(?: or more|\+)/i);
});

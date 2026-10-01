import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {STAGING_LABEL,stagingOrigin,transformServiceAsset,addStagingWebsiteBanner} from '../staging/client-transform.mjs';
const root=new URL('../',import.meta.url);
const config={websiteOrigin:'https://website.staging.example.test',serviceOrigin:'https://celebration.staging.example.test'};
const read=path=>readFile(new URL(path,root),'utf8');
const output=async path=>transformServiceAsset(path,await read('public/'+path),config);
test('staging origins must be isolated exact HTTPS origins',()=>{
  for(const value of ['http://example.test','https://thesourboule.com','https://www.thesourboule.com','https://celebrate.thesourboule.com','https://x.test/','https://x.test/path','https://x.test?clock=1','https://user:pass@x.test','https://*.test','https://x.test:8443','https://x.test.','https://workers.dev','https://site.account.workers.dev'])assert.throws(()=>stagingOrigin(value));
  assert.equal(stagingOrigin(config.websiteOrigin),config.websiteOrigin);
  assert.throws(()=>transformServiceAsset('index.html','',{...config,websiteOrigin:config.serviceOrigin}));
});
test('guest and staff pages carry exact staging labels before JavaScript loads',async()=>{
  for(const path of ['index.html','staff/index.html']) {
    const html=await output(path);assert.ok(html.includes(STAGING_LABEL));
    assert.match(html,/<body><aside[^>]+data-nye-staging-notice/);
  }
  const staff=await output('staff/index.html');assert.match(staff,/href="\/staff\/assets\/nye.css"/);assert.match(staff,/src="\/staff\/assets\/staff.js"/);
});
test('website copy adds an explicit top-level service sign-in link without rewriting its contents',()=>{
  const source='<!doctype html><html><body class="current"><main>Current content &amp; current theme.</main></body></html>';
  const html=addStagingWebsiteBanner(source,config);
  assert.ok(html.includes(STAGING_LABEL));assert.ok(html.includes(config.serviceOrigin+'/?pass=1'));assert.match(html,/target="_blank" rel="noopener noreferrer"/);
  assert.equal(html.replace(/<aside data-nye-staging-notice[\s\S]*?<\/aside>/,''),source);
  assert.throws(()=>addStagingWebsiteBanner(html,config),/already installed/);
});
test('staging pass display, screen-reader announcement, and saved PNG use the exact label',async()=>{
  const view=await output('assets/view.js');assert.match(view,/function stamp\(\)\{return true;\}/);
  assert.ok(view.includes('sb-demo-stamp">'+STAGING_LABEL));assert.ok(view.includes('x.fillText(demo?\''+STAGING_LABEL+'\''));
  assert.ok(view.includes("announce(stamp()?'"+STAGING_LABEL+".'"));
  assert.ok(!view.includes('TEST ONLY - NOT VALID FOR REDEMPTION'));assert.ok(!view.includes('TEST ONLY &middot; NOT VALID FOR REDEMPTION'));
  assert.ok(view.includes('No purchase required.'));assert.ok(view.includes("return now()<data.event.midnight?'2026':'2027'"));
});
test('actual saved-pass drawing writes the exact non-redeemable staging label',async()=>{
  const view=(await output('assets/view.js')).replace('export function mountExperience','function mountExperience');
  const drawn=[],downloads=[];
  const context={fillRect(){},strokeRect(){},fillText(text){drawn.push(text);},setLineDash(){},beginPath(){},moveTo(){},lineTo(){},stroke(){}};
  const document={createElement:type=>type==='canvas'?{getContext:()=>context,toBlob:callback=>callback({type:'image/png'})}:{click(){downloads.push(this.download);}}};
  const scope={document,URL:{createObjectURL:()=> 'blob:staging-test',revokeObjectURL(){}},setTimeout:callback=>callback()};
  vm.runInNewContext(view,scope);
  scope.savePassImage({firstName:'Rehearsal',code:'12345',status:'issued'},true);
  assert.ok(drawn.includes(STAGING_LABEL));assert.ok(drawn.includes('No purchase required.'));assert.ok(drawn.includes('12345'));
  assert.deepEqual(downloads,['Sour-Boule-SAMPLE-pass.png']);
});
test('staging staff retains five-digit flow and never instructs a real cookie handout',async()=>{
  const staff=await output('assets/staff-ui.js');assert.ok(staff.includes(STAGING_LABEL));
  for(const text of ['Check code','Redeem cookie','Next guest','inputmode="numeric"','No purchase required.'])assert.ok(staff.includes(text));
  assert.ok(!staff.includes('Give one cookie. Recorded'));assert.ok(!staff.includes('then give one cookie after confirmation'));
  assert.ok(staff.includes("me.mode!=='staging'"));assert.ok(staff.includes('Test redemption recorded at'));
});
function guestContext(source,{origin=config.serviceOrigin,mode='staging',testLabel=STAGING_LABEL,parent=config.websiteOrigin,embedded=true}={}) {
  let adapter;const sent=[],navigated=[];
  const foreign={postMessage:(message,target)=>sent.push({message,target})};
  const window={parent:embedded?foreign:null};if(!embedded)window.parent=window;
  const ctx={URLSearchParams,URL,Set,AbortSignal,performance:{now:()=>0},document:{querySelector:()=>({})},location:{origin,hostname:new URL(origin).hostname,search:'?embed=1&parent='+encodeURIComponent(parent),assign:url=>navigated.push(url)},window,
    fetch:async()=>({ok:true,json:async()=>({serverNow:1798783200000,mode,testLabel})}),mountExperience:(_root,value)=>adapter=value};
  vm.runInNewContext(source.replace("import { mountExperience } from './view.js';",''),ctx);
  return {adapter,sent,navigated};
}
test('staging guest accepts only staging server metadata without changing cookie fetch policy',async()=>{
  const guest=await output('assets/guest.js');assert.ok(guest.includes("credentials:'same-origin'"));
  assert.ok(!guest.includes('localParent'));assert.ok(!guest.includes("mode==='local-lab'"));
  await guestContext(guest).adapter.state();
  await assert.rejects(guestContext(guest,{mode:'live'}).adapter.state(),/staging is unavailable/);
  await assert.rejects(guestContext(guest,{testLabel:'sample'}).adapter.state(),/staging is unavailable/);
  assert.throws(()=>guestContext(guest,{origin:'https://other.staging.example.test'}),/origin mismatch/);
});
test('staging guest exit messages target only the configured private parent',async()=>{
  const guest=await output('assets/guest.js');
  const valid=guestContext(guest);await valid.adapter.state();valid.adapter.exit(false);
  assert.equal(valid.sent.length,1);assert.equal(valid.sent[0].target,config.websiteOrigin);assert.equal(valid.sent[0].message.type,'sb-nye-close');assert.equal(valid.navigated.length,0);
  for(const parent of ['https://thesourboule.com','http://127.0.0.1:8788','https://untrusted.test']) {
    const invalid=guestContext(guest,{parent});await invalid.adapter.state();invalid.adapter.exit(false);
    assert.equal(invalid.sent.length,0);assert.deepEqual(invalid.navigated,[config.websiteOrigin+'/']);
  }
});
test('source-anchor drift fails closed and unchanged service assets remain byte-identical',async()=>{
  assert.throws(()=>transformServiceAsset('assets/view.js','changed source',config),/expected one source anchor/);
  assert.throws(()=>transformServiceAsset('../index.html','',config),/service-relative/);
  for(const path of ['assets/nye.css'])assert.equal(await output(path),await read('public/'+path));
  const source=await read('public/assets/view.js');assert.ok(source.includes('TEST ONLY - NOT VALID FOR REDEMPTION'));assert.ok(!source.includes(STAGING_LABEL));
});

test('actual staging staff adapter stays under the signed-in staff path for all three requests',async()=>{
  const original=await read('public/assets/staff.js'),script=await output('assets/staff.js');
  assert.ok(original.includes("fetch('/api/staff/'+path"));assert.ok(!script.includes('/api/staff/'));
  let adapter;const calls=[];
  vm.runInNewContext(script.replace("import { mountStaff } from './staff-ui.js';",''),{
    document:{querySelector:()=>({})},AbortSignal,
    mountStaff:(_root,value)=>adapter=value,
    fetch:async(url,options)=>{calls.push({url,options});return {ok:true,status:200,json:async()=>({mode:'staging',testLabel:STAGING_LABEL})};}
  });
  await adapter.me();await adapter.verify({code:'12345'});await adapter.redeem({code:'12345',requestId:'10000000-1000-4000-8000-100000000001'});
  assert.deepEqual(calls.map(call=>call.url),['/staff/api/me','/staff/api/verify','/staff/api/redeem']);
  for(const call of calls)assert.equal(call.options.credentials,'same-origin');
  assert.deepEqual(JSON.parse(calls[2].options.body),{code:'12345',requestId:'10000000-1000-4000-8000-100000000001'});
  assert.equal(await read('public/assets/staff.js'),original);
  assert.throws(()=>transformServiceAsset('assets/staff.js',original.replace("fetch('/api/staff/'+path","fetch('/changed/'+path"),config),/expected one source anchor/);
});

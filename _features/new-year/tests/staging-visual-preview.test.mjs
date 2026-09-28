import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {PREVIEW_FILES,transformVisualPreview} from '../staging/visual-preview.mjs';
import {STAGING_LABEL} from '../staging/client-transform.mjs';

const config={websiteOrigin:'https://website.staging.example.test'};
const sources=Object.fromEntries(await Promise.all(Object.keys(PREVIEW_FILES).map(async path=>[path,await readFile(new URL('../'+path,import.meta.url),'utf8')])));
const transformed=Object.fromEntries(Object.entries(sources).map(([path,source])=>[path,transformVisualPreview(path,source,config)]));

test('private visual preview reuses the five approved assets, original controls and CSS, with explicit TEST ONLY labels',()=>{
  assert.deepEqual(Object.values(PREVIEW_FILES),['index.html','preview.js','view.js','staff-ui.js','nye.css']);
  assert.equal(transformed['public/assets/nye.css'],sources['public/assets/nye.css']);
  const controls=source=>[...source.matchAll(/data-(?:stage|sim)="[^"]+"/g)].map(match=>match[0]);
  assert.deepEqual(controls(transformed['preview/index.html']),controls(sources['preview/index.html']));
  for(const path of ['preview/index.html','preview/preview.js','public/assets/view.js','public/assets/staff-ui.js'])assert.ok(transformed[path].includes(STAGING_LABEL),path);
  assert.ok(transformed['preview/index.html'].includes('Independent of the event clock'));
  assert.ok(transformed['public/assets/view.js'].includes('href="'+config.websiteOrigin+'/"'));
  assert.ok(transformed['public/assets/view.js'].includes('Open private website'));
  assert.ok(!transformed['public/assets/view.js'].includes('https://thesourboule.com'));
  assert.ok(transformed['public/assets/view.js'].includes("x.fillText(demo?'"+STAGING_LABEL+"'"));
});

test('visual preview imports only its local renderers and has no service, authentication or network adapter',()=>{
  assert.deepEqual([...transformed['preview/preview.js'].matchAll(/import .*? from '([^']+)'/g)].map(match=>match[1]),['./view.js','./staff-ui.js']);
  assert.ok(transformed['preview/index.html'].includes('href="./nye.css"'));
  for(const [path,source] of Object.entries(transformed)) {
    assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|document\.cookie|\/api\/|guest\.js|staff\.js|location\.assign|localStorage\.clear|sessionStorage/,path);
  }
});

test('existing simulation controls change only the preview clock and preview storage, with reserved sample codes',async()=>{
  const stages=['opening','final','last10','midnight','reward','return','staff'];
  const node=dataset=>({dataset,setAttribute(){}});
  const buttons=stages.map(stage=>node({stage})),offline=node({}),reset=node({});
  const app={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>({})};
  const storage=new Map([['unrelated-existing-record','keep']]),writes=[];
  let adapter,staffAdapter,options,returns=0;
  const controller={destroy(){},sync:async()=>{},showWebsite(){returns++;}};
  const context={
    document:{querySelector(selector){return selector==='#app'?app:selector==='[data-sim="offline"]'?offline:reset;},querySelectorAll:()=>buttons},
    performance:{now:()=>123},
    localStorage:{getItem:key=>storage.get(key)||null,setItem(key,value){writes.push(key);storage.set(key,value);}},
    mountExperience(_root,value,settings){adapter=value;options=settings;return controller;},
    mountStaff(_root,value,settings){staffAdapter=value;options=settings;return controller;},
    fetch(){throw new Error('Network access is forbidden for simulation');}
  };
  vm.runInNewContext(transformed['preview/preview.js'].replace(/^import .*;\n/gm,''),context);
  assert.equal(options.demo,true);
  const initial=await adapter.state();
  assert.equal(initial.serverNow,Date.parse('2027-01-01T05:50:00Z'));
  assert.equal(initial.mode,'simulation');
  for(const [stage,time] of [['final','2027-01-01T05:59:00Z'],['last10','2027-01-01T05:59:50Z'],['midnight','2027-01-01T06:00:00Z']]) {
    buttons.find(button=>button.dataset.stage===stage).onclick();
    assert.equal((await adapter.state()).serverNow,Date.parse(time));
    assert.equal(options.demo,true);
  }
  buttons.find(button=>button.dataset.stage==='reward').onclick();
  assert.equal((await adapter.state()).pass.code,'04271');
  buttons.find(button=>button.dataset.stage==='return').onclick();
  await Promise.resolve();
  assert.equal((await adapter.state()).serverNow,Date.parse('2027-01-01T06:05:00Z'));
  assert.equal(returns,1);
  buttons.find(button=>button.dataset.stage==='staff').onclick();
  assert.equal((await staffAdapter.me()).mode,'simulation');
  assert.equal((await staffAdapter.redeem({code:'04271'})).status,'redeemed_now');
  reset.onclick();
  assert.equal((await adapter.state()).pass,null);
  assert.ok(writes.length>0);
  assert.deepEqual([...new Set(writes)],['sb-nye-preview-only-v2']);
  assert.equal(storage.get('unrelated-existing-record'),'keep');
});

test('visual preview refuses production origins, unknown assets and drifted source anchors',()=>{
  assert.throws(()=>transformVisualPreview('preview/index.html',sources['preview/index.html'],{websiteOrigin:'https://thesourboule.com'}),/production host/);
  assert.throws(()=>transformVisualPreview('public/assets/guest.js','',config),/allowlisted/);
  assert.throws(()=>transformVisualPreview('preview/preview.js',sources['preview/preview.js'].replace("'../public/assets/view.js'","'elsewhere.js'"),config),/source drift/);
});

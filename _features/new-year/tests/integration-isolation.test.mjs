import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,relative} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {integrationAsset} from '../scripts/build-integration.mjs';
const feature=fileURLToPath(new URL('../',import.meta.url));
const site=resolve(feature,'../..');
const baseline='b08545ed37a2e9388ff8e565c50ab36d2eb89712';
const tag=Buffer.from('<script defer src="assets/js/new-year-2027.js"></script>\n');
const pages=['about.html','brand-home.html','catering.html','contact.html','events.html','fort-worth.html','index.html','locations.html','menu.html','menus-order.html','willow-bend.html','willow-bend-menu.html'];
test('every original tracked file is byte-identical except one additive script include per visitor page',()=>{
  const tree=execFileSync('git',['ls-tree','-rz',baseline],{cwd:site}).toString().split('\0').filter(Boolean);
  for(const entry of tree){
    const [meta,path]=entry.split('\t');
    const hash=meta.split(' ')[2];
    let content=readFileSync(resolve(site,path));
    if(pages.includes(path)){
      const at=content.indexOf(tag);
      assert.ok(at>=0,`${path}: additive include missing`);
      assert.equal(content.indexOf(tag,at+1),-1,`${path}: duplicate include`);
      content=Buffer.concat([content.subarray(0,at),content.subarray(at+tag.length)]);
    }
    const actual=createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
    assert.equal(actual,hash,`${path}: unrelated website/seasonal change`);
  }
});
test('disabled loader reference has no side effects and prepared artifact differs only by its approved release gate',()=>{
  const source=readFileSync(resolve(feature,'src/integration-loader.js'),'utf8');
  assert.match(source,/const ENABLED=false;/);
  assert.equal(readFileSync(resolve(site,'assets/js/new-year-2027.js'),'utf8'),integrationAsset(source,'approved-october-release'));
  // No browser globals exist: even looking up window/document/fetch would throw.
  assert.doesNotThrow(()=>runInNewContext(source,Object.create(null)));
});
test('service public assets exclude local lab, samples, preview controls and credentials',()=>{
  const root=resolve(feature,'public');
  const files=[];
  function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const path=resolve(dir,item.name);if(item.isDirectory())walk(path);else files.push(relative(root,path));}}
  walk(root);
  assert.deepEqual(files.sort(),['assets/guest.js','assets/nye.css','assets/staff-ui.js','assets/staff.js','assets/view.js','index.html','staff/index.html']);
  for(const path of files){
    assert.doesNotMatch(readFileSync(resolve(root,path),'utf8'),/local-test-(?:staff|wb|control)-token|\/__lab\/time|sb_nye_preview|04271/);
  }
  const worker=readFileSync(resolve(feature,'src/worker.mjs'),'utf8');
  assert.match(worker,/export default createApp\(\);/);
  assert.doesNotMatch(worker,/\/__lab\/|\/__test\/|LAB_CONTROL_TOKEN/);
});

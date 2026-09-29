import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {parseArgs,prepareLock,armRelease} from './arm.mjs';
import {PLAN,controlPath} from './publish.mjs';
import {HEALTH_FILES,REFERENCE} from './artifact.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url));
const APPROVED='a'.repeat(40),APPROVED_TREE='b'.repeat(40),BOOTSTRAP='c'.repeat(40),BOOTSTRAP_TREE='d'.repeat(40),OTHER='e'.repeat(40),PREVIOUS_TREE='f'.repeat(40);
const target=Date.parse(PLAN.targetUtc),beforeTarget=()=>target-60000;
const clone=value=>structuredClone(value);
const gitHash=body=>createHash('sha1').update('blob '+Buffer.byteLength(body)+'\0').update(body).digest('hex');
const paths=[...new Set([...HEALTH_FILES,REFERENCE,'CNAME',PLAN.workflow,'_release/plan.json','_release/publish.mjs','_release/artifact.mjs','_release/arm.mjs'])];
// Only repository reads and mocked API state. No GitHub CLI, HTTP, git refs,
// cloud resources, or working-tree files are changed by these tests.
const sources=new Map(await Promise.all(paths.map(async path=>[path,await readFile(resolve(repo,path),'utf8')])));

function fixture({main=PLAN.previousProductionCommit,rollback=null,onCall}={}){
  const blobs=new Map([...sources].map(([,text])=>[gitHash(text),text]));
  const approvedTree=[...sources].map(([path,text])=>({path,type:'blob',mode:'100644',sha:gitHash(text)}));
  const previousTree=clone(approvedTree.filter(entry=>!controlPath(entry.path)));
  // The old production page intentionally differs from the candidate. Bootstrap
  // must preserve it while installing only the candidate's release controls.
  const previousIndex='Existing live page, preserved until the scheduled release.';
  blobs.set(gitHash(previousIndex),previousIndex);
  previousTree.find(entry=>entry.path==='index.html').sha=gitHash(previousIndex);
  const bootstrapTree=[...clone(previousTree),...clone(approvedTree.filter(entry=>controlPath(entry.path)))];
  const state={main,release:APPROVED,approvedTree,bootstrapTree,previousTree,bootstrapParents:[PLAN.previousProductionCommit],
    relation:{merge_base_commit:{sha:BOOTSTRAP},behind_by:0},variables:[],rollback,lockTag:null,
    pages:{build_type:'legacy',source:{branch:'main',path:'/'},cname:'thesourboule.com'},
    workflow:{id:123,path:PLAN.workflow,state:'active'},workflowResponses:[]};
  const calls=[],sleeps=[];
  async function api(path,{method='GET',body}={}){
    const call={path,method,...(body===undefined?{}:{body:clone(body)})};calls.push(call);onCall?.({call,state,calls});
    if(method==='GET'){
      if(path==='git/commits/'+APPROVED)return {sha:APPROVED,tree:{sha:APPROVED_TREE},parents:[{sha:BOOTSTRAP}]};
      if(path==='git/commits/'+BOOTSTRAP)return {sha:BOOTSTRAP,tree:{sha:BOOTSTRAP_TREE},parents:state.bootstrapParents.map(sha=>({sha}))};
      if(path==='git/commits/'+PLAN.previousProductionCommit)return {sha:PLAN.previousProductionCommit,tree:{sha:PREVIOUS_TREE},parents:[]};
      for(const [sha,tree] of [[APPROVED_TREE,state.approvedTree],[BOOTSTRAP_TREE,state.bootstrapTree],[PREVIOUS_TREE,state.previousTree]])if(path==='git/trees/'+sha+'?recursive=1')return {truncated:false,tree:clone(tree)};
      if(path.startsWith('git/blobs/')){const text=blobs.get(path.slice('git/blobs/'.length));assert.notEqual(text,undefined,'Unknown fixture blob');return {encoding:'base64',content:Buffer.from(text).toString('base64')};}
      if(path==='compare/'+BOOTSTRAP+'...'+APPROVED)return clone(state.relation);
      if(path==='git/ref/heads/'+PLAN.branch)return {object:{sha:state.release}};
      if(path==='git/ref/heads/main')return {object:{sha:state.main}};
      if(path==='pages')return clone(state.pages);
      if(path==='actions/variables?per_page=100')return {variables:clone(state.variables)};
      if(path==='git/matching-refs/tags/'+PLAN.rollbackTag)return state.rollback?[{ref:'refs/tags/'+PLAN.rollbackTag,object:{sha:state.rollback}}]:[];
      if(path==='git/matching-refs/tags/'+PLAN.lockTag)return state.lockTag?[{ref:'refs/tags/'+PLAN.lockTag,object:{sha:state.lockTag}}]:[];
      if(path==='actions/workflows?per_page=100'){
        const workflow=state.workflowResponses.length?state.workflowResponses.shift():state.workflow;
        return {workflows:workflow?[clone(workflow)]:[]};
      }
    }
    if(method==='PATCH'&&path==='git/refs/heads/main'){
      assert.deepEqual(body,{sha:BOOTSTRAP,force:false},'Arming may install only the non-force control-only bootstrap');
      state.main=BOOTSTRAP;return {object:{sha:BOOTSTRAP}};
    }
    if(method==='POST'&&path==='git/refs'){
      if(body.ref==='refs/tags/'+PLAN.rollbackTag){assert.equal(body.sha,PLAN.previousProductionCommit);state.rollback=body.sha;}
      else{assert.deepEqual(body,{ref:'refs/tags/'+PLAN.lockTag,sha:APPROVED});state.lockTag=body.sha;}
      return {object:{sha:body.sha}};
    }
    if(method==='POST'&&path==='actions/variables'){
      assert.equal(body.name,PLAN.lockVariable);state.variables.push(clone(body));return null;
    }
    if(method==='PUT'&&path==='actions/workflows/'+state.workflow?.id+'/enable'){
      assert.equal(body,undefined);state.workflow.state='active';return null;
    }
    throw Error('Unexpected mocked operation: '+method+' '+path);
  }
  const sleep=async ms=>{sleeps.push(ms);};
  return {state,calls,api,sleeps,sleep,prepare:()=>prepareLock(api,APPROVED,BOOTSTRAP),writes:()=>calls.filter(call=>call.method!=='GET')};
}

test('arming CLI has an explicit read-only check and requires two full SHAs plus separate arm confirmation',()=>{
  assert.deepEqual(parseArgs(['--check',APPROVED,BOOTSTRAP]),{arm:false,approvedCommit:APPROVED,bootstrapCommit:BOOTSTRAP});
  assert.deepEqual(parseArgs(['--arm',APPROVED,BOOTSTRAP,'--confirm-owner-approved']),{arm:true,approvedCommit:APPROVED,bootstrapCommit:BOOTSTRAP});
  for(const args of [[],[APPROVED,BOOTSTRAP],['--check','abc',BOOTSTRAP],['--check',APPROVED],['--check',APPROVED,BOOTSTRAP,'--confirm-owner-approved'],['--arm',APPROVED,BOOTSTRAP],['--arm',APPROVED,BOOTSTRAP,'yes'],['--arm',APPROVED,BOOTSTRAP,'--confirm-owner-approved','extra']])assert.throws(()=>parseArgs(args));
});

test('read-only preparation binds exact candidate/tree/bootstrap while preserving old production content',async()=>{
  const f=fixture();const prepared=await f.prepare();
  assert.deepEqual(prepared,{main:PLAN.previousProductionCommit,lock:{id:PLAN.id,targetUtc:PLAN.targetUtc,armed:true,approvedCommit:APPROVED,approvedTree:APPROVED_TREE,bootstrapCommit:BOOTSTRAP,previousProductionCommit:PLAN.previousProductionCommit}});
  assert.deepEqual(f.writes(),[]);assert.equal(f.state.main,PLAN.previousProductionCommit);
});

test('preparation rejects changed public bootstrap content, parent, controls, ancestry, refs, hosting and existing locks without writes',async t=>{
  for(const [name,mutate,match] of [
    ['public page',s=>{s.bootstrapTree.find(entry=>entry.path==='index.html').sha=OTHER;},/must not alter any production content/],
    ['public added file',s=>{s.bootstrapTree.push({path:'extra-public.html',type:'blob',mode:'100644',sha:OTHER});},/must not alter any production content/],
    ['wrong parent',s=>{s.bootstrapParents=[OTHER];},/directly descend/],
    ['extra parent',s=>{s.bootstrapParents.push(OTHER);},/directly descend/],
    ['different controls',s=>{s.bootstrapTree.find(entry=>entry.path===PLAN.workflow).sha=OTHER;},/control files differ/],
    ['not ancestor',s=>{s.relation.merge_base_commit.sha=OTHER;},/already be an ancestor/],
    ['behind bootstrap',s=>{s.relation.behind_by=1;},/already be an ancestor/],
    ['release advanced',s=>{s.release=OTHER;},/Remote release branch/],
    ['main advanced',s=>{s.main=OTHER;},/Production changed/],
    ['publishing branch',s=>{s.pages.source.branch='release/2026-10-01';},/Hosting settings changed/],
    ['existing lock',s=>{s.variables.push({name:PLAN.lockVariable,value:'already locked'});},/release lock already exists/],
    ['existing cancellation tag',s=>{s.lockTag=APPROVED;},/cancellation\/lock tag already exists/]
  ])await t.test(name,async()=>{const f=fixture();mutate(f.state);await assert.rejects(f.prepare(),match);assert.deepEqual(f.writes(),[]);});
});

test('arming at or after the target or with an invalid time performs zero API calls and writes',async t=>{
  for(const [name,value] of [['target',target],['late',target+1],['next year',Date.parse('2027-10-01T04:59:00Z')],['invalid',NaN]])await t.test(name,async()=>{
    const f=fixture();await assert.rejects(armRelease(f.api,{lock:{approvedCommit:APPROVED,bootstrapCommit:BOOTSTRAP}},{now:()=>value,sleep:f.sleep}),/Too late to arm/);
    assert.deepEqual(f.calls,[]);assert.deepEqual(f.writes(),[]);
  });
});

test('arming rechecks remote advancement and prepared lock equality before any mutation',async t=>{
  for(const name of ['main','release','prepared lock'])await t.test(name,async()=>{
    const f=fixture();const prepared=await f.prepare();
    if(name==='prepared lock')prepared.lock.approvedTree=OTHER;else f.state[name]=OTHER;
    await assert.rejects(armRelease(f.api,prepared,{now:beforeTarget,sleep:f.sleep}),/Production changed|Remote release branch|Prepared lock changed/);
    assert.deepEqual(f.writes(),[]);
  });
});

test('valid arming installs only the control bootstrap, preserves rollback, then creates the cancellation tag and arm variable',async()=>{
  const f=fixture();const prepared=await f.prepare();const lock=await armRelease(f.api,prepared,{now:beforeTarget,sleep:f.sleep});
  assert.deepEqual(lock,prepared.lock);
  assert.deepEqual(f.writes(),[
    {method:'POST',path:'git/refs',body:{ref:'refs/tags/'+PLAN.rollbackTag,sha:PLAN.previousProductionCommit}},
    {method:'PATCH',path:'git/refs/heads/main',body:{sha:BOOTSTRAP,force:false}},
    {method:'POST',path:'git/refs',body:{ref:'refs/tags/'+PLAN.lockTag,sha:APPROVED}},
    {method:'POST',path:'actions/variables',body:{name:PLAN.lockVariable,value:JSON.stringify(lock)}}
  ]);
  assert.equal(f.state.main,BOOTSTRAP);assert.notEqual(f.state.main,APPROVED);
  assert.equal(f.calls.some(call=>call.path==='pages/builds'),false,'Arming never requests website publication');
});

test('arming an installed bootstrap does not rewrite main or the matching rollback reference',async()=>{
  const f=fixture({main:BOOTSTRAP,rollback:PLAN.previousProductionCommit});const prepared=await f.prepare();await armRelease(f.api,prepared,{now:beforeTarget,sleep:f.sleep});
  assert.deepEqual(f.writes().map(call=>call.path),['git/refs','actions/variables']);
  assert.equal(f.state.main,BOOTSTRAP);
});

test('a conflicting rollback reference blocks all arming mutations',async()=>{
  const f=fixture({rollback:OTHER});const prepared=await f.prepare();await assert.rejects(armRelease(f.api,prepared,{now:beforeTarget,sleep:f.sleep}),/Rollback reference collision/);
  assert.deepEqual(f.writes(),[]);
});

test('arming waits for exact workflow registration before creating the cancellation tag or arm variable',async()=>{
  const f=fixture();f.state.workflowResponses=[null,{id:999,path:'.github/workflows/unrelated.yml',state:'active'}];
  const prepared=await f.prepare();await armRelease(f.api,prepared,{now:beforeTarget,sleep:f.sleep});
  assert.deepEqual(f.sleeps,[1000,1000]);
  const registrationCalls=f.calls.map((call,index)=>({call,index})).filter(({call})=>call.path==='actions/workflows?per_page=100');
  assert.equal(registrationCalls.length,3);
  const lockTagIndex=f.calls.findIndex(call=>call.method==='POST'&&call.path==='git/refs'&&call.body.ref==='refs/tags/'+PLAN.lockTag);
  assert.ok(lockTagIndex>registrationCalls.at(-1).index);
});

test('an inactive registered scheduler is enabled before the arm variable is created',async()=>{
  const f=fixture();f.state.workflow.state='disabled_manually';const prepared=await f.prepare();await armRelease(f.api,prepared,{now:beforeTarget,sleep:f.sleep});
  assert.equal(f.state.workflow.state,'active');
  const writes=f.writes();const enableIndex=writes.findIndex(call=>call.method==='PUT'&&call.path==='actions/workflows/123/enable');
  assert.ok(enableIndex>=0);assert.ok(enableIndex<writes.findIndex(call=>call.path==='actions/variables'));
  assert.equal(f.state.main,BOOTSTRAP);
});

test('registration timeout preserves the old public bootstrap content but never arms the release',async()=>{
  const f=fixture();f.state.workflow=null;const prepared=await f.prepare();await assert.rejects(armRelease(f.api,prepared,{now:beforeTarget,sleep:f.sleep}),/Scheduler not registered.*no release lock was armed/);
  assert.equal(f.sleeps.length,10);assert.ok(f.sleeps.every(ms=>ms===1000));
  assert.equal(f.state.main,BOOTSTRAP);assert.equal(f.state.lockTag,null);assert.deepEqual(f.state.variables,[]);
  assert.deepEqual(f.writes().map(call=>call.path),['git/refs','git/refs/heads/main']);
});

test('target passing or candidate/main advancement during setup never creates an arm variable or lock tag',async t=>{
  for(const name of ['target passed','candidate advanced','main advanced'])await t.test(name,async()=>{
    const f=fixture({onCall:({call,state})=>{if(call.path==='actions/workflows?per_page=100'){if(name==='candidate advanced')state.release=OTHER;if(name==='main advanced')state.main=OTHER;}}});
    const prepared=await f.prepare();let nowCalls=0;
    const now=name==='target passed'?()=>++nowCalls===1?target-1:target:beforeTarget;
    await assert.rejects(armRelease(f.api,prepared,{now,sleep:f.sleep}),/Target passed during setup|Candidate changed during arming|Main changed during arming/);
    assert.equal(f.state.lockTag,null);assert.deepEqual(f.state.variables,[]);assert.equal(f.state.main,name==='main advanced'?OTHER:BOOTSTRAP);
  });
});

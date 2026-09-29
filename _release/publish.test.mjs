import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {PLAN,publish,dryRun,githubClient,healthCheck} from './publish.mjs';
import {validateArtifact,HEALTH_FILES,LOADER,REFERENCE,hash} from './artifact.mjs';

const repo=fileURLToPath(new URL('../',import.meta.url));
const APPROVED='a'.repeat(40),TREE='b'.repeat(40),BOOTSTRAP='c'.repeat(40),BOOT_TREE='d'.repeat(40),OTHER='e'.repeat(40),PREVIOUS_TREE='f'.repeat(40);
const target=Date.parse(PLAN.targetUtc),windowNow=()=>target+60000;
const clone=value=>structuredClone(value);
const read=path=>readFile(resolve(repo,path),'utf8');
const paths=[...new Set([...HEALTH_FILES,REFERENCE,'CNAME',PLAN.workflow,'_release/plan.json','_release/artifact.mjs','_release/publish.mjs'])];
// Real current source bytes become Git blob fixtures. No repository or network
// mutation is performed by this suite, and every HTTP/health operation is mocked.
const source=new Map(await Promise.all(paths.map(async path=>[path,await read(path)])));
const gitHash=body=>createHash('sha1').update('blob '+Buffer.byteLength(body)+'\0').update(body).digest('hex');

function fixture({main=BOOTSTRAP,latest={commit:PLAN.previousProductionCommit,status:'built'},rollback=true,onCall}={}){
  const lock={armed:true,id:PLAN.id,targetUtc:PLAN.targetUtc,approvedCommit:APPROVED,approvedTree:TREE,bootstrapCommit:BOOTSTRAP,previousProductionCommit:PLAN.previousProductionCommit};
  const approvedTree=[...source].map(([path,body])=>({path,mode:'100644',type:'blob',sha:gitHash(body)}));
  const blobs=new Map([...source].map(([,body])=>[gitHash(body),body]));
  const state={lockTag:APPROVED,main,release:APPROVED,approvedTree,bootstrapTree:clone(approvedTree),previousTree:clone(approvedTree),bootstrapParents:[PLAN.previousProductionCommit],approvedTreeSha:TREE,latest:clone(latest),rollback:rollback?PLAN.previousProductionCommit:null,buildResponses:[],mainReads:0};
  const calls=[],healthCalls=[],sleeps=[];
  async function api(path,{method='GET',body}={}){
    const call={path,method,...(body===undefined?{}:{body:clone(body)})};calls.push(call);
    if(path==='git/ref/heads/main')state.mainReads++;
    onCall?.({call,state,calls});
    if(method==='GET'){
      if(path==='pages')return {build_type:'legacy',source:{branch:'main',path:'/'},cname:'thesourboule.com'};
      if(path==='git/ref/heads/'+PLAN.branch)return {object:{sha:state.release}};
      if(path==='git/ref/heads/main')return {object:{sha:state.main}};
      if(path==='git/commits/'+APPROVED)return {sha:APPROVED,tree:{sha:state.approvedTreeSha}};
      if(path==='git/commits/'+BOOTSTRAP)return {sha:BOOTSTRAP,tree:{sha:BOOT_TREE},parents:state.bootstrapParents.map(sha=>({sha}))};
      if(path==='git/commits/'+PLAN.previousProductionCommit)return {sha:PLAN.previousProductionCommit,tree:{sha:PREVIOUS_TREE}};
      if(path==='git/trees/'+state.approvedTreeSha+'?recursive=1')return {truncated:false,tree:clone(state.approvedTree)};
      if(path==='git/trees/'+BOOT_TREE+'?recursive=1')return {truncated:false,tree:clone(state.bootstrapTree)};
      if(path==='git/trees/'+PREVIOUS_TREE+'?recursive=1')return {truncated:false,tree:clone(state.previousTree)};
      if(path.startsWith('git/blobs/')){const text=blobs.get(path.slice('git/blobs/'.length));assert.notEqual(text,undefined,'Unknown local fixture blob');return {encoding:'base64',content:Buffer.from(text).toString('base64')};}
      if(path==='compare/'+BOOTSTRAP+'...'+APPROVED)return {merge_base_commit:{sha:BOOTSTRAP},behind_by:0};
      if(path==='git/ref/tags/'+PLAN.lockTag)return state.lockTag?{object:{sha:state.lockTag}}:null;
      if(path==='git/ref/tags/'+PLAN.rollbackTag)return state.rollback?{object:{sha:state.rollback}}:null;
      if(path==='pages/builds/latest'){if(state.buildResponses.length)state.latest=state.buildResponses.shift();return clone(state.latest);}
    }
    if(method==='PATCH'&&path==='git/refs/heads/main'){assert.deepEqual(body,{sha:APPROVED,force:false});state.main=body.sha;return {object:{sha:body.sha}};}
    if(method==='POST'&&path==='git/refs'){assert.deepEqual(body,{ref:'refs/tags/'+PLAN.rollbackTag,sha:PLAN.previousProductionCommit});state.rollback=body.sha;return {object:{sha:body.sha}};}
    if(method==='POST'&&path==='pages/builds'){assert.equal(body,undefined);state.latest={commit:APPROVED,status:'built'};return {status:'queued'};}
    throw Error('Unexpected mock API operation: '+method+' '+path);
  }
  const health=async(expected,sha)=>healthCalls.push({expected,sha});
  const sleep=async ms=>{sleeps.push(ms);};
  const run=options=>publish({api,lock,now:windowNow,sleep,health,...options});
  return {lock,state,api,calls,healthCalls,sleeps,health,sleep,run,writes:()=>calls.filter(call=>call.method!=='GET')};
}

test('disarmed, early, closed-window and next-year runs perform zero API calls or writes',async t=>{
  for(const [name,lockValue,time] of [['disarmed',null,target],['early','valid',target-1],['closed','valid',Date.parse(PLAN.latestStartUtc)],['next year','valid',Date.parse('2027-10-01T04:59:00Z')]])await t.test(name,async()=>{
    const f=fixture();const result=await f.run({lock:lockValue==='valid'?f.lock:lockValue,now:()=>time});assert.equal(result.mode,'NO PUBLICATION');assert.equal(result.publicationWrites,0);assert.deepEqual(f.calls,[]);assert.deepEqual(f.healthCalls,[]);
  });
});

test('changed release ref, main ref, approved tree or bootstrap controls reject before writes',async t=>{
  for(const [name,mutate,match] of [
    ['release',state=>{state.release=OTHER;},/Release branch advanced/],
    ['main',state=>{state.main=OTHER;},/Unexpected main change/],
    ['approved tree',state=>{state.approvedTreeSha=OTHER;},/Approved tree changed/],
    ['controls',state=>{state.bootstrapTree.find(entry=>entry.path==='_release/publish.mjs').sha=OTHER;},/Publisher\/workflow changed/],
    ['bootstrap parent',state=>{state.bootstrapParents=[OTHER];},/Bootstrap parent changed/],
    ['bootstrap public content',state=>{state.bootstrapTree.find(entry=>entry.path==='menu.html').sha=OTHER;},/Bootstrap changed production content/]
  ])await t.test(name,async()=>{const f=fixture();mutate(f.state);await assert.rejects(f.run(),match);assert.deepEqual(f.writes(),[]);assert.deepEqual(f.healthCalls,[]);});
});

test('valid fixed-window publication explicitly fast-forwards main, requests Pages and verifies the exact SHA',async()=>{
  const f=fixture();f.state.buildResponses=[{commit:PLAN.previousProductionCommit,status:'built'},{commit:APPROVED,status:'queued'},{commit:APPROVED,status:'built'}];
  const result=await f.run();assert.equal(result.status,'VERIFIED');assert.equal(result.sha,APPROVED);assert.equal(result.pagesCommit,APPROVED);assert.equal(result.publicationWrites,2);
  assert.deepEqual(f.writes(),[{method:'PATCH',path:'git/refs/heads/main',body:{sha:APPROVED,force:false}},{method:'POST',path:'pages/builds'}]);
  assert.deepEqual(f.sleeps,[30000]);assert.equal(f.healthCalls.length,1);assert.equal(f.healthCalls[0].sha,APPROVED);
  assert.deepEqual(f.healthCalls[0].expected,Object.fromEntries(HEALTH_FILES.map(path=>[path,hash(source.get(path))])));
});

test('missing rollback tag is preserved at the approved prior production SHA before main advances',async()=>{
  const f=fixture({rollback:false});const result=await f.run();assert.equal(result.publicationWrites,3);assert.deepEqual(f.writes()[0],{method:'POST',path:'git/refs',body:{ref:'refs/tags/'+PLAN.rollbackTag,sha:PLAN.previousProductionCommit}});
});

test('completed retry verifies content without duplicate publication writes',async()=>{
  const f=fixture({main:APPROVED,latest:{commit:APPROVED,status:'built'}});const result=await f.run();assert.equal(result.status,'VERIFIED');assert.equal(result.publicationWrites,0);assert.deepEqual(f.writes(),[]);assert.equal(f.healthCalls.length,1);
});

test('queued retry waits for that exact Pages build without another POST',async()=>{
  const f=fixture({main:APPROVED,latest:{commit:APPROVED,status:'queued'}});f.state.buildResponses=[{commit:APPROVED,status:'queued'},{commit:APPROVED,status:'building'},{commit:APPROVED,status:'built'}];
  const result=await f.run();assert.equal(result.status,'VERIFIED');assert.deepEqual(f.writes(),[]);assert.deepEqual(f.sleeps,[30000]);
});

test('main moving after the fast-forward but just before the Pages POST stops the build request',async()=>{
  const f=fixture({onCall:({call,state})=>{if(call.path==='git/ref/heads/main'&&state.mainReads===4)state.main=OTHER;}});
  await assert.rejects(f.run(),/Main changed before Pages request/);assert.deepEqual(f.writes().map(call=>call.method+' '+call.path),['PATCH git/refs/heads/main']);assert.deepEqual(f.healthCalls,[]);
});

test('cancellation or lock-tag alteration before the main PATCH stops all publication writes',async t=>{
  for(const name of ['cancel','change'])await t.test(name,async()=>{
    const f=fixture({onCall:({call,state})=>{if(call.path==='git/ref/tags/'+PLAN.lockTag)state.lockTag=name==='cancel'?null:OTHER;}});
    await assert.rejects(f.run(),/Release cancelled or lock changed/);assert.deepEqual(f.writes(),[]);assert.deepEqual(f.healthCalls,[]);
  });
});

test('the release window and branch are checked again immediately before publication writes',async t=>{
  await t.test('window closes during inspection',async()=>{
    const f=fixture();let ticks=0;await assert.rejects(f.run({now:()=>++ticks===1?target:Date.parse(PLAN.latestStartUtc)}),/Fixed publication window closed/);assert.deepEqual(f.writes(),[]);
  });
  await t.test('candidate changes during inspection',async()=>{
    const f=fixture({onCall:({call,state})=>{if(call.path==='git/ref/tags/'+PLAN.lockTag)state.release=OTHER;}});await assert.rejects(f.run(),/Approved branch changed/);assert.deepEqual(f.writes(),[]);
  });
});

test('an unexpected Pages commit never counts as a successful publication',async()=>{
  const f=fixture({main:APPROVED,latest:{commit:APPROVED,status:'queued'}});f.state.buildResponses=[{commit:APPROVED,status:'queued'},...Array.from({length:24},()=>({commit:OTHER,status:'built'}))];
  await assert.rejects(f.run(),/Pages\/health verification timed out/);assert.deepEqual(f.writes(),[]);assert.equal(f.healthCalls.length,0);assert.equal(f.sleeps.length,24);
});

test('a correct Pages SHA with failing health never reports verified success',async()=>{
  const f=fixture({main:APPROVED,latest:{commit:APPROVED,status:'built'}});let attempts=0;
  await assert.rejects(f.run({health:async()=>{attempts++;throw Error('Observed health mismatch');}}),/Observed health mismatch/);
  assert.equal(attempts,24);assert.equal(f.sleeps.length,23);assert.deepEqual(f.writes(),[]);
});

test('Pages explicitly reporting an errored approved build fails without health success',async()=>{
  const f=fixture({main:APPROVED,latest:{commit:APPROVED,status:'queued'}});f.state.buildResponses=[{commit:APPROVED,status:'queued'},{commit:APPROVED,status:'errored'}];
  await assert.rejects(f.run(),/Pages build failed for approved commit/);assert.deepEqual(f.writes(),[]);assert.deepEqual(f.healthCalls,[]);
});

test('main or Pages changing during health verification cannot receive a verified result',async t=>{
  await t.test('main changed',async()=>{
    const f=fixture({main:APPROVED,latest:{commit:APPROVED,status:'built'}});await assert.rejects(f.run({health:async()=>{f.state.main=OTHER;}}),/Main changed during final health check/);assert.deepEqual(f.writes(),[]);
  });
  await t.test('Pages changed',async()=>{
    const f=fixture({main:APPROVED,latest:{commit:APPROVED,status:'built'}});await assert.rejects(f.run({health:async()=>{f.state.latest={commit:OTHER,status:'built'};}}),/Pages changed during final health check/);assert.deepEqual(f.writes(),[]);
  });
});

test('read-only dry run validates real artifact bytes only while both hosted locks are absent',async t=>{
  await t.test('disarmed',async()=>{
    const f=fixture({main:PLAN.previousProductionCommit});f.state.lockTag=null;
    const result=await dryRun(f.api,APPROVED);assert.equal(result.mode,'READ-ONLY DRY RUN');assert.equal(result.publicationWrites,0);assert.equal(result.verifiedFiles,HEALTH_FILES.length);assert.deepEqual(f.writes(),[]);
  });
  for(const name of ['tag present','variable armed'])await t.test(name,async()=>{
    const f=fixture({main:PLAN.previousProductionCommit});if(name==='variable armed')f.state.lockTag=null;
    await assert.rejects(dryRun(f.api,APPROVED,name==='variable armed'?f.lock:null),/requires the hosted release to be disarmed/);assert.deepEqual(f.writes(),[]);
  });
});

test('the GitHub read-only client refuses writes before invoking its HTTP transport',async()=>{
  const calls=[];const api=githubClient('LOCAL-ONLY-TEST-TOKEN',{fetcher:async(...args)=>{calls.push(args);return Response.json({ok:true});}});
  for(const method of ['POST','PATCH','PUT','DELETE'])await assert.rejects(api('pages/builds',{method}),/prohibits writes/);
  assert.deepEqual(calls,[]);assert.deepEqual(await api('pages'),{ok:true});assert.equal(calls.length,1);
});

test('artifact verification rejects a disabled website loader and private preview contamination',async()=>{
  await assert.rejects(validateArtifact(async path=>path===LOADER?source.get(REFERENCE):source.get(path)),/exactly the enabled production reference/);
  await assert.rejects(validateArtifact(async path=>source.get(path)+(path==='menu.html'?'\n<!-- data-nye-staging-notice -->':'')),/private export cannot be published/);
});

test('health verification rejects changed website bytes and incorrect live event times',async()=>{
  await assert.rejects(healthCheck({'index.html':hash('approved')},APPROVED,{fetcher:async()=>new Response('changed')}),/Published content mismatch/);
  await assert.rejects(healthCheck({},APPROVED,{fetcher:async()=>Response.json({mode:'live',phase:'before',event:{start:1798782600001,midnight:1798783200000,end:1798783500000}})}),/Production schedule mismatch/);
});

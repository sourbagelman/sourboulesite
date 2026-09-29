// Owner-operated final lock. This command is NOT run during preparation.
// Default --check is read-only; --arm requires the exact approved commit and
// explicit acknowledgement. Uses existing gh authorization, never a new PAT.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PLAN,snapshot,controls,controlPath,validateLock} from './publish.mjs';
import {validateArtifact} from './artifact.mjs';
const sha=value=>/^[a-f0-9]{40}$/.test(value||'');
export function parseArgs(args){
  assert(['--check','--arm'].includes(args[0]),'Use --check or --arm with exact approved and bootstrap SHAs');
  assert(sha(args[1])&&sha(args[2]),'Two full SHAs required: approved candidate, bootstrap');
  assert(args[0]==='--arm'?args.length===4&&args[3]==='--confirm-owner-approved':args.length===3,'Explicit owner approval required for --arm');
  return {arm:args[0]==='--arm',approvedCommit:args[1],bootstrapCommit:args[2]};
}
function ghApi(path,{method='GET',body}={}){
  const args=['api','repos/'+PLAN.repository+'/'+path,'--method',method];if(body)args.push('--input','-');
  const result=execFileSync('gh',args,{input:body?JSON.stringify(body):undefined,encoding:'utf8',stdio:['pipe','pipe','pipe']});return result.trim()?JSON.parse(result):null;
}
export async function prepareLock(api,approvedCommit,bootstrapCommit){
  assert(sha(approvedCommit)&&sha(bootstrapCommit),'Full SHAs required');
  const [candidate,bootstrap,previous]=await Promise.all([snapshot(api,approvedCommit),snapshot(api,bootstrapCommit),snapshot(api,PLAN.previousProductionCommit)]);
  assert.deepEqual(bootstrap.commit.parents.map(p=>p.sha),[PLAN.previousProductionCommit],'Bootstrap must directly descend from the unchanged production baseline');
  const publicTree=tree=>tree.filter(x=>x.type==='blob'&&!controlPath(x.path)).map(x=>[x.path,x.mode,x.sha]).sort((a,b)=>a[0].localeCompare(b[0]));
  assert.deepEqual(publicTree(previous.tree),publicTree(bootstrap.tree),'Bootstrap must not alter any production content');
  assert.deepEqual(controls(candidate.tree),controls(bootstrap.tree),'Candidate control files differ from bootstrap');
  const relation=await api('compare/'+bootstrapCommit+'...'+approvedCommit);assert(relation?.merge_base_commit?.sha===bootstrapCommit&&relation.behind_by===0,'Bootstrap must already be an ancestor of the approved candidate');
  await validateArtifact(candidate.read);
  assert.equal((await api('git/ref/heads/'+PLAN.branch))?.object?.sha,approvedCommit,'Remote release branch does not equal approved SHA');
  const main=(await api('git/ref/heads/main'))?.object?.sha;assert([PLAN.previousProductionCommit,bootstrapCommit].includes(main),'Production changed; do not overwrite it');
  const pages=await api('pages');assert(pages.build_type==='legacy'&&pages.source?.branch==='main'&&pages.source?.path==='/'&&pages.cname==='thesourboule.com','Hosting settings changed');
  const variables=await api('actions/variables?per_page=100');assert(!variables.variables.some(v=>v.name===PLAN.lockVariable),'A release lock already exists; inspect/cancel it explicitly');
  assert.equal((await api('git/matching-refs/tags/'+PLAN.lockTag)).length,0,'A cancellation/lock tag already exists; inspect it explicitly');
  const lock={id:PLAN.id,targetUtc:PLAN.targetUtc,armed:true,approvedCommit,approvedTree:candidate.commit.tree.sha,bootstrapCommit,previousProductionCommit:PLAN.previousProductionCommit};
  validateLock(lock);return {lock,main};
}
export async function armRelease(api,prepared,{now=()=>Date.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}){
  assert(now()<Date.parse(PLAN.targetUtc),'Too late to arm this dated release');
  // Repeat all checks against fresh remote state immediately before mutations.
  const {lock,main}=await prepareLock(api,prepared.lock.approvedCommit,prepared.lock.bootstrapCommit);
  assert.deepEqual(lock,prepared.lock,'Prepared lock changed');
  const backup=await api('git/matching-refs/tags/'+PLAN.rollbackTag);
  if(backup.length)assert(backup.length===1&&backup[0].ref==='refs/tags/'+PLAN.rollbackTag&&backup[0].object.sha===PLAN.previousProductionCommit,'Rollback reference collision');
  else await api('git/refs',{method:'POST',body:{ref:'refs/tags/'+PLAN.rollbackTag,sha:PLAN.previousProductionCommit}});
  if(main!==lock.bootstrapCommit)await api('git/refs/heads/main',{method:'PATCH',body:{sha:lock.bootstrapCommit,force:false}});
  assert.equal((await api('git/ref/heads/main'))?.object?.sha,lock.bootstrapCommit,'Bootstrap was not installed exactly');
  let workflow;
  for(let attempt=0;attempt<10;attempt++){workflow=(await api('actions/workflows?per_page=100')).workflows.find(w=>w.path===PLAN.workflow);if(workflow)break;await sleep(1000);}
  assert(workflow,'Scheduler not registered on default main; no release lock was armed');
  if(workflow.state!=='active')await api('actions/workflows/'+workflow.id+'/enable',{method:'PUT'});
  assert(now()<Date.parse(PLAN.targetUtc),'Target passed during setup; no release lock was armed');
  assert.equal((await api('git/ref/heads/'+PLAN.branch))?.object?.sha,lock.approvedCommit,'Candidate changed during arming');
  assert.equal((await api('git/ref/heads/main'))?.object?.sha,lock.bootstrapCommit,'Main changed during arming; no release lock was armed');
  await api('git/refs',{method:'POST',body:{ref:'refs/tags/'+PLAN.lockTag,sha:lock.approvedCommit}});
  // This variable is the actual arm switch; the checked-in plan stays disarmed.
  await api('actions/variables',{method:'POST',body:{name:PLAN.lockVariable,value:JSON.stringify(lock)}});
  return lock;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const options=parseArgs(process.argv.slice(2));
    const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
    assert.equal(git('rev-parse','HEAD'),options.approvedCommit,'Run from the exact approved candidate');
    assert.equal(git('status','--porcelain'),'','Commit all approved work first');
    const prepared=await prepareLock(ghApi,options.approvedCommit,options.bootstrapCommit);
    if(!options.arm)console.log(JSON.stringify({mode:'READ-ONLY ARMING CHECK',willInstallControlOnlyMainCommit:options.bootstrapCommit,proposedLock:prepared.lock,armed:false},null,2));
    else console.log(JSON.stringify({mode:'ARMED BY EXPLICIT OWNER APPROVAL',lock:await armRelease(ghApi,prepared)},null,2));
  }catch(error){console.error(error.message);process.exitCode=1;}
}

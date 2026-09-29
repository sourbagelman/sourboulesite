// Hosted release controller. A dry run has no write path. Publication requires
// the exact dated owner lock, unchanged refs, and the approved artifact/tree.
import assert from 'node:assert/strict';
import {readFile,appendFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateArtifact,hash} from './artifact.mjs';
export const PLAN=JSON.parse(await readFile(new URL('plan.json',import.meta.url),'utf8'));
const fullSha=value=>typeof value==='string'&&/^[0-9a-f]{40}$/.test(value);
export function validateLock(lock){
  assert(lock?.armed===true&&lock.id===PLAN.id&&lock.targetUtc===PLAN.targetUtc,'Release is disarmed or wrong dated lock');
  for(const key of ['approvedCommit','approvedTree','bootstrapCommit','previousProductionCommit'])assert(fullSha(lock[key]),'Missing exact '+key);
  assert.equal(lock.previousProductionCommit,PLAN.previousProductionCommit,'Rollback baseline changed');
  return lock;
}
export function inWindow(now){return now>=Date.parse(PLAN.targetUtc)&&now<Date.parse(PLAN.latestStartUtc);}
export const controlPath=path=>path===PLAN.workflow||path.startsWith('_release/');
export function controls(tree){return tree.filter(x=>controlPath(x.path)&&x.type==='blob').map(x=>[x.path,x.mode,x.sha]).sort((a,b)=>a[0].localeCompare(b[0]));}
export function githubClient(token,{fetcher=fetch,writes=false}={}){
  assert(token,'GitHub runner token or existing authorized CLI token required');
  return async(path,{method='GET',body}={})=>{
    assert(method==='GET'||writes,'Dry-run GitHub client prohibits writes');
    const r=await fetcher('https://api.github.com/repos/'+PLAN.repository+'/'+path,{method,headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
    if(r.status===404)return null;
    const data=await r.json();assert(r.ok,'GitHub '+method+' '+path+' failed ('+r.status+'): '+(data.message||''));return data;
  };
}
export async function snapshot(api,sha){
  const commit=await api('git/commits/'+sha);assert(commit?.sha===sha,'Commit not available');
  const data=await api('git/trees/'+commit.tree.sha+'?recursive=1');assert(!data.truncated,'Repository tree truncated');
  const files=new Map(data.tree.filter(x=>x.type==='blob').map(x=>[x.path,x]));const cache=new Map();
  async function read(path){assert(files.has(path),'Missing '+path);assert.equal(files.get(path).mode,'100644','Unexpected file mode: '+path);if(!cache.has(path)){const b=await api('git/blobs/'+files.get(path).sha);assert.equal(b.encoding,'base64');cache.set(path,Buffer.from(b.content.replace(/\s/g,''),'base64').toString('utf8'));}return cache.get(path);}
  return {commit,tree:data.tree,read};
}
async function hosting(api){const p=await api('pages');assert(p?.build_type==='legacy'&&p.source?.branch==='main'&&p.source?.path==='/'&&p.cname==='thesourboule.com','Unexpected Pages publishing configuration');return p;}
async function mainSha(api){return (await api('git/ref/heads/main'))?.object?.sha;}
async function lockTag(api){return (await api('git/ref/tags/'+PLAN.lockTag))?.object?.sha;}
export async function inspect(api,lock){
  validateLock(lock);await hosting(api);
  const release=(await api('git/ref/heads/'+PLAN.branch))?.object?.sha;assert.equal(release,lock.approvedCommit,'Release branch advanced after approval');
  const main=await mainSha(api);assert([lock.bootstrapCommit,lock.approvedCommit].includes(main),'Unexpected main change');
  const [approved,bootstrap]=await Promise.all([snapshot(api,lock.approvedCommit),snapshot(api,lock.bootstrapCommit)]);
  assert.equal(approved.commit.tree.sha,lock.approvedTree,'Approved tree changed');
  assert.deepEqual(controls(approved.tree),controls(bootstrap.tree),'Publisher/workflow changed after bootstrap');
  assert.deepEqual(bootstrap.commit.parents.map(p=>p.sha),[PLAN.previousProductionCommit],'Bootstrap parent changed');
  const previous=await snapshot(api,PLAN.previousProductionCommit);
  const publicTree=tree=>tree.filter(x=>x.type==='blob'&&!controlPath(x.path)).map(x=>[x.path,x.mode,x.sha]).sort((a,b)=>a[0].localeCompare(b[0]));
  assert.deepEqual(publicTree(bootstrap.tree),publicTree(previous.tree),'Bootstrap changed production content');
  const relation=await api('compare/'+lock.bootstrapCommit+'...'+lock.approvedCommit);assert(relation?.merge_base_commit?.sha===lock.bootstrapCommit&&relation.behind_by===0,'Candidate is not a fast-forward from bootstrap');
  const expected=await validateArtifact(approved.read);return {main,approved,expected};
}
export async function dryRun(api,sha,lock=null){
  assert(fullSha(sha),'Exact dry-run SHA required');await hosting(api);
  const artifact=await snapshot(api,sha);const expected=await validateArtifact(artifact.read);
  assert(!lock?.armed&&!await lockTag(api),'Preparation dry run requires the hosted release to be disarmed');
  const main=await mainSha(api);assert.equal(main,PLAN.previousProductionCommit,'Production moved; reconcile before arming');
  return {mode:'READ-ONLY DRY RUN',armed:false,sha,tree:artifact.commit.tree.sha,main,targetUtc:PLAN.targetUtc,verifiedFiles:Object.keys(expected).length,publicationWrites:0};
}
export async function healthCheck(expected,sha,{fetcher=fetch}={}){
  for(const [path,digest] of Object.entries(expected)){
    const url=PLAN.website+'/'+(path==='index.html'?'':path)+'?release='+sha;
    const r=await fetcher(url,{cache:'no-store',signal:AbortSignal.timeout(20000)});assert(r.ok,'Website health '+path+': '+r.status);assert.equal(hash(await r.text()),digest,'Published content mismatch: '+path);
  }
  const r=await fetcher(PLAN.service+'/api/time',{cache:'no-store',signal:AbortSignal.timeout(10000)});assert(r.ok,'Production promotion time unavailable');const time=await r.json();
  assert(time.mode==='live'&&time.phase==='before'&&time.event?.start===1798782600000&&time.event?.midnight===1798783200000&&time.event?.end===1798783500000,'Production schedule mismatch or premature takeover');
}
export async function publish({api,lock,now=()=>Date.now(),sleep=ms=>new Promise(r=>setTimeout(r,ms)),health=healthCheck}){
  if(!lock?.armed||!inWindow(now()))return {mode:'NO PUBLICATION',reason:'Disarmed or outside the fixed 2026 release window',publicationWrites:0};
  validateLock(lock);
  const state=await inspect(api,lock);const summary={mode:'PUBLICATION',sha:lock.approvedCommit,targetUtc:PLAN.targetUtc,publicationWrites:0};
  async function stillApproved(){assert(inWindow(now()),'Fixed publication window closed');assert.equal(await lockTag(api),lock.approvedCommit,'Release cancelled or lock changed');assert.equal((await api('git/ref/heads/'+PLAN.branch))?.object?.sha,lock.approvedCommit,'Approved branch changed');}
  const rollback=await api('git/ref/tags/'+PLAN.rollbackTag);
  if(rollback)assert.equal(rollback.object.sha,lock.previousProductionCommit,'Rollback tag mismatch');
  else{await stillApproved();await api('git/refs',{method:'POST',body:{ref:'refs/tags/'+PLAN.rollbackTag,sha:lock.previousProductionCommit}});summary.publicationWrites++;}
  if(state.main!==lock.approvedCommit){await stillApproved();assert.equal(await mainSha(api),lock.bootstrapCommit,'Main changed before publication');await api('git/refs/heads/main',{method:'PATCH',body:{sha:lock.approvedCommit,force:false}});summary.publicationWrites++;}
  assert.equal(await mainSha(api),lock.approvedCommit,'Main must equal approved commit before Pages request');
  let build=await api('pages/builds/latest');
  if(build?.commit!==lock.approvedCommit||!['built','queued','building'].includes(build.status)){
    await stillApproved();assert.equal(await mainSha(api),lock.approvedCommit,'Main changed before Pages request');
    await api('pages/builds',{method:'POST'});summary.publicationWrites++;
  }
  // Never claim publication from a ref update/201 alone. Observe Pages' exact SHA.
  for(let attempt=0;attempt<24;attempt++){
    assert.equal(await mainSha(api),lock.approvedCommit,'Main changed while verifying Pages');
    build=await api('pages/builds/latest');
    if(build?.commit===lock.approvedCommit&&build.status==='errored')throw Error('Pages build failed for approved commit');
    if(build?.commit===lock.approvedCommit&&build.status==='built'){
      try{await health(state.expected,lock.approvedCommit);}catch(error){if(attempt===23)throw error;await sleep(30000);continue;}
      assert.equal(await mainSha(api),lock.approvedCommit,'Main changed during final health check');
      const finalBuild=await api('pages/builds/latest');assert(finalBuild?.commit===lock.approvedCommit&&finalBuild.status==='built','Pages changed during final health check');
      return {...summary,status:'VERIFIED',pagesCommit:build.commit};
    }
    await sleep(30000);
  }
  throw Error('Pages/health verification timed out; inspect the Actions run. Rollback version remains preserved.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const mode=process.argv[2];assert(['--dry-run','--publish'].includes(mode),'Explicit --dry-run or --publish required');
    assert.equal(process.env.GITHUB_REPOSITORY,PLAN.repository,'Unexpected runner repository');
    const writing=mode==='--publish';
    if(writing)assert(['schedule','workflow_dispatch'].includes(process.env.GITHUB_EVENT_NAME)&&process.env.GITHUB_REF==='refs/heads/main','Publication only from default-main scheduler/manual retry');
    const api=githubClient(process.env.GH_TOKEN,{writes:writing});
    const lock=process.env.RELEASE_LOCK_JSON?JSON.parse(process.env.RELEASE_LOCK_JSON):null;
    const result=writing?await publish({api,lock}):await dryRun(api,process.env.GITHUB_SHA,lock);
    console.log(JSON.stringify(result,null,2));if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'## October website release\n\n```json\n'+JSON.stringify(result,null,2)+'\n```\n');
  }catch(error){console.error(error.message);if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,'## Release failed\n\n'+error.message+'\n\nNo success is implied. Check main and the Pages build SHA before retrying; use the documented rollback if needed.\n');process.exitCode=1;}
}

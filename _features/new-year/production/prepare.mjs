// Local preparation only. Never deploys, activates a loader, or writes site pages.
import {readFile,writeFile,mkdir,mkdtemp,lstat,realpath} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const feature=fileURLToPath(new URL('../',import.meta.url)),repo=resolve(feature,'../..');
export const PRODUCTION_FILES=Object.freeze(['index.html','staff/index.html','assets/guest.js','assets/view.js','assets/staff.js','assets/staff-ui.js','assets/nye.css']);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function once(source,anchor,replacement){if(source.split(anchor).length!==2)throw Error('Production asset source drift: '+anchor);return source.replace(anchor,()=>replacement);}
export function productionAsset(path,source){
  if(!PRODUCTION_FILES.includes(path))throw Error('Not a production public asset');
  if(path==='staff/index.html'){
    source=once(source,'href="/assets/nye.css"','href="/staff/assets/nye.css"');
    source=once(source,'src="/assets/staff.js"','src="/staff/assets/staff.js"');
  }else if(path==='assets/staff.js')source=once(source,"fetch('/api/staff/'+path","fetch('/staff/api/'+path");
  return source;
}
async function source(path){
  const full=resolve(feature,path),info=await lstat(full);
  if(!full.startsWith(feature)||!info.isFile()||info.isSymbolicLink()||await realpath(full)!==full)throw Error('Only regular current feature source files are allowed');
  return readFile(full,'utf8');
}
export async function prepareProduction(){
  const loader=await source('src/integration-loader.js');
  if(!loader.includes('const ENABLED=false;')||loader!==await readFile(resolve(repo,'assets/js/new-year-2027.js'),'utf8'))throw Error('Shipped loaders must remain identical and disabled during preparation');
  const config=JSON.parse(await source('production/wrangler.template.json'));
  if(config.vars.PRODUCTION_ENABLED!=='false'||config.routes||config.account_id)throw Error('Preparation must not configure release enablement, account or DNS routes');
  const files=[];
  for(const path of PRODUCTION_FILES){const input=await source('public/'+path);files.push({path,input,output:productionAsset(path,input)});}
  const local=resolve(feature,'.local');await mkdir(local,{recursive:true,mode:0o700});
  if((await lstat(local)).isSymbolicLink()||await realpath(local)!==local)throw Error('Local output directory cannot be a symlink');
  const output=await mkdtemp(resolve(local,'production-build-')),assets=resolve(output,'assets');
  for(const file of files){const target=resolve(assets,file.path);await mkdir(dirname(target),{recursive:true,mode:0o700});await writeFile(target,file.output,{flag:'wx',mode:0o600});}
  config.main=resolve(feature,'production/worker.mjs');config.assets.directory=assets;
  const wranglerPath=resolve(output,'wrangler.json');await writeFile(wranglerPath,JSON.stringify(config,null,2)+'\n',{flag:'wx',mode:0o600});
  await writeFile(resolve(output,'0001_initial.sql'),await source('migrations/0001_initial.sql'),{flag:'wx',mode:0o600});
  await writeFile(resolve(output,'0002_production_environment.sql'),await source('production/0002_production_environment.sql'),{flag:'wx',mode:0o600});
  const git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim();
  const manifest={kind:'october-production-preparation-NOT-RELEASED',sourceHead:git('rev-parse','HEAD'),branch:git('branch','--show-current'),workingTreeSources:true,
    productionVerified:false,productionEnabled:false,websiteLoaderEnabled:false,serviceOrigin:config.vars.PRODUCTION_SERVICE_ORIGIN,
    pending:['October release authorization','production account/resource and cost approval','production domain/DNS approval','fresh production D1 ID','production staff Access app/AUD and assignments','server-side PASS_SECRET','confirmed holiday hours','device/security/operational release checks'],
    websiteNote:'No website files copied or replaced. Reconcile newest approved October pages and preserve their disabled additive includes until release approval.',
    files:files.map(f=>({source:'public/'+f.path,asset:f.path,sourceSha256:sha(f.input),assetSha256:sha(f.output)}))};
  await writeFile(resolve(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
  return {outputDirectory:output,assetsDirectory:assets,wranglerPath,manifestPath:resolve(output,'manifest.json')};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==2)throw Error('Usage: node production/prepare.mjs (local preparation only)');
  console.log(JSON.stringify(await prepareProduction(),null,2));
  console.log('Prepared disabled production artifacts only. No deployment, DNS, database or website changes.');
}

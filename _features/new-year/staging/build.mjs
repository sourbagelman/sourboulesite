import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,mkdtemp,lstat,realpath} from 'node:fs/promises';
import {resolve,relative,dirname,extname,basename,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {STAGING_LABEL,stagingOrigin,transformServiceAsset,addStagingWebsiteBanner} from './client-transform.mjs';
const run=promisify(execFile);
const FEATURE_ROOT=fileURLToPath(new URL('../',import.meta.url));
const REPOSITORY_ROOT=resolve(FEATURE_ROOT,'../..');
const PUBLIC_EXTENSIONS=new Set(['.css','.js','.svg','.png','.jpg','.jpeg','.webp','.avif','.gif','.ico','.woff','.woff2','.ttf','.otf']);
export const WEBSITE_PAGES=Object.freeze(['index.html','brand-home.html','about.html','catering.html','contact.html','events.html','fort-worth.html','locations.html','menu.html','menus-order.html','willow-bend.html','willow-bend-menu.html']);
export const SERVICE_FILES=Object.freeze(['index.html','staff/index.html','assets/guest.js','assets/view.js','assets/staff.js','assets/staff-ui.js','assets/nye.css']);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
async function git(...args) {return (await run('git',args,{cwd:REPOSITORY_ROOT,maxBuffer:8*1024*1024})).stdout;}
function once(source,anchor,replacement,label) {
  if(source.split(anchor).length!==2)throw new Error('Staging loader source drift: '+label);
  return source.replace(anchor,replacement);
}
export function buildStagingLoader(source,{websiteOrigin,serviceOrigin}={}) {
  websiteOrigin=stagingOrigin(websiteOrigin);serviceOrigin=stagingOrigin(serviceOrigin);
  if(websiteOrigin===serviceOrigin)throw new Error('Staging website and service origins must differ');
  let out=once(source,'const ENABLED=false;','const ENABLED=true;','disabled production gate');
  out=once(out,"const SERVICE='https://celebrate.thesourboule.com';",'const SERVICE='+JSON.stringify(serviceOrigin)+';','service origin');
  out=once(out,"credentials:'omit'","credentials:'include'",'authenticated time request');
  out=once(out,"'use strict';","'use strict';\n  if(location.origin!=="+JSON.stringify(websiteOrigin)+')return;','exact website origin');
  out=once(out,"exit.textContent='Continue to the website';",'exit.textContent='+JSON.stringify(STAGING_LABEL+' · Continue to the website')+';','visible independent dialog label');
  out=once(out,"dialog.setAttribute('aria-label','The Sour Boule New Year celebration');",'dialog.setAttribute(\'aria-label\','+JSON.stringify(STAGING_LABEL+' · The Sour Boule New Year celebration')+');','accessible dialog label');
  return '/* PRIVATE STAGING ARTIFACT — never copy to the live website. */\n'+out;
}
async function readSource(file) {
  const info=await lstat(file);
  if(!info.isFile()||info.isSymbolicLink())throw new Error('Only regular repository source files may enter staging');
  const actual=await realpath(file),root=await realpath(REPOSITORY_ROOT);
  if(actual!==file||!actual.startsWith(root+sep))throw new Error('Staging source must remain inside the repository without symlinks');
  return readFile(file);
}
async function createOutput(requested) {
  const local=resolve(FEATURE_ROOT,'.local');
  await mkdir(local,{recursive:true,mode:0o700});
  if((await lstat(local)).isSymbolicLink()||await realpath(local)!==local)throw new Error('Staging build directory must not use symlinks');
  if(requested===undefined)return mkdtemp(resolve(local,'staging-build-'));
  if(typeof requested!=='string')throw new Error('outputDirectory must name a new staging build directory');
  const output=resolve(FEATURE_ROOT,requested);
  if(dirname(output)!==local||!/^staging-build-[a-zA-Z0-9_-]+$/.test(basename(output)))throw new Error('Output must be a new direct child .local/staging-build-NAME');
  // Do not remove or reuse existing directories: they may contain another run.
  await mkdir(output,{mode:0o700});
  return output;
}
export async function buildStaging(options={}) {
  for(const key of Object.keys(options))if(!['websiteOrigin','serviceOrigin','outputDirectory'].includes(key))throw new Error('Unexpected staging build option: '+key);
  const websiteOrigin=stagingOrigin(options.websiteOrigin),serviceOrigin=stagingOrigin(options.serviceOrigin);
  if(websiteOrigin===serviceOrigin)throw new Error('Staging website and service origins must differ');
  const config={websiteOrigin,serviceOrigin};
  const tracked=new Set((await git('ls-files','-z','--',...WEBSITE_PAGES,'assets','images')).split('\0').filter(Boolean));
  const sourceHead=(await git('rev-parse','HEAD')).trim();
  const sourceBranch=(await git('branch','--show-current')).trim();
  if(sourceBranch!=='feature/new-year-cookie-promotion')throw new Error('Build staging only from feature/new-year-cookie-promotion');
  const plan=[];
  const add=(path,input,output,source)=>plan.push({path,input,output:Buffer.isBuffer(output)?output:Buffer.from(output),source});
  for(const page of WEBSITE_PAGES) {
    if(!tracked.has(page))throw new Error('A required current website page is not tracked: '+page);
    const input=await readSource(resolve(REPOSITORY_ROOT,page));
    add('site/'+page,input,addStagingWebsiteBanner(input.toString('utf8'),config),page);
  }
  const currentLoader=await readSource(resolve(FEATURE_ROOT,'src/integration-loader.js'));
  const generatedLoader=await readSource(resolve(REPOSITORY_ROOT,'assets/js/new-year-2027.js'));
  if(!currentLoader.equals(generatedLoader))throw new Error('The disabled generated website loader must match its current source');
  const stagingLoader=buildStagingLoader(currentLoader.toString('utf8'),config);
  const skipped=[];
  for(const path of [...tracked].filter(path=>path.startsWith('assets/')||path.startsWith('images/')).sort()) {
    if(!PUBLIC_EXTENSIONS.has(extname(path).toLowerCase())||path.split('/').some(part=>part.startsWith('.'))) {skipped.push(path);continue;}
    const input=await readSource(resolve(REPOSITORY_ROOT,path));
    add('site/'+path,input,path==='assets/js/new-year-2027.js'?stagingLoader:input,path);
  }
  if(!plan.some(entry=>entry.path==='site/assets/js/new-year-2027.js'))throw new Error('The website loader must be a tracked public asset');
  for(const path of SERVICE_FILES) {
    const file=resolve(FEATURE_ROOT,'public',path),input=await readSource(file);
    add('service/'+path,input,transformServiceAsset(path,input.toString('utf8'),config),relative(REPOSITORY_ROOT,file).split(sep).join('/'));
  }
  // Validation/transforms finish before a new directory is allocated. Build output
  // never overwrites source pages, production assets, or a previous rehearsal.
  const outputDirectory=await createOutput(options.outputDirectory),assetsDirectory=resolve(outputDirectory,'assets');
  await mkdir(assetsDirectory,{mode:0o700});
  for(const entry of plan) {
    const destination=resolve(assetsDirectory,entry.path);await mkdir(dirname(destination),{recursive:true,mode:0o700});
    await writeFile(destination,entry.output,{flag:'wx',mode:0o600});
  }
  const manifest={format:1,kind:'private-staging-only',testLabel:STAGING_LABEL,sourceHead,sourceBranch,createdAt:new Date().toISOString(),
    websiteOrigin,serviceOrigin,productionLoaderEnabled:false,cloudDeployed:false,
    note:'Current working-tree inputs; this local artifact is not authorization to deploy. Business URLs/forms remain unchanged: do not submit real forms or place orders during QA.',
    files:plan.map(entry=>({source:entry.source,sourceSha256:sha(entry.input),asset:entry.path,assetSha256:sha(entry.output),bytes:entry.output.length})),excludedTrackedNonPublicAssets:skipped};
  const manifestPath=resolve(outputDirectory,'manifest.json');await writeFile(manifestPath,JSON.stringify(manifest,null,2)+'\n',{flag:'wx',mode:0o600});
  return {outputDirectory,assetsDirectory,manifestPath};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.length!==3) {
    process.stderr.write('Usage: node staging/build.mjs /absolute/path/to/nonsecret-staging-origins.json\n');process.exitCode=1;
  } else {
    try {const result=await buildStaging(JSON.parse(await readFile(resolve(process.argv[2]),'utf8')));process.stdout.write(JSON.stringify(result,null,2)+'\n');}
    catch(error) {process.stderr.write(error.message+'\n');process.exitCode=1;}
  }
}

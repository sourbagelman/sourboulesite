#!/usr/bin/env node
// Anonymous GET probes only. Supply approved staging URLs; no discovery or mutations.
import {pathToFileURL} from 'node:url';

const PRODUCTION_HOSTS=new Set(['thesourboule.com','www.thesourboule.com','celebrate.thesourboule.com']);
export const PROBE_PATHS=Object.freeze([
  '/','/index.html','/assets/js/new-year-2027.js','/assets/guest.js','/assets/nye.css',
  '/staff','/staff/','/staff/index.html','/staff/assets/staff.js','/staff/identity','/staff/api/me',
  '/api/time','/api/state','/api/staff','/api/staff/','/api/staff/me',
  '/api/staff/verify','/api/staff/redeem'
]);
const MAX_ALTERNATES=3;
const invalid=()=>new Error('Invalid staging privacy probe configuration');

function checkedUrl(value,{originOnly=false,issuer=false}={}) {
  let url;try{url=new URL(value);}catch{throw invalid();}
  const host=url.hostname.replace(/\.+$/,'').toLowerCase();
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.port||
    PRODUCTION_HOSTS.has(host)||(originOnly&&url.pathname!=='/'))throw invalid();
  if(issuer&&!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(url.origin))throw invalid();
  return url;
}

export function buildProbeTargets({site,service,issuer,alternates=[]}) {
  const siteUrl=checkedUrl(site,{originOnly:true}),serviceUrl=checkedUrl(service,{originOnly:true});
  const issuerUrl=checkedUrl(issuer,{originOnly:true,issuer:true});
  if(siteUrl.origin===serviceUrl.origin||!Array.isArray(alternates)||alternates.length>MAX_ALTERNATES)throw invalid();
  const targets=[siteUrl,serviceUrl].flatMap(origin=>PROBE_PATHS.map(path=>({url:new URL(path,origin).href,alternate:false})));
  const seen=new Set(targets.map(target=>target.url));
  for(const value of alternates){const parsed=checkedUrl(value),url=parsed.href;if(!seen.has(url)){targets.push({url,alternate:![siteUrl.origin,serviceUrl.origin].includes(parsed.origin)});seen.add(url);}}
  return {targets,issuer:issuerUrl.origin};
}

export function classifyResponse(response,target,issuer) {
  const status=Number.isInteger(response.status)?response.status:null;
  let location=null;
  try{const raw=response.headers?.get('location');if(raw)location=new URL(raw,target.url);}catch{}
  let verdict='inconclusive';
  if(status>=200&&status<300)verdict='public-response';
  else if(!response.redirected&&(status===401||status===403))verdict='denied';
  else if(!response.redirected&&status===404&&target.alternate)verdict='unrouted';
  else if(!response.redirected&&[301,302,303,307,308].includes(status)&&location?.origin===issuer&&
    !location.username&&!location.password&&/^\/cdn-cgi\/access\/login(?:\/|$)/.test(location.pathname))verdict='access-login';
  return {method:'GET',url:target.url,status,locationHost:location?.hostname||null,verdict};
}

export async function probePrivacy(configuration,{fetcher=globalThis.fetch,timeoutMs=5000,dryRun=false}={}) {
  const {targets,issuer}=buildProbeTargets(configuration);
  if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw invalid();
  const results=[];
  for(const target of targets){
    const empty={method:'GET',url:target.url,status:null,locationHost:null};
    if(dryRun||typeof fetcher!=='function'){results.push({...empty,verdict:'not-run'});continue;}
    try{
      const response=await fetcher(target.url,{method:'GET',credentials:'omit',redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(timeoutMs)});
      results.push(classifyResponse(response,target,issuer));
      // Classification never consumes or records response bodies, cookies or tokens.
      try{await response.body?.cancel();}catch{}
    }catch{results.push({...empty,verdict:'inconclusive'});}
  }
  return results;
}

export function probeExitCode(results) {
  if(results.some(row=>row.verdict==='public-response'))return 1;
  if(!results.length||results.some(row=>!['access-login','denied','unrouted'].includes(row.verdict)))return 2;
  return 0;
}

export function parseArguments(argv) {
  const configuration={alternates:[]},options={dryRun:false};
  for(let i=0;i<argv.length;i++){
    const flag=argv[i];
    if(flag==='--dry-run'){if(options.dryRun)throw invalid();options.dryRun=true;continue;}
    if(!['--site','--service','--issuer','--alternate'].includes(flag))throw invalid();
    const value=argv[++i];if(!value||value.startsWith('--'))throw invalid();
    const key=flag.slice(2);
    if(key==='alternate')configuration.alternates.push(value);
    else{if(configuration[key]!==undefined)throw invalid();configuration[key]=value;}
  }
  buildProbeTargets(configuration);
  return {configuration,options};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const {configuration,options}=parseArguments(process.argv.slice(2));
    const results=await probePrivacy(configuration,options);
    process.stdout.write(JSON.stringify(results,null,2)+'\n');
    process.exitCode=probeExitCode(results);
  }catch{
    process.stderr.write('Privacy probe not run: supply distinct approved HTTPS --site and --service origins, the trusted --issuer, and at most three query-free --alternate URLs. Production hosts are refused.\n');
    process.stdout.write('[]\n');process.exitCode=2;
  }
}

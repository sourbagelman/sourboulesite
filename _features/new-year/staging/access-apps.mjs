// Pure payload generation. This module never calls Cloudflare or changes DNS.
// Current schemas:
// https://github.com/cloudflare/cloudflare-python/blob/main/src/cloudflare/types/zero_trust/access/application_create_params.py
// https://github.com/cloudflare/cloudflare-python/blob/main/src/cloudflare/types/zero_trust/access/policy_create_params.py
// Cookie semantics:
// https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stagingOrigin,STAGING_LABEL} from './client-transform.mjs';

export const ACCESS_SESSION_DURATION='12h';
const allowedKeys=new Set(['websiteOrigin','serviceOrigin','pinIdentityProviderId','testerEmails','stationEmails']);
function emails(input,name) {
  if(!Array.isArray(input)||!input.length)throw Error('Explicit approved '+name+' required');
  const result=input.map(value=>{
    if(typeof value!=='string'||value!==value.trim()||!/^[A-Za-z0-9.!#$%&'+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+$/.test(value))throw Error('Invalid '+name);
    return value.toLowerCase();
  });
  if(new Set(result).size!==result.length)throw Error('Duplicate '+name);
  return result;
}
function policy(name,list) {
  return {name,decision:'allow',include:list.map(email=>({email:{email}})),exclude:[],require:[],
    session_duration:ACCESS_SESSION_DURATION};
}
export function accessApplications(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Explicit approved Access configuration required');
  for(const key of Object.keys(input))if(!allowedKeys.has(key))throw Error('Unexpected Access configuration field: '+key);
  const website=new URL(stagingOrigin(input.websiteOrigin)).hostname;
  const service=new URL(stagingOrigin(input.serviceOrigin)).hostname;
  if(website===service||website.split('.').length<3||website.split('.').slice(1).join('.')!==service.split('.').slice(1).join('.'))throw Error('Distinct sibling staging hosts required');
  if(typeof input.pinIdentityProviderId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(input.pinIdentityProviderId))throw Error('Verified PIN identity provider UUID required');
  const testers=emails(input.testerEmails,'tester emails'),stations=emails(input.stationEmails,'station emails');
  if(stations.length!==2||stations.some(email=>!testers.includes(email)))throw Error('Two distinct approved stations must also be testers');
  function application(name,domains,allowIframe) {
    return {type:'self_hosted',name,domain:domains[0],destinations:domains.map(uri=>({type:'public',uri})),
      session_duration:ACCESS_SESSION_DURATION,allowed_idps:[input.pinIdentityProviderId],
      auto_redirect_to_identity:true,allow_authenticate_via_warp:false,allow_iframe:allowIframe,
      app_launcher_visible:false,http_only_cookie_attribute:true,path_cookie_attribute:true,
      same_site_cookie_attribute:'lax',eager_redirect_cookie_setting:true,options_preflight_bypass:false,
      policies:[]};
  }
  // Create the two independent reusable policies, then attach only their own IDs
  // through withAccessPolicy(). Keep the origins unrouted until read-back confirms
  // both applications and policies. More-specific staff paths replace root policy.
  return {
    tester:{application:application('Sour Boule NYE testers — '+STAGING_LABEL,[website,service],true),
      policy:policy('Approved staging testers — '+STAGING_LABEL,testers)},
    staff:{application:application('Sour Boule NYE stations — '+STAGING_LABEL,
      ['/staff','/staff/*','/api/staff','/api/staff/*'].map(path=>service+path),false),
      policy:policy('Approved staging stations — '+STAGING_LABEL,stations)}
  };
}
export function withAccessPolicy(application,policyId) {
  if(typeof policyId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(policyId))throw Error('Created Access policy UUID required');
  if(application?.type!=='self_hosted'||!Array.isArray(application.policies)||application.policies.length)throw Error('Expected generated application with no attached policy');
  return {...structuredClone(application),policies:[{id:policyId,precedence:1}]};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  if(process.argv.length!==3)throw Error('Usage: node staging/access-apps.mjs .local/approved-access.json');
  console.log(JSON.stringify(accessApplications(JSON.parse(await readFile(process.argv[2],'utf8'))),null,2));
}

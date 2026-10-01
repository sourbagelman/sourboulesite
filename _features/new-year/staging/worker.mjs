// PRIVATE STAGING ENTRYPOINT ONLY. Production continues to use src/worker.mjs.
import {createApp} from '../src/worker.mjs';
import {stagingClock} from './clock.mjs';
import {authorizeTester,authorizeStation,isStaffPath,testerEmails} from './auth.mjs';
export const TEST_LABEL='TEST ONLY — NOT REDEEMABLE';
const privacy={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow, noarchive','X-Sour-Boule-Environment':'private-staging','Vary':'Origin, Cookie'};
function failure(status,message) {
  return Response.json({error:message,mode:'staging',testLabel:TEST_LABEL},{status,headers:{...privacy,'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}});
}
function approvedOrigin(value) {
  const url=new URL(value);
  if(url.protocol!=='https:'||url.origin!==value||url.username||url.password||url.port||url.hostname.endsWith('.')||url.hostname==='workers.dev'||url.hostname.endsWith('.workers.dev')||url.hostname.includes('*')||['thesourboule.com','www.thesourboule.com','celebrate.thesourboule.com'].includes(url.hostname))throw new Error('Only approved isolated HTTPS staging origins are allowed');
  return url.origin;
}
function settings(env) {
  if(env.STAGING_ENABLED!=='true')throw new Error('Private staging is disabled');
  const site=approvedOrigin(env.STAGING_SITE_ORIGIN),service=approvedOrigin(env.STAGING_SERVICE_ORIGIN);
  if(site===service)throw new Error('The integration rehearsal requires separate site/service origins');
  if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.STAGING_ACCESS_ISSUER||''))throw new Error('Access issuer is required');
  for(const name of ['STAGING_SITE_AUD','STAGING_SERVICE_AUD','STAGING_STAFF_AUD'])if(typeof env[name]!=='string'||!env[name]||/REPLACE|PLACEHOLDER/i.test(env[name]))throw new Error('Access application audience is required');
  if(env.STAGING_STAFF_AUD===env.STAGING_SITE_AUD||env.STAGING_STAFF_AUD===env.STAGING_SERVICE_AUD)throw new Error('Staff must have a separate Access audience');
  testerEmails(env.STAGING_TESTER_EMAILS);
  if(!env.DB||!env.ASSETS||typeof env.PASS_SECRET!=='string'||env.PASS_SECRET.length<32)throw new Error('Isolated bindings and secret are required');
  if(typeof env.STAGING_ENVIRONMENT_ID!=='string'||!/^[-a-zA-Z0-9_]{8,80}$/.test(env.STAGING_ENVIRONMENT_ID)||/REPLACE|PLACEHOLDER/i.test(env.STAGING_ENVIRONMENT_ID))throw new Error('Staging database identity is required');
  return {site,service};
}
function canonicalPath(value) {
  const path=decodeURIComponent(value);
  if(path.includes('%')||path.includes('\\')||path.includes('\0')||path.includes('//')||path.split('/').some(part=>part==='.'||part==='..'))throw new Error('Invalid asset path');
  return path;
}
function assetRequest(request,prefix,path) {
  const url=new URL(request.url);
  if(path.endsWith('/'))path+='index.html';
  else if(path==='/staff')path='/staff/index.html';
  if(prefix==='service'&&path.startsWith('/staff/assets/'))path='/assets/'+path.slice('/staff/assets/'.length);
  url.pathname='/'+prefix+path;
  return new Request(url,request);
}
function headersFor(response) {const headers=new Headers(response.headers);for(const [name,value] of Object.entries(privacy))headers.set(name,value);return headers;}
async function serviceResponse(response,path,origin,site) {
  const headers=headersFor(response);
  headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors "+site+"; worker-src 'none'");
  if(path==='/api/time'&&origin===site) {
    headers.set('Access-Control-Allow-Origin',site);headers.set('Access-Control-Allow-Credentials','true');
  } else {headers.delete('Access-Control-Allow-Origin');headers.delete('Access-Control-Allow-Credentials');}
  if((headers.get('Content-Type')||'').includes('application/json')) {
    const data=await response.json();data.mode='staging';data.testLabel=TEST_LABEL;
    if(data.pass){data.pass.simulated=true;data.pass.testLabel=TEST_LABEL;}
    headers.delete('Content-Length');headers.delete('Content-Encoding');
    return Response.json(data,{status:response.status,headers});
  }
  return new Response(response.body,{status:response.status,headers});
}
export function createStagingApp({wallClock=()=>Date.now(),fetcher=fetch}={}) {
  return {async fetch(request,env) {
    let config,clock,path;
    try {config=settings(env);clock=stagingClock(env,wallClock);path=canonicalPath(new URL(request.url).pathname);}
    catch {return failure(503,'Private staging configuration is incomplete');}
    const url=new URL(request.url);
    if(url.protocol!=='https:'||![config.site,config.service].includes(url.origin))return failure(404,'Unknown staging host');
    const siteRequest=url.origin===config.site,staff=!siteRequest&&isStaffPath(path);
    const audience=staff?env.STAGING_STAFF_AUD:siteRequest?env.STAGING_SITE_AUD:env.STAGING_SERVICE_AUD;
    let tester;
    try {tester=await authorizeTester(request,env,audience,wallClock(),fetcher);}
    catch {return failure(401,'Private staging sign-in required or tester not approved');}
    try {
      // A production/other-project database lacks this staging-only marker.
      const marker=await env.DB.prepare('SELECT identifier FROM staging_environment WHERE id=1').first();
      if(marker?.identifier!==env.STAGING_ENVIRONMENT_ID)throw new Error('Wrong database');
    } catch {return failure(503,'Isolated staging database identity could not be verified');}
    // Read-only setup introspection: discover this approved sign-in's verified
    // Access subject before a manager provisions its fixed station row. This
    // does not grant staff operations, return credentials or change assignments.
    if(!siteRequest&&path==='/staff/identity') {
      if(request.method!=='GET')return failure(405,'GET required');
      return Response.json({sub:tester.sub,email:tester.email.toLowerCase(),mode:'staging',testLabel:TEST_LABEL},
        {headers:{...privacy,'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}});
    }
    // Stored asset namespaces are internal; never expose alternate request paths.
    if(path==='/site'||path.startsWith('/site/')||path==='/service'||path.startsWith('/service/'))return failure(404,'Unknown staging asset path');
    if(!siteRequest&&['/assets/staff.js','/assets/staff-ui.js'].includes(path))return failure(404,'Use the protected staff asset path');
    if(siteRequest) {
      if(path.startsWith('/api/')||isStaffPath(path))return failure(404,'Use the protected staging service');
      const visualPreview=path==='/new-year-preview'||path.startsWith('/new-year-preview/');
      if(visualPreview&&!['GET','HEAD'].includes(request.method))return failure(405,'Visual preview is read-only');
      if(path==='/new-year-preview')return new Response(null,{status:302,headers:{...privacy,Location:config.site+'/new-year-preview/'}});
      try {
        const response=await env.ASSETS.fetch(assetRequest(request,'site',path));
        const headers=headersFor(response);
        // Response-only rehearsal guard: keep existing fonts/layout, but block
        // production telemetry, form submission and unrelated network writes.
        headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self' "+config.service+"; frame-src "+config.service+"; form-action 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; worker-src 'none'");
        // The existing visual simulator has no API adapter. Block all network
        // connections and form/iframe submission as an additional boundary.
        if(visualPreview)headers.set('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'none'; frame-src 'none'; form-action 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; worker-src 'none'");
        return new Response(response.body,{status:response.status,headers});
      } catch {return failure(503,'Private staging website unavailable');}
    }
    if(path.startsWith('/__lab')||path.startsWith('/__test'))return failure(404,'No browser-accessible staging controls');
    if(staff) {
      try {await authorizeStation(request,env,wallClock(),fetcher);}
      catch {return failure(403,'Approved location station required');}
    }
    // The real Access clock is intentionally separate from the event clock.
    // lab:false preserves production Secure/HttpOnly/host-only cookie settings.
    const app=createApp({clock,staffAuth:(staffRequest)=>authorizeStation(staffRequest,env,wallClock(),fetcher)});
    const appEnv={...env,WEBSITE_ORIGINS:config.site,ASSETS:{async fetch(asset){
      try{return await env.ASSETS.fetch(assetRequest(asset,'service',path));}
      catch {throw Object.assign(new Error('Private staging service unavailable'),{status:503});}
    }}};
    const canonical=new URL(request.url);
    // Staff browser traffic stays under the staff Access cookie path. Authorize
    // that original request first, then call the unchanged business API route.
    canonical.pathname=path.startsWith('/staff/api/')?'/api/staff/'+path.slice('/staff/api/'.length):path;
    try {
      const response=await app.fetch(new Request(canonical,request),appEnv);
      return await serviceResponse(response,path,request.headers.get('Origin'),config.site);
    } catch {return failure(503,'Private staging service unavailable');}
  }};
}
export default createStagingApp();

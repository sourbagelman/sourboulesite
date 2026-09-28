// Production boundary only. The approved business logic uses its real server
// clock and Access verifier without simulation or tester-allowlist adapters.
import {createApp} from '../src/worker.mjs';
import {verifyAccess} from '../src/auth.mjs';

export const SERVICE_ORIGIN='https://celebrate.thesourboule.com';
export const WEBSITE_ORIGINS=['https://thesourboule.com','https://www.thesourboule.com'];
export const DATABASE_IDENTIFIER='sb-nye-2027-production';
const app=createApp();
const publicAssets=new Map([
  ['/','/index.html'],['/index.html','/index.html'],
  ['/assets/guest.js','/assets/guest.js'],['/assets/view.js','/assets/view.js'],['/assets/nye.css','/assets/nye.css']
]);
const staffAssets=new Map([
  ['/staff','/staff/index.html'],['/staff/','/staff/index.html'],['/staff/index.html','/staff/index.html'],
  ['/staff/assets/staff.js','/assets/staff.js'],['/staff/assets/staff-ui.js','/assets/staff-ui.js'],['/staff/assets/nye.css','/assets/nye.css']
]);
const guestApis=new Set(['/api/time','/api/session','/api/state','/api/register','/api/presence','/api/claim']);
const staffApis=new Set(['/api/staff/me','/api/staff/verify','/api/staff/redeem']);
const safe={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow','Vary':'Origin'};
function failure(status,error) {
  return Response.json({error},{status,headers:{...safe,'Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}});
}
function configured(env) {
  const origins=typeof env.WEBSITE_ORIGINS==='string'?env.WEBSITE_ORIGINS.split(',').map(value=>value.trim()):[];
  return env.PRODUCTION_ENABLED==='true'&&env.PRODUCTION_SERVICE_ORIGIN===SERVICE_ORIGIN
    &&origins.length===2&&new Set(origins).size===2&&origins.every(value=>WEBSITE_ORIGINS.includes(value))
    &&/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER||'')
    &&typeof env.ACCESS_AUD==='string'&&/^[a-f0-9]{64}$/.test(env.ACCESS_AUD)
    &&env.DB&&env.ASSETS&&typeof env.PASS_SECRET==='string'&&env.PASS_SECRET.length>=32;
}
function canonicalPath(value) {
  const path=decodeURIComponent(value);
  if(path.includes('%')||path.includes('\\')||path.includes('\0')||path.includes('//')||path.split('/').some(part=>part==='.'||part==='..'))throw new Error('Invalid path');
  return path;
}
export function createProductionApp() {
  return {async fetch(request,env) {
    if(!configured(env))return failure(503,'Production promotion configuration is incomplete');
    const url=new URL(request.url);
    if(url.origin!==SERVICE_ORIGIN)return failure(404,'Unknown promotion host');
    let path;
    try {path=canonicalPath(url.pathname);}catch {return failure(404,'Not found');}
    const apiPath=path.startsWith('/staff/api/')?'/api/staff/'+path.slice('/staff/api/'.length):path;
    const staff=staffAssets.has(path)||staffApis.has(apiPath);
    const assetPath=publicAssets.get(path)||staffAssets.get(path);
    if(!assetPath&&!guestApis.has(apiPath)&&!staffApis.has(apiPath))return failure(404,'Not found');
    if(assetPath&&!['GET','HEAD'].includes(request.method))return failure(405,'GET or HEAD required');
    try {
      // This read-only marker is installed only in a fresh production database.
      // A staging database never becomes production merely by changing a binding.
      const marker=await env.DB.prepare('SELECT identifier FROM production_environment WHERE id=1').first();
      if(marker?.identifier!==DATABASE_IDENTIFIER)throw new Error('Wrong database');
    } catch {return failure(503,'Production database identity could not be verified');}
    if(staff) {
      let identity;
      try {identity=await verifyAccess(request,env,Date.now());}
      catch {return failure(401,'Staff sign-in required or access unavailable');}
      try {
        const assignments=await env.DB.prepare('SELECT location FROM staff_locations WHERE subject=?').bind(identity.subject).all();
        if(assignments.results.length!==1)return failure(403,'Ask a manager to assign this staff phone to exactly one location');
      } catch {return failure(503,'Staff station unavailable');}
    }
    // Staff requests retain the Access-protected browser namespace; the approved
    // backend receives its original API path only after normal authentication.
    url.pathname=apiPath;
    const appEnv={...env,WEBSITE_ORIGINS:WEBSITE_ORIGINS.join(','),ASSETS:{fetch:async asset=>{
      const target=new URL(asset.url);target.pathname=assetPath;
      return env.ASSETS.fetch(new Request(target,asset));
    }}};
    try {
      const response=await app.fetch(new Request(url,request),appEnv);
      const headers=new Headers(response.headers);
      for(const [name,value] of Object.entries(safe))headers.set(name,value);
      if(staff)headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; worker-src 'none'");
      return new Response(response.body,{status:response.status,headers});
    } catch {return failure(503,'Promotion service unavailable');}
  }};
}
export default createProductionApp();

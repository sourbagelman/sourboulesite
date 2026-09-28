// Real Access JWT verification is shared; staging never substitutes a staff token.
import {verifyAccessToken,verifyAccess} from '../src/auth.mjs';
export function testerEmails(value) {
  if(typeof value!=='string'||!value.trim())throw new Error('An explicit tester allowlist is required');
  const emails=value.split(',').map(email=>email.trim().toLowerCase());
  if(emails.some(email=>!email||email.includes('*')||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)))throw new Error('Invalid tester allowlist');
  return new Set(emails);
}
export function isStaffPath(path) {return path==='/staff'||path.startsWith('/staff/')||path==='/api/staff'||path.startsWith('/api/staff/');}
export function accessEnvironment(env,audience) {return {...env,ACCESS_ISSUER:env.STAGING_ACCESS_ISSUER,ACCESS_AUD:audience};}
export async function authorizeTester(request,env,audience,realNow,fetcher=fetch) {
  const claims=await verifyAccessToken(request,accessEnvironment(env,audience),realNow,fetcher);
  if(!testerEmails(env.STAGING_TESTER_EMAILS).has(claims.email.toLowerCase()))throw new Error('Tester is not approved');
  return claims;
}
export async function authorizeStation(request,env,realNow,fetcher=fetch) {
  // Reverify the staff application's audience and current tester membership,
  // then independently require the approved active subject/email in D1.
  await authorizeTester(request,env,env.STAGING_STAFF_AUD,realNow,fetcher);
  const staff=await verifyAccess(request,accessEnvironment(env,env.STAGING_STAFF_AUD),realNow,fetcher);
  const assignments=await env.DB.prepare('SELECT location FROM staff_locations WHERE subject=?').bind(staff.subject).all();
  if(assignments.results.length!==1)throw new Error('Station must have exactly one assigned location');
  return staff;
}

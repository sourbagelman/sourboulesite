// STAGING ONLY. This module is not imported by the production Worker.
// A trusted deployment configuration maps real elapsed time 1:1 to event time.
// There are no clock-control routes, request headers, query options or speedups.
import {EVENT} from '../src/config.mjs';
function instant(value,name) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value))throw new Error(name+' must be an explicit UTC instant');
  const parsed=Date.parse(value);
  const canonical=value.length===20?value.replace('Z','.000Z'):value;
  if(!Number.isSafeInteger(parsed)||new Date(parsed).toISOString()!==canonical)throw new Error(name+' is invalid');
  return parsed;
}
export function stagingClock(env,wallClock=()=>Date.now()) {
  const real=instant(env.STAGING_REAL_ANCHOR_UTC,'STAGING_REAL_ANCHOR_UTC');
  const event=instant(env.STAGING_EVENT_ANCHOR_UTC,'STAGING_EVENT_ANCHOR_UTC');
  if(event<EVENT.start-86400000||event>EVENT.sessionExpires)throw new Error('Staging event anchor is outside the rehearsal campaign');
  return ()=>{
    const current=wallClock();
    if(!Number.isSafeInteger(current))throw new Error('Invalid server clock');
    return event+current-real;
  };
}

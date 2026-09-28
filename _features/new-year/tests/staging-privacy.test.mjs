import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {PROBE_PATHS,buildProbeTargets,classifyResponse,probePrivacy,probeExitCode,parseArguments} from '../staging/probe-privacy.mjs';

const config={site:'https://site-stage.example.test',service:'https://service-stage.example.test',issuer:'https://approved-test-team.cloudflareaccess.com'};
const first={url:config.site+'/',alternate:false};
const response=(status,location)=>new Response(null,{status,headers:location?{location}:undefined});

test('privacy probe plans exactly 36 explicit page, asset, API and staff-slash requests',()=>{
  const {targets,issuer}=buildProbeTargets(config);
  assert.equal(targets.length,36);assert.equal(PROBE_PATHS.length,18);assert.equal(issuer,config.issuer);
  for(const origin of [config.site,config.service])for(const path of PROBE_PATHS)assert.ok(targets.some(target=>target.url===origin+path&&!target.alternate));
  assert.equal(new Set(targets.map(target=>target.url)).size,36);
});
test('privacy probe explicitly protects identity discovery and the cookie-scoped staff API on both hosts',async()=>{
  for(const path of ['/staff/identity','/staff/api/me'])for(const origin of [config.site,config.service]) {
    const leaked=origin+path,calls=[];
    const rows=await probePrivacy(config,{fetcher:async(url)=>{
      calls.push(url);
      return url===leaked?response(200):response(302,config.issuer+'/cdn-cgi/access/login/stage');
    }});
    assert.equal(calls.filter(url=>url===leaked).length,1);
    assert.equal(rows.find(row=>row.url===leaked).verdict,'public-response');
    assert.equal(probeExitCode(rows),1);
  }
});
test('privacy probe includes only supplied alternates and caps the total below 40',()=>{
  const alternates=Array.from({length:3},(_,i)=>`https://observed-${i}.example.test/`);
  const {targets}=buildProbeTargets({...config,alternates});
  assert.equal(targets.length,39);assert.deepEqual(targets.filter(target=>target.alternate).map(target=>target.url),alternates);
  assert.equal(buildProbeTargets({...config,alternates:[config.site+'/']}).targets.length,36);
  const sameHost=buildProbeTargets({...config,alternates:[config.site+'/another-path']}).targets.at(-1);
  assert.equal(sameHost.alternate,false);assert.equal(classifyResponse(response(404),sameHost,config.issuer).verdict,'inconclusive');
  assert.throws(()=>buildProbeTargets({...config,alternates:[...alternates,'https://extra.example.test/']}));
});
test('privacy probe rejects production hosts including canonicalization variants',()=>{
  for(const host of ['thesourboule.com','www.thesourboule.com','celebrate.thesourboule.com','THESOURBOULE.COM','thesourboule.com.']){
    for(const key of ['site','service'])assert.throws(()=>buildProbeTargets({...config,[key]:'https://'+host}));
    assert.throws(()=>buildProbeTargets({...config,alternates:['https://'+host+'/api/time']}));
  }
});
test('privacy probe rejects credentials, queries, fragments, non-HTTPS and ambiguous origins',()=>{
  for(const value of ['http://stage.example.test','https://name:secret@stage.example.test','https://stage.example.test/?token=secret','https://stage.example.test/#secret','https://stage.example.test/path','https://stage.example.test:8443','not a URL'])assert.throws(()=>buildProbeTargets({...config,site:value}));
  assert.throws(()=>buildProbeTargets({...config,service:config.site}));
  for(const issuer of ['https://untrusted.example.test','https://team.cloudflareaccess.com.evil.test','https://team.cloudflareaccess.com/path'])assert.throws(()=>buildProbeTargets({...config,issuer}));
  assert.throws(()=>buildProbeTargets({...config,alternates:['https://observed.example.test/?token=secret']}));
});
test('privacy probe recognizes only a login redirect at the pinned Access issuer and path',()=>{
  for(const status of [301,302,303,307,308])assert.equal(classifyResponse(response(status,config.issuer+'/cdn-cgi/access/login/site-stage.example.test?kid=secret'),first,config.issuer).verdict,'access-login');
  for(const location of ['https://other.cloudflareaccess.com/cdn-cgi/access/login/',config.issuer+'/unrelated',config.issuer+'/cdn-cgi/access/login-spoof','/cdn-cgi/access/login/',config.issuer.replace('https:','http:')+'/cdn-cgi/access/login/'])assert.equal(classifyResponse(response(302,location),first,config.issuer).verdict,'inconclusive');
});
test('privacy probe distinguishes authentication denial from an unrouted alternate',()=>{
  for(const status of [401,403])assert.equal(classifyResponse(response(status),first,config.issuer).verdict,'denied');
  assert.equal(classifyResponse(response(404),first,config.issuer).verdict,'inconclusive');
  assert.equal(classifyResponse(response(404),{...first,alternate:true},config.issuer).verdict,'unrouted');
  for(const status of [400,405,429,500,502,503])assert.equal(classifyResponse(response(status),first,config.issuer).verdict,'inconclusive');
});
test('privacy probe fails every successful response even when content says TEST ONLY',async()=>{
  for(const status of [200,204,206])assert.equal(classifyResponse(response(status),first,config.issuer).verdict,'public-response');
  const results=await probePrivacy(config,{fetcher:async()=>new Response('TEST ONLY — NOT REDEEMABLE',{status:200})});
  assert.ok(results.every(row=>row.verdict==='public-response'));assert.equal(probeExitCode(results),1);
});
test('privacy probe always uses anonymous GET without following redirects or setting authentication',async()=>{
  const calls=[];
  const results=await probePrivacy(config,{fetcher:async(url,options)=>{calls.push({url,options});return response(302,config.issuer+'/cdn-cgi/access/login/stage');}});
  assert.equal(calls.length,36);assert.equal(probeExitCode(results),0);
  for(const {url,options} of calls){assert.ok(url.startsWith(config.site+'/')||url.startsWith(config.service+'/'));assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'manual');assert.equal(options.cache,'no-store');assert.equal(options.headers,undefined);assert.equal(options.body,undefined);assert.ok(options.signal instanceof AbortSignal);}
});
test('privacy probe sanitizes reports and does not consume or expose bodies, cookies or redirect tokens',async()=>{
  let canceled=0;
  const results=await probePrivacy(config,{fetcher:async()=>({status:302,redirected:false,headers:new Headers({location:config.issuer+'/cdn-cgi/access/login/?token=SECRET_JWT','set-cookie':'SECRET_COOKIE'}),body:{cancel:async()=>{canceled++;}},text(){throw Error('Body must not be read');}})});
  assert.equal(canceled,36);
  for(const row of results){assert.deepEqual(Object.keys(row),['method','url','status','locationHost','verdict']);assert.equal(row.locationHost,'approved-test-team.cloudflareaccess.com');}
  assert.doesNotMatch(JSON.stringify(results),/SECRET_|set-cookie|token=/);
});
test('privacy probe treats network errors as inconclusive without logging error contents',async()=>{
  const results=await probePrivacy(config,{fetcher:async()=>{throw Error('SECRET_COOKIE SECRET_JWT');}});
  assert.equal(results.length,36);assert.ok(results.every(row=>row.status===null&&row.locationHost===null&&row.verdict==='inconclusive'));
  assert.equal(probeExitCode(results),2);assert.doesNotMatch(JSON.stringify(results),/SECRET_/);
});
test('privacy probe dry-run makes no requests and cannot produce a passing result',async()=>{
  let calls=0;const results=await probePrivacy(config,{dryRun:true,fetcher:async()=>{calls++;throw Error('Must not fetch');}});
  assert.equal(calls,0);assert.ok(results.every(row=>row.verdict==='not-run'));assert.equal(probeExitCode(results),2);assert.equal(probeExitCode([]),2);
});
test('privacy probe does not accept a response already followed by an injected transport',()=>{
  const result=classifyResponse({status:403,redirected:true,headers:new Headers()},first,config.issuer);
  assert.equal(result.verdict,'inconclusive');
});
test('privacy probe argument parsing is explicit and refuses missing, duplicate or unknown flags',()=>{
  const parsed=parseArguments(['--site',config.site,'--service',config.service,'--issuer',config.issuer,'--alternate','https://observed.example.test/','--dry-run']);
  assert.deepEqual(parsed,{configuration:{...config,alternates:['https://observed.example.test/']},options:{dryRun:true}});
  const base=['--site',config.site,'--service',config.service,'--issuer',config.issuer];
  for(const extra of [['--unknown','anything'],['--site',config.site],['--alternate'],['--dry-run','--dry-run']])assert.throws(()=>parseArguments([...base,...extra]));
  assert.throws(()=>parseArguments([]));
});
test('privacy probe CLI dry-run emits only sanitized not-run records and exits inconclusive',()=>{
  const cli=fileURLToPath(new URL('../staging/probe-privacy.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[cli,'--site',config.site,'--service',config.service,'--issuer',config.issuer,'--dry-run'],{encoding:'utf8'});
  assert.equal(result.status,2);assert.equal(result.stderr,'');
  const rows=JSON.parse(result.stdout);assert.equal(rows.length,36);assert.ok(rows.every(row=>row.verdict==='not-run'));
});
test('privacy probe CLI rejects secret-bearing inputs without echoing their values',()=>{
  const cli=fileURLToPath(new URL('../staging/probe-privacy.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[cli,'--site',config.site+'/?token=SECRET_VALUE','--service',config.service,'--issuer',config.issuer],{encoding:'utf8'});
  assert.equal(result.status,2);assert.deepEqual(JSON.parse(result.stdout),[]);assert.match(result.stderr,/not run/);assert.doesNotMatch(result.stderr+result.stdout,/SECRET_VALUE/);
});

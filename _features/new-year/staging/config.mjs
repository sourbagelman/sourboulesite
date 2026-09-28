// Generates local artifacts only. It does not create resources or change DNS.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {stagingOrigin} from './client-transform.mjs';
import {stagingClock} from './clock.mjs';
import {testerEmails} from './auth.mjs';
import {EVENT} from '../src/config.mjs';

const feature=fileURLToPath(new URL('../',import.meta.url));
const required=['accountId','databaseId','environmentId','websiteOrigin','serviceOrigin','accessIssuer','testerAudience','staffAudience','testerEmails','realAnchorUtc','eventAnchorUtc'];
export function validateConfiguration(input) {
  for(const name of required)if(input[name]===undefined||input[name]===''||/REPLACE|PLACEHOLDER/.test(String(input[name])))throw Error('Missing reviewed configuration: '+name);
  for(const name of ['accountId','testerAudience','staffAudience'])if(!/^[a-f0-9]{32,64}$/.test(input[name]))throw Error('Invalid '+name);
  if(!/^[a-f0-9-]{36}$/.test(input.databaseId))throw Error('Invalid databaseId');
  if(!/^[a-z0-9][a-z0-9-]{7,79}$/.test(input.environmentId))throw Error('Invalid staging environment identifier');
  const websiteOrigin=stagingOrigin(input.websiteOrigin),serviceOrigin=stagingOrigin(input.serviceOrigin);
  if(websiteOrigin===serviceOrigin)throw Error('Separate website and service origins required');
  // Two siblings on the approved zone keep the iframe same-site and cross-origin.
  const siteHost=new URL(websiteOrigin).hostname,serviceHost=new URL(serviceOrigin).hostname;
  if(siteHost.split('.').length<3||siteHost.split('.').slice(1).join('.')!==serviceHost.split('.').slice(1).join('.'))throw Error('Staging hosts must be siblings on one approved zone');
  if(!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(input.accessIssuer))throw Error('Invalid Access issuer');
  if(input.staffAudience===input.testerAudience)throw Error('Independent staff Access audience required');
  if(!Array.isArray(input.testerEmails)||input.testerEmails.length===0)throw Error('Explicit approved tester emails required');
  const emails=[...testerEmails(input.testerEmails.join(','))];
  const vars={STAGING_ENABLED:'true',STAGING_SITE_ORIGIN:websiteOrigin,STAGING_SERVICE_ORIGIN:serviceOrigin,
    STAGING_ACCESS_ISSUER:input.accessIssuer,STAGING_SITE_AUD:input.testerAudience,STAGING_SERVICE_AUD:input.testerAudience,
    STAGING_STAFF_AUD:input.staffAudience,STAGING_TESTER_EMAILS:emails.join(','),STAGING_ENVIRONMENT_ID:input.environmentId,
    STAGING_REAL_ANCHOR_UTC:input.realAnchorUtc,STAGING_EVENT_ANCHOR_UTC:input.eventAnchorUtc};
  stagingClock(vars);
  return {...input,websiteOrigin,serviceOrigin,vars};
}

export function workerConfiguration(input,assetsDirectory,{attachApprovedDomains=false}={}) {
  const config=validateConfiguration(input);
  const assets=resolve(assetsDirectory),allowed=resolve(feature,'.local')+sep;
  if(!assets.startsWith(allowed))throw Error('Assets must be generated inside the ignored staging build directory');
  const result={name:'sour-boule-nye-private-staging',account_id:config.accountId,
    main:resolve(feature,'staging/worker.mjs'),compatibility_date:'2026-09-01',
    workers_dev:false,preview_urls:false,observability:{enabled:false},
    assets:{directory:assets,binding:'ASSETS',run_worker_first:true,html_handling:'none',not_found_handling:'none'},
    d1_databases:[{binding:'DB',database_name:'sour-boule-nye-private-staging',database_id:config.databaseId}],
    vars:config.vars};
  // An explicit build flag is not owner approval. Obtain the separately required
  // DNS approval before generating/deploying this variant. Default has NO routes.
  if(attachApprovedDomains)result.routes=[config.websiteOrigin,config.serviceOrigin].map(origin=>({pattern:new URL(origin).hostname,custom_domain:true}));
  return result;
}

export function stagingSql(input,initialMigration) {
  const config=validateConfiguration(input);
  // New staging DB only. Never run this script against an existing/shared DB.
  // Real production windows remain empty in the production migration.
  return initialMigration+'\n-- PRIVATE REHEARSAL ONLY. TEST ONLY — NOT REDEEMABLE.\n'+
    'CREATE TABLE staging_environment (id INTEGER PRIMARY KEY CHECK(id=1), identifier TEXT NOT NULL);\n'+
    `INSERT INTO staging_environment(id,identifier) VALUES(1,'${config.environmentId}');\n`+
    ['fort-worth','willow-bend'].map(location=>`INSERT INTO redemption_windows(location,opens_ms,closes_ms,label) VALUES('${location}',${EVENT.midnight},${EVENT.midnight+3600000},'TEST ONLY — NOT REDEEMABLE — ARTIFICIAL ONE-HOUR REHEARSAL WINDOW');`).join('\n')+'\n';
}

// No secret, station subject, browser profile, token or database content belongs
// in this configuration. PASS_SECRET is provisioned through Wrangler secrets.
export async function prepareStaging(input,{attachApprovedDomains=false}={}) {
  const config=validateConfiguration(input);
  const {buildStaging}=await import('./build.mjs');
  const build=await buildStaging({websiteOrigin:config.websiteOrigin,serviceOrigin:config.serviceOrigin});
  const wranglerPath=resolve(build.outputDirectory,'wrangler.json');
  const sqlPath=resolve(build.outputDirectory,'staging-initial.sql');
  await writeFile(wranglerPath,JSON.stringify(workerConfiguration(config,build.assetsDirectory,{attachApprovedDomains}),null,2)+'\n');
  await writeFile(sqlPath,stagingSql(config,await readFile(resolve(feature,'migrations/0001_initial.sql'),'utf8')));
  return {...build,wranglerPath,sqlPath,domainsAttached:attachApprovedDomains};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),path=args.find(arg=>!arg.startsWith('--'));
  if(!path||args.some(arg=>arg.startsWith('--')&&arg!=='--attach-approved-domains'))throw Error('Usage: node staging/config.mjs .local/approved-staging.json [--attach-approved-domains]');
  const result=await prepareStaging(JSON.parse(await readFile(path,'utf8')),{attachApprovedDomains:args.includes('--attach-approved-domains')});
  console.log(JSON.stringify(result,null,2));
  console.log('Prepared local artifacts only. Nothing provisioned or deployed. Review cost, Access and DNS approvals before any cloud commands.');
}

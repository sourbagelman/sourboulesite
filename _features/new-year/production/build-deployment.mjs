// Rebuild the authorized production service locally. No network, deployment,
// secret access, database mutation, DNS change, or website activation occurs.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareProduction} from './prepare.mjs';

export async function buildDeployment(){
  const resources=JSON.parse(await readFile(new URL('resources.json',import.meta.url),'utf8'));
  if(resources.hostname!=='celebrate.thesourboule.com'||resources.workerName!=='sour-boule-nye-production'||resources.databaseName!=='sour-boule-nye-production'
    ||!/^[a-f0-9]{32}$/.test(resources.accountId)||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(resources.databaseId)
    ||!/^[a-f0-9]{64}$/.test(resources.staffAccessAudience)||resources.staffAccessIssuer!=='https://sourbagelman.cloudflareaccess.com')throw Error('Invalid approved production resource configuration');
  const prepared=await prepareProduction();
  const config=JSON.parse(await readFile(prepared.wranglerPath,'utf8'));
  config.name=resources.workerName;
  config.account_id=resources.accountId;
  config.routes=[{pattern:resources.hostname,custom_domain:true}];
  config.d1_databases=[{binding:'DB',database_name:resources.databaseName,database_id:resources.databaseId}];
  config.vars.PRODUCTION_ENABLED='true';
  config.vars.PRODUCTION_SERVICE_ORIGIN='https://'+resources.hostname;
  config.vars.ACCESS_ISSUER=resources.staffAccessIssuer;
  config.vars.ACCESS_AUD=resources.staffAccessAudience;
  await writeFile(prepared.wranglerPath,JSON.stringify(config,null,2)+'\n',{mode:0o600});
  const manifest=JSON.parse(await readFile(prepared.manifestPath,'utf8'));
  Object.assign(manifest,{kind:'production-deployment-local-build',productionEnabled:true,productionVerified:false,resources,
    pending:['This local build does not verify live deployment, staff authentication/assignments, holiday redemption windows, or device/security/operational checks.','Preparing an enabled website artifact does not publish the finalized October website release.']});
  await writeFile(prepared.manifestPath,JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
  return prepared;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(process.argv.length!==2)throw Error('Usage: node production/build-deployment.mjs (local build only)');
  console.log(JSON.stringify(await buildDeployment(),null,2));
  console.log('Built the production service configuration locally. No deployment or website activation occurred; PASS_SECRET remains a server-side Worker secret.');
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp,writeFile,rm,realpath} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {integrationMode,integrationAsset,generatedIntegrationMode} from '../scripts/build-integration.mjs';

const feature=fileURLToPath(new URL('../',import.meta.url));
const sourcePath=resolve(feature,'src/integration-loader.js');
const generatedPath=resolve(feature,'../../assets/js/new-year-2027.js');

test('website gate changes require an explicit flag and the default preserves the existing artifact',()=>{
  assert.equal(integrationMode([]),'preserve');
  assert.equal(integrationMode(['--disable']),'disabled');
  assert.equal(integrationMode(['--enable-for-approved-october-release']),'approved-october-release');
  for(const args of [['--enable'],['true'],['--staging'],['--disable','--disable'],['--disable','--enable-for-approved-october-release']])assert.throws(()=>integrationMode(args),/Usage:/);
});

test('approved activation changes only the generated gate and preserves the production endpoint and fixed schedule',async()=>{
  const source=await readFile(sourcePath,'utf8'),generated=await readFile(generatedPath,'utf8');
  assert.equal(integrationAsset(source),source);
  const enabled=integrationAsset(source,'approved-october-release');
  assert.equal(enabled.replace('const ENABLED=true;','const ENABLED=false;'),source);
  assert.match(enabled,/const SERVICE='https:\/\/celebrate\.thesourboule\.com';/);
  assert.match(enabled,/e\.start===1798782600000&&e\.midnight===1798783200000&&e\.end===1798783500000/);
  assert.doesNotMatch(enabled,/nye-staging|nye-service-staging|\/__lab\/|STAGING_/);
  assert.equal(await readFile(sourcePath,'utf8'),source);
  assert.equal(await readFile(generatedPath,'utf8'),generated);
  assert.equal(generated,enabled,'The prepared release artifact is enabled without changing or publishing it in these tests');
  assert.match(source,/const ENABLED=false;/,'The source reference remains disabled');
});

test('generated mode validation accepts only the exact disabled reference or enabled release asset',async()=>{
  const source=await readFile(sourcePath,'utf8');
  assert.equal(generatedIntegrationMode(source,source),'disabled');
  assert.equal(generatedIntegrationMode(source,integrationAsset(source,'approved-october-release')),'approved-october-release');
  for(const drift of [source+'\n',source.replace('celebrate.thesourboule.com','nye-service-staging.thesourboule.com'),source.replace('1798782600000','1798782600001')])assert.throws(()=>generatedIntegrationMode(source,drift),/differs from its source/);
});

test('activation refuses a changed endpoint, an already-enabled source, or ambiguous release gates',async()=>{
  const source=await readFile(sourcePath,'utf8');
  assert.throws(()=>integrationAsset(source,'enabled'),/Unknown/);
  assert.throws(()=>integrationAsset(source.replace('celebrate.thesourboule.com','nye-service-staging.thesourboule.com'),'approved-october-release'),/permanent production service/);
  assert.throws(()=>integrationAsset(source.replace('const ENABLED=false;','const ENABLED=true;'),'approved-october-release'),/exactly one disabled release gate/);
  assert.throws(()=>integrationAsset(source+'\nconst ENABLED=false;','approved-october-release'),/exactly one disabled release gate/);
});

test('release CLI preserves an enabled artifact by default, refuses drift, and disables only with the explicit flag',async t=>{
  const root=await realpath(await mkdtemp(resolve(tmpdir(),'sb-nye-release-activation-')));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const isolatedFeature=resolve(root,'_features/new-year');
  for(const path of ['scripts','src'])await mkdir(resolve(isolatedFeature,path),{recursive:true});
  await mkdir(resolve(root,'assets/js'),{recursive:true});
  const script=resolve(isolatedFeature,'scripts/build-integration.mjs');
  const source=await readFile(sourcePath,'utf8');
  const sourceCopy=resolve(isolatedFeature,'src/integration-loader.js');
  const assetCopy=resolve(root,'assets/js/new-year-2027.js');
  await writeFile(script,await readFile(resolve(feature,'scripts/build-integration.mjs')));
  await writeFile(sourceCopy,source);await writeFile(assetCopy,source);
  execFileSync(process.execPath,[script,'--enable-for-approved-october-release']);
  const enabled=await readFile(assetCopy,'utf8');
  assert.equal(enabled,integrationAsset(source,'approved-october-release'));
  assert.equal(await readFile(sourceCopy,'utf8'),source,'Source is never enabled or rewritten');
  assert.throws(()=>execFileSync(process.execPath,[script,'--unexpected'],{stdio:'pipe'}));
  assert.equal(await readFile(assetCopy,'utf8'),enabled,'Invalid flags fail before writes');
  execFileSync(process.execPath,[script]);
  assert.equal(await readFile(assetCopy,'utf8'),enabled,'A normal rebuild must not silently disable the release');
  const changed=enabled+'\n// Unreviewed source drift\n';
  await writeFile(assetCopy,changed);
  assert.throws(()=>execFileSync(process.execPath,[script],{stdio:'pipe'}));
  assert.equal(await readFile(assetCopy,'utf8'),changed,'Source drift fails before writes');
  execFileSync(process.execPath,[script,'--disable']);
  assert.equal(await readFile(assetCopy,'utf8'),source);
  execFileSync(process.execPath,[script]);
  assert.equal(await readFile(assetCopy,'utf8'),source);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdir,mkdtemp,writeFile,rm,realpath} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {integrationMode,integrationAsset} from '../scripts/build-integration.mjs';

const feature=fileURLToPath(new URL('../',import.meta.url));
const sourcePath=resolve(feature,'src/integration-loader.js');
const generatedPath=resolve(feature,'../../assets/js/new-year-2027.js');

test('website activation requires the exact approved-release flag and defaults to disabled',()=>{
  assert.equal(integrationMode([]),'disabled');
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
  assert.match(generated,/const ENABLED=false;/,'The current website is not activated by these tests');
});

test('activation refuses a changed endpoint, an already-enabled source, or ambiguous release gates',async()=>{
  const source=await readFile(sourcePath,'utf8');
  assert.throws(()=>integrationAsset(source,'enabled'),/Unknown/);
  assert.throws(()=>integrationAsset(source.replace('celebrate.thesourboule.com','nye-service-staging.thesourboule.com'),'approved-october-release'),/permanent production service/);
  assert.throws(()=>integrationAsset(source.replace('const ENABLED=false;','const ENABLED=true;'),'approved-october-release'),/exactly one disabled release gate/);
  assert.throws(()=>integrationAsset(source+'\nconst ENABLED=false;','approved-october-release'),/exactly one disabled release gate/);
});

test('release CLI enables only a temporary generated asset and --disable restores the identical source bytes',async t=>{
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
  execFileSync(process.execPath,[script,'--disable']);
  assert.equal(await readFile(assetCopy,'utf8'),source);
  execFileSync(process.execPath,[script]);
  assert.equal(await readFile(assetCopy,'utf8'),source);
});

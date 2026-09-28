// Default preparation stays disabled. Only the explicit release flag enables the
// generated website asset after owner authorization; the source stays disabled.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function integrationMode(args){
  if(args.length===0||(args.length===1&&args[0]==='--disable'))return 'disabled';
  if(args.length===1&&args[0]==='--enable-for-approved-october-release')return 'approved-october-release';
  throw Error('Usage: node scripts/build-integration.mjs [--disable | --enable-for-approved-october-release]');
}

export function integrationAsset(source,mode='disabled'){
  if(!['disabled','approved-october-release'].includes(mode))throw Error('Unknown website integration mode');
  if(source.split('const ENABLED=false;').length!==2||source.includes('const ENABLED=true;'))throw Error('Website integration source must have exactly one disabled release gate');
  if(source.split("const SERVICE='https://celebrate.thesourboule.com';").length!==2)throw Error('Website integration must use the permanent production service');
  return mode==='disabled'?source:source.replace('const ENABLED=false;','const ENABLED=true;');
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const mode=integrationMode(process.argv.slice(2));
  const root=new URL('../',import.meta.url);
  const source=readFileSync(new URL('src/integration-loader.js',root),'utf8');
  writeFileSync(new URL('../../assets/js/new-year-2027.js',root),integrationAsset(source,mode));
  console.log(mode==='disabled'
    ?'Built disabled website loader; no network calls or DOM changes while disabled.'
    :'Built enabled production loader for the owner-authorized October release; takeover follows the real server schedule. No website was published.');
}

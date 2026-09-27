// Generate only a DISABLED website asset. Enabling it needs separate release approval.
import {readFileSync,writeFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const source=readFileSync(new URL('src/integration-loader.js',root),'utf8');
if(!source.includes('const ENABLED=false;'))throw new Error('Website integration must remain disabled.');
writeFileSync(new URL('../../assets/js/new-year-2027.js',root),source);
console.log('Built disabled website loader; no network calls or DOM changes while disabled.');

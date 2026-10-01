// Explicit live-provider integration check, separate from deterministic tests.
// Optional argument points to package.json beside an existing miniflare install.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(process.argv[2] ? resolve(process.argv[2]) : new URL('../../new-year/package.json', import.meta.url));
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
const modules = [{
  type: 'ESModule', path: 'entry.mjs', contents: `
    import {fetchStation} from './provider.mjs';
    import {publicSnapshot} from './backend.mjs';
    export default { async fetch() {
      const now=Date.now();
      const report=await fetchStation('KFTW',now);
      return Response.json({runtime:'workerd',checkedAt:new Date(now).toISOString(),
        locations:['fort-worth','willow-bend'].map(id=>publicSnapshot(report,id,now))});
    }};`
}];
for (const file of ['provider.mjs', 'backend.mjs', 'config.mjs', 'solar.mjs']) {
  modules.push({ type: 'ESModule', path: file, contents: await readFile(new URL(`../${file}`, import.meta.url), 'utf8') });
}
const options = { compatibilityDate: '2026-09-01', modules };
const runtime = new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options);
try {
  const response = await runtime.dispatchFetch('http://local-weather-runtime/');
  const result = await response.json();
  assert.equal(response.status, 200);
  for (const location of result.locations) {
    assert.ok(location, 'Actual NWS report is required; a fixture is not substituted');
    assert.equal(location.provider, 'NWS'); assert.equal(location.station, 'KFTW');
    assert.ok(Date.parse(location.validUntil) > Date.now());
  }
  console.log(JSON.stringify(result, null, 2));
} finally { await runtime.dispose(); }

// Explicit live-provider integration check, separate from deterministic tests.
// Optional argument points to package.json beside an existing miniflare install.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import textures from '../texture-manifest-v3.json' with { type: 'json' };
import { resolve } from 'node:path';
const require = createRequire(process.argv[2] ? resolve(process.argv[2]) : new URL('../../new-year/package.json', import.meta.url));
const { Miniflare, convertV4MiniflareOptions } = require('miniflare');
const { build } = require('esbuild');
// Match Wrangler's bundled production module graph, including the shared v3
// validator and JSON asset allowlist; do not duplicate a stale module file list.
const bundled = await build({ write: false, bundle: true, format: 'esm', platform: 'browser', target: 'es2022',
  stdin: { resolveDir: resolve(new URL('..', import.meta.url).pathname), sourcefile: 'live-entry.mjs', contents: `
    import {fetchStation} from './provider.mjs';
    import worker,{publicSnapshot,publicSnapshotV2,publicSnapshotV3} from './backend.mjs';
    export default { async fetch(request,env) {
      if(new URL(request.url).pathname!=='/') return worker.fetch(request,env);
      const now=Date.now();
      const report=await fetchStation('KFTW',now);
      return Response.json({runtime:'workerd',checkedAt:new Date(now).toISOString(),
        locations:['fort-worth','willow-bend'].map(id=>({v1:publicSnapshot(report,id,now),v2:publicSnapshotV2(report,id,now),v3:publicSnapshotV3(report,id,now)}))});
    }};`
  } });
const modules = [{ type: 'ESModule', path: 'entry.mjs', contents: bundled.outputFiles[0].text }];
const options = { compatibilityDate: '2026-09-01', modules, assets: { directory: resolve(new URL('../textures-v3', import.meta.url).pathname), binding: 'WEATHER_ASSETS', run_worker_first: true, routerConfig: { has_user_worker: true } } };
const runtime = new Miniflare(convertV4MiniflareOptions ? convertV4MiniflareOptions(options) : options);
try {
  const assetChecks = [];
  for (const texture of Object.values(textures)) {
    const url = `http://local-weather-runtime/textures/${texture.file}`;
    const asset = await runtime.dispatchFetch(url, { headers: { Origin: 'https://thesourboule.com' } });
    assert.equal(asset.status, 200, asset.ok ? undefined : await asset.text());
    assert.equal(asset.headers.get('Content-Type'), 'image/webp');
    assert.equal(asset.headers.get('Cache-Control'), 'public, max-age=31536000, immutable');
    assert.equal(asset.headers.get('Access-Control-Allow-Origin'), 'https://thesourboule.com');
    const bytes = Buffer.from(await asset.arrayBuffer());
    assert.equal(bytes.length, texture.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), texture.sha256);
    const head = await runtime.dispatchFetch(url, { method: 'HEAD' });
    assert.equal(head.status, 200); assert.equal((await head.arrayBuffer()).byteLength, 0);
    assetChecks.push({ file: texture.file, status: 200, bytes: bytes.length, sha256Matches: true, headEmpty: true });
  }
  assert.equal((await runtime.dispatchFetch('http://local-weather-runtime/textures/unlisted.webp')).status, 404);
  assert.equal((await runtime.dispatchFetch(`http://local-weather-runtime/textures/${Object.values(textures)[0].file}`, { headers: { Origin: 'https://unapproved.invalid' } })).status, 403);
  const response = await runtime.dispatchFetch('http://local-weather-runtime/');
  const result = await response.json();
  assert.equal(response.status, 200);
  for (const location of result.locations) {
    for (const snapshot of Object.values(location)) {
      assert.ok(snapshot, 'Actual NWS report is required; a fixture is not substituted');
      assert.equal(snapshot.provider, 'NWS'); assert.equal(snapshot.station, 'KFTW');
      assert.ok(Date.parse(snapshot.validUntil) > Date.now());
      assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) < 2048);
    }
  }
  console.log(JSON.stringify({ ...result, assetChecks }, null, 2));
} finally { await runtime.dispose(); }

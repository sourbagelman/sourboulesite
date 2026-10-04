/* PRIVATE synthetic observations through the actual v3 adapter, bootstrap and
 * built renderer. Accelerated deterministic RAF checks are not performance data. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { observation } from '../provider.mjs';
import { publicSnapshotV3 } from '../backend.mjs';
import { suiteScenes, sceneObservation } from './suite-fixtures.mjs';
const require = createRequire(new URL('../../new-year/package.json', import.meta.url));
const { chromium } = require(process.env.SB_PLAYWRIGHT || 'playwright');
const assets = new Map();
for (const name of ['weather-v3.js', 'weather-renderer-v3.js', 'weather-fallback-v3.js']) assets.set('/assets/js/' + name, await readFile(new URL('../../../assets/js/' + name, import.meta.url)));
assets.set('/assets/css/weather-v3.css', await readFile(new URL('../../../assets/css/weather-v3.css', import.meta.url)));
let browser, server, origin;
test.before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.SB_CHROME ? { executablePath: process.env.SB_CHROME } : {}) });
  server = createServer((req, res) => {
    if (assets.has(req.url)) { res.writeHead(200, { 'content-type': req.url.endsWith('.css') ? 'text/css' : 'text/javascript' }); res.end(assets.get(req.url)); return; }
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<!doctype html><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/assets/css/weather-v3.css"><header class="site-header">Private fixture</header><div data-sb-home-weather class="sb-home-weather-slot"></div><main><h1>Normal content remains available</h1><button id="ordinary">Ordinary control</button></main><footer><button data-sb-weather-toggle>Weather effects: on</button><button data-sb-weather-lighting>Storm lighting: off</button></footer><script defer src="/assets/js/weather-v3.js" data-location="fort-worth" data-endpoint="https://sour-boule-weather.lance-c84.workers.dev/weather/v3/fort-worth"></script>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = 'http://127.0.0.1:' + server.address().port;
});
test.after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
for (const scene of suiteScenes) test(`actual adapter→v3→built renderer: ${scene.id}`, async () => {
  const now = Date.parse(scene.daypart === 'night' ? '2026-10-04T03:00:00Z' : '2026-10-04T18:00:00Z');
  const data = publicSnapshotV3(observation(sceneObservation(scene, now), 'KFTW', now), 'fort-worth', now, { enhanced: true, readout: true, lighting: true });
  assert.equal(data.scene.daypart, scene.daypart);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' });
  try {
    await context.addInitScript(now => {
      let clock = 0; Date.now = () => now + clock;
      Object.defineProperty(performance, 'now', { value: () => clock });
      window.fixtureLife = { added: null, removed: null, count: 0, painted: false, decorative: false };
      const pending = new Map(); let next = 0;
      window.requestAnimationFrame = fn => {
        const id = ++next, timer = setTimeout(() => {
          pending.delete(id); clock += 1000 / 60; fn(clock);
          const c = document.querySelector('canvas[data-sb-weather]'), life = window.fixtureLife;
          if (c && !life.painted && life.added !== null && clock - life.added >= 300) {
            const bytes = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            for (let i = 3; i < bytes.length; i += 4) if (bytes[i]) { life.painted = true; break; }
          }
        }, 0); pending.set(id, timer); return id;
      };
      window.cancelAnimationFrame = id => { clearTimeout(pending.get(id)); pending.delete(id); };
      new MutationObserver(() => {
        const c = document.querySelector('canvas[data-sb-weather]'), life = window.fixtureLife;
        if (c && life.added === null) { life.added = clock; life.count++; life.decorative = c.getAttribute('aria-hidden') === 'true' && getComputedStyle(c).pointerEvents === 'none'; }
        if (!c && life.added !== null && life.removed === null) life.removed = clock;
      }).observe(document, { childList: true, subtree: true });
    }, now);
    const page = await context.newPage(), errors = [], counts = { json: 0, renderer: 0, textures: 0 }, textures = new Set(); let bytes = 0;
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.url().endsWith('weather-renderer-v3.js')) counts.renderer++; });
    await page.route('https://sour-boule-weather.lance-c84.workers.dev/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/weather/v3/fort-worth') { counts.json++; await route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(data) }); return; }
      assert.match(path, /^\/textures\/[a-z-]+\.[a-f0-9]{12}\.webp$/);
      const body = await readFile(new URL('../textures-v3' + path, import.meta.url)); counts.textures++; bytes += body.length; textures.add(path);
      await route.fulfill({ contentType: 'image/webp', headers: { 'access-control-allow-origin': '*' }, body });
    });
    await page.goto(origin, { waitUntil: 'load' });
    await page.waitForFunction(() => window.fixtureLife.removed !== null, null, { timeout: 10000 });
    const life = await page.evaluate(() => window.fixtureLife);
    assert.equal(life.count, 1); assert.equal(life.painted, true); assert.equal(life.decorative, true);
    assert.ok(life.removed - life.added >= 4950 && life.removed - life.added <= 5100, JSON.stringify(life));
    assert.equal(await page.evaluate(() => window.SourBouleWeatherStatus.reason), 'complete');
    assert.equal(await page.evaluate(() => sessionStorage.getItem('sb-weather-session-played-v1')), '1');
    assert.equal(await page.locator('.sb-home-weather').isVisible(), true);
    assert.equal(await page.locator('.sb-home-weather__conditions').textContent(), data.conditionLabel);
    assert.equal(counts.json, 1); assert.equal(counts.renderer, 1); assert.equal(textures.size, counts.textures);
    assert.ok(bytes <= 128 * 1024); assert.ok(counts.textures < 13, 'Never download the entire texture suite');
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

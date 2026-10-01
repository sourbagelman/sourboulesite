/* Regression integration: mixed precipitation reaches the unchanged shipped browser assets.
 * Observation fixtures and intercepted weather responses exist only in this local test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { normalize, observation } from '../provider.mjs';
import { publicSnapshot } from '../backend.mjs';
const require = createRequire(new URL('../../new-year/package.json', import.meta.url));
const { chromium } = require(process.env.SB_PLAYWRIGHT || 'playwright');
const builtAssets = new Map();
for (const name of ['weather.js', 'weather-renderer.js']) builtAssets.set('/assets/js/' + name, await readFile(new URL('../../../assets/js/' + name, import.meta.url)));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
let browser, server, origin;
test.before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.SB_CHROME ? { executablePath: process.env.SB_CHROME } : {}) });
  server = createServer((req, res) => {
    if (builtAssets.has(req.url)) { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(builtAssets.get(req.url)); return; }
    const location = req.url === '/willow-bend.html' ? 'willow-bend' : 'fort-worth';
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Local mixed-weather regression fixture</title></head><body><main><h1>Ordinary website content</h1><button id="ordinary-control" onclick="this.dataset.clicked='yes'">Ordinary control</button></main><footer><button type="button" data-sb-weather-toggle aria-pressed="true">Weather effects: on</button></footer><script defer src="/assets/js/weather.js" data-location="${location}" data-endpoint="https://weather-fixture.invalid/weather/${location}"></script></body></html>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
});
test.after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
  for (const [path, bytes] of builtAssets) assert.equal(digest(await readFile(new URL('../../../' + path.slice(1), import.meta.url))), digest(bytes), 'Shipped asset was not changed: ' + path);
});
const mixtures = [
  { name: 'structured light rain with fog/mist', textDescription: 'Light Rain and Fog/Mist', presentWeather: [{ intensity: 'light', modifier: null, weather: 'rain', rawString: '-RA', inVicinity: null }, { intensity: null, modifier: null, weather: 'fog_mist', rawString: 'BR', inVicinity: null }] },
  { name: 'structured drizzle with fog', textDescription: 'Light Drizzle and Fog', presentWeather: [{ intensity: 'light', modifier: null, weather: 'drizzle', rawString: '-DZ', inVicinity: false }, { intensity: null, modifier: null, weather: 'fog', rawString: 'FG', inVicinity: false }] },
  { name: 'exact text-only Light Rain and Fog/Mist', textDescription: 'Light Rain and Fog/Mist' }
];
for (const device of [{ name: 'desktop', width: 1440, height: 900, mobile: false, path: '/', location: 'fort-worth' }, { name: 'mobile390', width: 390, height: 844, mobile: true, path: '/willow-bend.html', location: 'willow-bend' }]) {
  for (const mixture of mixtures) test(`${device.name}: ${mixture.name} reaches real rain renderer once, then cleans up`, async () => {
    const context = await browser.newContext({ viewport: { width: device.width, height: device.height }, deviceScaleFactor: device.mobile ? 2 : 1, isMobile: device.mobile, hasTouch: device.mobile, reducedMotion: 'no-preference' });
    try {
      await context.addInitScript(() => {
        window.fixtureCanvasLifecycle = { added: 0, removed: 0 };
        new MutationObserver(() => {
          const life = window.fixtureCanvasLifecycle;
          const canvas = document.querySelector('canvas[data-sb-weather]');
          if (canvas && !life.added) life.added = performance.now();
          if (!canvas && life.added && !life.removed) life.removed = performance.now();
        }).observe(document, { childList: true, subtree: true });
      });
      const page = await context.newPage();
      const counts = { weather: 0, renderer: 0 };
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (request.url().endsWith('/assets/js/weather-renderer.js')) counts.renderer++; });
      await page.route('https://weather-fixture.invalid/**', async route => {
        counts.weather++;
        const now = Date.now();
        const properties = {
          station: 'https://api.weather.gov/stations/KFTW', timestamp: new Date(now - 120000).toISOString(),
          ...(mixture.presentWeather ? { presentWeather: mixture.presentWeather } : {}), textDescription: mixture.textDescription,
          cloudLayers: [{ amount: 'OVC' }], windSpeed: { value: 30, unitCode: 'wmoUnit:mi_h-1' }
        };
        // No manually assigned condition/effect: all JSON is produced by the real provider/backend pipeline.
        assert.deepEqual(normalize(properties), { condition: 'rain', coherent: true });
        const normalized = observation({ properties }, 'KFTW', now);
        assert.equal(normalized.condition, 'rain');
        const payload = publicSnapshot(normalized, device.location, now);
        assert.equal(payload.effect, 'rain');
        await route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': origin }, body: JSON.stringify(payload) });
      });
      await page.goto(origin + device.path, { waitUntil: 'load' });
      await page.waitForSelector('canvas[data-sb-weather]', { state: 'attached', timeout: 5000 });
      assert.equal(await page.evaluate(() => sessionStorage.getItem('sb-weather-session-played-v1')), '1');
      await page.waitForTimeout(750);
      const canvas = await page.locator('canvas[data-sb-weather]').evaluate(node => {
        const bytes = node.getContext('2d').getImageData(0, 0, node.width, node.height).data;
        let painted = false;
        for (let i = 3; i < bytes.length; i += 4) if (bytes[i]) { painted = true; break; }
        return { painted, hidden: node.getAttribute('aria-hidden'), pointerEvents: getComputedStyle(node).pointerEvents, position: getComputedStyle(node).position };
      });
      assert.deepEqual(canvas, { painted: true, hidden: 'true', pointerEvents: 'none', position: 'fixed' });
      if (device.mobile) await page.locator('#ordinary-control').tap(); else await page.locator('#ordinary-control').click();
      assert.equal(await page.locator('#ordinary-control').getAttribute('data-clicked'), 'yes');
      await page.waitForSelector('canvas[data-sb-weather]', { state: 'detached', timeout: 5000 });
      const lifecycle = await page.evaluate(() => window.fixtureCanvasLifecycle);
      assert.ok(lifecycle.removed - lifecycle.added >= 3900 && lifecycle.removed - lifecycle.added < 4500, 'Four-second lifecycle');
      assert.deepEqual(counts, { weather: 1, renderer: 1 });
      assert.deepEqual(errors, []);
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(350);
      assert.equal(await page.locator('canvas[data-sb-weather]').count(), 0);
      assert.deepEqual(counts, { weather: 1, renderer: 1 }, 'Consumed tab session does not fetch or replay');
    } finally { await context.close(); }
  });
}

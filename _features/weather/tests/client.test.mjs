import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { validSnapshot } from '../client.mjs';
const require = createRequire(new URL('../../new-year/package.json', import.meta.url));
const { chromium, webkit } = require(process.env.SB_PLAYWRIGHT || 'playwright');
const fixture = (extra = {}, now = Date.now()) => ({ version: 1, provider: 'NWS', location: 'fort-worth', station: 'KFTW', timezone: 'America/Chicago', condition: 'cloud', effect: 'cloud', observedAt: new Date(now - 60000).toISOString(), fetchedAt: new Date(now).toISOString(), validUntil: new Date(now + 3500000).toISOString(), ...extra });
const now = Date.parse('2026-10-01T18:00:00.000Z');
test('snapshot rejects malformed, future, stale, incoherent and overlong freshness', () => {
  assert.equal(validSnapshot(fixture({}, now), 'fort-worth', now), true);
  for (const extra of [{ version: 2 }, { location: 'willow-bend' }, { station: '' }, { station: ['KFTW'] }, { provider: 'Other' }, { timezone: 'UTC' }, { effect: 'hail' }, { condition: 'clear' }, { observedAt: 'bad' }, { observedAt: '2026-02-30T12:00:00Z' }, { observedAt: new Date(now + 300001).toISOString() }, { fetchedAt: new Date(now + 300001).toISOString() }, { observedAt: new Date(now - 7200001).toISOString() }, { fetchedAt: new Date(now - 3600001).toISOString() }, { validUntil: new Date(now).toISOString() }, { validUntil: new Date(now + 3600001).toISOString() }]) assert.equal(validSnapshot(fixture(extra, now), 'fort-worth', now), false, JSON.stringify(extra));
});
test('clear day/night and expiry cannot cross sunrise or sunset', () => {
  const sun = fixture({ effect: 'sun', condition: 'clear', sunrise: '2026-10-01T12:30:00.000Z', sunset: '2026-10-02T00:15:00.000Z' }, now);
  assert.equal(validSnapshot(sun, 'fort-worth', now), true);
  assert.equal(validSnapshot({ ...sun, effect: 'night' }, 'fort-worth', now), false);
  const dawn = Date.parse(sun.sunrise) - 1000;
  assert.equal(validSnapshot(fixture({ ...sun, effect: 'night', observedAt: new Date(dawn).toISOString(), fetchedAt: new Date(dawn).toISOString(), validUntil: sun.sunrise }, dawn), 'fort-worth', dawn), true);
  assert.equal(validSnapshot(fixture({ ...sun, effect: 'night', observedAt: new Date(dawn).toISOString(), fetchedAt: new Date(dawn).toISOString(), validUntil: new Date(dawn + 2000).toISOString() }, dawn), 'fort-worth', dawn), false);
});

const bootstrap = await readFile(new URL('../../../assets/js/weather.js', import.meta.url), 'utf8');
const fakeRenderer = `export function startWeather(options){if(window.fixtureNoCanvas)return null;window.fixtureStarts=(window.fixtureStarts||0)+1;window.fixtureEffect=options.effect;window.fixtureLeaves=options.autumnLeaves;const c=document.createElement('canvas');c.dataset.sbWeather='';c.setAttribute('aria-hidden','true');c.style.pointerEvents='none';document.body.append(c);let closed=false;return ()=>{if(closed)return;closed=true;c.remove();window.fixtureStops=(window.fixtureStops||0)+1;options.onFinish();};}`;
let browser, server, origin;
const engine = process.env.SB_BROWSER === 'webkit' ? webkit : chromium;
test.before(async () => {
  browser = await engine.launch({ headless: true, ...(process.env.SB_CHROME ? { executablePath: process.env.SB_CHROME } : {}) });
  server = createServer((req, res) => {
    if (req.url === '/assets/js/weather.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bootstrap); return; }
    const willow = req.url.startsWith('/willow-bend.html');
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><meta name="viewport" content="width=device-width"><main><h1>Current website</h1><a href="/fort-worth.html">Order</a></main><footer><button data-sb-weather-toggle aria-pressed="true">Weather effects: on</button></footer><script defer src="/assets/js/weather.js" data-location="${willow ? 'willow-bend' : 'fort-worth'}" data-endpoint="https://weather.test/weather/${willow ? 'willow-bend' : 'fort-worth'}"></script>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
});
test.after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });
async function setup(options = {}) {
  const context = await browser.newContext({ reducedMotion: options.motion || 'no-preference', viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ options }) => {
    if (options.played) sessionStorage.setItem('sb-weather-session-played-v1', '1');
    if (options.off) localStorage.setItem('sb-weather-disabled-v1', '1');
    if (options.denied) Object.defineProperty(window, options.denied, { get() { throw Error('denied'); } });
    if (options.connection) Object.defineProperty(navigator, 'connection', { value: options.connection });
    if (options.effectsOff) window.SourBouleSeasonalConfig = { CONFIG: { mode: 'off' } };
    if (options.fallback) window.requestIdleCallback = undefined;
    else {
      window.requestIdleCallback = fn => { window.fixtureIdle = fn; if (!options.holdIdle) return setTimeout(fn, 0); return 4321; };
      window.cancelIdleCallback = id => { window.fixtureIdleCancelled = true; clearTimeout(id); window.fixtureIdle = null; };
    }
    if (options.hidden) Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    window.fixtureNoCanvas = options.noCanvas;
  }, { options });
  const page = await context.newPage(); const counts = { weather: 0, renderer: 0 };
  await page.route('https://weather.test/**', async route => {
    counts.weather++;
    if (options.weatherDelay) await new Promise(resolve => setTimeout(resolve, options.weatherDelay));
    try {
      if (options.networkError) await route.abort();
      else await route.fulfill({ status: options.status || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: options.raw || JSON.stringify(fixture({ ...(route.request().url().includes('willow-bend') ? { location: 'willow-bend' } : {}), ...options.snapshot, ...(options.expiresSoon ? { validUntil: new Date(Date.now() + 80).toISOString() } : {}) })) });
    } catch { /* Browser cancellation is the asserted outcome in race tests. */ }
  });
  await page.route('**/assets/js/weather-renderer.js', async route => {
    counts.renderer++;
    if (options.rendererDelay) await new Promise(resolve => setTimeout(resolve, options.rendererDelay));
    try { await route.fulfill({ contentType: 'text/javascript', body: fakeRenderer }); } catch {}
  });
  await page.goto(origin + (options.path || '/'), { waitUntil: 'load' });
  return { context, page, counts, close: () => context.close() };
}
const active = async page => page.waitForSelector('[data-sb-weather]', { state: 'attached' });
const absent = async page => assert.equal(await page.locator('[data-sb-weather]').count(), 0);

for (const [name, options] of [
  ['played tab', { played: true }], ['saved weather off', { off: true }], ['reduced motion', { motion: 'reduce' }],
  ['denied session storage', { denied: 'sessionStorage' }], ['denied local storage', { denied: 'localStorage' }],
  ['save data', { connection: { saveData: true } }], ['2g', { connection: { effectiveType: '2g' } }],
  ['slow downlink', { connection: { downlink: 0.2 } }], ['existing effects off', { effectsOff: true }],
  ['hidden initial page', { hidden: true }], ['standalone menu', { path: '/menu.html' }],
  ['location directory', { path: '/locations.html' }], ['legacy chooser', { path: '/brand-home.html' }], ['staff', { path: '/staff/' }]
]) test(`suppressed ${name}: no JSON, renderer or canvas`, async () => { const t = await setup(options); try { await t.page.waitForTimeout(350); assert.deepEqual(t.counts, { weather: 0, renderer: 0 }); await absent(t.page); } finally { await t.close(); } });

test('one session consumed only by actual playback and shared across eligible routes/reload', async () => {
  const t = await setup(); try {
    await active(t.page); assert.equal(await t.page.evaluate(() => sessionStorage.getItem('sb-weather-session-played-v1')), '1');
    await t.page.goto(origin + '/willow-bend.html'); await t.page.waitForTimeout(350); await absent(t.page);
    await t.page.reload(); await t.page.waitForTimeout(350); assert.deepEqual(t.counts, { weather: 1, renderer: 1 });
  } finally { await t.close(); }
});
test('unsupported canvas does not consume session', async () => { const t = await setup({ noCanvas: true }); try { await t.page.waitForTimeout(200); assert.equal(t.counts.renderer, 1); assert.equal(await t.page.evaluate(() => sessionStorage.getItem('sb-weather-session-played-v1')), null); } finally { await t.close(); } });
test('Safari idle fallback runs and cancels before work', async () => {
  const first = await setup({ fallback: true }); try { await active(first.page); } finally { await first.close(); }
  const t = await setup({ fallback: true }); try { await t.page.locator('button').click(); await t.page.waitForTimeout(400); assert.deepEqual(t.counts, { weather: 0, renderer: 0 }); } finally { await t.close(); }
});
test('off cancels idle work; turning on never revives a stopped document', async () => {
  const t = await setup({ holdIdle: true }); try { assert.equal(await t.page.locator('button').getAttribute('aria-pressed'), 'true'); await t.page.locator('button').click(); assert.equal(await t.page.locator('button').getAttribute('aria-pressed'), 'false'); await t.page.locator('button').click(); assert.equal(await t.page.locator('button').getAttribute('aria-pressed'), 'true'); assert.equal(await t.page.evaluate(() => window.fixtureIdleCancelled), true); await t.page.waitForTimeout(100); assert.deepEqual(t.counts, { weather: 0, renderer: 0 }); } finally { await t.close(); }
});
for (const [name, action] of [
  ['off', async page => page.locator('button').click()],
  ['reduced motion', async page => page.emulateMedia({ reducedMotion: 'reduce' })],
  ['pagehide/BFCache', async page => page.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); })],
  ['tab hidden/return', async page => page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); })],
  ['NYE host', async page => page.evaluate(() => { const host = document.createElement('div'); host.id = 'sb-nye-isolated-host'; document.body.append(host); })]
]) test(`${name} stops active playback and never restarts`, async () => {
  const t = await setup(); try { await active(t.page); await action(t.page); await t.page.waitForTimeout(100); await absent(t.page); assert.equal(await t.page.evaluate(() => window.fixtureStops), 1); await t.page.setViewportSize({ width: 320, height: 568 }); await t.page.waitForTimeout(100); await absent(t.page); assert.equal(t.counts.weather, 1); } finally { await t.close(); }
});
for (const stage of ['weather', 'renderer']) test(`NYE arriving during ${stage} suppresses late async result`, async () => {
  const t = await setup({ [stage + 'Delay']: 200 }); try {
    await t.page.waitForFunction(() => Boolean(window.fixtureIdle));
    while (!t.counts[stage]) await t.page.waitForTimeout(10);
    await t.page.evaluate(() => { const host = document.createElement('div'); host.id = 'sb-nye-isolated-host'; document.body.append(host); });
    await t.page.waitForTimeout(350); await absent(t.page); assert.equal(await t.page.evaluate(() => window.fixtureStarts || 0), 0);
  } finally { await t.close(); }
});
for (const [name, options] of [['unavailable', { status: 503 }], ['unsupported', { snapshot: { effect: 'none', condition: 'none' } }], ['malformed', { raw: 'not json' }], ['oversized', { raw: ' '.repeat(2049) }], ['stale', { snapshot: { observedAt: '2025-01-01T00:00:00.000Z' } }], ['network failure', { networkError: true }]]) test(`${name} weather fails closed without renderer or retry`, async () => {
  const t = await setup(options); try { await t.page.waitForTimeout(150); await absent(t.page); assert.deepEqual(t.counts, { weather: 1, renderer: 0 }); assert.equal(await t.page.locator('h1').textContent(), 'Current website'); } finally { await t.close(); }
});
test('three-second weather timeout cancels late result with no retry', async () => {
  const t = await setup({ weatherDelay: 3300 }); try { await t.page.waitForTimeout(3500); await absent(t.page); assert.deepEqual(t.counts, { weather: 1, renderer: 0 }); } finally { await t.close(); }
});
test('expiry is revalidated after renderer import', async () => { const t = await setup({ expiresSoon: true, rendererDelay: 200 }); try { await t.page.waitForTimeout(350); await absent(t.page); assert.deepEqual(t.counts, { weather: 1, renderer: 1 }); } finally { await t.close(); } });
test('four-second deadline removes canvas and leaves ordinary navigation responsive', async () => {
  const t = await setup(); try { await active(t.page); assert.equal(await t.page.locator('a').textContent(), 'Order'); await t.page.waitForTimeout(4200); await absent(t.page); assert.equal(await t.page.evaluate(() => window.fixtureStops), 1); assert.deepEqual(t.counts, { weather: 1, renderer: 1 }); } finally { await t.close(); }
});

for (const stage of ['weather', 'renderer']) test(`off during ${stage} cancels pending work and ignores its late result`, async () => {
  const t = await setup({ [stage + 'Delay']: 250 }); try {
    while (!t.counts[stage]) await t.page.waitForTimeout(10);
    await t.page.locator('button').click();
    await t.page.waitForTimeout(350); await absent(t.page);
    assert.equal(await t.page.evaluate(() => window.fixtureStarts || 0), 0);
    assert.equal(await t.page.evaluate(() => sessionStorage.getItem('sb-weather-session-played-v1')), null);
  } finally { await t.close(); }
});
test('NYE present before idle work prevents requests entirely', async () => {
  const t = await setup({ holdIdle: true }); try {
    await t.page.evaluate(() => { const host = document.createElement('div'); host.id = 'sb-nye-isolated-host'; document.body.append(host); });
    await t.page.waitForTimeout(100); assert.deepEqual(t.counts, { weather: 0, renderer: 0 }); await absent(t.page);
  } finally { await t.close(); }
});
test('renderer import timeout ignores module completion without consuming session', async () => {
  const t = await setup({ rendererDelay: 3250 }); try {
    await t.page.waitForTimeout(3450); await absent(t.page);
    assert.equal(await t.page.evaluate(() => window.fixtureStarts || 0), 0);
    assert.equal(await t.page.evaluate(() => sessionStorage.getItem('sb-weather-session-played-v1')), null);
  } finally { await t.close(); }
});

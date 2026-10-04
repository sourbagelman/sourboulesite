import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { observation } from '../provider.mjs';
import { publicSnapshotV3 } from '../backend.mjs';
import { validSnapshot, snapshotProblem, PLAYBACK_MS } from '../client-v3.mjs';
import { temperatureText } from '../readout-v3.mjs';
import { suiteScenes, sceneObservation } from './suite-fixtures.mjs';
const require = createRequire(new URL('../../new-year/package.json', import.meta.url));
const { chromium } = require(process.env.SB_PLAYWRIGHT || 'playwright');
const now = Date.parse('2026-10-04T18:00:00Z');
const rain = suiteScenes.find(s => s.id === 'rain-day');
function fixture(extra = {}, at = now) {
  const snapshot = observation(sceneObservation(rain, at), 'KFTW', at);
  return { ...publicSnapshotV3(snapshot, extra.location || 'fort-worth', at, { enhanced: true, readout: true, lighting: true }), ...extra };
}
test('all64 server-projected scenes satisfy v3 contract with independent day/night', () => {
  for (const scene of suiteScenes) {
    const at = Date.parse(scene.daypart === 'night' ? '2026-10-04T03:00:00Z' : '2026-10-04T18:00:00Z');
    const snap = observation(sceneObservation(scene, at), 'KFTW', at);
    const data = publicSnapshotV3(snap, 'fort-worth', at);
    assert.equal(validSnapshot(data, 'fort-worth', at), true, scene.id);
  }
});
test('v3 rejects incompatible, stale, malformed components and wrong solar phase', () => {
  const good = fixture(); assert.equal(validSnapshot(good, 'fort-worth', now), true);
  assert.equal(validSnapshot({ ...good, fallback: { ...good.fallback, effect: [good.fallback.effect] } }, 'fort-worth', now), false);
  for (const extra of [{ version: 2 }, { station: 'KDFW' }, { provider: 'other' }, { temperatureF: '0' }, { temperatureF: Infinity }, { temperatureF: 151 }, { conditionLabel: '<b>Rain</b>' }, { conditionLabel: 'Freezing\nrain' }, { conditionLabel: 'x'.repeat(121) }, { icon: 'storm' }, { scene: null, icon: 'sun' }, { conditionLabel: 'Rain\u202efog' }, { validUntil: new Date(now).toISOString() }, { sunrise: 'bad' }, { scene: { ...good.scene, daypart: 'night' } }, { controls: { enhanced: 1, readout: true, lighting: false } }]) assert.equal(validSnapshot({ ...good, ...extra }, 'fort-worth', now), false, JSON.stringify(extra));
  assert.equal(PLAYBACK_MS, 5000);
  assert.equal(snapshotProblem({ ...good, observedAt: 'bad' }, 'fort-worth', now), 'snapshot-timestamps');
});
test('readout preserves real zero and omits missing/invalid temperature instead of inventing it', () => {
  assert.equal(temperatureText(0), '0°F'); assert.equal(temperatureText(32), '32°F'); assert.equal(temperatureText(-0.1), '0°F');
  for (const value of [null, undefined, '0', NaN, Infinity, -151, 151]) assert.equal(temperatureText(value), null);
});
test('cached all-scene responses expire at solar and midnight boundaries; fresh projection preserves provenance', () => {
  for (const boundary of ['2026-10-04T05:00:00Z', fixture().sunrise, fixture().sunset]) {
    const at = Date.parse(boundary) - 1000;
    for (const id of ['rain-day', 'overcast-day', 'fog-day']) {
      const scene = suiteScenes.find(s => s.id === id) || rain;
      const snap = observation(sceneObservation(scene, at), 'KFTW', at);
      const prior = publicSnapshotV3(snap, 'fort-worth', at), next = publicSnapshotV3(snap, 'fort-worth', at + 2000);
      assert.equal(validSnapshot(prior, 'fort-worth', at), true); assert.equal(validSnapshot(prior, 'fort-worth', at + 2000), false);
      assert.equal(validSnapshot(next, 'fort-worth', at + 2000), true);
      assert.equal(next.observedAt, prior.observedAt); assert.equal(next.fetchedAt, prior.fetchedAt);
    }
  }
});

// The loopback harness changes only the fixed origin; production has no override.
const bootstrap = (await readFile(new URL('../../../assets/js/weather-v3.js', import.meta.url), 'utf8')).replaceAll('https://sour-boule-weather.lance-c84.workers.dev', 'https://weather.test');
const css = await readFile(new URL('../../../assets/css/weather-v3.css', import.meta.url), 'utf8');
const fakeRenderer = `const start=(options)=>{if(window.fixtureNoCanvas)return null;window.fixtureStarts=(window.fixtureStarts||0)+1;window.fixtureStartAt=performance.now();const c=document.createElement('canvas');c.dataset.sbWeather='';c.setAttribute('aria-hidden','true');c.style.pointerEvents='none';document.body.append(c);let closed=false;const stop=reason=>{if(closed)return;closed=true;c.remove();window.fixtureStops=(window.fixtureStops||0)+1;options.onFinish(reason);};window.fixtureFinish=stop;return stop;};export async function prepareWeather(options){window.fixturePreparation=(window.fixturePreparation||0)+1;window.fixtureLighting=options.lighting;window.fixtureScene=options.scene;if(window.fixturePrepDelay)await new Promise(r=>setTimeout(r,window.fixturePrepDelay));if(options.signal.aborted||window.fixturePrepFailure)return null;return start;}export function startWeather(options){window.fixtureFallback=options;return start(options);}`;
let browser, server, origin;
test.before(async () => {
  browser = await chromium.launch({ headless: true, ...(process.env.SB_CHROME ? { executablePath: process.env.SB_CHROME } : {}) });
  server = createServer((req, res) => {
    if (req.url === '/assets/js/weather-v3.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(bootstrap); return; }
    if (req.url === '/assets/css/weather-v3.css') { res.writeHead(200, { 'content-type': 'text/css' }); res.end(css); return; }
    const pathname = new URL(req.url, origin || 'http://localhost').pathname;
    const location = pathname === '/willow-bend.html' ? 'willow-bend' : 'fort-worth';
    const home = pathname === '/' || pathname === '/index.html';
    const service = req.url.includes('?badOrigin') ? 'https://unapproved.invalid' : 'https://weather.test';
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(`<!doctype html><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/assets/css/weather-v3.css"><header class="site-header"><details><summary>Order Online</summary><a href="#ordinary">Order</a></details></header>${home ? '<div class="sb-home-weather-slot" data-sb-home-weather></div>' : ''}<main><h1>Current website</h1><button id="ordinary">Ordinary control</button></main><footer><button data-sb-weather-toggle>Weather effects: on</button><button data-sb-weather-lighting>Storm lighting: off</button></footer><script defer src="/assets/js/weather-v3.js" data-location="${location}" data-endpoint="${service}/weather/v3/${location}"></script>`);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = 'http://127.0.0.1:' + server.address().port;
});
test.after(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
async function setup(options = {}) {
  const begun = Date.now();
  const context = await browser.newContext({ reducedMotion: options.motion || 'no-preference', viewport: { width: 390, height: 844 } });
  await context.addInitScript(({ options, now }) => {
    const start = performance.now(); window.fixtureClockOffset = 0; Date.now = () => now + performance.now() - start + window.fixtureClockOffset;
    if (options.played) sessionStorage.setItem('sb-weather-session-played-v1', '1');
    if (options.off) localStorage.setItem('sb-weather-disabled-v1', '1');
    if (options.lightOff) localStorage.setItem('sb-weather-lighting-disabled-v1', '1');
    if (options.denied) Object.defineProperty(window, options.denied, { get() { throw Error('denied'); } });
    if (options.connection) Object.defineProperty(navigator, 'connection', { value: options.connection });
    if (options.effectsOff) window.SourBouleSeasonalConfig = { CONFIG: { mode: 'off' } };
    if (options.hidden) Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    window.fixturePrepDelay = options.prepDelay || 0; window.fixtureNoCanvas = options.noCanvas; window.fixturePrepFailure = options.prepFailure;
    if (options.fallbackIdle) window.requestIdleCallback = undefined;
    else { window.requestIdleCallback = fn => { window.fixtureIdle = fn; if (!options.holdIdle) return setTimeout(fn, 0); return 321; }; window.cancelIdleCallback = id => { clearTimeout(id); window.fixtureIdle = null; }; }
    window.fixtureShifts = [];
    new PerformanceObserver(list => { for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.fixtureShifts.push(entry.value); }).observe({ type: 'layout-shift', buffered: true });
  }, { options, now });
  const page = await context.newPage(), counts = { weather: 0, enhanced: 0, fallback: 0 }, errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://weather.test/**', async route => {
    counts.weather++;
    if (options.weatherDelay) await new Promise(resolve => setTimeout(resolve, options.weatherDelay));
    const at = now + Date.now() - begun;
    const data = fixture({ ...(route.request().url().includes('willow-bend') ? { location: 'willow-bend' } : {}), ...options.snapshot, ...(options.expiresSoon ? { validUntil: new Date(at + options.expiresSoon).toISOString() } : {}) }, at);
    try { if (options.networkError) await route.abort(); else await route.fulfill({ status: options.status || 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: options.raw || JSON.stringify(data) }); } catch {}
  });
  await page.route('**/assets/js/weather-*-v3.js', async route => {
    const fallback = route.request().url().includes('fallback'); counts[fallback ? 'fallback' : 'enhanced']++;
    if (options.rendererDelay) await new Promise(resolve => setTimeout(resolve, options.rendererDelay));
    try { await route.fulfill({ contentType: 'text/javascript', body: options.rendererRaw || fakeRenderer }); } catch {}
  });
  await page.goto(origin + (options.path || '/'), { waitUntil: 'load' });
  return { context, page, counts, errors, close: () => context.close() };
}
const active = page => page.waitForSelector('canvas[data-sb-weather]', { state: 'attached' });
const shown = page => page.waitForSelector('.sb-home-weather', { state: 'visible' });
const noCanvas = async page => { await page.waitForSelector('canvas[data-sb-weather]', { state: 'detached', timeout: 1000 }); assert.equal(await page.locator('canvas[data-sb-weather]').count(), 0); };

for (const [name, options] of [
  ['consumed session', { played: true }], ['weather off', { off: true }], ['reduced motion', { motion: 'reduce' }],
  ['denied session storage', { denied: 'sessionStorage' }], ['denied local storage', { denied: 'localStorage' }],
  ['save data', { connection: { saveData: true } }], ['2g', { connection: { effectiveType: '2g' } }], ['slow downlink', { connection: { downlink: .2 } }], ['seasonal effects off', { effectsOff: true }]
]) {
  test(`Home ${name}: one factual JSON read, no renderer or animation`, async () => { const t = await setup(options); try { await shown(t.page); await noCanvas(t.page); assert.deepEqual(t.counts, { weather: 1, enhanced: 0, fallback: 0 }); assert.deepEqual(t.errors, []); } finally { await t.close(); } });
  test(`Location ${name}: preserves zero-request suppression`, async () => { const t = await setup({ ...options, path: '/willow-bend.html' }); try { await t.page.waitForTimeout(160); assert.deepEqual(t.counts, { weather: 0, enhanced: 0, fallback: 0 }); assert.equal(await t.page.locator('.sb-home-weather').count(), 0); } finally { await t.close(); } });
}
for (const path of ['/menu.html', '/locations.html', '/brand-home.html', '/staff/']) test(`${path}: no request or readout`, async () => { const t = await setup({ path }); try { await t.page.waitForTimeout(120); assert.deepEqual(t.counts, { weather: 0, enhanced: 0, fallback: 0 }); assert.equal(await t.page.locator('.sb-home-weather').count(), 0); } finally { await t.close(); } });
test('unapproved service origin fails closed before a weather request', async () => { const t = await setup({ path: '/?badOrigin' }); try { assert.equal(await t.page.evaluate(() => window.SourBouleWeatherStatus.reason), 'invalid-configuration'); assert.deepEqual(t.counts, { weather: 0, enhanced: 0, fallback: 0 }); } finally { await t.close(); } });
test('Home shares one JSON between readout and playback; preparation does not consume session', async () => {
  const t = await setup({ prepDelay: 200 }); try {
    await shown(t.page); assert.equal(await t.page.evaluate(() => sessionStorage.getItem('sb-weather-session-played-v1')), null);
    await active(t.page); assert.deepEqual(t.counts, { weather: 1, enhanced: 1, fallback: 0 });
    assert.equal(await t.page.evaluate(() => sessionStorage.getItem('sb-weather-session-played-v1')), '1');
    await t.page.evaluate(() => window.fixtureFinish('complete')); await shown(t.page); await noCanvas(t.page);
    assert.deepEqual(await t.page.evaluate(() => window.fixtureShifts), []);
  } finally { await t.close(); }
});
test('full five-second deadline begins after preparation and readout remains afterward', async () => {
  const t = await setup({ prepDelay: 220 }); try { await active(t.page); await t.page.waitForTimeout(4250); assert.equal(await t.page.locator('canvas[data-sb-weather]').count(), 1); await t.page.waitForSelector('canvas[data-sb-weather]', { state: 'detached', timeout: 1800 }); await shown(t.page); assert.deepEqual(t.errors, []); } finally { await t.close(); }
});
test('saved lighting off and server lighting off are independent', async () => {
  for (const options of [{ lightOff: true }, { snapshot: { controls: { enhanced: true, readout: true, lighting: false } } }]) {
    const t = await setup(options); try { await active(t.page); assert.equal(await t.page.evaluate(() => window.fixtureLighting), false); assert.equal(await t.page.locator('[data-sb-weather-lighting]').getAttribute('aria-pressed'), 'false'); } finally { await t.close(); }
  }
});
test('storm lighting preference is accessible, saved, and stops lighting without hiding factual readout', async () => {
  const t = await setup(); try { await active(t.page); const button = t.page.locator('[data-sb-weather-lighting]'); assert.equal(await button.getAttribute('aria-pressed'), 'true'); await button.click(); await noCanvas(t.page); await shown(t.page); assert.equal(await t.page.evaluate(() => localStorage.getItem('sb-weather-lighting-disabled-v1')), '1'); assert.equal(await button.getAttribute('aria-pressed'), 'false'); } finally { await t.close(); }
});
test('consumed location can save lighting preference without fetching weather', async () => {
  const t = await setup({ played: true, path: '/willow-bend.html' }); try { const button = t.page.locator('[data-sb-weather-lighting]'); assert.equal(await button.isEnabled(), true); await button.click(); assert.equal(await t.page.evaluate(() => localStorage.getItem('sb-weather-lighting-disabled-v1')), '1'); assert.equal(await button.getAttribute('aria-pressed'), 'false'); assert.deepEqual(t.counts, { weather: 0, enhanced: 0, fallback: 0 }); } finally { await t.close(); }
});
test('enhanced-off flag chooses only the compatible five-second lightweight module', async () => {
  const t = await setup({ snapshot: { controls: { enhanced: false, readout: true, lighting: false } } }); try { await active(t.page); await shown(t.page); assert.deepEqual(t.counts, { weather: 1, enhanced: 0, fallback: 1 }); } finally { await t.close(); }
});
for (const [name, snapshot] of [['unsupported artwork', { scene: null, icon: 'neutral', conditionLabel: 'Smoke' }], ['missing temperature', { temperatureF: null }], ['zero Fahrenheit', { temperatureF: 0 }]]) test(`readout ${name}`, async () => {
  const t = await setup({ played: true, snapshot }); try { await shown(t.page); const card = t.page.locator('.sb-home-weather'); assert.equal(await card.getAttribute('aria-live'), null); assert.equal(await t.page.locator('.sb-home-weather__temp').isVisible(), name !== 'missing temperature'); if (name === 'zero Fahrenheit') assert.equal(await t.page.locator('.sb-home-weather__temp').textContent(), '0°F'); assert.deepEqual(t.counts, { weather: 1, enhanced: 0, fallback: 0 }); } finally { await t.close(); }
});
test('new null temperature never retains old temperature; expiry hides without polling', async () => {
  const options = { played: true, expiresSoon: 500 }; const t = await setup(options); try {
    await shown(t.page); assert.equal(await t.page.locator('.sb-home-weather__temp').textContent(), '70°F');
    await t.page.waitForTimeout(650); assert.equal(await t.page.locator('.sb-home-weather').isVisible(), false); assert.equal(t.counts.weather, 1); assert.equal(await t.page.evaluate(() => window.SourBouleWeatherStatus.readout), 'expired');
    options.snapshot = { temperatureF: null }; options.expiresSoon = 10000;
    await t.page.evaluate(() => { dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
    await shown(t.page); assert.equal(t.counts.weather, 2); assert.equal(await t.page.locator('.sb-home-weather__temp').isVisible(), false);
  } finally { await t.close(); }
});
test('fresh BFCache and foreground restoration reuse data, never replay and coalesce events', async () => {
  const t = await setup(); try { await active(t.page); await t.page.evaluate(() => { dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })); dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); dispatchEvent(new Event('visibilitychange')); }); await shown(t.page); await noCanvas(t.page); assert.deepEqual(t.counts, { weather: 1, enhanced: 1, fallback: 0 }); } finally { await t.close(); }
});
test('expired foreground return hides old text immediately and coalesces one recovery read', async () => {
  const options = { played: true }; const t = await setup(options); try {
    await shown(t.page); await t.page.evaluate(() => { window.fixtureClockOffset += 3700000; Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })); });
    await t.page.waitForTimeout(180); assert.equal(t.counts.weather, 2); assert.equal(await t.page.locator('.sb-home-weather').isVisible(), false); await noCanvas(t.page);
  } finally { await t.close(); }
});
for (const [name, options] of [['API failure', { status: 503 }], ['invalid JSON', { raw: '{' }], ['old version', { snapshot: { version: 2 } }], ['invalid components', { snapshot: { scene: {} } }], ['network failure', { networkError: true }]]) test(`${name} fails closed without stale or invented text`, async () => { const t = await setup(options); try { await t.page.waitForTimeout(160); await noCanvas(t.page); assert.equal(await t.page.locator('.sb-home-weather').isVisible(), false); assert.equal(t.counts.enhanced, 0); assert.deepEqual(t.errors, []); } finally { await t.close(); } });
for (const [name, options] of [['preparation failure', { prepFailure: true }], ['renderer parse failure', { rendererRaw: 'bad syntax !!!' }], ['unsupported canvas', { noCanvas: true }]]) test(`${name} preserves static readout and does not consume session`, async () => { const t = await setup(options); try { await shown(t.page); await t.page.waitForTimeout(160); await noCanvas(t.page); assert.equal(await t.page.evaluate(() => sessionStorage.getItem('sb-weather-session-played-v1')), null); } finally { await t.close(); } });
test('weather timeout does not retry or block normal controls', async () => { const t = await setup({ weatherDelay: 3300 }); try { await t.page.waitForTimeout(3400); await noCanvas(t.page); assert.equal(t.counts.weather, 1); assert.equal(await t.page.evaluate(() => window.SourBouleWeatherStatus.reason), 'request-timeout'); await t.page.locator('#ordinary').click(); } finally { await t.close(); } });
test('bounded preparation timeout cancels late starter and keeps factual text', async () => { const t = await setup({ prepDelay: 3300 }); try { await shown(t.page); await t.page.waitForTimeout(3400); await noCanvas(t.page); assert.equal(await t.page.evaluate(() => sessionStorage.getItem('sb-weather-session-played-v1')), null); assert.equal(await t.page.evaluate(() => window.SourBouleWeatherStatus.reason), 'renderer-timeout'); } finally { await t.close(); } });
for (const [name, action] of [['weather off', page => page.locator('[data-sb-weather-toggle]').click()], ['reduced motion', page => page.emulateMedia({ reducedMotion: 'reduce' })]]) test(`${name} cancels active effect but preserves readout`, async () => { const t = await setup(); try { await active(t.page); await action(t.page); await noCanvas(t.page); await shown(t.page); assert.equal(t.counts.weather, 1); } finally { await t.close(); } });
for (const stage of ['weather', 'renderer', 'prep']) test(`NYE interruption during ${stage} wins, then factual readout can recover without replay`, async () => {
  const t = await setup({ [stage === 'prep' ? 'prepDelay' : stage + 'Delay']: 220 }); try {
    await t.page.waitForTimeout(60);
    await t.page.evaluate(() => { const host = document.createElement('div'); host.id = 'sb-nye-isolated-host'; document.body.append(host); });
    await t.page.waitForTimeout(280); await noCanvas(t.page); assert.equal(await t.page.locator('.sb-home-weather').isVisible(), false);
    await t.page.evaluate(() => document.getElementById('sb-nye-isolated-host').remove()); await shown(t.page); await noCanvas(t.page); assert.equal(await t.page.evaluate(() => window.fixtureStarts || 0), 0);
  } finally { await t.close(); }
});
test('header disclosure hides the readout while open without removing reserved space', async () => { const t = await setup({ played: true }); try { await shown(t.page); const before = await t.page.locator('[data-sb-home-weather]').boundingBox(); await t.page.locator('summary').click(); assert.equal(await t.page.locator('.sb-home-weather').isVisible(), false); assert.equal((await t.page.locator('[data-sb-home-weather]').boundingBox()).height, before.height); await t.page.locator('summary').click(); await shown(t.page); } finally { await t.close(); } });
test('static-only failure diagnostics preserve animation suppression and explain readout failure', async () => { const t = await setup({ played: true, status: 503 }); try { await t.page.waitForFunction(() => window.SourBouleWeatherStatus.readout === 'http-unavailable'); assert.deepEqual(await t.page.evaluate(() => window.SourBouleWeatherStatus), { version: 3, phase: 'skipped', reason: 'played-session', readout: 'http-unavailable' }); } finally { await t.close(); } });
test('Home index alias has readout; production includes retain one pinned version and seasonal ordering', async () => {
  const t = await setup({ path: '/index.html', played: true }); try { await shown(t.page); } finally { await t.close(); }
  for (const name of ['index.html', 'fort-worth.html', 'willow-bend.html']) {
    const html = await readFile(new URL('../../../' + name, import.meta.url), 'utf8');
    assert.equal((html.match(/data-sb-weather data-location=/g) || []).length, 1);
    assert.match(html, /src="assets\/js\/weather-v3\.js"/); assert.match(html, /workers\.dev\/weather\/v3\//);
    assert.equal((html.match(/data-sb-home-weather/g) || []).length, name === 'index.html' ? 1 : 0);
    if (name === 'index.html') assert.ok(html.indexOf('assets/css/weather-v3.css') < html.indexOf('assets/css/seasonal.css'));
  }
});
test('native back/forward cache restores the same document, fresh readout and consumed-session request savings', async () => {
  // Playwright normally launches Chromium with --disable-back-forward-cache.
  // Omit only that testing default for this real history-navigation check.
  const bfcacheBrowser = await chromium.launch({ headless: true, ignoreDefaultArgs: ['--disable-back-forward-cache'], ...(process.env.SB_CHROME ? { executablePath: process.env.SB_CHROME } : {}) });
  try {
    const context = await bfcacheBrowser.newContext({ viewport: { width: 390, height: 844 } });
    await context.addInitScript(() => {
      sessionStorage.setItem('sb-weather-session-played-v1', '1'); window.fixtureDocument = Math.random(); window.fixturePageshows = [];
      addEventListener('pageshow', event => window.fixturePageshows.push(event.persisted));
    });
    const page = await context.newPage(); let requests = 0;
    await page.route('https://weather.test/**', async route => { requests++; await route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(fixture({}, Date.now())) }); });
    await page.goto(origin); await shown(page); const original = await page.evaluate(() => window.fixtureDocument);
    await page.goto(origin + '/contact.html'); await page.goBack({ waitUntil: 'commit' }); await shown(page);
    assert.equal(await page.evaluate(() => window.fixtureDocument), original, 'Same document was restored');
    assert.equal(await page.evaluate(() => window.fixturePageshows.at(-1)), true, 'Browser emitted a genuine persisted pageshow');
    assert.equal(requests, 1, 'Fresh cached snapshot was reused after actual history restoration'); await noCanvas(page);
    await context.close();
  } finally { await bfcacheBrowser.close(); }
});

test('actual NWS temperature units/QC pipeline feeds the built readout without inferred temperatures', async () => {
  for (const [temperature, expected] of [
    [{ value: 0, unitCode: 'wmoUnit:degC', qualityControl: 'V' }, '32°F'],
    [{ value: 0, unitCode: 'wmoUnit:degF', qualityControl: 'V' }, '0°F'],
    [{ value: null, unitCode: 'wmoUnit:degC', qualityControl: 'V' }, null],
    [{ value: 22, unitCode: 'wmoUnit:degC', qualityControl: 'X' }, null],
    [{ value: 22, unitCode: 'unknown', qualityControl: 'V' }, null]
  ]) {
    const data = publicSnapshotV3(observation(sceneObservation(rain, now, { temperature }), 'KFTW', now), 'fort-worth', now);
    const t = await setup({ played: true, snapshot: data });
    try { await shown(t.page); assert.equal(await t.page.locator('.sb-home-weather__temp').textContent(), expected || ''); assert.equal(await t.page.locator('.sb-home-weather__temp').isVisible(), expected !== null); } finally { await t.close(); }
  }
});

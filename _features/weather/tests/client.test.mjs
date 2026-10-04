import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { publicSnapshotV2 } from '../backend.mjs';
import { solarWindow } from '../solar.mjs';
import { LOCATIONS } from '../config.mjs';
import { validSnapshot } from '../client.mjs';
const require = createRequire(new URL('../../new-year/package.json', import.meta.url));
const { chromium, webkit } = require(process.env.SB_PLAYWRIGHT || 'playwright');
const fixture = (extra = {}, now = Date.now()) => {
  const site = LOCATIONS[extra.location || 'fort-worth'];
  const solar = solarWindow(now, site.latitude, site.longitude);
  return { version: 2, provider: 'NWS', location: 'fort-worth', station: 'KFTW', timezone: 'America/Chicago', condition: 'cloud', effect: 'cloud', mist: false, night: false, observedAt: new Date(now - 60000).toISOString(), fetchedAt: new Date(now).toISOString(), validUntil: new Date(now + 3500000).toISOString(), sunrise: new Date(solar.sunrise).toISOString(), sunset: new Date(solar.sunset).toISOString(), ...extra };
};
const now = Date.parse('2026-10-01T18:00:00.000Z');
test('snapshot rejects malformed, future, stale, incoherent and overlong freshness', () => {
  assert.equal(validSnapshot(fixture({}, now), 'fort-worth', now), true);
  for (const extra of [{ version: 1 }, { version: 3 }, { station: 'KDFW' }, { location: 'willow-bend' }, { station: '' }, { station: ['KFTW'] }, { provider: 'Other' }, { timezone: 'UTC' }, { effect: 'hail' }, { condition: 'clear' }, { observedAt: 'bad' }, { observedAt: '2026-02-30T12:00:00Z' }, { observedAt: new Date(now + 300001).toISOString() }, { fetchedAt: new Date(now + 300001).toISOString() }, { observedAt: new Date(now - 7200001).toISOString() }, { fetchedAt: new Date(now - 3600001).toISOString() }, { validUntil: new Date(now).toISOString() }, { validUntil: new Date(now + 3600001).toISOString() }]) assert.equal(validSnapshot(fixture(extra, now), 'fort-worth', now), false, JSON.stringify(extra));
});
test('clear day/night and expiry cannot cross sunrise or sunset', () => {
  const sun = fixture({ effect: 'sun', condition: 'clear', sunrise: '2026-10-01T12:30:00.000Z', sunset: '2026-10-02T00:15:00.000Z' }, now);
  assert.equal(validSnapshot(sun, 'fort-worth', now), true);
  assert.equal(validSnapshot({ ...sun, effect: 'night' }, 'fort-worth', now), false);
  const dawn = Date.parse(sun.sunrise) - 1000;
  assert.equal(validSnapshot(fixture({ ...sun, effect: 'night', observedAt: new Date(dawn).toISOString(), fetchedAt: new Date(dawn).toISOString(), validUntil: sun.sunrise }, dawn), 'fort-worth', dawn), true);
  assert.equal(validSnapshot(fixture({ ...sun, effect: 'night', observedAt: new Date(dawn).toISOString(), fetchedAt: new Date(dawn).toISOString(), validUntil: new Date(dawn + 2000).toISOString() }, dawn), 'fort-worth', dawn), false);
});

const bootstrap = await readFile(new URL('../../../assets/js/weather-v2.js', import.meta.url), 'utf8');
const fakeRenderer = `export function startWeather(options){if(window.fixtureNoCanvas)return null;window.fixtureStarts=(window.fixtureStarts||0)+1;window.fixtureEffect=options.effect;window.fixtureMist=options.mist;window.fixtureNight=options.night;window.fixtureLeaves=options.autumnLeaves;const c=document.createElement('canvas');c.dataset.sbWeather='';c.setAttribute('aria-hidden','true');c.style.pointerEvents='none';document.body.append(c);let closed=false;const stop=reason=>{if(closed)return;closed=true;c.remove();window.fixtureStops=(window.fixtureStops||0)+1;options.onFinish(reason);};window.fixtureFinish=stop;return stop;}`;
let browser, server, origin;
const engine = process.env.SB_BROWSER === 'webkit' ? webkit : chromium;
test.before(async () => {
  browser = await engine.launch({ headless: true, ...(process.env.SB_CHROME ? { executablePath: process.env.SB_CHROME } : {}) });
  server = createServer((req, res) => {
    if (req.url === '/assets/js/weather-v2.js') { res.setHeader('Content-Type', 'text/javascript'); res.end(bootstrap); return; }
    const willow = req.url.startsWith('/willow-bend.html');
    res.setHeader('Content-Type', 'text/html');
    res.end(`<!doctype html><meta name="viewport" content="width=device-width"><main><h1>Current website</h1><a href="/fort-worth.html">Order</a></main><footer><button data-sb-weather-toggle aria-pressed="true">Weather effects: on</button></footer><script defer src="/assets/js/weather-v2.js" data-location="${willow ? 'willow-bend' : 'fort-worth'}" data-endpoint="https://weather.test/weather/v2/${willow ? 'willow-bend' : 'fort-worth'}"></script>`);
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
  await page.route('**/assets/js/weather-renderer-v2.js', async route => {
    counts.renderer++;
    if (options.rendererDelay) await new Promise(resolve => setTimeout(resolve, options.rendererDelay));
    try { await route.fulfill({ contentType: 'text/javascript', body: options.rendererRaw || fakeRenderer }); } catch {}
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


test('v2 validates modifier agreement, station identity and restaurant solar date', () => {
  for (const extra of [
    { mist: undefined }, { night: undefined }, { mist: 'false' }, { night: 0 },
    { mist: true }, { night: true }, { effect: 'storm', condition: 'storm', mist: true },
    { effect: 'snow', condition: 'snow', mist: true }, { effect: 'rain', condition: 'drizzle' },
    { effect: 'rain', condition: 'rain', night: true }, { sunrise: 'bad' },
    { condition: 'clear', effect: 'sun', sunrise: '2026-09-30T12:30:00.000Z', sunset: '2026-10-01T00:15:00.000Z' }
  ]) assert.equal(validSnapshot(fixture(extra, now), 'fort-worth', now), false, JSON.stringify(extra));
  for (const effect of ['rain', 'drizzle']) for (const mist of [false, true]) assert.equal(validSnapshot(fixture({ condition: effect, effect, mist }, now), 'fort-worth', now), true);
  assert.equal(validSnapshot(fixture({ condition: 'storm', effect: 'storm' }, now), 'fort-worth', now), true);
});
test('fog night coloring and absolute expiry obey Chicago sunrise/sunset at both boundaries', () => {
  const site = LOCATIONS['fort-worth'], solar = solarWindow(now, site.latitude, site.longitude);
  for (const [boundary, beforeNight, afterNight] of [[solar.sunrise, true, false], [solar.sunset, false, true]]) {
    const before = boundary - 1;
    const values = { condition: 'fog', effect: 'fog', night: beforeNight, sunrise: new Date(solar.sunrise).toISOString(), sunset: new Date(solar.sunset).toISOString(), validUntil: new Date(boundary).toISOString() };
    assert.equal(validSnapshot(fixture(values, before), 'fort-worth', before), true);
    assert.equal(validSnapshot(fixture({ ...values, night: !beforeNight }, before), 'fort-worth', before), false);
    assert.equal(validSnapshot(fixture({ ...values, validUntil: new Date(boundary + 1).toISOString() }, before), 'fort-worth', before), false);
    assert.equal(validSnapshot(fixture({ ...values, night: afterNight, validUntil: new Date(boundary + 600000).toISOString() }, boundary), 'fort-worth', boundary), true);
  }
});
for (const [name, snapshot] of [
  ['unknown version', { version: 9 }], ['old response at v2 endpoint', { version: 1 }],
  ['wrong station', { station: 'KDFW' }], ['impossible mist', { effect: 'fog', condition: 'fog', mist: true }]
]) test(`v2 ${name} cannot import renderer`, async () => {
  const t = await setup({ snapshot }); try { await t.page.waitForTimeout(200); await absent(t.page); assert.deepEqual(t.counts, { weather: 1, renderer: 0 }); } finally { await t.close(); }
});
test('expansion-disabled legacy projection works with one v2 request and no extra lookup', async () => {
  const t = await setup({ snapshot: { effect: 'rain', condition: 'rain', mist: false, night: false } }); try {
    await active(t.page);
    assert.deepEqual(await t.page.evaluate(() => [window.fixtureEffect, window.fixtureMist, window.fixtureNight]), ['rain', false, false]);
    assert.deepEqual(t.counts, { weather: 1, renderer: 1 });
  } finally { await t.close(); }
});
test('three production includes activate only v3 and retained v2/v1 bootstraps pin their compatible renderers', async () => {
  for (const page of ['index.html', 'fort-worth.html', 'willow-bend.html']) {
    const html = await readFile(new URL('../../../' + page, import.meta.url), 'utf8');
    const includes = html.match(/<script[^>]+data-sb-weather[^>]*>/g) || [];
    assert.equal(includes.length, 1, page);
    assert.match(includes[0], /src="assets\/js\/weather-v3\.js"/);
    assert.match(includes[0], /data-endpoint="https:\/\/sour-boule-weather\.lance-c84\.workers\.dev\/weather\/v3\/(fort-worth|willow-bend)"/);
  }
  assert.match(bootstrap, /\/assets\/js\/weather-renderer-v2\.js/);
  assert.doesNotMatch(bootstrap, /\/assets\/js\/weather-renderer\.js/);
  const legacy = await readFile(new URL('../../../assets/js/weather.js', import.meta.url), 'utf8');
  assert.match(legacy, /\/assets\/js\/weather-renderer\.js/);
  assert.doesNotMatch(legacy, /\/assets\/js\/weather-renderer-v2\.js/);
});


const stored = (condition, at) => ({ station: 'KFTW', condition: condition === 'fog' ? 'none' : condition,
  expansion: { version: 2, condition, mist: false }, observedAt: new Date(at - 60000).toISOString(),
  fetchedAt: new Date(at).toISOString(), validUntil: new Date(at + 3600000).toISOString() });
test('cached rain/cloud and new reads remain valid across local midnight without a solar variant', () => {
  const before = Date.parse('2026-10-03T04:59:00Z'), after = Date.parse('2026-10-03T05:01:00Z');
  for (const location of Object.keys(LOCATIONS)) for (const condition of ['rain', 'cloud']) {
    const cache = stored(condition, before), response = publicSnapshotV2(cache, location, before);
    assert.equal(validSnapshot(response, location, before), true);
    assert.equal(validSnapshot(response, location, after), true, 'Unused yesterday solar data does not suppress current precipitation/cloud');
    assert.equal(validSnapshot(publicSnapshotV2(cache, location, after), location, after), true);
    assert.equal(response.effect, condition); assert.equal(response.night, false);
    assert.equal(validSnapshot(response, location, Date.parse(cache.validUntil)), false, 'Absolute hourly expiry remains enforced');
  }
});
test('cached clear-night/fog expires at midnight and freshly projected same observation validates after midnight', () => {
  const before = Date.parse('2026-10-03T04:59:00Z'), midnight = Date.parse('2026-10-03T05:00:00Z'), after = midnight + 60000;
  for (const location of Object.keys(LOCATIONS)) for (const condition of ['clear', 'fog']) {
    const cache = stored(condition, before), response = publicSnapshotV2(cache, location, before);
    assert.equal(response.validUntil, new Date(midnight).toISOString());
    assert.equal(validSnapshot(response, location, before), true);
    assert.equal(validSnapshot(response, location, midnight), false);
    assert.equal(validSnapshot(response, location, after), false);
    const fresh = publicSnapshotV2(cache, location, after);
    assert.equal(validSnapshot(fresh, location, after), true);
    assert.equal(fresh.observedAt, response.observedAt); assert.equal(fresh.fetchedAt, response.fetchedAt);
    assert.equal(fresh.effect, condition === 'clear' ? 'night' : 'fog'); assert.equal(fresh.night, condition === 'fog');
  }
});
test('HTTP-cached solar boundaries and hourly expiry reject old data; new projections preserve observation provenance', () => {
  for (const location of Object.keys(LOCATIONS)) {
    const site = LOCATIONS[location], solar = solarWindow(now, site.latitude, site.longitude);
    for (const boundary of [solar.sunrise, solar.sunset]) for (const condition of ['clear', 'fog', 'rain', 'cloud']) {
      const before = boundary - 1000, after = boundary + 1000, cache = stored(condition, before);
      const oldResponse = publicSnapshotV2(cache, location, before);
      assert.equal(validSnapshot(oldResponse, location, before), true);
      assert.equal(validSnapshot(oldResponse, location, after), !['clear', 'fog'].includes(condition));
      const freshResponse = publicSnapshotV2(cache, location, after);
      assert.equal(validSnapshot(freshResponse, location, after), true);
      assert.equal(freshResponse.observedAt, oldResponse.observedAt);
      assert.equal(freshResponse.fetchedAt, oldResponse.fetchedAt);
      assert.equal(validSnapshot(freshResponse, location, Date.parse(cache.validUntil)), false);
      if (['rain', 'cloud'].includes(condition)) assert.equal(freshResponse.effect, condition, 'Night cannot replace precipitation or cloud');
    }
  }
});
for (const [name, options, reason] of [
  ['session', { played: true }, 'played-session'], ['preference', { off: true }, 'preference-off'],
  ['storage', { denied: 'sessionStorage' }, 'storage-unavailable'], ['reduced motion', { motion: 'reduce' }, 'reduced-motion'],
  ['slow connection', { connection: { saveData: true } }, 'slow-connection'],
  ['fresh none', { snapshot: { effect: 'none', condition: 'none' } }, 'no-effect'],
  ['invalid snapshot', { snapshot: { version: 99 } }, 'invalid-snapshot'], ['service unavailable', { status: 503 }, 'http-unavailable'],
  ['malformed timestamps', { snapshot: { observedAt: 'invalid' } }, 'snapshot-timestamps'],
  ['expired snapshot', { snapshot: { validUntil: '2026-01-01T00:00:00Z' } }, 'snapshot-freshness'],
  ['invalid solar data', { snapshot: { sunrise: 'invalid' } }, 'snapshot-solar']
]) test(`bounded local diagnostics distinguish ${name}`, async () => {
  const t = await setup(options); try {
    await t.page.waitForTimeout(220);
    const status = await t.page.evaluate(() => ({ value: window.SourBouleWeatherStatus, frozen: Object.isFrozen(window.SourBouleWeatherStatus), setter: Object.getOwnPropertyDescriptor(window, 'SourBouleWeatherStatus').set !== undefined, keys: Object.keys(window.SourBouleWeatherStatus) }));
    assert.deepEqual(status.value, { version: 2, phase: 'skipped', reason });
    assert.equal(status.frozen, true); assert.equal(status.setter, false);
    assert.deepEqual(status.keys, ['version', 'phase', 'reason']);
    assert.equal(t.counts.renderer, 0);
  } finally { await t.close(); }
});
test('local diagnostics preserve renderer busy termination without restarting or exposing controls', async () => {
  const t = await setup(); try {
    await active(t.page);
    assert.equal(await t.page.evaluate(() => window.SourBouleWeatherStatus.phase), 'playing');
    await t.page.evaluate(() => window.fixtureFinish('busy'));
    assert.deepEqual(await t.page.evaluate(() => window.SourBouleWeatherStatus), { version: 2, phase: 'finished', reason: 'busy', effect: 'cloud' });
    await absent(t.page); assert.deepEqual(t.counts, { weather: 1, renderer: 1 });
  } finally { await t.close(); }
});
test('renderer module syntax failure is distinguished from malformed weather JSON', async () => {
  const t = await setup({ rendererRaw: 'invalid module !!' }); try {
    await t.page.waitForFunction(() => window.SourBouleWeatherStatus.phase === 'skipped');
    assert.deepEqual(await t.page.evaluate(() => window.SourBouleWeatherStatus), { version: 2, phase: 'skipped', reason: 'renderer-failed', effect: 'cloud' });
    await absent(t.page);
    assert.deepEqual(t.counts, { weather: 1, renderer: 1 });
    assert.equal(await t.page.evaluate(() => sessionStorage.getItem('sb-weather-session-played-v1')), null);
  } finally { await t.close(); }
});

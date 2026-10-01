import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { WeatherCache, publicSnapshot } from '../backend.mjs';
import { normalize, windMph, observation, fetchStation } from '../provider.mjs';
import { solarWindow } from '../solar.mjs';
import { HOUR, LOCATIONS } from '../config.mjs';
const NOW = Date.parse('2026-10-01T15:30:00Z');
const iso = (value) => new Date(value).toISOString();
const report = (changes = {}, age = 20 * 60000) => ({ properties: { station: 'https://api.weather.gov/stations/KFTW', timestamp: iso(NOW - age), presentWeather: [], textDescription: 'Fair', cloudLayers: [{ amount: 'CLR' }], windSpeed: { value: 10, unitCode: 'wmoUnit:km_h-1' }, ...changes } });
const base = () => observation(report(), 'KFTW', NOW);
const rain = { presentWeather: [{ weather: 'rain', modifier: null, intensity: 'light' }], textDescription: 'Light Rain' };
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
function harness() {
  const data = new Map();
  const env = { WEATHER_ENABLED: 'true', REFRESH_TOKEN: 'a'.repeat(48) };
  const state = { storage: { get: async (k) => data.get(k), put: async (k, v) => data.set(k, structuredClone(v)), delete: async (k) => data.delete(k) }, blockConcurrencyWhile: (fn) => fn() };
  const object = new WeatherCache(state, env);
  env.WEATHER_CACHE = { idFromName: (v) => v, get: () => object };
  return { data, env, object };
}
test('structured current precipitation has priority and past totals are not weather', () => {
  assert.equal(normalize(report({ ...rain, windGust: { value: 80, unitCode: 'wmoUnit:km_h-1' } }).properties).condition, 'rain');
  for (const amount of ['SCT', 'BKN', 'OVC']) assert.equal(normalize(report({ ...rain, cloudLayers: [{ amount }] }).properties).condition, 'rain');
  assert.equal(normalize(report({ presentWeather: [{ weather: 'snow', modifier: 'showers' }], textDescription: 'Light Snow' }).properties).condition, 'snow');
  assert.equal(normalize(report({ precipitationLastHour: { value: 10, unitCode: 'wmoUnit:mm' } }).properties).condition, 'clear');
});
test('ordinary rain or drizzle with fog and fog_mist selects rain in either order', () => {
  for (const precipitation of ['rain', 'drizzle']) for (const fog of ['fog', 'fog_mist']) {
    const list = [{ weather: precipitation, intensity: 'light', modifier: null }, { weather: fog, modifier: null }];
    for (const presentWeather of [list, [...list].reverse()]) {
      const p = report({ presentWeather, textDescription: 'Light Rain and Fog/Mist', cloudLayers: [{ amount: 'OVC' }] }).properties;
      assert.deepEqual(normalize(p), { condition: 'rain', coherent: true });
    }
  }
  assert.equal(normalize({ presentWeather: [{ weather: 'fog' }, { weather: 'drizzle' }, { weather: 'fog_mist' }, { weather: 'rain' }] }).condition, 'rain');
});
test('fog alone cannot invent precipitation or broaden snow and modifier support', () => {
  for (const weather of ['fog', 'fog_mist']) {
    // Even a positive text description cannot override a populated structured list.
    assert.equal(normalize(report({ presentWeather: [{ weather }], textDescription: 'Light Rain and Fog/Mist' }).properties).condition, 'none');
    for (const list of [[{ weather }, { weather: 'snow' }], [{ weather, modifier: 'freezing' }, { weather: 'rain' }], [{ weather, modifier: 'showers' }, { weather: 'rain' }], [{ weather, inVicinity: true }, { weather: 'drizzle' }]]) {
      for (const presentWeather of [list, [...list].reverse()]) assert.equal(normalize({ presentWeather }).condition, 'none');
    }
  }
});
test('mixed, freezing, vicinity and unknown conditions conservatively suppress effects', () => {
  for (const weather of ['hail', 'ice_pellets', 'thunderstorms', 'unknown', 'smoke', 'snow', 'mist', null]) {
    const list = [{ weather }, { weather: 'rain' }, { weather: 'fog_mist' }];
    // Exhaust every permutation: rain first must not mask a later restriction.
    for (const presentWeather of [list, [list[0], list[2], list[1]], [list[1], list[0], list[2]], [list[1], list[2], list[0]], [list[2], list[0], list[1]], [...list].reverse()]) {
      assert.equal(normalize(report({ presentWeather, textDescription: 'Light Rain and Fog/Mist' }).properties).condition, 'none');
    }
  }
  for (const p of [[{ weather: 'rain' }, { weather: 'snow' }], [{ weather: 'rain', modifier: 'freezing' }], [{ weather: 'snow', modifier: 'blowing' }], [{ weather: 'rain', inVicinity: true }], [null]]) assert.equal(normalize(report({ presentWeather: p }).properties).condition, 'none');
  assert.equal(normalize(report({ presentWeather: [{ weather: 'rain' }, { weather: 'drizzle' }] }).properties).condition, 'rain');
});
test('all supported wind units use a 20 mph threshold without null coercion', () => {
  for (const [unitCode, value] of [['wmoUnit:km_h-1', 32.18688], ['wmoUnit:m_s-1', 8.9408], ['wmoUnit:kn', 20 * 1609.344 / 1852], ['wmoUnit:mi_h-1', 20]]) {
    assert.equal(windMph({ value, unitCode }), 20);
    assert.equal(normalize(report({ windSpeed: { value, unitCode } }).properties).condition, 'wind');
    assert.equal(normalize(report({ windSpeed: { value: value + 0.001, unitCode } }).properties).condition, 'wind');
    assert.equal(normalize(report({ windSpeed: { value: value - 0.001, unitCode } }).properties).condition, 'clear');
    assert.equal(normalize(report({ windGust: { value: value + 0.001, unitCode } }).properties).condition, 'wind');
  }
  for (const value of [null, undefined, NaN, -1, '20']) assert.equal(windMph({ value, unitCode: 'wmoUnit:mi_h-1' }), null);
  assert.equal(windMph({ value: 999, unitCode: 'unknown' }), null);
  assert.equal(windMph({ value: 99, unitCode: 'wmoUnit:mi_h-1', qualityControl: 'Q' }), null);
});
test('cloud categories require positive evidence and contradictions do not imply clear', () => {
  for (const amount of ['OVC', 'BKN', 'SCT']) assert.equal(normalize(report({ textDescription: '', cloudLayers: [{ amount }] }).properties).condition, 'cloud');
  for (const amount of ['CLR', 'SKC', 'FEW']) assert.equal(normalize(report({ textDescription: '', cloudLayers: [{ amount }] }).properties).condition, 'clear');
  for (const amount of ['VV', null, 'stratus']) assert.equal(normalize(report({ cloudLayers: [{ amount }] }).properties).condition, 'none');
  assert.equal(normalize(report({ cloudLayers: [{ amount: 'BKN' }] }).properties).condition, 'none');
  assert.deepEqual(normalize({ presentWeather: [], cloudLayers: [], textDescription: '' }), { condition: 'none', coherent: false });
  assert.deepEqual(normalize({ presentWeather: null, cloudLayers: [{ amount: 'CLR' }] }), { condition: 'none', coherent: false });
  assert.equal(normalize(null).coherent, false);
});
test('description fallback is an exact table, not keyword/forecast matching', () => {
  for (const [textDescription, condition] of [['Fair', 'clear'], ['Clear', 'clear'], ['A Few Clouds', 'clear'], ['Mostly Cloudy', 'cloud'], ['Overcast', 'cloud'], ['Light Rain', 'rain'], ['Heavy Snow', 'snow']]) assert.equal(normalize({ textDescription }).condition, condition);
  for (const textDescription of ['Chance Rain', 'Rain nearby', 'Rain and Snow', 'Partly cloudy with rain', 'Thunderstorms', 'Not clear', 'sunny', 'Fog', 'Fog/Mist', 'Light Rain and Fog/Mist with Thunderstorms', 'Light Rain and Freezing Fog', 'Chance of Light Rain and Fog/Mist', 'light rain and fog/mist']) assert.equal(normalize({ textDescription, presentWeather: [], windGust: { value: 50, unitCode: 'wmoUnit:mi_h-1' } }).condition, 'none');
});
test('verified exact NWS rain and drizzle with fog text works only as fallback', () => {
  for (const textDescription of ['Rain and Fog/Mist', 'Light Rain and Fog/Mist', 'Heavy Rain and Fog/Mist', 'Light Drizzle and Fog/Mist']) {
    assert.equal(normalize({ textDescription }).condition, 'rain');
    assert.equal(normalize({ textDescription, presentWeather: [] }).condition, 'rain');
    for (const weather of ['fog', 'fog_mist', 'hail', 'smoke', 'unknown']) assert.equal(normalize({ textDescription, presentWeather: [{ weather }] }).condition, 'none');
  }
});
test('observation timestamps, station identity and absolute expiry are validated', () => {
  assert.equal(base().observedAt, iso(NOW - 20 * 60000));
  assert.equal(base().validUntil, iso(NOW + HOUR));
  assert.equal(observation(report({}, 90 * 60000), 'KFTW', NOW).validUntil, iso(NOW + 30 * 60000));
  for (const timestamp of [null, '', 'garbage', '2026-10-01', '2026-02-30T12:00:00Z', '2026-10-01T24:00:00Z', '2026-10-01T12:60:00Z', iso(NOW + 300001), iso(NOW - 2 * HOUR)]) assert.equal(observation(report({ timestamp }), 'KFTW', NOW), null);
  assert.ok(observation(report({ timestamp: iso(NOW + 300000) }), 'KFTW', NOW));
  assert.equal(observation(report({ station: 'https://api.weather.gov/stations/KDFW' }), 'KFTW', NOW), null);
  const refetched = observation(report({}, 110 * 60000), 'KFTW', NOW);
  assert.equal(refetched.validUntil, iso(NOW + 10 * 60000));
});
test('provider validates latest with identifying User-Agent and never uses forecast', async () => {
  const urls = [];
  const result = await fetchStation('KFTW', NOW, async (url, options) => {
    urls.push(url); assert.match(options.headers['User-Agent'], /thesourboule.com/); assert.equal(options.redirect, 'manual');
    return response(report(rain));
  });
  assert.equal(result.condition, 'rain'); assert.deepEqual(urls, ['https://api.weather.gov/stations/KFTW/observations/latest']);
});
test('incomplete latest inspects at most four whole history reports with no field mixing', async () => {
  let calls = 0;
  const result = await fetchStation('KFTW', NOW, async (url) => {
    calls++;
    if (calls === 1) return response(report({ cloudLayers: [], textDescription: '', windSpeed: null }));
    assert.match(url, /limit=4&start=/);
    return response({ features: [report({ timestamp: iso(NOW + 600000) }), report({ presentWeather: null, textDescription: '', cloudLayers: [] }), report(rain, 40 * 60000), report({}, 60 * 60000), report({}, 10 * 60000)] });
  });
  assert.equal(calls, 2); assert.equal(result.condition, 'rain'); assert.equal(result.observedAt, iso(NOW - 40 * 60000));
});
test('valid unsupported report does not cherry-pick an older attractive effect', async () => {
  let calls = 0;
  const result = await fetchStation('KFTW', NOW, async () => { calls++; return response(report({ presentWeather: [{ weather: 'rain' }, { weather: 'thunderstorms' }], textDescription: 'Thunderstorm and Rain' })); });
  assert.equal(result.condition, 'none'); assert.equal(calls, 1);
});
test('provider failure/malformed reports are bounded and fail closed without retry loops', async () => {
  for (const fetcher of [async () => response({}, 503), async () => response({}, 302), async () => { throw Error('timeout'); }, async () => new Response('not-json')]) {
    let calls = 0;
    assert.equal(await fetchStation('KFTW', NOW, (...args) => { calls++; return fetcher(...args); }), null); assert.equal(calls, 1);
  }
  let calls = 0;
  assert.equal(await fetchStation('KFTW', NOW, async () => { calls++; return response({ features: [] }); }), null);
  assert.equal(calls, 2);
});
test('solar calculation follows restaurant Chicago date, DST and seasonal changes', () => {
  const site = LOCATIONS['fort-worth'];
  const today = solarWindow(NOW, site.latitude, site.longitude);
  // Independently reasonable Dallas/Fort Worth solar bounds in early October.
  assert.ok(today.sunrise > Date.parse('2026-10-01T12:15:00Z') && today.sunrise < Date.parse('2026-10-01T12:35:00Z'));
  assert.ok(today.sunset > Date.parse('2026-10-01T00:00:00Z') + 23 * HOUR && today.sunset < Date.parse('2026-10-02T00:25:00Z'));
  assert.equal(solarWindow(Date.parse('2026-10-02T01:00:00Z'), site.latitude, site.longitude).sunrise, today.sunrise);
  for (const date of ['2026-03-08T12:00:00Z', '2026-11-01T12:00:00Z', '2028-02-29T12:00:00Z']) {
    const value = solarWindow(Date.parse(date), site.latitude, site.longitude); assert.ok(value.sunrise < value.sunset);
  }
  assert.equal(solarWindow(NaN, site.latitude, site.longitude), null);
});
test('clear selection and absolute response expiry cannot cross sunrise/sunset', () => {
  const site = LOCATIONS['fort-worth'], solar = solarWindow(NOW, site.latitude, site.longitude);
  for (const [boundary, beforeEffect, afterEffect] of [[solar.sunrise, 'night', 'sun'], [solar.sunset, 'sun', 'night']]) {
    const value = { station: site.station, condition: 'clear', observedAt: iso(boundary - 600000), fetchedAt: iso(boundary - 600000), validUntil: iso(boundary + 3000000) };
    const before = publicSnapshot(value, 'fort-worth', boundary - 1);
    assert.equal(before.effect, beforeEffect); assert.equal(before.validUntil, iso(boundary));
    assert.equal(publicSnapshot(value, 'fort-worth', boundary).effect, afterEffect);
    assert.equal(publicSnapshot({ ...value, condition: 'rain' }, 'fort-worth', boundary - 1).effect, 'rain');
  }
});
test('snapshot validation fails closed for stale future malformed or forged cache', () => {
  assert.equal(publicSnapshot(base(), 'fort-worth', NOW).effect, 'sun');
  assert.equal(publicSnapshot(base(), 'unknown', NOW), null);
  for (const changes of [{ station: 'KDFW' }, { condition: 'storm' }, { fetchedAt: iso(NOW + 300001) }, { observedAt: 'garbage' }, { validUntil: iso(NOW + HOUR + 1) }, { validUntil: iso(NOW) }]) assert.equal(publicSnapshot({ ...base(), ...changes }, 'fort-worth', NOW), null);
  assert.equal(publicSnapshot(base(), 'fort-worth', NOW + HOUR), null);
});
test('server cron refresh deduplicates shared station but stores distinct location snapshots', async (t) => {
  t.mock.method(Date, 'now', () => NOW);
  let calls = 0; t.mock.method(globalThis, 'fetch', async () => { calls++; return response(report(rain)); });
  const { env, data } = harness(); let promise;
  await worker.scheduled({}, env, { waitUntil: (p) => { promise = p; } }); await promise;
  assert.equal(calls, 1); assert.ok(data.has('snapshot:fort-worth')); assert.ok(data.has('snapshot:willow-bend'));
  assert.notEqual(data.get('snapshot:fort-worth'), data.get('snapshot:willow-bend'));
  assert.equal(data.get('last-refresh').source, 'scheduled');
  await worker.scheduled({}, env, { waitUntil: (p) => { promise = p; } }); await promise; assert.equal(calls, 1);
});
test('visitor requests including an absent cache never call provider or initialize refresh', async (t) => {
  t.mock.method(Date, 'now', () => NOW);
  let calls = 0; t.mock.method(globalThis, 'fetch', async () => { calls++; throw Error('must not fetch'); });
  const { env, data } = harness();
  for (let i = 0; i < 10; i++) assert.equal((await worker.fetch(new Request('https://weather.example/weather/fort-worth'), env)).status, 503);
  data.set('snapshot:fort-worth', base());
  const r = await worker.fetch(new Request('https://weather.example/weather/fort-worth', { headers: { Origin: 'https://thesourboule.com' } }), env);
  assert.equal(r.status, 200); assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://thesourboule.com');
  assert.equal(r.headers.get('Access-Control-Allow-Credentials'), null); assert.match(r.headers.get('Cache-Control'), /max-age=300/);
  assert.ok((await r.text()).length < 2048); assert.equal(calls, 0); assert.equal(data.has('attempt-hour'), false);
  assert.equal((await worker.fetch(new Request('https://weather.example/weather/willow-bend'), env)).status, 503);
});
test('failed hourly refresh clears only weather snapshot and does not grant retries to visitors', async (t) => {
  t.mock.method(Date, 'now', () => NOW); let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw Error('upstream failure'); });
  const { env, data, object } = harness(); data.set('snapshot:fort-worth', base());
  await object.fetch(new Request('https://weather-cache/refresh', { method: 'POST' }));
  assert.equal(data.has('snapshot:fort-worth'), false);
  for (let i = 0; i < 5; i++) await worker.fetch(new Request('https://weather.example/weather/fort-worth'), env);
  await object.fetch(new Request('https://weather-cache/refresh', { method: 'POST' }));
  assert.equal(calls, 1);
});
test('fixed public routes, methods, exact CORS and secret refresh deny arbitrary input', async (t) => {
  t.mock.method(Date, 'now', () => NOW); t.mock.method(globalThis, 'fetch', async () => response(report()));
  const { env } = harness();
  for (const path of ['/weather/anywhere', '/weather/fort-worth?condition=rain', '/weather/fort-worth?url=https://evil.test']) assert.ok((await worker.fetch(new Request(`https://weather.example${path}`), env)).status >= 400);
  assert.equal((await worker.fetch(new Request('https://weather.example/weather/fort-worth', { headers: { Origin: 'https://evil.test' } }), env)).status, 403);
  assert.equal((await worker.fetch(new Request('https://weather.example/weather/fort-worth', { method: 'POST' }), env)).status, 405);
  assert.equal((await worker.fetch(new Request('https://weather.example/internal/refresh', { method: 'POST' }), env)).status, 404);
  assert.equal((await worker.fetch(new Request('https://weather.example/internal/refresh', { method: 'POST', headers: { Authorization: `Bearer ${env.REFRESH_TOKEN}` } }), env)).status, 200);
  assert.equal((await worker.fetch(new Request('https://weather.example/internal/refresh', { method: 'POST', headers: { Origin: 'https://thesourboule.com', Authorization: `Bearer ${env.REFRESH_TOKEN}` } }), env)).status, 404);
});
test('weather-only kill switch suppresses reads and scheduled refresh without touching content', async () => {
  const { env } = harness(); env.WEATHER_ENABLED = 'false';
  let pending = false; await worker.scheduled({}, env, { waitUntil: () => { pending = true; } }); assert.equal(pending, false);
  const r = await worker.fetch(new Request('https://weather.example/weather/fort-worth'), env);
  assert.equal(r.status, 503); assert.equal((await r.json()).reason, 'disabled');
});

test('refresh slots align with cron minute so initial setup does not suppress first scheduled tick', async (t) => {
  let now = Date.parse('2026-10-01T15:40:00Z');
  t.mock.method(Date, 'now', () => now); let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return response(report(rain)); });
  const { env, object, data } = harness();
  await object.fetch(new Request('https://weather-cache/refresh', { method: 'POST' }));
  now = Date.parse('2026-10-01T15:47:00Z'); let pending;
  await worker.scheduled({}, env, { waitUntil: (p) => { pending = p; } }); await pending;
  assert.equal(calls, 2); assert.equal(data.get('last-refresh').source, 'scheduled');
  assert.equal(data.get('last-refresh').attemptedAt, iso(now));
});

test('hung provider request is aborted at the bounded server deadline', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let calls = 0, aborted = false;
  const pending = fetchStation('KFTW', NOW, async (_url, options) => {
    calls++;
    return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => {
      aborted = true; reject(new Error('aborted'));
    }, { once: true }));
  });
  t.mock.timers.tick(4500);
  assert.equal(await pending, null); assert.equal(aborted, true); assert.equal(calls, 1);
});

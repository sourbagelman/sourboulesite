import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { WeatherCache, publicSnapshot, publicSnapshotV2 } from '../backend.mjs';
import { normalize, normalizeExpansion, classifyExpansion, observation, fetchStation } from '../provider.mjs';
import { solarWindow } from '../solar.mjs';
import { HOUR, LOCATIONS } from '../config.mjs';

const NOW = Date.parse('2026-10-02T15:30:00Z');
const iso = (value) => new Date(value).toISOString();
const phenomenon = (weather, changes = {}) => ({ weather, intensity: null, modifier: null, rawString: ({ rain: 'RA', drizzle: 'DZ', snow: 'SN', fog: 'FG', fog_mist: 'BR', thunderstorms: 'TS' })[weather] || 'XX', ...changes });
const properties = (presentWeather = [], changes = {}) => ({ station: 'https://api.weather.gov/stations/KFTW', timestamp: iso(NOW - 20 * 60000), presentWeather, textDescription: '', cloudLayers: [{ amount: 'OVC' }], ...changes });
const record = (weather, now = NOW, changes = {}) => observation({ properties: properties(weather, { timestamp: iso(now - 20 * 60000), ...changes }) }, 'KFTW', now);
const response = (value, status = 200) => new Response(JSON.stringify(value), { status });
const permutations = (values) => values.length < 2 ? [values] : values.flatMap((value, index) => permutations(values.filter((_, other) => other !== index)).map((rest) => [value, ...rest]));
function harness() {
  const data = new Map();
  const env = { WEATHER_ENABLED: 'true', WEATHER_EXPANSION_ENABLED: 'true', REFRESH_TOKEN: 's'.repeat(48) };
  const ctx = { storage: { get: async (key) => data.get(key), put: async (key, value) => data.set(key, structuredClone(value)), delete: async (key) => data.delete(key) }, blockConcurrencyWhile: (fn) => fn() };
  const object = new WeatherCache(ctx, env);
  env.WEATHER_CACHE = { idFromName: (name) => { assert.equal(name, 'restaurant-weather-live-v1'); return name; }, get: () => object };
  return { data, env, object, ctx };
}

test('v2 complete structured combinations are order-independent; v1 projection stays separate', () => {
  for (const [names, condition, mist, legacy] of [
    [['fog'], 'fog', false, 'none'], [['fog_mist'], 'fog', false, 'none'],
    [['drizzle'], 'drizzle', false, 'rain'], [['drizzle', 'fog'], 'drizzle', true, 'rain'],
    [['rain', 'fog_mist'], 'rain', true, 'rain'], [['rain', 'drizzle', 'fog'], 'rain', true, 'rain'],
    [['rain', 'thunderstorms'], 'storm', false, 'none'], [['rain', 'drizzle', 'thunderstorms', 'fog_mist'], 'storm', false, 'none'],
    [['snow'], 'snow', false, 'snow'], [['snow', 'fog_mist'], 'snow', false, 'none']
  ]) for (const presentWeather of permutations(names.map((name) => phenomenon(name)))) {
    const p = properties(presentWeather, { windGust: { value: 90, unitCode: 'wmoUnit:mi_h-1' } });
    assert.deepEqual(normalizeExpansion(p), { condition, mist });
    assert.equal(normalize(p).condition, legacy);
    const snapshot = observation({ properties: p }, 'KFTW', NOW);
    assert.equal(snapshot.condition, legacy);
    assert.deepEqual(snapshot.expansion, { version: 2, condition, mist });
  }
});

test('v2 validates every entry, including an unsupported third item in all orders', () => {
  for (const weather of ['hail', 'ice_pellets', 'snow_pellets', 'ice_crystals', 'smoke', 'dust', 'squalls', 'unknown', 'mist', null]) {
    for (const list of permutations([phenomenon('rain'), phenomenon('fog_mist'), phenomenon(weather)])) {
      assert.deepEqual(normalizeExpansion(properties(list)), { condition: 'none', mist: false });
    }
  }
  for (const names of [['rain', 'snow'], ['drizzle', 'snow'], ['thunderstorms'], ['thunderstorms', 'drizzle'], ['thunderstorms', 'snow']]) {
    for (const list of permutations(names.map((name) => phenomenon(name)))) assert.equal(normalizeExpansion(properties(list)).condition, 'none');
  }
});

test('v2 validates schema fields and rejects freezing, blowing, vicinity and malformed reports', () => {
  const valid = phenomenon('rain');
  for (const changes of [{ intensity: 'moderate' }, { intensity: 1 }, { modifier: 'freezing' }, { modifier: 'blowing' }, { modifier: 'patches' }, { modifier: 'shallow' }, { modifier: 'low_drifting' }, { modifier: 'partial' }, { inVicinity: true }, { inVicinity: null }, { inVicinity: 'false' }, { rawString: null }, { rawString: '' }, { extra: true }, { weather: 'RAIN' }]) {
    for (const list of permutations([phenomenon('fog'), { ...valid, ...changes }])) assert.equal(normalizeExpansion(properties(list)).condition, 'none');
  }
  for (const key of ['intensity', 'modifier', 'rawString', 'weather']) {
    const incomplete = { ...valid }; delete incomplete[key];
    assert.equal(normalizeExpansion(properties([incomplete])).condition, 'none');
  }
  for (const malformed of [null, 'rain', 5, [], {}]) assert.equal(normalizeExpansion(properties([valid, malformed])).condition, 'none');
  for (const malformed of [null, 'rain', {}, 42]) assert.equal(normalizeExpansion(properties(malformed, { textDescription: 'Light Rain' })).condition, 'none');
  assert.equal(normalizeExpansion(properties([phenomenon('rain', { modifier: 'showers', inVicinity: false })])).condition, 'rain');
  assert.equal(normalizeExpansion(properties([phenomenon('snow', { modifier: 'showers' })])).condition, 'snow');
  for (const weather of ['drizzle', 'fog', 'fog_mist', 'thunderstorms']) assert.equal(normalizeExpansion(properties([phenomenon('rain'), phenomenon(weather, { modifier: 'showers' })])).condition, 'none');
});

test('heavy rain, wind, and forecast words never manufacture storm rain', () => {
  assert.equal(normalizeExpansion(properties([phenomenon('rain', { intensity: 'heavy' })])).condition, 'rain');
  assert.equal(normalizeExpansion(properties([phenomenon('thunderstorms')], { textDescription: 'Heavy Rain' })).condition, 'none');
  assert.equal(normalizeExpansion(properties([], { windGust: { value: 80, unitCode: 'wmoUnit:mi_h-1' } })).condition, 'wind');
  for (const textDescription of ['Chance of Thunderstorms and Rain', 'Heavy Rain Nearby', 'Fog/Mist', 'Light Rain and Thunderstorms', 'Cloudy with Rain', 'cloudy', 'Cloudy Tonight']) assert.equal(normalizeExpansion(properties([], { textDescription })).condition, 'none');
});

test('verified exact fallback phrases are narrow and never override populated structured weather', () => {
  for (const [textDescription, condition, mist] of [
    ['Fog', 'fog', false], ['Heavy Thunderstorms and Heavy Rain', 'storm', false],
    ['Drizzle', 'drizzle', false], ['Light Drizzle', 'drizzle', false], ['Heavy Drizzle', 'drizzle', false],
    ['Rain and Fog/Mist', 'rain', true], ['Light Rain and Fog/Mist', 'rain', true], ['Heavy Rain and Fog/Mist', 'rain', true],
    ['Light Drizzle and Fog/Mist', 'drizzle', true]
  ]) {
    assert.deepEqual(normalizeExpansion({ textDescription }), { condition, mist });
    assert.deepEqual(normalizeExpansion(properties([], { textDescription })), { condition, mist });
    assert.equal(normalizeExpansion(properties([phenomenon('hail')], { textDescription })).condition, 'none');
    assert.equal(normalizeExpansion(properties([phenomenon('fog')], { textDescription })).condition, 'fog');
  }
});

test('actual KFTW Cloudy reports reproduce and repair the missing exact legacy fallback', () => {
  // Official NWS reports at 2026-10-02T12:53Z and 13:53Z, retained relevant fields.
  for (const [timestamp, amounts] of [['2026-10-02T12:53:00+00:00', ['FEW', 'BKN', 'OVC']], ['2026-10-02T13:53:00+00:00', ['SCT', 'OVC']]]) {
    const p = properties([], { timestamp, textDescription: 'Cloudy', cloudLayers: amounts.map((amount) => ({ amount })) });
    assert.equal(normalize(p).condition, 'cloud'); assert.equal(normalizeExpansion(p).condition, 'cloud');
    p.presentWeather = [phenomenon('rain')]; assert.equal(normalize(p).condition, 'rain'); assert.equal(normalizeExpansion(p).condition, 'rain');
    p.presentWeather.push(phenomenon('hail')); assert.equal(normalize(p).condition, 'none'); assert.equal(normalizeExpansion(p).condition, 'none');
  }
  assert.equal(normalizeExpansion(properties([], { textDescription: 'Cloudy', cloudLayers: [{ amount: 'CLR' }] })).condition, 'none');
  assert.equal(normalizeExpansion(properties([], { textDescription: '', cloudLayers: [] })).condition, 'none');
  assert.equal(normalizeExpansion(properties([], { textDescription: '', cloudLayers: [{ amount: 'VV' }] })).condition, 'none');
});

test('v1/v2 use one report while v2 skips old cache and rollback projects exact corrected legacy behavior', () => {
  for (const [names, legacy, expanded] of [[['drizzle'], 'rain', 'drizzle'], [['fog'], 'none', 'fog'], [['rain', 'thunderstorms'], 'none', 'storm'], [['snow', 'fog'], 'none', 'snow'], [['rain', 'fog'], 'rain', 'rain']]) {
    const snapshot = record(names.map((name) => phenomenon(name)));
    assert.equal(publicSnapshot(snapshot, 'fort-worth', NOW).condition, legacy);
    assert.equal(publicSnapshotV2(snapshot, 'fort-worth', NOW).condition, expanded);
    const rollback = publicSnapshotV2(snapshot, 'fort-worth', NOW, false);
    assert.equal(rollback.version, 2); assert.equal(rollback.condition, legacy); assert.equal(rollback.mist, false); assert.equal(rollback.night, false);
    delete snapshot.expansion;
    assert.equal(publicSnapshot(snapshot, 'fort-worth', NOW).condition, legacy);
    assert.equal(publicSnapshotV2(snapshot, 'fort-worth', NOW), null);
    assert.equal(publicSnapshotV2(snapshot, 'fort-worth', NOW, false).condition, legacy);
  }
});

test('v2 rejects wrong station, unknown expansion versions, impossible modifiers and stale snapshots', () => {
  const snapshot = record([phenomenon('rain')]);
  for (const expansion of [null, {}, { version: 3, condition: 'rain', mist: false }, { version: 2, condition: 'rain' }, { version: 2, condition: 'drizzle', mist: 'true' }, { version: 2, condition: 'fog', mist: true }, { version: 2, condition: 'storm', mist: true }, { version: 2, condition: 'sun', mist: false }, { version: 2, condition: 'rain', mist: false, night: true }]) assert.equal(publicSnapshotV2({ ...snapshot, expansion }, 'fort-worth', NOW), null);
  assert.equal(publicSnapshotV2({ ...snapshot, station: 'KDFW' }, 'fort-worth', NOW), null);
  assert.equal(publicSnapshotV2(snapshot, 'unknown', NOW), null);
  for (const changes of [{ fetchedAt: iso(NOW + 300001) }, { observedAt: iso(NOW + 300001) }, { observedAt: iso(NOW - 2 * HOUR) }, { validUntil: iso(NOW) }, { fetchedAt: '2026-02-30T00:00:00Z' }]) assert.equal(publicSnapshotV2({ ...snapshot, ...changes }, 'fort-worth', NOW), null);
  const conflicting = record([phenomenon('rain')], NOW, { stationId: 'KDFW' });
  assert.ok(publicSnapshot(conflicting, 'fort-worth', NOW)); assert.equal(publicSnapshotV2(conflicting, 'fort-worth', NOW), null);
});

test('fog and clear use restaurant solar boundaries; rain/cloud remain themselves after dark', () => {
  for (const location of Object.keys(LOCATIONS)) for (const date of ['2026-03-08T18:00:00Z', '2026-11-01T18:00:00Z', '2027-01-01T18:00:00Z', '2028-02-29T18:00:00Z']) {
    const site = LOCATIONS[location], solar = solarWindow(Date.parse(date), site.latitude, site.longitude);
    for (const boundary of [solar.sunrise, solar.sunset]) for (const delta of [-1, 0, 1]) {
      const now = boundary + delta;
      const night = now < solar.sunrise || now >= solar.sunset;
      for (const condition of ['fog', 'clear', 'rain', 'cloud']) {
        const snapshot = record(condition === 'fog' || condition === 'rain' ? [phenomenon(condition)] : [], now, condition === 'clear' ? { textDescription: 'Clear', cloudLayers: [{ amount: 'CLR' }] } : {});
        const p = publicSnapshotV2(snapshot, location, now);
        assert.equal(p.night, condition === 'fog' && night);
        assert.equal(p.effect, condition === 'clear' ? night ? 'night' : 'sun' : condition);
        if (delta === -1 && ['fog', 'clear'].includes(condition)) assert.equal(p.validUntil, iso(boundary));
        else assert.ok(Date.parse(p.validUntil) > now);
      }
    }
  }
});

test('v2 fog/clear HTTP snapshots stop at Chicago midnight; freshly read rain/cloud cross midnight', () => {
  for (const midnight of ['2026-10-03T05:00:00Z', '2026-11-01T05:00:00Z', '2026-11-02T06:00:00Z', '2027-03-14T06:00:00Z', '2027-03-15T05:00:00Z']) {
    const boundary = Date.parse(midnight), now = boundary - 60000;
    for (const condition of ['fog', 'clear', 'rain', 'cloud']) {
      const snapshot = record(['fog', 'rain'].includes(condition) ? [phenomenon(condition)] : [], now, condition === 'clear' ? { textDescription: 'Clear', cloudLayers: [{ amount: 'CLR' }] } : {});
      const cached = publicSnapshotV2(snapshot, 'fort-worth', now);
      if (['fog', 'clear'].includes(condition)) assert.equal(cached.validUntil, iso(boundary));
      else assert.equal(cached.validUntil, snapshot.validUntil);
      const fresh = publicSnapshotV2(snapshot, 'fort-worth', boundary);
      assert.ok(Date.parse(fresh.validUntil) > boundary);
      assert.notEqual(fresh.sunrise, cached.sunrise);
      assert.equal(fresh.effect, condition === 'clear' ? 'night' : condition);
    }
  }
});

test('complete unsupported newest report is none in both versions without older-report cherry-picking', async () => {
  let calls = 0;
  const out = await fetchStation('KFTW', NOW, async () => { calls++; return response({ properties: properties([phenomenon('rain'), phenomenon('hail')]) }); });
  assert.equal(calls, 1); assert.equal(out.condition, 'none'); assert.equal(out.expansion.condition, 'none');
});

test('both locations and API versions share one eligible station fetch; all public reads are provider-free', async (t) => {
  t.mock.method(Date, 'now', () => NOW); let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return response({ properties: properties([phenomenon('drizzle'), phenomenon('fog_mist')]) }); });
  const { data, env, object } = harness();
  await object.fetch(new Request('https://cache/refresh', { method: 'POST' }));
  assert.equal(calls, 1);
  for (const location of Object.keys(LOCATIONS)) for (const route of [`/weather/${location}`, `/weather/v2/${location}`]) {
    const result = await worker.fetch(new Request(`https://weather.example${route}`, { headers: { Origin: 'https://thesourboule.com' } }), env);
    assert.equal(result.status, 200); assert.equal(result.headers.get('Access-Control-Allow-Origin'), 'https://thesourboule.com');
    const text = await result.text(); assert.ok(Buffer.byteLength(text) < 2048);
    const json = JSON.parse(text); assert.equal(json.condition, route.includes('/v2/') ? 'drizzle' : 'rain');
  }
  const skipped = await object.fetch(new Request('https://cache/refresh', { method: 'POST' }));
  assert.equal((await skipped.json()).reason, 'already-attempted-this-hour'); assert.equal(calls, 1);
  data.clear();
  for (const location of Object.keys(LOCATIONS)) for (const prefix of ['/weather/', '/weather/v2/']) assert.equal((await worker.fetch(new Request(`https://weather.example${prefix}${location}`), env)).status, 503);
  assert.equal(calls, 1);
});

test('expansion and full kill switches, old records, fixed routes and CORS are fail-closed', async (t) => {
  t.mock.method(Date, 'now', () => NOW);
  const { data, env } = harness(); data.set('snapshot:fort-worth', record([phenomenon('fog')]));
  env.WEATHER_EXPANSION_ENABLED = 'false';
  const rollback = await worker.fetch(new Request('https://weather.example/weather/v2/fort-worth'), env);
  assert.equal(rollback.status, 200); assert.equal((await rollback.json()).effect, 'none');
  env.WEATHER_ENABLED = 'false';
  for (const prefix of ['/weather/', '/weather/v2/']) assert.equal((await worker.fetch(new Request(`https://weather.example${prefix}fort-worth`), env)).status, 503);
  let pending = false; await worker.scheduled({}, env, { waitUntil: () => { pending = true; } }); assert.equal(pending, false);
  for (const route of ['/weather/v4/fort-worth', '/weather/v1/fort-worth', '/weather/v2/unknown', '/weather/v2/fort-worth/']) assert.equal((await worker.fetch(new Request(`https://weather.example${route}`), env)).status, 404);
  assert.equal((await worker.fetch(new Request('https://weather.example/weather/v2/fort-worth?effect=rain'), env)).status, 400);
  assert.equal((await worker.fetch(new Request('https://weather.example/weather/v2/fort-worth', { headers: { Origin: 'https://evil.test' } }), env)).status, 403);
});

test('authorized bounded diagnostics distinguish genuine none, failed refresh, missing and expired without fetching', async (t) => {
  let now = NOW, calls = 0, failed = false;
  t.mock.method(Date, 'now', () => now);
  t.mock.method(globalThis, 'fetch', async () => { calls++; return failed ? response({}, 503) : response({ properties: properties([phenomenon('hail')], { timestamp: iso(now - 20 * 60000) }) }); });
  const { data, env, object } = harness();
  const getStatus = (headers = {}) => worker.fetch(new Request('https://weather.example/internal/status', { headers }), env);
  const auth = { Authorization: `Bearer ${env.REFRESH_TOKEN}` };
  assert.equal((await getStatus()).status, 404);
  assert.equal((await getStatus({ ...auth, Origin: 'https://thesourboule.com' })).status, 404);
  assert.equal((await getStatus({ Authorization: 'Bearer invalid' })).status, 404);
  for (let i = 0; i < 10; i++) { await object.fetch(new Request('https://cache/refresh', { method: 'POST', headers: { 'X-Weather-Refresh': 'scheduled' } })); now += HOUR; }
  now -= HOUR;
  let r = await getStatus(auth); assert.equal(r.headers.get('Cache-Control'), 'no-store'); let status = await r.json();
  assert.equal(status.refreshHistory.length, 8); assert.equal(status.snapshots['fort-worth'].status, 'fresh'); assert.equal(status.snapshots['fort-worth'].condition, 'none');
  assert.equal(status.refreshHistory.at(-1).stations[0].status, 'ready');
  assert.equal(calls, 10);
  now += HOUR;
  status = await (await getStatus(auth)).json(); assert.equal(status.snapshots['fort-worth'].status, 'expired-or-invalid'); assert.equal(calls, 10);
  failed = true; await object.fetch(new Request('https://cache/refresh', { method: 'POST' }));
  status = await (await getStatus(auth)).json(); assert.equal(status.snapshots['fort-worth'].status, 'missing');
  assert.equal(status.refreshHistory.at(-1).stations[0].reason, 'http-503'); assert.equal(status.refreshHistory.length, 8);
  assert.equal(data.has('snapshot:fort-worth'), false); assert.equal(calls, 11);
  const serialized = JSON.stringify(status); assert.equal(serialized.includes(env.REFRESH_TOKEN), false); assert.equal(serialized.includes('rawString'), false);
  const skipped = await object.fetch(new Request('https://cache/refresh', { method: 'POST' })); assert.equal((await skipped.json()).refreshed, false); assert.equal(calls, 11);
});

test('optional diagnostic history storage errors do not change successful refresh or grant retries', async (t) => {
  t.mock.method(Date, 'now', () => NOW); let calls = 0; const warnings = [];
  t.mock.method(console, 'warn', (value) => warnings.push(JSON.parse(value)));
  t.mock.method(globalThis, 'fetch', async () => { calls++; return response({ properties: properties([phenomenon('rain')]) }); });
  for (const method of ['get', 'put']) {
    const { ctx, data, object } = harness();
    const original = ctx.storage[method];
    ctx.storage[method] = async (key, ...args) => { if (key === 'refresh-history') throw new Error('private storage error'); return original(key, ...args); };
    const result = await object.fetch(new Request('https://cache/refresh', { method: 'POST' }));
    assert.equal(result.status, 200); assert.equal((await result.json()).refreshed, true);
    assert.equal(data.get('snapshot:fort-worth').condition, 'rain');
    assert.equal(data.get('last-refresh').results['willow-bend'], 'rain');
    const repeated = await object.fetch(new Request('https://cache/refresh', { method: 'POST' }));
    assert.equal((await repeated.json()).reason, 'already-attempted-this-hour');
  }
  assert.equal(calls, 2);
  assert.deepEqual(warnings, Array.from({ length: 2 }, () => ({ event: 'weather-diagnostics-unavailable', reason: 'history-storage' })));
});

test('all 23 verified NWS phenomenon enums have deliberate supported, unsupported or unknown outcomes', () => {
  // Exact current OpenAPI MetarPhenomenon.weather enum read 2026-10-02.
  const knownUnsupported = ['dust_storm', 'dust', 'funnel_cloud', 'smoke', 'hail', 'snow_pellets', 'haze', 'ice_crystals', 'ice_pellets', 'dust_whirls', 'spray', 'sand', 'snow_grains', 'squalls', 'sand_storm', 'volcanic_ash'];
  const supported = { fog_mist: 'fog', drizzle: 'drizzle', fog: 'fog', rain: 'rain', snow: 'snow' };
  assert.equal(knownUnsupported.length + Object.keys(supported).length + 2, 23);
  for (const [weather, condition] of Object.entries(supported)) assert.deepEqual(classifyExpansion(properties([phenomenon(weather)])), { condition, mist: false, reason: 'supported-condition' });
  assert.equal(classifyExpansion(properties([phenomenon('thunderstorms')])).reason, 'unsupported-condition');
  assert.equal(classifyExpansion(properties([phenomenon('thunderstorms'), phenomenon('rain')])).condition, 'storm');
  for (const weather of knownUnsupported) {
    assert.equal(classifyExpansion(properties([phenomenon(weather)])).reason, 'unsupported-condition');
    for (const values of permutations([phenomenon('rain'), phenomenon('fog_mist'), phenomenon(weather)])) assert.deepEqual(classifyExpansion(properties(values)), { condition: 'none', mist: false, reason: 'unsupported-condition' });
  }
  for (const weather of ['unknown', 'not-a-provider-enum', 'mist']) assert.equal(classifyExpansion(properties([phenomenon(weather)])).reason, 'unrecognized-condition');
});

test('all verified modifiers are explicitly accepted or rejected without conflating malformed input', () => {
  for (const modifier of ['patches', 'blowing', 'low_drifting', 'freezing', 'shallow', 'partial']) {
    for (const values of permutations([phenomenon('rain'), phenomenon('fog', { modifier })])) assert.equal(classifyExpansion(properties(values)).reason, 'unsupported-condition');
  }
  for (const weather of ['rain', 'snow']) assert.equal(classifyExpansion(properties([phenomenon(weather, { modifier: 'showers' })])).reason, 'supported-condition');
  for (const weather of ['drizzle', 'fog', 'fog_mist', 'thunderstorms']) assert.equal(classifyExpansion(properties([phenomenon(weather, { modifier: 'showers' })])).reason, 'unsupported-condition');
  assert.equal(classifyExpansion(properties([phenomenon('rain', { modifier: 'SH' })])).reason, 'unrecognized-condition');
  assert.equal(classifyExpansion(properties([phenomenon('rain', { modifier: 5 })])).reason, 'incomplete-observation');
  assert.equal(classifyExpansion(properties([phenomenon('rain', { inVicinity: true })])).reason, 'unsupported-condition');
  assert.equal(classifyExpansion(properties([phenomenon('rain', { inVicinity: 'true' })])).reason, 'incomplete-observation');
  // Both final effect and its fixed diagnostic category are order-independent.
  for (const values of permutations([phenomenon('hail'), phenomenon('unknown'), null])) assert.equal(classifyExpansion(properties(values)).reason, 'incomplete-observation');
  for (const values of permutations([phenomenon('hail'), phenomenon('unknown'), phenomenon('rain')])) assert.equal(classifyExpansion(properties(values)).reason, 'unrecognized-condition');
});

test('all sky categories, fog with VV, and layered clouds preserve actual evidence and numeric wind', () => {
  for (const amount of ['SKC', 'CLR', 'FEW']) assert.equal(classifyExpansion(properties([], { cloudLayers: [{ amount }] })).condition, 'clear');
  for (const amount of ['SCT', 'BKN', 'OVC']) assert.equal(classifyExpansion(properties([], { cloudLayers: [{ amount: 'FEW' }, { amount }] })).condition, 'cloud');
  assert.equal(classifyExpansion(properties([], { cloudLayers: [{ amount: 'VV' }] })).reason, 'unsupported-condition');
  assert.equal(classifyExpansion(properties([phenomenon('fog')], { cloudLayers: [{ amount: 'VV' }] })).condition, 'fog');
  assert.equal(classifyExpansion(properties([phenomenon('fog')], { cloudLayers: [{ amount: 'CLR' }] })).condition, 'fog');
  assert.equal(classifyExpansion(properties([], { cloudLayers: [{ amount: 'CLOUD' }] })).reason, 'unrecognized-condition');
  assert.equal(classifyExpansion(properties([], { cloudLayers: [null] })).reason, 'incomplete-observation');
  assert.equal(classifyExpansion(properties([], { cloudLayers: [] })).reason, 'incomplete-observation');
  assert.equal(classifyExpansion(properties([], { textDescription: 'Clear', cloudLayers: [{ amount: 'OVC' }] })).reason, 'contradictory-observation');
  for (const unitCode of ['wmoUnit:km_h-1', 'wmoUnit:m_s-1', 'wmoUnit:kn', 'wmoUnit:mi_h-1']) {
    const windSpeed = { value: 100, unitCode, qualityControl: 'V' };
    assert.equal(classifyExpansion(properties([], { windSpeed })).condition, 'wind');
    assert.equal(classifyExpansion(properties([phenomenon('fog')], { windSpeed })).condition, 'fog');
    for (const qualityControl of ['X', 'Q', 'B', 'T']) assert.equal(classifyExpansion(properties([], { windSpeed: { ...windSpeed, qualityControl } })).condition, 'cloud');
  }
});

test('verified Cloudy and Windy exact alias uses numeric threshold, not the English adjective', () => {
  // Actual KPHP 2026-10-02T15:10Z: OVC, presentWeather [], 31.5 km/h.
  const p = properties([], { textDescription: 'Cloudy and Windy', cloudLayers: [{ amount: 'OVC' }], windSpeed: { value: 31.5, unitCode: 'wmoUnit:km_h-1', qualityControl: 'V' } });
  for (const value of [0, 31.5, 32.186879]) {
    p.windSpeed.value = value;
    assert.equal(normalize(p).condition, 'cloud'); assert.equal(classifyExpansion(p).condition, 'cloud');
  }
  p.windSpeed.value = 32.18688;
  assert.equal(normalize(p).condition, 'wind'); assert.equal(classifyExpansion(p).condition, 'wind');
  p.presentWeather = [phenomenon('hail')]; assert.equal(classifyExpansion(p).reason, 'unsupported-condition');
  p.presentWeather = []; p.textDescription = 'Cloudy and Breezy'; assert.equal(classifyExpansion(p).reason, 'unrecognized-condition');
  p.textDescription = 'Cloudy and Windy Tomorrow'; assert.equal(classifyExpansion(p).reason, 'unrecognized-condition');
});

test('private classification reasons remain separate from provider failures and absent from public JSON', async (t) => {
  t.mock.method(Date, 'now', () => NOW);
  const { data, env, object } = harness();
  t.mock.method(globalThis, 'fetch', async () => response({ properties: properties([phenomenon('hail')]) }));
  await object.fetch(new Request('https://cache/refresh', { method: 'POST' }));
  assert.equal(data.get('snapshot:fort-worth').classificationReason, 'unsupported-condition');
  const statusResponse = await worker.fetch(new Request('https://weather.example/internal/status', { headers: { Authorization: `Bearer ${env.REFRESH_TOKEN}` } }), env);
  const status = await statusResponse.json();
  assert.equal(status.snapshots['fort-worth'].classificationReason, 'unsupported-condition');
  assert.equal(status.refreshHistory[0].stations[0].status, 'ready');
  assert.equal(status.refreshHistory[0].stations[0].classificationReason, 'unsupported-condition');
  for (const path of ['/weather/fort-worth', '/weather/v2/fort-worth']) {
    const publicResponse = await worker.fetch(new Request(`https://weather.example${path}`), env);
    assert.equal(publicResponse.status, 200);
    const body = await publicResponse.json(); assert.equal(body.effect, 'none'); assert.equal(Object.hasOwn(body, 'classificationReason'), false);
  }
  for (const [changes, expected] of [[{ timestamp: iso(NOW - 2 * HOUR) }, 'stale-observation'], [{ timestamp: iso(NOW + 300001) }, 'future-observation'], [{ timestamp: 'invalid' }, 'invalid-timestamp'], [{ station: 'wrong' }, 'invalid-station'], [{ presentWeather: [], cloudLayers: [] }, 'incomplete-observation']]) {
    let calls = 0; const outcomes = [];
    const result = await fetchStation('KFTW', NOW, async () => response(++calls === 1 ? { properties: properties([], changes) } : { features: [] }), (outcome) => outcomes.push(outcome));
    assert.equal(result, null); assert.equal(calls, 2);
    assert.equal(outcomes[0].reason, 'no-coherent-fresh-report'); assert.equal(outcomes[0].latestObservationReason, expected);
  }
  let calls = 0; const recovered = [];
  const result = await fetchStation('KFTW', NOW, async () => response(++calls === 1 ? { properties: properties([], { cloudLayers: [] }) } : { features: [{ properties: properties([phenomenon('rain')]) }] }), (outcome) => recovered.push(outcome));
  assert.equal(result.expansion.condition, 'rain'); assert.equal(recovered[0].status, 'ready'); assert.equal(recovered[0].latestObservationReason, 'incomplete-observation');
});

test('complete structured data controls text differences; malformed structured data is never rescued by text', () => {
  for (const textDescription of ['Light Rain and Fog/Mist', 'A Different Provider Label', 'Freezing Rain']) {
    assert.equal(classifyExpansion(properties([phenomenon('rain')], { textDescription })).condition, 'rain');
    assert.equal(classifyExpansion(properties([phenomenon('rain', { modifier: 'freezing' })], { textDescription: 'Light Rain' })).reason, 'unsupported-condition');
    const missingModifier = phenomenon('rain'); delete missingModifier.modifier;
    assert.equal(classifyExpansion(properties([missingModifier], { textDescription })).reason, 'incomplete-observation');
  }
  assert.equal(classifyExpansion(properties(null, { textDescription: 'Light Rain' })).reason, 'incomplete-observation');
  assert.equal(classifyExpansion({ textDescription: 'Light Rain' }).condition, 'rain');
  for (const textDescription of ['Freezing Rain', 'Thunderstorm in Vicinity Rain Fog/Mist', 'Cloudy and Breezy', 'Chance Rain']) assert.equal(classifyExpansion({ textDescription }).reason, 'unrecognized-condition');
});

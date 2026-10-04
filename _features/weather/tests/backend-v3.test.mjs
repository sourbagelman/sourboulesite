import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSuite, observation, temperatureF, conditionText } from '../provider.mjs';
import worker, { WeatherCache, publicSnapshot, publicSnapshotV2, publicSnapshotV3 } from '../backend.mjs';
import { validScene } from '../components-v3.mjs';
import { LOCATIONS, HOUR } from '../config.mjs';
import { solarWindow } from '../solar.mjs';
import { suiteScenes, sceneObservation } from './suite-fixtures.mjs';
import textures from '../texture-manifest-v3.json' with { type: 'json' };
const NOW = Date.parse('2026-10-04T18:00:00Z');
const iso = (now) => new Date(now).toISOString();
const scene = (id) => suiteScenes.find((value) => value.id === id);
const report = (id = 'rain-day', now = NOW, changes = {}) => observation(sceneObservation(scene(id), now, changes), 'KFTW', now);
const response = (value, status = 200) => new Response(JSON.stringify(value), { status });
const permutations = (list) => list.length < 2 ? [list] : list.flatMap((value, index) => permutations(list.filter((_, i) => i !== index)).map((rest) => [value, ...rest]));
const wx = (weather, changes = {}) => ({ weather, intensity: null, modifier: null, rawString: 'TEST', ...changes });
function harness() {
  const data = new Map();
  const env = { WEATHER_ENABLED: 'true', WEATHER_EXPANSION_ENABLED: 'true', WEATHER_ENHANCED_ENABLED: 'true', WEATHER_READOUT_ENABLED: 'true', WEATHER_LIGHTING_ENABLED: 'false', REFRESH_TOKEN: 't'.repeat(48) };
  const ctx = { storage: { get: async (key) => data.get(key), put: async (key, value) => data.set(key, structuredClone(value)), delete: async (key) => data.delete(key) }, blockConcurrencyWhile: (fn) => fn() };
  const object = new WeatherCache(ctx, env);
  env.WEATHER_CACHE = { idFromName: (key) => { assert.equal(key, 'restaurant-weather-live-v1'); return key; }, get: () => object };
  return { data, env, object };
}

for (const fixture of suiteScenes) test(`actual NWS adapter reproduces approved components: ${fixture.id}`, () => {
  const now = Date.parse(fixture.daypart === 'night' ? '2026-10-04T03:00:00Z' : '2026-10-04T18:00:00Z');
  const source = sceneObservation(fixture, now);
  const stored = observation(source, 'KFTW', now);
  const snapshot = publicSnapshotV3(stored, 'fort-worth', now);
  const { id, ...expected } = fixture;
  assert.deepEqual(snapshot.scene, expected);
  assert.equal(validScene(snapshot.scene), true);
  assert.equal(snapshot.temperatureF, 69.8);
  assert.ok(snapshot.conditionLabel);
  assert.equal(snapshot.version, 3);
  assert.ok(Buffer.byteLength(JSON.stringify(snapshot)) < 2048);
  assert.ok(publicSnapshot(stored, 'fort-worth', now)); assert.ok(publicSnapshotV2(stored, 'fort-worth', now));
});

test('v3 temperature comes only from same-record finite C/F measurement with explicit QC and preserves zero', () => {
  for (const [measurement, expected] of [
    [{ value: 0, unitCode: 'wmoUnit:degC' }, 32], [{ value: 0, unitCode: 'wmoUnit:degF' }, 0],
    [{ value: 21, unitCode: 'wmoUnit:degC', qualityControl: 'V' }, 69.8], [{ value: -10, unitCode: 'wmoUnit:degC', qualityControl: 'C' }, 14],
    [{ value: null, unitCode: 'wmoUnit:degC' }, null], [{ value: '21', unitCode: 'wmoUnit:degC' }, null],
    [{ value: Infinity, unitCode: 'wmoUnit:degC' }, null], [{ value: 273.15, unitCode: 'wmoUnit:K' }, null],
    [{ value: 999, unitCode: 'wmoUnit:degF' }, null], [null, null]
  ]) assert.equal(temperatureF(measurement), expected);
  for (const qualityControl of ['X', 'Q', 'B', 'T', 'unknown', null, 1]) assert.equal(temperatureF({ value: 0, unitCode: 'wmoUnit:degC', qualityControl }), null);
  for (const qualityControl of ['Z', 'C', 'S', 'V', 'G']) assert.equal(temperatureF({ value: 0, unitCode: 'wmoUnit:degF', qualityControl }), 0);
  const before = publicSnapshotV3(report('snow-day', NOW, { temperature: { value: 27, unitCode: 'wmoUnit:degC' } }), 'fort-worth', NOW);
  const after = publicSnapshotV3(report('snow-day', NOW + 1000, { temperature: { value: null, unitCode: 'wmoUnit:degC' } }), 'fort-worth', NOW + 1000);
  assert.equal(before.temperatureF, 80.6); assert.equal(after.temperatureF, null); assert.equal(after.scene.precip, 'snow');
});

test('readout preserves observed unsupported conditions, safe text and meaning-changing qualifiers', () => {
  const p = sceneObservation(scene('clear-day'), NOW, { textDescription: 'Smoke', presentWeather: [wx('smoke')] }).properties;
  const value = normalizeSuite(p); assert.equal(value.components, null); assert.equal(value.reason, 'recognized-unrendered'); assert.equal(value.conditionLabel, 'Smoke');
  const snapshot = publicSnapshotV3(observation({ properties: p }, 'KFTW', NOW), 'fort-worth', NOW);
  assert.equal(snapshot.icon, 'neutral'); assert.equal(snapshot.conditionLabel, 'Smoke'); assert.equal(snapshot.temperatureF, 69.8);
  assert.equal(conditionText('  Light  Rain\n and Fog/Mist  '), 'Light Rain and Fog/Mist');
  for (const text of ['<img src=x onerror=alert(1)>', 'a'.repeat(121), '\u202EFreezing Rain', 'Rain\0Snow', null]) assert.equal(conditionText(text), null);
  for (const [weather, modifier, word] of [['rain', 'freezing', 'Freezing'], ['snow', 'blowing', 'Blowing'], ['snow', 'low_drifting', 'Low drifting']]) {
    const out = normalizeSuite({ ...p, presentWeather: [wx(weather, { modifier })], textDescription: weather === 'rain' ? 'Rain' : 'Snow' });
    assert.ok(out.conditionLabel.startsWith(word));
  }
  for (const weather of ['thunderstorms', 'hail', 'snow', 'fog']) {
    const out = normalizeSuite({ ...p, presentWeather: [wx('rain'), wx(weather)], textDescription: 'Rain' });
    assert.match(out.conditionLabel.toLowerCase(), new RegExp(weather === 'thunderstorms' ? 'thunderstorms' : weather));
  }
  assert.equal(normalizeSuite({ ...p, textDescription: '<script>x</script>', presentWeather: [wx('rain')] }).conditionLabel, 'Rain');
  assert.equal(normalizeSuite({ ...p, textDescription: 'Rain', presentWeather: Array.from({ length: 20 }, () => wx('rain', { modifier: 'freezing' })) }).conditionLabel, null, 'Oversize decoded text must not fall back to a phrase that drops freezing');
  assert.equal(normalizeSuite({ ...p, presentWeather: [{ weather: 'rain' }], textDescription: 'Rain' }).conditionLabel, null);
  for (const presentWeather of [[wx('rain'), wx('unrecognized')], [wx('rain', { modifier: 'unrecognized' })]]) {
    const invalid = normalizeSuite({ ...p, presentWeather, textDescription: 'Rain' });
    assert.equal(invalid.conditionLabel, null); assert.equal(invalid.components, null);
    assert.equal(invalid.temperatureF, 69.8, 'Validated same-record measurement is separate from an unrecognized label');
  }
  assert.equal(normalizeSuite({ ...p, presentWeather: [wx('rain'), wx('smoke')], textDescription: 'Rain' }).conditionLabel, 'Rain and Smoke');
});

test('missing optional sky, wind, gust and visibility do not discard positive precipitation or invent layers', () => {
  const p = sceneObservation(scene('rain-day'), NOW, { cloudLayers: [], windSpeed: null, windGust: null, visibility: null }).properties;
  const out = normalizeSuite(p); assert.equal(out.components.precip, 'rain');
  for (const key of ['sky', 'wind', 'gust', 'visibility']) assert.equal(out.components[key], null);
  assert.equal(validScene({ ...out.components, daypart: 'day' }), true);
  const fog = normalizeSuite({ ...p, presentWeather: [wx('fog')], cloudLayers: [{ amount: 'VV' }] });
  assert.equal(fog.components.sky, 'VV'); assert.equal(fog.components.mist, 'fog');
  const missing = normalizeSuite({ ...p, presentWeather: [], textDescription: '' }); assert.equal(missing.components, null);
  const noWind = normalizeSuite({ ...p, windSpeed: { value: 90, unitCode: 'unknown' } }); assert.equal(noWind.components.wind, null);
  const unmeasured = normalizeSuite({ ...p, presentWeather: [], textDescription: 'Cloudy and Windy' }); assert.equal(unmeasured.components.wind, null); assert.equal(unmeasured.components.sky, 'OVC');
  const dryThunder = normalizeSuite({ ...p, presentWeather: [wx('thunderstorms')] });
  assert.equal(dryThunder.components, null); assert.equal(dryThunder.reason, 'no-drawable-components'); assert.equal(dryThunder.conditionLabel, 'Thunderstorms');
});

test('the complete mixture is validated before priority and unsupported items cannot be masked', () => {
  for (const weather of ['snow_grains', 'ice_crystals', 'snow_pellets', 'smoke', 'volcanic_ash', 'dust', 'sand', 'spray', 'dust_whirls', 'squalls', 'funnel_cloud', 'sand_storm', 'dust_storm', 'unknown', 'invented']) {
    for (const presentWeather of permutations([wx('rain'), wx('fog_mist'), wx(weather)])) {
      const out = normalizeSuite(sceneObservation(scene('rain-day'), NOW, { presentWeather }).properties);
      assert.equal(out.components, null);
      assert.equal(out.reason, weather === 'unknown' ? 'unidentified-precipitation' : weather === 'invented' ? 'unrecognized-condition' : 'recognized-unrendered');
    }
  }
  for (const presentWeather of [[wx('rain'), wx('snow'), wx('hail')], [wx('snow'), wx('thunderstorms')], [wx('rain', { modifier: 'freezing' }), wx('rain')], [wx('snow', { modifier: 'blowing' }), wx('snow', { modifier: 'low_drifting' })], [wx('ice_pellets'), wx('rain')], [wx('haze'), wx('rain')], [wx('drizzle'), wx('thunderstorms')]]) {
    for (const values of permutations(presentWeather)) assert.equal(normalizeSuite(sceneObservation(scene('rain-day'), NOW, { presentWeather: values }).properties).reason, 'unsupported-mixture');
  }
  for (const changes of [{ inVicinity: true }, { modifier: 'made-up' }, { intensity: 'moderate' }, { rawString: '' }]) assert.equal(normalizeSuite(sceneObservation(scene('rain-day'), NOW, { presentWeather: [wx('rain', changes)] }).properties).components, null);
});

test('thunder, hail, freezing liquid and ground snow remain independent observed components', () => {
  const adapt = (presentWeather) => normalizeSuite(sceneObservation(scene('clear-day'), NOW, { presentWeather }).properties).components;
  assert.equal(adapt([wx('thunderstorms')]).precip, 'none');
  assert.equal(adapt([wx('rain', { intensity: 'heavy' })]).thunder, false);
  assert.equal(adapt([wx('hail')]).precip, 'hail'); assert.equal(adapt([wx('hail')]).thunder, false);
  assert.equal(adapt([wx('rain', { modifier: 'freezing' })]).precip, 'rain');
  assert.equal(adapt([wx('drizzle', { modifier: 'freezing' })]).precip, 'drizzle');
  assert.equal(adapt([wx('snow', { modifier: 'blowing' })]).precip, 'blowing_snow');
  assert.equal(adapt([wx('snow', { modifier: 'low_drifting' })]).precip, 'drifting_snow');
  assert.equal(adapt([wx('rain'), wx('snow')]).precip, 'rain_snow');
  assert.equal(adapt([wx('rain'), wx('hail')]).precip, 'rain_hail');
});

test('verified exact descriptions work without guessing new aliases or using forecasts', () => {
  for (const [textDescription, precip, mist] of [['Rain and Fog/Mist', 'rain', 'fog_mist'], ['Light Drizzle and Fog/Mist', 'drizzle', 'fog_mist'], ['Heavy Thunderstorms and Heavy Rain', 'rain', 'none'], ['Fog', 'none', 'fog']]) {
    const out = normalizeSuite(sceneObservation(scene('clear-day'), NOW, { presentWeather: [], textDescription }).properties);
    assert.equal(out.components.precip, precip); assert.equal(out.components.mist, mist);
  }
  for (const textDescription of ['Freezing Rain', 'Cloudy and Breezy', 'Chance Rain', 'Rain Fog/Mist']) {
    const out = normalizeSuite(sceneObservation(scene('clear-day'), NOW, { presentWeather: [], textDescription }).properties);
    assert.equal(out.components, null); assert.equal(out.reason, 'unrecognized-condition'); assert.equal(out.conditionLabel, textDescription);
  }
});

test('all v3 scenes use request-time restaurant daypart and expire at solar and Chicago date boundaries', () => {
  for (const location of Object.keys(LOCATIONS)) for (const date of ['2026-10-04T18:00:00Z', '2026-11-01T18:00:00Z', '2027-03-14T18:00:00Z']) {
    const site = LOCATIONS[location], solar = solarWindow(Date.parse(date), site.latitude, site.longitude);
    for (const boundary of [solar.sunrise, solar.sunset]) for (const id of ['clear-day', 'overcast-day', 'rain-day', 'snow-day', 'fog-day', 'thunder-dry-day']) {
      const before = publicSnapshotV3(report(id, boundary - 60000), location, boundary - 1);
      assert.equal(before.validUntil, iso(boundary));
      const after = publicSnapshotV3(report(id, boundary), location, boundary);
      assert.equal(after.scene.daypart, boundary === solar.sunrise ? 'day' : 'night'); assert.ok(Date.parse(after.validUntil) > boundary);
    }
  }
  for (const midnight of ['2026-10-05T05:00:00Z', '2026-11-02T06:00:00Z', '2027-03-15T05:00:00Z']) {
    const boundary = Date.parse(midnight), stored = report('rain-night', boundary - 60000);
    const before = publicSnapshotV3(stored, 'fort-worth', boundary - 1), after = publicSnapshotV3(stored, 'fort-worth', boundary);
    assert.equal(before.validUntil, iso(boundary)); assert.notEqual(before.sunrise, after.sunrise); assert.equal(after.scene.precip, 'rain'); assert.equal(after.scene.daypart, 'night');
  }
});

test('v3 fails closed on old/invalid cache without reconstructing component weather from legacy none', () => {
  const base = report();
  for (const suite of [undefined, null, { ...base.suite, version: 4 }, { ...base.suite, temperatureF: '0' }, { ...base.suite, temperatureF: 900 }, { ...base.suite, conditionLabel: '<script>x</script>' }, { ...base.suite, components: { ...base.suite.components, rawProvider: true } }]) assert.equal(publicSnapshotV3({ ...base, suite }, 'fort-worth', NOW), null);
  for (const changes of [{ station: 'KDFW' }, { observedAt: iso(NOW - 2 * HOUR) }, { fetchedAt: iso(NOW + 300001) }, { validUntil: iso(NOW) }]) assert.equal(publicSnapshotV3({ ...base, ...changes }, 'fort-worth', NOW), null);
  const old = { ...base }; delete old.suite;
  assert.ok(publicSnapshot(old, 'fort-worth', NOW)); assert.ok(publicSnapshotV2(old, 'fort-worth', NOW)); assert.equal(publicSnapshotV3(old, 'fort-worth', NOW), null);
});

test('v3 component validation rejects impossible modifier/daypart/intensity combinations', () => {
  const { id: _id, ...good } = scene('rain-day');
  for (const changes of [{ sky: 'UNK' }, { daypart: 'twilight' }, { precip: 'ice' }, { intensity: 'violent' }, { mist: 'mist' }, { thunder: 1 }, { wind: -1 }, { gust: 121 }, { visibility: '300' }, { modifier: 'showers' }, { precip: 'snow', modifier: 'freezing' }, { precip: 'drifting_snow', modifier: 'blowing' }, { mist: 'haze' }, { mist: 'dense_fog', visibility: null }]) assert.equal(validScene({ ...good, ...changes }), false);
});

test('public v1/v2/v3 share one provider fetch and preserve independent controls and existing lease', async (t) => {
  t.mock.method(Date, 'now', () => NOW); let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; return response(sceneObservation(scene('rain-mist-day'), NOW)); });
  const { data, env, object } = harness();
  await object.fetch(new Request('https://cache/refresh', { method: 'POST', headers: { 'X-Weather-Refresh': 'scheduled' } }));
  assert.equal(calls, 1);
  for (const location of Object.keys(LOCATIONS)) for (const prefix of ['/weather/', '/weather/v2/', '/weather/v3/']) assert.equal((await worker.fetch(new Request(`https://weather.example${prefix}${location}`), env)).status, 200);
  for (const key of ['enhanced', 'readout', 'lighting']) {
    const flag = `WEATHER_${key.toUpperCase()}_ENABLED`;
    env[flag] = 'true'; let out = await (await worker.fetch(new Request('https://weather.example/weather/v3/fort-worth'), env)).json(); assert.equal(out.controls[key], true);
    env[flag] = 'false'; out = await (await worker.fetch(new Request('https://weather.example/weather/v3/fort-worth'), env)).json(); assert.equal(out.controls[key], false); assert.ok(out.scene); assert.equal(out.temperatureF, 69.8);
  }
  const skipped = await object.fetch(new Request('https://cache/refresh', { method: 'POST' })); assert.equal((await skipped.json()).refreshed, false); assert.equal(calls, 1);
  env.WEATHER_ENABLED = 'false'; assert.equal((await worker.fetch(new Request('https://weather.example/weather/v3/fort-worth'), env)).status, 503);
  env.WEATHER_ENABLED = 'true'; data.clear(); assert.equal((await worker.fetch(new Request('https://weather.example/weather/v3/fort-worth'), env)).status, 503); assert.equal(calls, 1);
});

test('texture route allows only exact immutable hashed assets and cannot fetch providers or arbitrary files', async (t) => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Provider must not be called'); });
  const { env } = harness(); let calls = 0;
  env.WEATHER_ASSETS = { fetch: async (req) => { calls++; assert.ok(req.url.includes('/textures/')); return new Response(req.method === 'HEAD' ? null : 'webp', { headers: { 'Content-Type': 'image/webp', 'cache-control': 'public, max-age=0, must-revalidate' } }); } };
  const path = `/textures/${Object.values(textures)[0].file}`;
  for (const method of ['GET', 'HEAD']) {
    const r = await worker.fetch(new Request(`https://weather.example${path}`, { method, headers: { Origin: 'https://thesourboule.com' } }), env);
    assert.equal(r.status, 200); assert.equal(r.headers.get('Cache-Control'), 'public, max-age=31536000, immutable'); assert.equal(r.headers.get('Access-Control-Allow-Origin'), 'https://thesourboule.com'); assert.equal(r.headers.get('Content-Type'), 'image/webp');
  }
  for (const bad of ['/textures/missing.webp', '/textures/secret.json', '/textures/' + Object.values(textures)[0].file.replace('.webp', '.png')]) assert.equal((await worker.fetch(new Request(`https://weather.example${bad}`), env)).status, 404);
  assert.equal((await worker.fetch(new Request(`https://weather.example${path}?force=1`), env)).status, 400);
  assert.equal((await worker.fetch(new Request(`https://weather.example${path}`, { method: 'POST' }), env)).status, 405);
  assert.equal((await worker.fetch(new Request(`https://weather.example${path}`, { headers: { Origin: 'https://evil.example' } }), env)).status, 403);
  assert.equal(calls, 2);
});

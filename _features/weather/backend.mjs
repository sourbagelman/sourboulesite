import { ALLOWED_ORIGINS, CRON_MINUTE, FUTURE_TOLERANCE, HOUR, LOCATIONS, MAX_AGE, TIMEZONE } from './config.mjs';
import { conditionText, fetchStation, timestamp } from './provider.mjs';
import { solarWindow } from './solar.mjs';
import { validScene } from './components-v3.mjs';
import textureManifest from './texture-manifest-v3.json' with { type: 'json' };
const CONDITIONS = new Set(['rain', 'snow', 'wind', 'cloud', 'clear', 'none']);
const EXPANSION_CONDITIONS = new Set([...CONDITIONS, 'fog', 'drizzle', 'storm']);
const CACHE_ID = 'restaurant-weather-live-v1';
const TEXTURE_PATHS = new Set(Object.values(textureManifest).map((entry) => `/textures/${entry.file}`));
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
function nextChicagoMidnight(now) {
  const format = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const parts = (value) => Object.fromEntries(format.formatToParts(value).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
  const current = parts(now);
  const target = Date.UTC(current.year, current.month - 1, current.day + 1);
  let guess = target;
  // Resolve the local calendar boundary using its actual offset, including DST.
  for (let i = 0; i < 2; i++) {
    const local = parts(guess);
    guess += target - Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  }
  return guess;
}
export function publicSnapshot(snapshot, location, now) {
  const site = LOCATIONS[location];
  if (!site || !snapshot || snapshot.station !== site.station || !CONDITIONS.has(snapshot.condition)) return null;
  const observed = timestamp(snapshot.observedAt), fetched = timestamp(snapshot.fetchedAt), until = timestamp(snapshot.validUntil);
  if (![observed, fetched, until].every(Number.isFinite) || observed > now + FUTURE_TOLERANCE || fetched > now + FUTURE_TOLERANCE || now - observed >= MAX_AGE || now - fetched >= HOUR || until <= now || until > Math.min(observed + MAX_AGE, fetched + HOUR)) return null;
  const solar = solarWindow(now, site.latitude, site.longitude);
  if (!solar) return null;
  let effect = snapshot.condition;
  let validUntil = until;
  if (effect === 'clear') {
    effect = now >= solar.sunrise && now < solar.sunset ? 'sun' : 'night';
    // The client must reject a cached response that crosses a solar boundary.
    const nextBoundary = [solar.sunrise, solar.sunset].find((boundary) => boundary > now);
    if (nextBoundary) validUntil = Math.min(validUntil, nextBoundary);
  }
  return {
    version: 1, provider: 'NWS', location, station: site.station, timezone: TIMEZONE,
    condition: snapshot.condition, effect,
    observedAt: snapshot.observedAt, fetchedAt: snapshot.fetchedAt,
    validUntil: new Date(validUntil).toISOString(),
    sunrise: new Date(solar.sunrise).toISOString(), sunset: new Date(solar.sunset).toISOString(),
    refreshSource: snapshot.refreshSource === 'scheduled' ? 'scheduled' : 'manual'
  };
}
export function publicSnapshotV2(snapshot, location, now, expansionEnabled = true) {
  const legacy = publicSnapshot(snapshot, location, now);
  if (!legacy) return null;
  // The rollback flag deliberately projects the independently stored legacy
  // classification, including its drizzle/fog/storm behavior, into valid v2.
  const expanded = expansionEnabled ? snapshot.expansion : { version: 2, condition: legacy.condition, mist: false };
  if (!expanded || Object.keys(expanded).some((key) => !['version', 'condition', 'mist'].includes(key)) ||
      expanded.version !== 2 || !EXPANSION_CONDITIONS.has(expanded.condition) ||
      typeof expanded.mist !== 'boolean' || (expanded.mist && !['rain', 'drizzle'].includes(expanded.condition))) return null;
  const sunrise = timestamp(legacy.sunrise), sunset = timestamp(legacy.sunset);
  const afterDark = now < sunrise || now >= sunset;
  const effect = expanded.condition === 'clear' ? (afterDark ? 'night' : 'sun') : expanded.condition;
  let until = timestamp(snapshot.validUntil);
  if (expanded.condition === 'clear' || expanded.condition === 'fog') {
    const nextBoundary = [sunrise, sunset].find((boundary) => boundary > now);
    if (nextBoundary) until = Math.min(until, nextBoundary);
    // V2 solar fields identify today's restaurant date. Do not cache a fog or
    // clear treatment across midnight with yesterday's solar metadata.
    until = Math.min(until, nextChicagoMidnight(now));
  }
  return { ...legacy, version: 2, condition: expanded.condition, effect, mist: expanded.mist,
    night: expanded.condition === 'fog' && afterDark, validUntil: new Date(until).toISOString() };
}
export function publicSnapshotV3(snapshot, location, now, controls = { enhanced: true, readout: true, lighting: false }, expansionEnabled = true) {
  const previous = publicSnapshotV2(snapshot, location, now, expansionEnabled);
  const suite = snapshot?.suite;
  if (!previous || !suite || suite.version !== 3 || !Object.hasOwn(suite, 'components') ||
      !Object.hasOwn(suite, 'temperatureF') || !Object.hasOwn(suite, 'conditionLabel') ||
      (suite.temperatureF !== null && (typeof suite.temperatureF !== 'number' || !Number.isFinite(suite.temperatureF) || suite.temperatureF < -150 || suite.temperatureF > 150)) ||
      (suite.conditionLabel !== null && conditionText(suite.conditionLabel) !== suite.conditionLabel) ||
      !['enhanced', 'readout', 'lighting'].every((key) => typeof controls[key] === 'boolean')) return null;
  const sunrise = timestamp(previous.sunrise), sunset = timestamp(previous.sunset);
  const daypart = now >= sunrise && now < sunset ? 'day' : 'night';
  const scene = suite.components === null ? null : { ...suite.components, daypart };
  if (scene !== null && !validScene(scene)) return null;
  const nextBoundary = [sunrise, sunset].find((boundary) => boundary > now);
  const until = Math.min(timestamp(snapshot.validUntil), nextChicagoMidnight(now), nextBoundary ?? Infinity);
  let icon = 'neutral';
  if (scene) {
    if (['snow', 'rain_snow', 'blowing_snow', 'drifting_snow'].includes(scene.precip)) icon = 'snow';
    else if (['rain', 'drizzle', 'rain_hail'].includes(scene.precip)) icon = 'rain';
    else if (scene.precip === 'none' && scene.mist !== 'none') icon = 'fog';
    else if (scene.precip === 'none' && !scene.thunder && ['CLR', 'SKC', 'FEW'].includes(scene.sky)) icon = daypart === 'day' ? 'sun' : 'moon';
    else if (scene.sky !== null && ['none', 'hail', 'ice_pellets'].includes(scene.precip)) icon = scene.precip === 'none' ? 'cloud' : 'neutral';
  }
  const { condition, effect, mist, night, version: _version, ...common } = previous;
  const invalidReadout = ['incomplete-observation', 'invalid-intensity', 'invalid-sky', 'contradictory-observation'].includes(suite.reason);
  return { ...common, version: 3, validUntil: new Date(until).toISOString(), scene,
    temperatureF: invalidReadout ? null : suite.temperatureF, conditionLabel: invalidReadout ? null : suite.conditionLabel, icon,
    fallback: { condition, effect, mist, night }, controls: { enhanced: controls.enhanced, readout: controls.readout, lighting: controls.lighting } };
}
// One named SQLite-backed object, two fixed snapshot keys. get/put are its tiny
// cache API; no relational schema, business records, visitor data, or NYE binding.
export class WeatherCache {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/refresh' && request.method === 'POST') {
      return this.ctx.blockConcurrencyWhile(async () => {
        const now = Date.now();
        const bucket = Math.floor((now - CRON_MINUTE * 60000) / HOUR);
        if ((await this.ctx.storage.get('attempt-hour')) === bucket) return json({ refreshed: false, reason: 'already-attempted-this-hour' });
        // Persist the lease before I/O, including failures/restarts. Only the
        // hourly trigger or authenticated maintenance path can reach this code.
        await this.ctx.storage.put('attempt-hour', bucket);
        const source = request.headers.get('X-Weather-Refresh') === 'scheduled' ? 'scheduled' : 'manual';
        const stationReports = new Map();
        const providerOutcomes = [];
        for (const station of new Set(Object.values(LOCATIONS).map((site) => site.station))) {
          stationReports.set(station, await fetchStation(station, now, fetch, (outcome) => providerOutcomes.push(outcome)));
        }
        const results = {};
        for (const [location, site] of Object.entries(LOCATIONS)) {
          const report = stationReports.get(site.station);
          if (report) await this.ctx.storage.put(`snapshot:${location}`, { ...report, refreshSource: source });
          else await this.ctx.storage.delete(`snapshot:${location}`);
          results[location] = report ? report.condition : 'unavailable';
        }
        await this.ctx.storage.put('last-refresh', { attemptedAt: new Date(now).toISOString(), source, results });
        // Bounded, weather-only maintenance evidence. No provider payloads,
        // visitor identifiers, secrets or new refresh/retry behavior.
        try {
          const previous = await this.ctx.storage.get('refresh-history');
          const history = Array.isArray(previous) ? previous.slice(-7) : [];
          history.push({ attemptedAt: new Date(now).toISOString(), source, results,
            stations: providerOutcomes.map((outcome) => {
              const report = stationReports.get(outcome.station);
              return { ...outcome, ...(report ? { condition: report.condition, expansionCondition: report.expansion?.condition, classificationReason: report.classificationReason, suiteReason: report.suite?.reason,
                observedAt: report.observedAt, fetchedAt: report.fetchedAt, validUntil: report.validUntil } : {}) };
            }) });
          await this.ctx.storage.put('refresh-history', history);
        } catch {
          // Optional diagnostics must never make a successful refresh fail.
          console.warn(JSON.stringify({ event: 'weather-diagnostics-unavailable', reason: 'history-storage' }));
        }
        return json({ refreshed: true, attemptedAt: new Date(now).toISOString(), source, results });
      });
    }
    if (url.pathname === '/status' && request.method === 'GET') {
      const now = Date.now(), snapshots = {};
      for (const location of Object.keys(LOCATIONS)) {
        const snapshot = await this.ctx.storage.get(`snapshot:${location}`);
        const legacy = publicSnapshot(snapshot, location, now);
        const expanded = publicSnapshotV2(snapshot, location, now);
        const suite = publicSnapshotV3(snapshot, location, now);
        snapshots[location] = { status: legacy ? 'fresh' : snapshot ? 'expired-or-invalid' : 'missing',
          expansionStatus: expanded ? 'fresh' : snapshot?.expansion ? 'expired-or-invalid' : 'not-yet-capable',
          suiteStatus: suite ? 'fresh' : snapshot?.suite ? 'expired-or-invalid' : 'not-yet-capable',
          ...(snapshot ? { station: snapshot.station, observedAt: snapshot.observedAt, fetchedAt: snapshot.fetchedAt,
            validUntil: snapshot.validUntil, condition: snapshot.condition, expansionCondition: snapshot.expansion?.condition, classificationReason: snapshot.classificationReason, suiteReason: snapshot.suite?.reason,
            refreshSource: snapshot.refreshSource } : {}) };
      }
      return json({ checkedAt: new Date(now).toISOString(), snapshots,
        lastRefresh: await this.ctx.storage.get('last-refresh') || null,
        refreshHistory: (await this.ctx.storage.get('refresh-history') || []).slice(-8) });
    }
    const location = url.pathname.slice(1);
    if (request.method !== 'GET' || !Object.hasOwn(LOCATIONS, location)) return json({ error: 'Not found' }, 404);
    const value = await this.ctx.storage.get(`snapshot:${location}`);
    return json(value || null);
  }
}
function cache(env) { return env.WEATHER_CACHE.get(env.WEATHER_CACHE.idFromName(CACHE_ID)); }
async function authorized(request, env) {
  if (typeof env.REFRESH_TOKEN !== 'string' || env.REFRESH_TOKEN.length < 32) return false;
  const supplied = request.headers.get('Authorization') || '';
  const expected = `Bearer ${env.REFRESH_TOKEN}`;
  if (supplied.length !== expected.length) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([supplied, expected].map((s) => crypto.subtle.digest('SHA-256', encoder.encode(s))));
  return new Uint8Array(a).every((v, i) => v === new Uint8Array(b)[i]);
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'Origin not allowed' }, 403);
    const cors = { Vary: 'Origin', ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}) };
    if (url.search) return json({ error: 'Query parameters are not supported' }, 400, cors);
    if (url.pathname.startsWith('/textures/')) {
      if (!TEXTURE_PATHS.has(url.pathname) || !env.WEATHER_ASSETS) return json({ error: 'Not found' }, 404, cors);
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, HEAD', 'Access-Control-Max-Age': '300' } });
      if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'Method not allowed' }, 405, { ...cors, Allow: 'GET, HEAD' });
      const asset = await env.WEATHER_ASSETS.fetch(new Request(request.url, { method: request.method }));
      if (!asset.ok) return json({ error: 'Not found' }, 404, cors);
      const headers = new Headers(asset.headers);
      for (const [name, value] of Object.entries(cors)) headers.set(name, value);
      headers.set('Cache-Control', 'public, max-age=31536000, immutable');
      headers.set('X-Content-Type-Options', 'nosniff');
      return new Response(asset.body, { status: asset.status, headers });
    }
    if (url.pathname === '/internal/status') {
      if (request.method !== 'GET' || origin || !(await authorized(request, env))) return json({ error: 'Not found' }, 404);
      try { return await cache(env).fetch(new Request('https://weather-cache/status')); }
      catch { return json({ error: 'Unavailable' }, 503); }
    }
    if (url.pathname === '/internal/refresh') {
      if (request.method !== 'POST' || origin || !(await authorized(request, env))) return json({ error: 'Not found' }, 404);
      if (env.WEATHER_ENABLED !== 'true') return json({ refreshed: false, reason: 'disabled' }, 503);
      try { return await cache(env).fetch(new Request('https://weather-cache/refresh', { method: 'POST' })); }
      catch { return json({ refreshed: false, reason: 'unavailable' }, 503); }
    }
    const match = /^\/weather\/(v[23]\/)?(fort-worth|willow-bend)$/.exec(url.pathname);
    if (!match) return json({ error: 'Not found' }, 404, cors);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '300' } });
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, { ...cors, Allow: 'GET' });
    const version = match[1] ? Number(match[1][1]) : 1, location = match[2];
    if (env.WEATHER_ENABLED !== 'true') return json({ version, location, effect: 'none', reason: 'disabled' }, 503, cors);
    try {
      const stored = await cache(env).fetch(new Request(`https://weather-cache/${location}`));
      const value = await stored.json();
      const snapshot = version === 3 ? publicSnapshotV3(value, location, Date.now(), {
        enhanced: env.WEATHER_ENHANCED_ENABLED === 'true', readout: env.WEATHER_READOUT_ENABLED === 'true', lighting: env.WEATHER_LIGHTING_ENABLED === 'true'
      }, env.WEATHER_EXPANSION_ENABLED === 'true') : version === 2 ? publicSnapshotV2(value, location, Date.now(), env.WEATHER_EXPANSION_ENABLED === 'true') : publicSnapshot(value, location, Date.now());
      if (!snapshot) return json({ version, location, effect: 'none', reason: 'unavailable' }, 503, cors);
      const maxAge = Math.max(0, Math.min(300, Math.floor((Date.parse(snapshot.validUntil) - Date.now()) / 1000)));
      return json(snapshot, 200, { ...cors, 'Cache-Control': `public, max-age=${maxAge}, must-revalidate`, 'Expires': new Date(snapshot.validUntil).toUTCString() });
    } catch { return json({ version, location, effect: 'none', reason: 'unavailable' }, 503, cors); }
  },
  async scheduled(controller, env, ctx) {
    if (env.WEATHER_ENABLED !== 'true') return;
    ctx.waitUntil(cache(env).fetch(new Request('https://weather-cache/refresh', { method: 'POST', headers: { 'X-Weather-Refresh': 'scheduled' } })).then(async (response) => {
      // No provider payloads, credentials, IP addresses or visitor information.
      console.log(JSON.stringify({ event: 'weather-hourly-refresh', ...await response.json() }));
    }));
  }
};

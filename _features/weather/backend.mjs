import { ALLOWED_ORIGINS, CRON_MINUTE, FUTURE_TOLERANCE, HOUR, LOCATIONS, MAX_AGE, TIMEZONE } from './config.mjs';
import { fetchStation, timestamp } from './provider.mjs';
import { solarWindow } from './solar.mjs';
const CONDITIONS = new Set(['rain', 'snow', 'wind', 'cloud', 'clear', 'none']);
const CACHE_ID = 'restaurant-weather-live-v1';
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers } });
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
        for (const station of new Set(Object.values(LOCATIONS).map((site) => site.station))) {
          stationReports.set(station, await fetchStation(station, now));
        }
        const results = {};
        for (const [location, site] of Object.entries(LOCATIONS)) {
          const report = stationReports.get(site.station);
          if (report) await this.ctx.storage.put(`snapshot:${location}`, { ...report, refreshSource: source });
          else await this.ctx.storage.delete(`snapshot:${location}`);
          results[location] = report ? report.condition : 'unavailable';
        }
        await this.ctx.storage.put('last-refresh', { attemptedAt: new Date(now).toISOString(), source, results });
        return json({ refreshed: true, attemptedAt: new Date(now).toISOString(), source, results });
      });
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
    if (url.pathname === '/internal/refresh') {
      if (request.method !== 'POST' || origin || !(await authorized(request, env))) return json({ error: 'Not found' }, 404);
      if (env.WEATHER_ENABLED !== 'true') return json({ refreshed: false, reason: 'disabled' }, 503);
      try { return await cache(env).fetch(new Request('https://weather-cache/refresh', { method: 'POST' })); }
      catch { return json({ refreshed: false, reason: 'unavailable' }, 503); }
    }
    const match = /^\/weather\/(fort-worth|willow-bend)$/.exec(url.pathname);
    if (!match) return json({ error: 'Not found' }, 404, cors);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Max-Age': '300' } });
    if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405, { ...cors, Allow: 'GET' });
    const location = match[1];
    if (env.WEATHER_ENABLED !== 'true') return json({ version: 1, location, effect: 'none', reason: 'disabled' }, 503, cors);
    try {
      const stored = await cache(env).fetch(new Request(`https://weather-cache/${location}`));
      const snapshot = publicSnapshot(await stored.json(), location, Date.now());
      if (!snapshot) return json({ version: 1, location, effect: 'none', reason: 'unavailable' }, 503, cors);
      const maxAge = Math.max(0, Math.min(300, Math.floor((Date.parse(snapshot.validUntil) - Date.now()) / 1000)));
      return json(snapshot, 200, { ...cors, 'Cache-Control': `public, max-age=${maxAge}, must-revalidate`, 'Expires': new Date(snapshot.validUntil).toUTCString() });
    } catch { return json({ version: 1, location, effect: 'none', reason: 'unavailable' }, 503, cors); }
  },
  async scheduled(controller, env, ctx) {
    if (env.WEATHER_ENABLED !== 'true') return;
    ctx.waitUntil(cache(env).fetch(new Request('https://weather-cache/refresh', { method: 'POST', headers: { 'X-Weather-Refresh': 'scheduled' } })).then(async (response) => {
      // No provider payloads, credentials, IP addresses or visitor information.
      console.log(JSON.stringify({ event: 'weather-hourly-refresh', ...await response.json() }));
    }));
  }
};

import { HOUR, MAX_AGE, FUTURE_TOLERANCE, NWS_AGENT } from './config.mjs';
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
export function timestamp(value) {
  if (typeof value !== 'string') return NaN;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match || +match[4] > 23 || +match[5] > 59 || +match[6] > 59 || (match[7] && (+match[8] > 23 || +match[9] > 59))) return NaN;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.getUTCMonth() + 1 !== +match[2] || date.getUTCDate() !== +match[3]) return NaN;
  return Date.parse(value);
}
export function windMph(measurement) {
  if (!measurement || !finite(measurement.value) || measurement.value < 0 || ['X', 'Q', 'B', 'T'].includes(measurement.qualityControl)) return null;
  const factors = { 'wmoUnit:km_h-1': 1 / 1.609344, 'wmoUnit:m_s-1': 2.2369362920544, 'wmoUnit:kn': 1.150779448, 'wmoUnit:mi_h-1': 1 };
  const factor = factors[measurement.unitCode];
  // Normalize sub-micro-mph floating noise so an exact 20 mph threshold in
  // m/s (8.9408) is not mistaken for 19.999999999999998 mph.
  return factor ? Math.round(measurement.value * factor * 1e6) / 1e6 : null;
}
// Exact NWS METAR descriptions only. No forecast words, precipitation totals,
// substring matching, or inferred clear skies from absent cloud layers.
const DESCRIPTION = new Map([
  ['Fair', 'clear'], ['Clear', 'clear'], ['A Few Clouds', 'clear'],
  ['Partly Cloudy', 'cloud'], ['Mostly Cloudy', 'cloud'], ['Overcast', 'cloud'],
  ['Rain', 'rain'], ['Light Rain', 'rain'], ['Heavy Rain', 'rain'],
  ['Drizzle', 'rain'], ['Light Drizzle', 'rain'], ['Heavy Drizzle', 'rain'],
  ['Snow', 'snow'], ['Light Snow', 'snow'], ['Heavy Snow', 'snow']
]);
export function normalize(properties) {
  const p = properties;
  if (!p || typeof p !== 'object') return { condition: 'none', coherent: false };
  const hasWeather = Array.isArray(p.presentWeather);
  const description = typeof p.textDescription === 'string' ? p.textDescription.trim() : '';
  const fallback = DESCRIPTION.get(description);
  if (hasWeather && p.presentWeather.length) {
    const kinds = new Set();
    for (const phenomenon of p.presentWeather) {
      if (!phenomenon || phenomenon.inVicinity || ![null, undefined, 'showers'].includes(phenomenon.modifier)) return { condition: 'none', coherent: true };
      if (['rain', 'drizzle'].includes(phenomenon.weather)) kinds.add('rain');
      else if (phenomenon.weather === 'snow') kinds.add('snow');
      else return { condition: 'none', coherent: true };
    }
    return { condition: kinds.size === 1 ? [...kinds][0] : 'none', coherent: true };
  }
  // A populated but unrecognized description can indicate unsupported weather
  // omitted by an upstream field; never turn it into clouds/wind/clear.
  if (description && !fallback) return { condition: 'none', coherent: true };
  if (fallback === 'rain' || fallback === 'snow') return { condition: fallback, coherent: true };
  // Missing presentWeather cannot rule out precipitation. Exact description
  // fallback establishes a complete report; otherwise request bounded history.
  if (!hasWeather && !fallback) return { condition: 'none', coherent: false };
  const speed = windMph(p.windSpeed), gust = windMph(p.windGust);
  if ((speed !== null && speed >= 20) || (gust !== null && gust >= 20)) return { condition: 'wind', coherent: true };
  const clouds = Array.isArray(p.cloudLayers) ? p.cloudLayers : [];
  const amounts = clouds.map((layer) => layer?.amount);
  if (amounts.some((amount) => !['CLR', 'SKC', 'FEW', 'SCT', 'BKN', 'OVC'].includes(amount))) return { condition: 'none', coherent: true };
  if (amounts.some((amount) => ['SCT', 'BKN', 'OVC'].includes(amount))) {
    if (fallback === 'clear') return { condition: 'none', coherent: true };
    return { condition: 'cloud', coherent: true };
  }
  if (amounts.length && amounts.every((amount) => ['CLR', 'SKC', 'FEW'].includes(amount))) {
    if (fallback === 'cloud') return { condition: 'none', coherent: true };
    return { condition: 'clear', coherent: true };
  }
  return fallback ? { condition: fallback, coherent: true } : { condition: 'none', coherent: false };
}
export function observation(feature, station, fetchedAt) {
  const p = feature?.properties;
  const observedAt = timestamp(p?.timestamp);
  if (!Number.isFinite(observedAt) || observedAt > fetchedAt + FUTURE_TOLERANCE || observedAt <= fetchedAt - MAX_AGE) return null;
  // Station identity must agree with the fixed station requested.
  if (p?.station !== `https://api.weather.gov/stations/${station}` && p?.stationId !== station) return null;
  const result = normalize(p);
  if (!result.coherent) return null;
  return { station, condition: result.condition, observedAt: new Date(observedAt).toISOString(), fetchedAt: new Date(fetchedAt).toISOString(), validUntil: new Date(Math.min(observedAt + MAX_AGE, fetchedAt + HOUR)).toISOString() };
}
export async function fetchStation(station, now, fetcher = fetch) {
  if (!/^[A-Z0-9]{3,6}$/.test(station)) throw new Error('Invalid station');
  const headers = { 'User-Agent': NWS_AGENT, Accept: 'application/geo+json' };
  async function get(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    try {
      const response = await fetcher(`https://api.weather.gov/stations/${station}/observations${path}`, { headers, signal: controller.signal, redirect: 'manual' });
      if (!response.ok) throw new Error(`http-${response.status}`);
      const text = await response.text();
      if (text.length > 200000) throw new Error('oversize');
      try { return JSON.parse(text); } catch { throw new Error('invalid-json'); }
    } finally { clearTimeout(timer); }
  }
  const logFailure = (stage, error) => {
    const message = typeof error?.message === 'string' ? error.message : '';
    const reason = /^http-\d{3}$/.test(message) || ['oversize', 'invalid-json'].includes(message) ? message : error?.name === 'AbortError' ? 'timeout' : 'network-error';
    console.warn(JSON.stringify({ event: 'weather-provider-unavailable', station, stage, reason }));
  };
  let latest;
  try { latest = await get('/latest'); } catch (error) { logFailure('latest', error); return null; }
  const normalized = observation(latest, station, now);
  if (normalized) return normalized;
  // One bounded fallback request, maximum four coherent complete observations;
  // never merge properties from separate reports or page through history.
  try {
    const history = await get(`?limit=4&start=${encodeURIComponent(new Date(now - MAX_AGE).toISOString())}`);
    const features = Array.isArray(history.features) ? history.features.slice(0, 4) : [];
    features.sort((a, b) => timestamp(b?.properties?.timestamp) - timestamp(a?.properties?.timestamp));
    for (const feature of features) {
      const report = observation(feature, station, now);
      if (report) return report;
    }
  } catch (error) { logFailure('history', error); return null; }
  console.warn(JSON.stringify({ event: 'weather-provider-unavailable', station, stage: 'history', reason: 'no-coherent-fresh-report' }));
  return null;
}

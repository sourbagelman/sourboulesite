import { HOUR, MAX_AGE, FUTURE_TOLERANCE, NWS_AGENT } from './config.mjs';
import { validScene } from './components-v3.mjs';
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
  // Actual KFTW reports on 2026-10-02 used this exact NWS description.
  ['Cloudy', 'cloud'],
  // Actual KPHP 2026-10-02 15:10Z; wind still requires numeric evidence.
  ['Cloudy and Windy', 'cloud'],
  ['Rain', 'rain'], ['Light Rain', 'rain'], ['Heavy Rain', 'rain'],
  // Exact descriptions verified in actual NWS observation history (see BACKEND.md).
  ['Rain and Fog/Mist', 'rain'], ['Light Rain and Fog/Mist', 'rain'], ['Heavy Rain and Fog/Mist', 'rain'],
  ['Drizzle', 'rain'], ['Light Drizzle', 'rain'], ['Heavy Drizzle', 'rain'],
  ['Light Drizzle and Fog/Mist', 'rain'],
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
    let ordinaryFog = false;
    for (const phenomenon of p.presentWeather) {
      if (!phenomenon || phenomenon.inVicinity || ![null, undefined, 'showers'].includes(phenomenon.modifier)) return { condition: 'none', coherent: true };
      if (['rain', 'drizzle'].includes(phenomenon.weather)) kinds.add('rain');
      else if (phenomenon.weather === 'snow') kinds.add('snow');
      else if (['fog', 'fog_mist'].includes(phenomenon.weather) && [null, undefined].includes(phenomenon.modifier)) ordinaryFog = true;
      else return { condition: 'none', coherent: true };
    }
    // Select only after validating the entire list. Ordinary fog/mist may
    // accompany positive rain/drizzle, but cannot hide an unsupported entry,
    // create rain by itself, or broaden the existing snow restrictions.
    return { condition: kinds.size === 1 && (!ordinaryFog || kinds.has('rain')) ? [...kinds][0] : 'none', coherent: true };
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
// Preserve normalize() above and its corrected legacy interpretation (including
// the separately verified Cloudy repair). V2 examines the same report, never a
// translated legacy effect or another provider observation.
const EXPANSION_DESCRIPTION = new Map([...DESCRIPTION].map(([description, condition]) => [description, {
  condition: ['Drizzle', 'Light Drizzle', 'Heavy Drizzle', 'Light Drizzle and Fog/Mist'].includes(description) ? 'drizzle' : condition,
  mist: ['Rain and Fog/Mist', 'Light Rain and Fog/Mist', 'Heavy Rain and Fog/Mist', 'Light Drizzle and Fog/Mist'].includes(description)
}]));
// These additions were witnessed in actual NWS observations (BACKEND.md).
EXPANSION_DESCRIPTION.set('Fog', { condition: 'fog', mist: false });
EXPANSION_DESCRIPTION.set('Heavy Thunderstorms and Heavy Rain', { condition: 'storm', mist: false });
const PHENOMENON_KEYS = new Set(['intensity', 'modifier', 'weather', 'rawString', 'inVicinity']);
// Complete API enums verified from api.weather.gov/openapi.json, 2026-10-02.
// Deliberately unsupported does not mean an unrecognized value or API failure.
const SUPPORTED_PHENOMENA = new Set(['rain', 'drizzle', 'snow', 'fog', 'fog_mist', 'thunderstorms']);
const UNSUPPORTED_PHENOMENA = new Set(['dust_storm', 'dust', 'funnel_cloud', 'smoke', 'hail', 'snow_pellets', 'haze', 'ice_crystals', 'ice_pellets', 'dust_whirls', 'spray', 'sand', 'snow_grains', 'squalls', 'sand_storm', 'volcanic_ash']);
const KNOWN_MODIFIERS = new Set(['patches', 'blowing', 'low_drifting', 'freezing', 'shallow', 'partial', 'showers']);
const KNOWN_SKY = new Set(['OVC', 'BKN', 'SCT', 'FEW', 'SKC', 'CLR', 'VV']);
const NONE = Object.freeze({ condition: 'none', mist: false });
const classified = (condition, mist = false) => ({ condition, mist, reason: 'supported-condition' });
const skipped = (reason) => ({ ...NONE, reason });
export function classifyExpansion(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return skipped('incomplete-observation');
  if (p.presentWeather !== undefined && !Array.isArray(p.presentWeather)) return skipped('incomplete-observation');
  if (p.presentWeather?.length) {
    const kinds = new Set();
    const issues = new Set();
    for (const entry of p.presentWeather) {
      // Current NWS MetarPhenomenon requires all four fields. Validate every
      // item before applying priority; unknown fields/combinations fail closed.
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) { issues.add('incomplete-observation'); continue; }
      if (Object.keys(entry).some((key) => !PHENOMENON_KEYS.has(key)) ||
          !['intensity', 'modifier', 'weather', 'rawString'].every((key) => Object.hasOwn(entry, key)) ||
          typeof entry.rawString !== 'string' || !entry.rawString.trim() ||
          (entry.inVicinity !== undefined && typeof entry.inVicinity !== 'boolean')) issues.add('incomplete-observation');
      if (entry.intensity !== null && !['light', 'heavy'].includes(entry.intensity)) issues.add(typeof entry.intensity === 'string' ? 'unrecognized-condition' : 'incomplete-observation');
      const kind = entry.weather;
      if (UNSUPPORTED_PHENOMENA.has(kind)) issues.add('unsupported-condition');
      else if (!SUPPORTED_PHENOMENA.has(kind)) issues.add(typeof kind === 'string' ? 'unrecognized-condition' : 'incomplete-observation');
      else kinds.add(kind);
      if (entry.modifier !== null) {
        if (!KNOWN_MODIFIERS.has(entry.modifier)) issues.add(typeof entry.modifier === 'string' ? 'unrecognized-condition' : 'incomplete-observation');
        else if (entry.modifier !== 'showers' || !['rain', 'snow'].includes(kind)) issues.add('unsupported-condition');
      }
      if (entry.inVicinity === true) issues.add('unsupported-condition');
    }
    // Stable diagnostic precedence makes reasons order-independent as well.
    for (const reason of ['incomplete-observation', 'unrecognized-condition', 'unsupported-condition']) if (issues.has(reason)) return skipped(reason);
    const fog = kinds.has('fog') || kinds.has('fog_mist');
    const rain = kinds.has('rain'), drizzle = kinds.has('drizzle'), snow = kinds.has('snow'), thunder = kinds.has('thunderstorms');
    if ((snow && (rain || drizzle || thunder)) || (thunder && !rain)) return skipped('unsupported-condition');
    if (thunder) return classified('storm');
    if (rain) return classified('rain', fog);
    if (drizzle) return classified('drizzle', fog);
    if (snow) return classified('snow');
    return fog ? classified('fog') : skipped('incomplete-observation');
  }
  const description = typeof p.textDescription === 'string' ? p.textDescription.trim() : '';
  const fallback = EXPANSION_DESCRIPTION.get(description);
  if (description && !fallback) return skipped('unrecognized-condition');
  if (fallback && ['rain', 'drizzle', 'snow', 'storm', 'fog'].includes(fallback.condition)) return classified(fallback.condition, fallback.mist);
  // Existing complete-report wind/cloud/clear rules are retained. Unsupported
  // text cannot become a sunny/cloudy fallback, and absent evidence is none.
  const legacy = normalize(p);
  if (legacy.condition !== 'none') return classified(legacy.condition);
  if (!legacy.coherent) return skipped('incomplete-observation');
  const amounts = Array.isArray(p.cloudLayers) ? p.cloudLayers.map((layer) => layer?.amount) : [];
  if (amounts.some((amount) => typeof amount !== 'string')) return skipped('incomplete-observation');
  if (amounts.some((amount) => !KNOWN_SKY.has(amount))) return skipped('unrecognized-condition');
  if (amounts.includes('VV')) return skipped('unsupported-condition');
  return skipped('contradictory-observation');
}
export function normalizeExpansion(p) {
  const { condition, mist } = classifyExpansion(p);
  return { condition, mist };
}
export function observation(feature, station, fetchedAt, onInvalid = () => {}) {
  const invalid = (reason) => { onInvalid(reason); return null; };
  const p = feature?.properties;
  const observedAt = timestamp(p?.timestamp);
  if (!Number.isFinite(observedAt)) return invalid('invalid-timestamp');
  if (observedAt > fetchedAt + FUTURE_TOLERANCE) return invalid('future-observation');
  if (observedAt <= fetchedAt - MAX_AGE) return invalid('stale-observation');
  // Station identity must agree with the fixed station requested.
  if (p?.station !== `https://api.weather.gov/stations/${station}` && p?.stationId !== station) return invalid('invalid-station');
  const result = normalize(p);
  if (!result.coherent) return invalid('incomplete-observation');
  // V1's station acceptance remains compatible. V2 rejects conflicting station
  // fields rather than trusting one of two disagreeing identities.
  const identityAgrees = (p.station === undefined || p.station === `https://api.weather.gov/stations/${station}`) && (p.stationId === undefined || p.stationId === station);
  const classification = classifyExpansion(p);
  const expansion = identityAgrees ? { version: 2, condition: classification.condition, mist: classification.mist } : null;
  const suite = identityAgrees ? { version: 3, ...normalizeSuite(p) } : null;
  return { station, condition: result.condition, expansion, suite, classificationReason: identityAgrees ? classification.reason : 'invalid-station', observedAt: new Date(observedAt).toISOString(), fetchedAt: new Date(fetchedAt).toISOString(), validUntil: new Date(Math.min(observedAt + MAX_AGE, fetchedAt + HOUR)).toISOString() };
}
const SUITE_SKY = { SKC: 0, CLR: 0, FEW: .18, SCT: .44, BKN: .77, OVC: 1, VV: 1 };
const SKY_TEXT = new Map([['Fair', 'CLR'], ['Clear', 'CLR'], ['A Few Clouds', 'FEW'], ['Partly Cloudy', 'SCT'], ['Mostly Cloudy', 'BKN'], ['Overcast', 'OVC'], ['Cloudy', 'OVC'], ['Cloudy and Windy', 'OVC']]);
const LABELS = { rain: 'Rain', drizzle: 'Drizzle', snow: 'Snow', fog: 'Fog', fog_mist: 'Mist', haze: 'Haze', thunderstorms: 'Thunderstorms', ice_pellets: 'Ice pellets', hail: 'Hail', snow_grains: 'Snow grains', ice_crystals: 'Ice crystals', snow_pellets: 'Snow pellets', unknown: 'Unidentified precipitation', smoke: 'Smoke', volcanic_ash: 'Volcanic ash', dust: 'Dust', sand: 'Sand', spray: 'Spray', dust_whirls: 'Dust whirls', squalls: 'Squalls', funnel_cloud: 'Funnel cloud', sand_storm: 'Sandstorm', dust_storm: 'Dust storm' };
const SUITE_SUPPORTED = new Set(['rain', 'drizzle', 'snow', 'fog', 'fog_mist', 'haze', 'thunderstorms', 'ice_pellets', 'hail']);
const INTENSITY = { light: 0, moderate: 1, heavy: 2 };
const qualityOK = (q) => q === undefined || ['Z', 'C', 'S', 'V', 'G'].includes(q);
export function temperatureF(measurement) {
  if (!measurement || !finite(measurement.value) || !qualityOK(measurement.qualityControl)) return null;
  const value = measurement.unitCode === 'wmoUnit:degC' ? measurement.value * 9 / 5 + 32 : measurement.unitCode === 'wmoUnit:degF' ? measurement.value : NaN;
  return Number.isFinite(value) && value >= -150 && value <= 150 ? Math.round(value * 10) / 10 : null;
}
export function conditionText(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim().replace(/\s+/g, ' ');
  // Reject markup/control/oversize text rather than truncating a qualifier.
  return text && text.length <= 120 && /^[\p{L}\p{N} ,.'’()\/&+\-–—]+$/u.test(text) ? text : null;
}
function fallbackPhenomena(description) {
  const result = EXPANSION_DESCRIPTION.get(description);
  if (!result || !['rain', 'drizzle', 'snow', 'fog', 'storm'].includes(result.condition)) return null;
  const make = (weather, intensity = null) => ({ weather, intensity, modifier: null, rawString: description });
  const intensity = description.startsWith('Light ') ? 'light' : description.startsWith('Heavy ') ? 'heavy' : null;
  const items = result.condition === 'storm' ? [make('thunderstorms', intensity), make('rain', intensity)] : [make(result.condition, intensity)];
  if (result.mist) items.push(make('fog_mist'));
  return items;
}
export function normalizeSuite(p) {
  const empty = (reason) => ({ components: null, temperatureF: null, conditionLabel: null, reason });
  if (!p || typeof p !== 'object' || Array.isArray(p)) return empty('incomplete-observation');
  const description = conditionText(p.textDescription);
  const temp = temperatureF(p.temperature);
  const result = (components, reason, label = description) => ({ components, temperatureF: temp, conditionLabel: label, reason });
  if (p.presentWeather !== undefined && !Array.isArray(p.presentWeather)) return empty('incomplete-observation');
  let entries = p.presentWeather || [];
  const structured = entries.length > 0;
  if (!structured) {
    const fallback = fallbackPhenomena(description);
    if (fallback) entries = fallback;
    else if (description && !SKY_TEXT.has(description)) return result(null, 'unrecognized-condition');
    else if (!Array.isArray(p.presentWeather) && !SKY_TEXT.has(description)) return empty('incomplete-observation');
  }
  const issues = new Set(), kinds = new Set(), precipitation = [], fogModifiers = new Set(), liquidModes = new Set(), snowModes = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry) || Object.keys(entry).some((key) => !PHENOMENON_KEYS.has(key)) ||
        !['weather', 'intensity', 'modifier', 'rawString'].every((key) => Object.hasOwn(entry, key)) || typeof entry.rawString !== 'string' || !entry.rawString.trim() ||
        (entry.inVicinity !== undefined && typeof entry.inVicinity !== 'boolean')) { issues.add('incomplete-observation'); continue; }
    if (entry.intensity !== null && !['light', 'heavy'].includes(entry.intensity)) issues.add('invalid-intensity');
    if (!Object.hasOwn(LABELS, entry.weather)) issues.add('unrecognized-condition');
    else if (entry.weather === 'unknown') issues.add('unidentified-precipitation');
    else if (!SUITE_SUPPORTED.has(entry.weather)) issues.add('recognized-unrendered');
    kinds.add(entry.weather);
    if (entry.inVicinity) issues.add('vicinity-only');
    if (entry.modifier !== null) {
      if (!KNOWN_MODIFIERS.has(entry.modifier)) issues.add('unrecognized-modifier');
      else if (entry.modifier === 'showers' && ['rain', 'snow', 'hail', 'ice_pellets'].includes(entry.weather)) { /* Observed showers. */ }
      else if (entry.modifier === 'freezing' && ['rain', 'drizzle'].includes(entry.weather)) { /* Liquid, not pellets. */ }
      else if (['blowing', 'low_drifting'].includes(entry.modifier) && entry.weather === 'snow') { /* Ground snow. */ }
      else if (['patches', 'shallow', 'partial'].includes(entry.modifier) && entry.weather === 'fog') fogModifiers.add(entry.modifier);
      else issues.add('unsupported-modifier');
    }
    if (['rain', 'drizzle'].includes(entry.weather)) liquidModes.add(entry.modifier === 'freezing' ? 'freezing' : 'ordinary');
    if (entry.weather === 'snow') snowModes.add(['blowing', 'low_drifting'].includes(entry.modifier) ? entry.modifier : 'falling');
    if (['rain', 'drizzle', 'snow', 'hail', 'ice_pellets'].includes(entry.weather)) precipitation.push({ kind: entry.weather, intensity: entry.intensity || 'moderate' });
  }
  const derivedLabel = entries.map((entry) => {
    if (!entry || !Object.hasOwn(LABELS, entry.weather)) return null;
    const modifier = { freezing: 'Freezing', blowing: 'Blowing', low_drifting: 'Low drifting', patches: 'Patchy', shallow: 'Shallow', partial: 'Partial', showers: 'Showers of' }[entry.modifier];
    return [entry.inVicinity ? 'Nearby' : null, modifier, entry.intensity, LABELS[entry.weather]].filter(Boolean).join(' ');
  }).filter(Boolean).join(' and ');
  // Retain a verified provider phrase when it describes this complete list.
  // Otherwise decoded structured words preserve freezing, thunder, hail, snow,
  // vicinity and other qualifiers that a shorter description might omit.
  const signature = (list) => list.map((entry) => `${entry.weather}:${entry.modifier}:${entry.intensity}:${Boolean(entry.inVicinity)}`).sort().join('|');
  const described = fallbackPhenomena(description);
  const descriptionMatches = described && signature(described) === signature(entries);
  const label = structured && !descriptionMatches ? (derivedLabel ? conditionText(derivedLabel) : description) : description || conditionText(derivedLabel);
  for (const issue of ['incomplete-observation', 'invalid-intensity', 'unrecognized-condition', 'unrecognized-modifier', 'unidentified-precipitation', 'recognized-unrendered', 'vicinity-only', 'unsupported-modifier']) {
    if (issues.has(issue)) return issue === 'incomplete-observation' || issue === 'invalid-intensity' ? empty(issue) : result(null, issue, ['unrecognized-condition', 'unrecognized-modifier'].includes(issue) ? null : label);
  }
  const has = (kind) => kinds.has(kind);
  const rain = has('rain'), drizzle = has('drizzle'), snow = has('snow'), hail = has('hail'), ice = has('ice_pellets'), thunder = has('thunderstorms');
  const fog = has('fog'), mist = has('fog_mist'), haze = has('haze'), freezing = liquidModes.has('freezing'), snowMode = [...snowModes][0] || 'falling';
  if (fogModifiers.size > 1 || liquidModes.size > 1 || snowModes.size > 1 ||
      (haze && (fog || mist || precipitation.length || thunder)) ||
      (ice && (rain || drizzle || snow || hail || thunder)) || (hail && (snow || ice || drizzle || freezing)) ||
      (snow && (drizzle || hail || ice || thunder || freezing)) || (snowMode !== 'falling' && (rain || drizzle || thunder)) ||
      (freezing && (thunder || hail || snow || ice)) || (thunder && drizzle && !rain)) return result(null, 'unsupported-mixture', label);
  const layers = Array.isArray(p.cloudLayers) ? p.cloudLayers.map((layer) => layer?.amount) : [];
  const positiveWeather = entries.length > 0;
  let sky = null;
  const skyValid = layers.length && layers.every((amount) => Object.hasOwn(SUITE_SKY, amount)) &&
    !((layers.includes('CLR') || layers.includes('SKC')) && layers.some((amount) => !['CLR', 'SKC'].includes(amount))) &&
    (!layers.includes('VV') || fog || mist);
  if (skyValid) sky = layers.reduce((a, b) => SUITE_SKY[a] >= SUITE_SKY[b] ? a : b);
  else if (!layers.length && !positiveWeather && SKY_TEXT.has(description)) sky = SKY_TEXT.get(description);
  // Optional unknown sky is omitted for positive weather, never replaced by
  // inferred clear/overcast. A sky-only scene requires positive coherent sky.
  if (!positiveWeather && layers.length && !skyValid) return result(null, 'invalid-sky', label);
  if (!positiveWeather && sky && SKY_TEXT.has(description) && (SUITE_SKY[sky] < .3) !== (SUITE_SKY[SKY_TEXT.get(description)] < .3)) return result(null, 'contradictory-observation', label);
  const measureWind = (q, max) => { const value = qualityOK(q?.qualityControl) ? windMph(q) : null; return value !== null && value <= max ? value : null; };
  const wind = measureWind(p.windSpeed, 100), gust = measureWind(p.windGust, 120);
  const visibility = p.visibility?.unitCode === 'wmoUnit:m' && finite(p.visibility.value) && p.visibility.value >= 0 && p.visibility.value <= 100000 && qualityOK(p.visibility.qualityControl) ? p.visibility.value : null;
  let precip = rain && snow ? 'rain_snow' : rain && hail ? 'rain_hail' : hail ? 'hail' : ice ? 'ice_pellets' : rain ? 'rain' : drizzle ? 'drizzle' : snow ? 'snow' : 'none';
  if (snow && snowMode !== 'falling') precip = snowMode === 'blowing' ? 'blowing_snow' : 'drifting_snow';
  const modes = precip === 'rain_snow' ? ['rain', 'snow'] : precip === 'rain_hail' ? ['rain', 'hail'] : ['blowing_snow', 'drifting_snow'].includes(precip) ? ['snow'] : [precip];
  const intensity = precip === 'none' ? 'moderate' : precipitation.filter((entry) => modes.includes(entry.kind)).reduce((current, entry) => INTENSITY[entry.intensity] > INTENSITY[current] ? entry.intensity : current, 'light');
  const components = { sky, precip, intensity, mist: fog ? visibility !== null && visibility <= 400 ? 'dense_fog' : 'fog' : mist ? 'fog_mist' : haze ? 'haze' : 'none', wind, gust, thunder, visibility,
    modifier: freezing ? 'freezing' : snowMode !== 'falling' ? snowMode : [...fogModifiers][0] || null };
  if (sky === null && precip === 'none' && components.mist === 'none') return result(null, 'no-drawable-components', label);
  if (!validScene({ ...components, daypart: 'day' })) return result(null, 'incomplete-observation', label);
  const skyLabel = { CLR: 'Clear', SKC: 'Clear', FEW: 'A few clouds', SCT: 'Partly cloudy', BKN: 'Mostly cloudy', OVC: 'Overcast', VV: 'Obscured sky' }[sky];
  // A deliberately omitted present-weather label must not become a sky-only
  // claim that drops rain, freezing or another observed qualifier.
  return result(components, 'supported-condition', label || (!positiveWeather ? skyLabel : null) || null);
}
export async function fetchStation(station, now, fetcher = fetch, onOutcome = () => {}) {
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
  let latestObservationReason;
  const logFailure = (stage, error) => {
    const message = typeof error?.message === 'string' ? error.message : '';
    const reason = /^http-\d{3}$/.test(message) || ['oversize', 'invalid-json'].includes(message) ? message : error?.name === 'AbortError' ? 'timeout' : 'network-error';
    console.warn(JSON.stringify({ event: 'weather-provider-unavailable', station, stage, reason }));
    onOutcome({ station, status: 'unavailable', stage, reason, ...(latestObservationReason ? { latestObservationReason } : {}) });
  };
  let latest;
  try { latest = await get('/latest'); } catch (error) { logFailure('latest', error); return null; }
  const normalized = observation(latest, station, now, (reason) => { latestObservationReason = reason; });
  if (normalized) { onOutcome({ station, status: 'ready', stage: 'latest', reason: 'coherent-report' }); return normalized; }
  // One bounded fallback request, maximum four coherent complete observations;
  // never merge properties from separate reports or page through history.
  try {
    const history = await get(`?limit=4&start=${encodeURIComponent(new Date(now - MAX_AGE).toISOString())}`);
    const features = Array.isArray(history.features) ? history.features.slice(0, 4) : [];
    features.sort((a, b) => timestamp(b?.properties?.timestamp) - timestamp(a?.properties?.timestamp));
    for (const feature of features) {
      const report = observation(feature, station, now);
      if (report) { onOutcome({ station, status: 'ready', stage: 'history', reason: 'coherent-report', latestObservationReason }); return report; }
    }
  } catch (error) { logFailure('history', error); return null; }
  console.warn(JSON.stringify({ event: 'weather-provider-unavailable', station, stage: 'history', reason: 'no-coherent-fresh-report' }));
  onOutcome({ station, status: 'unavailable', stage: 'history', reason: 'no-coherent-fresh-report', latestObservationReason });
  return null;
}

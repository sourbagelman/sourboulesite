// PRIVATE TESTS ONLY. Real NWS field shapes populated with synthetic conditions.
import catalog from './fixtures/suite-scenes.json' with { type: 'json' };
export const suiteScenes = catalog;
const CODES = { rain: 'RA', drizzle: 'DZ', snow: 'SN', ice_pellets: 'PL', hail: 'GR', fog: 'FG', fog_mist: 'BR', haze: 'HZ', thunderstorms: 'TS' };
const MODIFIERS = { freezing: 'FZ', blowing: 'BL', low_drifting: 'DR', patches: 'BC', shallow: 'MI', partial: 'PR', showers: 'SH' };
export function sceneObservation(scene, now = Date.parse(scene.daypart === 'night' ? '2026-10-04T03:00:00Z' : '2026-10-04T18:00:00Z'), changes = {}) {
  const presentWeather = [];
  const add = (weather, modifier = null, intensity = null) => presentWeather.push({ weather, modifier, intensity,
    rawString: (intensity === 'light' ? '-' : intensity === 'heavy' ? '+' : '') + (MODIFIERS[modifier] || '') + CODES[weather], inVicinity: false });
  const intensity = scene.intensity === 'moderate' ? null : scene.intensity;
  if (scene.precip === 'rain_snow') { add('rain', null, intensity); add('snow', null, intensity); }
  else if (scene.precip === 'rain_hail') { add('rain', null, intensity); add('hail', null, intensity); }
  else if (['blowing_snow', 'drifting_snow'].includes(scene.precip)) add('snow', scene.precip === 'blowing_snow' ? 'blowing' : 'low_drifting');
  else if (scene.precip !== 'none') add(scene.precip, scene.modifier, intensity);
  if (scene.mist !== 'none') add(scene.mist === 'dense_fog' ? 'fog' : scene.mist, scene.precip === 'none' ? scene.modifier : null);
  if (scene.thunder) add('thunderstorms');
  return { type: 'Feature', properties: { station: 'https://api.weather.gov/stations/KFTW', timestamp: new Date(now - 12 * 60000).toISOString(), textDescription: '',
    presentWeather, cloudLayers: scene.sky === null ? [] : [{ amount: scene.sky, base: { value: 600, unitCode: 'wmoUnit:m' } }],
    windSpeed: { value: scene.wind, unitCode: 'wmoUnit:mi_h-1', qualityControl: 'V' },
    windGust: { value: scene.gust, unitCode: 'wmoUnit:mi_h-1', qualityControl: 'V' },
    visibility: { value: scene.visibility, unitCode: 'wmoUnit:m', qualityControl: 'V' },
    temperature: { value: 21, unitCode: 'wmoUnit:degC', qualityControl: 'V' }, ...changes } };
}

// Small shared wire contract only. No scene fixtures, provider calls or artwork.
const keys = ['sky', 'daypart', 'precip', 'intensity', 'mist', 'wind', 'gust', 'thunder', 'visibility', 'modifier'];
const numberOrNull = (n, max) => n === null || (typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max);
export function validScene(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s) || Object.keys(s).length !== keys.length || !keys.every((key) => Object.hasOwn(s, key))) return false;
  if (![null, 'CLR', 'SKC', 'FEW', 'SCT', 'BKN', 'OVC', 'VV'].includes(s.sky) || !['day', 'night'].includes(s.daypart) ||
      !['none', 'drizzle', 'rain', 'snow', 'ice_pellets', 'hail', 'rain_hail', 'rain_snow', 'blowing_snow', 'drifting_snow'].includes(s.precip) ||
      !['light', 'moderate', 'heavy'].includes(s.intensity) || !['none', 'fog', 'fog_mist', 'dense_fog', 'haze'].includes(s.mist) ||
      !numberOrNull(s.wind, 100) || !numberOrNull(s.gust, 120) || !numberOrNull(s.visibility, 100000) || typeof s.thunder !== 'boolean' ||
      ![null, 'freezing', 'blowing', 'low_drifting', 'patches', 'shallow', 'partial'].includes(s.modifier)) return false;
  if (s.thunder && !['none', 'rain', 'hail', 'rain_hail'].includes(s.precip)) return false;
  if (s.modifier === 'freezing' && (!['rain', 'drizzle'].includes(s.precip) || s.thunder)) return false;
  if ((s.precip === 'blowing_snow') !== (s.modifier === 'blowing') || (s.precip === 'drifting_snow') !== (s.modifier === 'low_drifting')) return false;
  if (['patches', 'shallow', 'partial'].includes(s.modifier) && !['fog', 'dense_fog'].includes(s.mist)) return false;
  if (s.sky === 'VV' && !['fog', 'fog_mist', 'dense_fog'].includes(s.mist)) return false;
  if (s.mist === 'haze' && (s.precip !== 'none' || s.thunder)) return false;
  if (s.mist === 'dense_fog' && (s.visibility === null || s.visibility > 400)) return false;
  if (s.precip === 'none' && s.intensity !== 'moderate') return false;
  if (s.sky === null && s.precip === 'none' && s.mist === 'none') return false;
  return true;
}

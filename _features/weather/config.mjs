// Fixed restaurant addresses are read from the live site's location pages.
// Coordinates: US Census Public_AR_Current address match, verified 2026-10-01.
export const LOCATIONS = Object.freeze({
  'fort-worth': Object.freeze({ latitude: 32.717264292217, longitude: -97.441625546485, station: 'KFTW' }),
  'willow-bend': Object.freeze({ latitude: 32.729383028691, longitude: -97.631901092125, station: 'KFTW' })
});
export const CRON_MINUTE = 47;
export const HOUR = 60 * 60 * 1000;
export const MAX_AGE = 2 * HOUR;
export const FUTURE_TOLERANCE = 5 * 60 * 1000;
export const TIMEZONE = 'America/Chicago';
export const NWS_AGENT = '(thesourboule.com weather effects, lance@thesourboule.com)';
export const ALLOWED_ORIGINS = new Set(['https://thesourboule.com', 'https://www.thesourboule.com']);

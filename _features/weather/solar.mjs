// NOAA/Meeus solar equations; approximate apparent horizon at -0.833 degrees.
// Restaurant-local calendar dates, never the visitor's timezone or fixed hours.
const RAD = Math.PI / 180;
const sin = (v) => Math.sin(v * RAD);
const cos = (v) => Math.cos(v * RAD);
function solarTerms(jd) {
  const t = (jd - 2451545) / 36525;
  const l = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const c = sin(m) * (1.914602 - t * (0.004817 + 0.000014 * t)) + sin(2 * m) * (0.019993 - 0.000101 * t) + sin(3 * m) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const lambda = l + c - 0.00569 - 0.00478 * sin(omega);
  const obliq = 23 + (26 + ((21.448 - t * (46.815 + t * (0.00059 - 0.001813 * t))) / 60)) / 60 + 0.00256 * cos(omega);
  const declination = Math.asin(sin(obliq) * sin(lambda)) / RAD;
  const y = Math.tan(obliq * RAD / 2) ** 2;
  const equation = 4 / RAD * (y * sin(2 * l) - 2 * e * sin(m) + 4 * e * y * sin(m) * cos(2 * l) - 0.5 * y * y * sin(4 * l) - 1.25 * e * e * sin(2 * m));
  return { declination, equation };
}
export function solarWindow(now, latitude, longitude) {
  if (!Number.isFinite(now) || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (name) => parts.find((p) => p.type === name).value;
  const midnight = Date.parse(`${get('year')}-${get('month')}-${get('day')}T00:00:00Z`);
  const jd = midnight / 86400000 + 2440587.5;
  function event(sign) {
    let minutes = 720 - 4 * longitude;
    for (let i = 0; i < 3; i++) {
      const { declination, equation } = solarTerms(jd + minutes / 1440);
      const angle = Math.acos((cos(90.833) / (cos(latitude) * cos(declination))) - Math.tan(latitude * RAD) * Math.tan(declination * RAD)) / RAD;
      minutes = 720 - 4 * longitude - equation + sign * 4 * angle;
    }
    return Math.round(midnight + minutes * 60000);
  }
  const sunrise = event(-1), sunset = event(1);
  return Number.isFinite(sunrise) && Number.isFinite(sunset) && sunrise < sunset ? { sunrise, sunset } : null;
}

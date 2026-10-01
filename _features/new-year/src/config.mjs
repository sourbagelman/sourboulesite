// Dates are fixed UTC instants corresponding to America/Chicago winter time.
// Only server code may authorize registration, eligibility, issuance or redemption.
export const EVENT = Object.freeze({
  id: 'sb-nye-2027', timezone: 'America/Chicago',
  start: Date.parse('2027-01-01T05:50:00.000Z'),
  midnight: Date.parse('2027-01-01T06:00:00.000Z'),
  end: Date.parse('2027-01-01T06:05:00.000Z'),
  expires: Date.parse('2027-01-04T06:00:00.000Z'),
  preWindow: 30000, postWindow: 90000,
  sessionExpires: Date.parse('2027-01-11T06:00:00.000Z')
});
export function phaseAt(now) {
  if (now < EVENT.start) return 'before';
  if (now < EVENT.midnight - 60000) return 'opening';
  if (now < EVENT.midnight) return 'final';
  if (now < EVENT.end) return 'midnight';
  return 'ended';
}
export function validName(value) {
  if (typeof value !== 'string') return null;
  const name = value.trim().normalize('NFC').replace(/\s+/g, ' ');
  return [...name].length >= 1 && [...name].length <= 40 &&
    /^[\p{L}\p{M} .'-]+$/u.test(name) ? name : null;
}
// Codes are strings, never names or guest authentication credentials.
// Real codes are 10000..99999. The 0xxxx range is reserved for unmistakable demos.
export function normalizeCode(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim();
  return /^[1-9][0-9]{4}$/.test(code) ? code : null;
}
export function displayCode(raw) { return raw; }

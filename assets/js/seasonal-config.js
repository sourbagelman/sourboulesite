/* Central annual schedule; business content and review controls live elsewhere. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SourBouleSeasonalConfig = api;
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';

  function freeze(value) {
    Object.values(value).forEach(child => {
      if (child && typeof child === 'object') freeze(child);
    });
    return Object.freeze(value);
  }

  const THEMES = freeze({
    fall: 'Fall',
    halloween: 'Halloween',
    winter: 'Winter',
    christmas: 'Christmas',
    newyear: 'New Year’s',
    valentine: 'Valentine’s',
    spring: 'Spring',
    easter: 'Easter',
    summer: 'Summer',
    independence: 'Independence Day'
  });

  // All endpoints are inclusive. Overrides outrank the underlying season.
  // "last" resolves to the final calendar day of that month in the current year.
  const CONFIG = freeze({
    timeZone: 'America/Chicago',
    mode: 'auto', // auto | off | a key from THEMES; never a simulated date
    schedule: [
      { theme: 'newyear', start: { month: 1, day: 1 }, end: { month: 1, day: 3 }, priority: 10 },
      { theme: 'winter', start: { month: 1, day: 4 }, end: { month: 1, day: 31 }, priority: 0 },
      { theme: 'valentine', start: { month: 2, day: 1 }, end: { month: 2, day: 14 }, priority: 10 },
      { theme: 'winter', start: { month: 2, day: 15 }, end: { month: 2, day: 'last' }, priority: 0 },
      { theme: 'spring', start: { month: 3, day: 1 }, end: { month: 5, day: 31 }, priority: 0 },
      { theme: 'easter', relativeTo: 'western-easter', days: 14, priority: 20 },
      { theme: 'summer', start: { month: 6, day: 1 }, end: { month: 8, day: 31 }, priority: 0 },
      { theme: 'independence', start: { month: 7, day: 1 }, end: { month: 7, day: 7 }, priority: 20 },
      { theme: 'fall', start: { month: 9, day: 1 }, end: { month: 10, day: 14 }, priority: 0 },
      { theme: 'halloween', start: { month: 10, day: 15 }, end: { month: 10, day: 31 }, priority: 10 },
      { theme: 'fall', start: { month: 11, day: 1 }, end: { month: 11, day: 30 }, priority: 0 },
      { theme: 'winter', start: { month: 12, day: 1 }, end: { month: 12, day: 9 }, priority: 0 },
      { theme: 'christmas', start: { month: 12, day: 10 }, end: { month: 12, day: 28 }, priority: 10 },
      { theme: 'newyear', start: { month: 12, day: 29 }, end: { month: 12, day: 31 }, priority: 10 }
    ],
    // Independent of the seasonal schedule: no December mark or later-year marks.
    yearMark: {
      text: '2027',
      start: { year: 2027, month: 1, day: 1 },
      end: { year: 2027, month: 2, day: 28 },
      previewThemes: ['newyear', 'winter', 'valentine']
    }
  });

  function daysInMonth(year, month) {
    if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
    return [4, 6, 9, 11].includes(month) ? 30 : 31;
  }

  function validCivil(date) {
    return Boolean(date && Number.isInteger(date.year) && date.year >= 1 && date.year <= 9999 &&
      Number.isInteger(date.month) && date.month >= 1 && date.month <= 12 &&
      Number.isInteger(date.day) && date.day >= 1 && date.day <= daysInMonth(date.year, date.month));
  }

  function requireCivil(date) {
    if (!validCivil(date)) throw new RangeError('Expected a valid Gregorian calendar date.');
  }

  // UTC here is only a DST-free calendar-day counter, not the selected time zone.
  function dayNumber(date) {
    const value = new Date(0);
    value.setUTCFullYear(date.year, date.month - 1, date.day);
    return value.getTime() / 86400000;
  }

  function parseDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = { year, month, day };
    return validCivil(date) ? date : null;
  }

  function chicagoDate(instant) {
    if (!(instant instanceof Date) || !Number.isFinite(instant.getTime())) {
      throw new RangeError('Expected a valid Date instant.');
    }
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: CONFIG.timeZone, year: 'numeric', month: 'numeric', day: 'numeric'
    }).formatToParts(instant);
    const number = type => Number(parts.find(part => part.type === type).value);
    const date = { year: number('year'), month: number('month'), day: number('day') };
    requireCivil(date);
    return date;
  }

  // Gregorian computus (Western Easter); independent of the machine's time zone.
  function easterSunday(year) {
    if (!Number.isInteger(year) || year < 1 || year > 9999) {
      throw new RangeError('Expected a Gregorian year from 1 to 9999.');
    }
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const value = h + l - 7 * m + 114;
    return { year, month: Math.floor(value / 31), day: value % 31 + 1 };
  }

  function ruleMatches(rule, date) {
    if (rule.relativeTo === 'western-easter') {
      const difference = dayNumber(easterSunday(date.year)) - dayNumber(date);
      return difference >= 0 && difference < rule.days;
    }
    const current = date.month * 100 + date.day;
    const endpoint = boundary => boundary.month * 100 +
      (boundary.day === 'last' ? daysInMonth(date.year, boundary.month) : boundary.day);
    return current >= endpoint(rule.start) && current <= endpoint(rule.end);
  }

  function themeForDate(date) {
    requireCivil(date);
    let selected = null;
    CONFIG.schedule.forEach(rule => {
      if (ruleMatches(rule, date) && (!selected || rule.priority > selected.priority)) selected = rule;
    });
    if (!selected) throw new RangeError('The annual theme schedule has an uncovered date.');
    return selected.theme;
  }

  function yearMarkForDate(date) {
    requireCivil(date);
    const current = dayNumber(date);
    return current >= dayNumber(CONFIG.yearMark.start) && current <= dayNumber(CONFIG.yearMark.end)
      ? CONFIG.yearMark.text : '';
  }

  return Object.freeze({ CONFIG, THEMES, chicagoDate, themeForDate, yearMarkForDate, parseDate, easterSunday });
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const schedule = require('../assets/js/seasonal-config.js');
const { CONFIG, THEMES, chicagoDate, themeForDate, yearMarkForDate, parseDate, easterSunday } = schedule;
const civil = value => {
  const result = parseDate(value);
  assert.ok(result, `Invalid test fixture: ${value}`);
  return result;
};
const offset = (date, days) => {
  const instant = new Date(0);
  instant.setUTCFullYear(date.year, date.month - 1, date.day + days);
  return { year: instant.getUTCFullYear(), month: instant.getUTCMonth() + 1, day: instant.getUTCDate() };
};

test('central configuration and theme labels cannot be changed accidentally at runtime', () => {
  assert.equal(CONFIG.timeZone, 'America/Chicago');
  assert.equal(CONFIG.mode, 'auto');
  assert.equal(Object.keys(THEMES).length, 10);
  assert.deepEqual(CONFIG.yearMark.previewThemes, ['newyear', 'winter', 'valentine']);
  assert.throws(() => { CONFIG.mode = 'off'; }, TypeError);
  assert.throws(() => { CONFIG.schedule[0].start.day = 2; }, TypeError);
  assert.throws(() => { CONFIG.yearMark.end.day = 27; }, TypeError);
  assert.throws(() => { THEMES.spring = 'Other'; }, TypeError);
});

test('browser export needs no document, location, storage, timers, or query-string access', () => {
  const source = fs.readFileSync(path.join(__dirname, '../assets/js/seasonal-config.js'), 'utf8');
  const window = new Proxy({}, { get() { throw new Error('Unexpected browser-state access'); } });
  vm.runInNewContext(source, { window });
  assert.deepEqual(Object.keys(Object.getOwnPropertyDescriptor(window, 'SourBouleSeasonalConfig').value), Object.keys(schedule));
});

test('civil dates reject malformed or impossible values without Date normalization', () => {
  for (const value of [null, undefined, '', '2027-2-1', ' 2027-02-01', '2027-02-01Z', '2027-02-29',
    '2027-04-31', '2027-00-01', '2027-13-01', '2027-01-00', '2027-01-32', '0000-01-01', '10000-01-01']) {
    assert.equal(parseDate(value), null, String(value));
  }
  assert.deepEqual(parseDate('2028-02-29'), { year: 2028, month: 2, day: 29 });
  assert.deepEqual(parseDate('0001-01-01'), { year: 1, month: 1, day: 1 });
  assert.equal(parseDate('2100-02-29'), null);
  assert.ok(parseDate('2400-02-29'));
  for (const invalid of [null, {}, { year: 2027, month: 2, day: 29 }, { year: '2027', month: 1, day: 1 }]) {
    assert.throws(() => themeForDate(invalid), RangeError);
    assert.throws(() => yearMarkForDate(invalid), RangeError);
  }
  assert.throws(() => chicagoDate(new Date(NaN)), RangeError);
  assert.throws(() => chicagoDate('2027-01-01'), RangeError);
  assert.throws(() => easterSunday(2027.5), RangeError);
});

const boundaries = [
  ['2027-01-01', 'newyear'], ['2027-01-03', 'newyear'], ['2027-01-04', 'winter'],
  ['2027-01-31', 'winter'], ['2027-02-01', 'valentine'], ['2027-02-14', 'valentine'],
  ['2027-02-15', 'winter'], ['2027-02-28', 'winter'], ['2027-03-01', 'spring'],
  ['2027-05-31', 'spring'], ['2027-06-01', 'summer'], ['2027-06-30', 'summer'],
  ['2027-07-01', 'independence'], ['2027-07-07', 'independence'], ['2027-07-08', 'summer'],
  ['2027-08-31', 'summer'], ['2027-09-01', 'fall'], ['2027-10-14', 'fall'],
  ['2027-10-15', 'halloween'], ['2027-10-31', 'halloween'], ['2027-11-01', 'fall'],
  ['2027-11-30', 'fall'], ['2027-12-01', 'winter'], ['2027-12-09', 'winter'],
  ['2027-12-10', 'christmas'], ['2027-12-28', 'christmas'], ['2027-12-29', 'newyear'],
  ['2027-12-31', 'newyear'], ['2028-01-01', 'newyear'], ['2028-01-03', 'newyear'],
  ['2028-01-04', 'winter'], ['2028-02-29', 'winter'], ['2028-03-01', 'spring']
];
for (const [date, expected] of boundaries) {
  test(`inclusive annual boundary ${date}: ${expected}`, () => {
    assert.equal(themeForDate(civil(date)), expected);
  });
}

test('Western Easter matches independently recorded early, late, and future dates', () => {
  for (const expected of ['1818-03-22', '1900-04-15', '1943-04-25', '2000-04-23', '2024-03-31',
    '2025-04-20', '2026-04-05', '2027-03-28', '2028-04-16', '2029-04-01', '2030-04-21', '2038-04-25', '2100-03-28']) {
    const date = civil(expected);
    assert.deepEqual(easterSunday(date.year), date, expected);
  }
});

test('Easter overrides exactly 14 calendar days, including Sunday, for every year 1583–4099', () => {
  for (let year = 1583; year <= 4099; year += 1) {
    const easter = easterSunday(year);
    const sunday = new Date(0);
    sunday.setUTCFullYear(year, easter.month - 1, easter.day);
    assert.equal(sunday.getUTCDay(), 0, String(year));
    assert.ok((easter.month === 3 && easter.day >= 22) || (easter.month === 4 && easter.day <= 25));
    assert.equal(themeForDate(offset(easter, -14)), 'spring', `${year}: before override`);
    for (let day = -13; day <= 0; day += 1) {
      assert.equal(themeForDate(offset(easter, day)), 'easter', `${year}: Easter ${day}`);
    }
    assert.equal(themeForDate(offset(easter, 1)), 'spring', `${year}: after override`);
  }
});

test('all 146,097 dates in a Gregorian 400-year cycle have a valid seasonal theme', () => {
  let date = { year: 2000, month: 1, day: 1 };
  let count = 0;
  const counts = Object.fromEntries(Object.keys(THEMES).map(theme => [theme, 0]));
  while (date.year < 2400) {
    const theme = themeForDate(date);
    assert.ok(Object.hasOwn(THEMES, theme), `${JSON.stringify(date)}: ${theme}`);
    counts[theme] += 1;
    count += 1;
    date = offset(date, 1);
  }
  assert.equal(count, 146097);
  assert.equal(counts.newyear, 6 * 400);
  assert.equal(counts.valentine, 14 * 400);
  assert.equal(counts.easter, 14 * 400);
  assert.equal(counts.independence, 7 * 400);
  assert.equal(counts.halloween, 17 * 400);
  assert.equal(counts.christmas, 19 * 400);
  assert.ok(Object.values(counts).every(count => count > 0));
});

test('Chicago midnight selects the civil day independently of UTC and host time zone', () => {
  for (const [instant, date, expected] of [
    ['2026-10-15T04:59:59.999Z', '2026-10-14', 'fall'],
    ['2026-10-15T05:00:00.000Z', '2026-10-15', 'halloween'],
    ['2027-02-01T05:59:59.999Z', '2027-01-31', 'winter'],
    ['2027-02-01T06:00:00.000Z', '2027-02-01', 'valentine'],
    ['2027-07-01T04:59:59.999Z', '2027-06-30', 'summer'],
    ['2027-07-01T05:00:00.000Z', '2027-07-01', 'independence']
  ]) {
    const actual = chicagoDate(new Date(instant));
    assert.deepEqual(actual, civil(date), instant);
    assert.equal(themeForDate(actual), expected, instant);
  }
});

test('both DST transitions retain the correct Chicago civil date and season', () => {
  for (const instant of ['2027-03-14T07:59:59.999Z', '2027-03-14T08:00:00.000Z']) {
    const date = chicagoDate(new Date(instant));
    assert.deepEqual(date, civil('2027-03-14'));
    assert.equal(themeForDate(date), 'spring');
  }
  for (const instant of ['2027-11-07T06:59:59.999Z', '2027-11-07T07:00:00.000Z']) {
    const date = chicagoDate(new Date(instant));
    assert.deepEqual(date, civil('2027-11-07'));
    assert.equal(themeForDate(date), 'fall');
  }
});

test('year mark begins at Chicago New Year midnight and is independent of seasonal selection', () => {
  const before = chicagoDate(new Date('2027-01-01T05:59:59.999Z'));
  const after = chicagoDate(new Date('2027-01-01T06:00:00.000Z'));
  assert.equal(themeForDate(before), 'newyear');
  assert.equal(themeForDate(after), 'newyear');
  assert.equal(yearMarkForDate(before), '');
  assert.equal(yearMarkForDate(after), '2027');
  assert.equal(themeForDate(civil('2027-01-04')), 'winter');
  assert.equal(yearMarkForDate(civil('2027-01-04')), '2027');
});

test('March 1 removes the year mark at Chicago midnight and retains spring decorations', () => {
  const before = chicagoDate(new Date('2027-03-01T05:59:59.999Z'));
  const after = chicagoDate(new Date('2027-03-01T06:00:00.000Z'));
  assert.equal(themeForDate(before), 'winter');
  assert.equal(yearMarkForDate(before), '2027');
  assert.equal(themeForDate(after), 'spring');
  assert.equal(yearMarkForDate(after), '');
});

test('the year mark appears for exactly 59 days in 2027 and never recurs in later years', () => {
  let count = 0;
  for (let date = civil('2026-01-01'); date.year <= 2032; date = offset(date, 1)) {
    const mark = yearMarkForDate(date);
    if (mark) {
      assert.equal(mark, '2027');
      assert.equal(date.year, 2027);
      assert.ok(date.month <= 2);
      count += 1;
    }
  }
  assert.equal(count, 59);
  assert.equal(themeForDate(civil('2028-02-29')), 'winter');
  assert.equal(yearMarkForDate(civil('2028-02-29')), '');
  assert.equal(yearMarkForDate(civil('2099-01-01')), '');
});

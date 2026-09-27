(() => {
  'use strict';
  if (document.documentElement.dataset.reviewEnabled !== 'true') return;
  const calendar = window.SourBouleSeasonalConfig;
  if (!calendar) return;
  const { CONFIG, THEMES, chicagoDate, themeForDate, parseDate } = calendar;
  const form = document.getElementById('review-controls');
  const page = document.getElementById('review-page');
  const theme = document.getElementById('review-theme');
  const date = document.getElementById('review-date');
  const year = document.getElementById('review-year');
  const width = document.getElementById('review-width');
  const frame = document.getElementById('review-frame');
  const openPage = document.getElementById('open-page');
  const status = document.getElementById('review-status');
  Object.entries(THEMES).forEach(([id, label]) => theme.add(new Option(label, id)));
  form.querySelector('fieldset').disabled = false;

  const months = Array.from({ length: 12 }, (_, month) => new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2027, month, 1))));
  const endpoint = boundary => boundary.day === 'last' ? `last day of ${months[boundary.month - 1]}` : `${months[boundary.month - 1]} ${boundary.day}`;
  const rows = document.getElementById('schedule-rows');
  CONFIG.schedule.forEach(rule => {
    const row = document.createElement('tr');
    const window = rule.relativeTo === 'western-easter'
      ? `${rule.days} calendar days ending on Western Easter Sunday, inclusive`
      : `${endpoint(rule.start)}–${endpoint(rule.end)}`;
    [window, THEMES[rule.theme], rule.priority ? 'Holiday override' : 'Season'].forEach(value => {
      const cell = document.createElement('td');
      cell.textContent = value;
      row.append(cell);
    });
    rows.append(row);
  });

  function apply(event) {
    if (event) event.preventDefault();
    const parameters = new URLSearchParams({ season: theme.value, year: year.value });
    if (parseDate(date.value)) parameters.set('date', date.value);
    const url = new URL('/' + page.value, location.origin);
    url.search = parameters.toString();
    frame.src = url.href;
    frame.style.width = width.value;
    openPage.href = url.href;
    const civil = parseDate(date.value) || chicagoDate(new Date());
    const selected = theme.value === 'auto' ? themeForDate(civil) : theme.value;
    const eligible = CONFIG.yearMark.previewThemes.includes(selected) || selected === 'off';
    status.textContent = `${page.selectedOptions[0].textContent} · ${THEMES[selected] || 'Off / normal website'} · ${date.value || 'Today in Chicago'}.` +
      (!eligible && year.value === '2027' ? ' The 2027 mark is intentionally omitted for this theme.' : '');
  }
  form.addEventListener('submit', apply);
  width.addEventListener('change', () => { frame.style.width = width.value; });
  apply();
})();

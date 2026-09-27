/* Optional seasonal presentation. Business content remains in the HTML. */
(() => {
  'use strict';
  const script = document.currentScript;

  function measureNavigation() {
    if (!document.querySelector('[data-seasonal-anchor]')) return;
    const header = document.querySelector('.site-header');
    const categories = document.querySelector('.section-nav');
    const root = document.documentElement;
    const update = () => {
      [[header, '--sb-header-clearance'], [categories, '--sb-section-nav-clearance']].forEach(([node, property]) => {
        const value = Math.ceil(node?.getBoundingClientRect().height || 0) + 'px';
        if (root.style.getPropertyValue(property) !== value) root.style.setProperty(property, value);
      });
    };
    update();
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(update);
      if (header) observer.observe(header);
      if (categories) observer.observe(categories);
    }
    window.addEventListener('resize', update, { passive: true });
    window.addEventListener('pageshow', update);
    document.fonts?.ready.then(update);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', measureNavigation, { once: true });
  else measureNavigation();

  const calendar = window.SourBouleSeasonalConfig;
  if (!calendar) return;
  const { CONFIG, THEMES, chicagoDate, themeForDate, yearMarkForDate, parseDate } = calendar;
  const review = script?.dataset.allowPreview === 'true';
  const parameters = review ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const validMode = value => value === 'auto' || value === 'off' || value === 'normal' || Object.hasOwn(THEMES, value);
  const configuredMode = script?.dataset.season || CONFIG.mode;
  const requestedMode = parameters.get('season');
  const mode = validMode(requestedMode) ? requestedMode : (validMode(configuredMode) ? configuredMode : 'off');
  const dateOverride = review ? parseDate(parameters.get('date') || '') : null;
  let timer;

  function apply() {
    let theme = 'off';
    let year = '';
    try {
      const date = dateOverride || chicagoDate(new Date());
      theme = mode === 'auto' ? themeForDate(date) : (mode === 'normal' ? 'off' : mode);
      year = yearMarkForDate(date);
      if (review) {
        const eligible = CONFIG.yearMark.previewThemes.includes(theme) || theme === 'off';
        if (!eligible || parameters.get('year') === 'off') year = '';
        else if (parameters.get('year') === '2027') year = CONFIG.yearMark.text;
      }
    } catch (_) {
      // Leave the ordinary website usable if the calendar is unavailable.
      theme = 'off';
      year = '';
    }

    const root = document.documentElement;
    if (theme === 'off') delete root.dataset.sbSeason;
    else root.dataset.sbSeason = theme;

    document.querySelectorAll('[data-seasonal-art]').forEach(node => {
      node.classList.add('sb-seasonal-art');
      node.hidden = theme === 'off';
    });
    document.querySelectorAll('[data-seasonal-trim]').forEach(node => {
      node.classList.add('sb-seasonal-trim');
      node.hidden = theme === 'off' || theme === 'fall';
    });
    document.querySelectorAll('[data-seasonal-year]').forEach(node => {
      node.classList.add('sb-year');
      if (node.textContent !== year) node.textContent = year;
      node.hidden = !year;
    });
  }

  function refresh() {
    apply();
    window.clearTimeout(timer);
    // Chicago midnight is also a UTC minute boundary, including DST dates.
    timer = window.setTimeout(refresh, 60000 - (Date.now() % 60000) + 25);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refresh, { once: true });
  else refresh();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('focus', refresh);
  window.addEventListener('pageshow', refresh);
})();

/* Optional restaurant-weather decoration. No visitor location or production demo hooks. */
const ENABLED = true; // Weather-only kill switch: build after setting false; no other feature changes.
export const SESSION_KEY = 'sb-weather-session-played-v1';
export const OFF_KEY = 'sb-weather-disabled-v1';
const HOUR = 3600000;
const EFFECTS = new Set(['rain', 'snow', 'wind', 'cloud', 'sun', 'night', 'none']);
const LOCATIONS = { '/': 'fort-worth', '/index.html': 'fort-worth', '/fort-worth.html': 'fort-worth', '/willow-bend.html': 'willow-bend' };
const isoTime = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) return NaN;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === (value.includes('.') ? value : value.replace('Z', '.000Z')) ? time : NaN;
};

export function validSnapshot(value, location, now = Date.now()) {
  if (!value || value.version !== 1 || value.location !== location || value.provider !== 'NWS' ||
      value.timezone !== 'America/Chicago' || typeof value.station !== 'string' || !/^[A-Z0-9]{3,8}$/.test(value.station) || !EFFECTS.has(value.effect)) return false;
  const observed = isoTime(value.observedAt), fetched = isoTime(value.fetchedAt), expires = isoTime(value.validUntil);
  if (![observed, fetched, expires].every(Number.isFinite) || observed > now + 300000 || fetched > now + 300000 ||
      observed > fetched + 300000 || now - observed > 2 * HOUR || now - fetched > HOUR || expires <= now ||
      expires > observed + 2 * HOUR || expires > fetched + HOUR || expires <= fetched) return false;
  const condition = { rain: 'rain', snow: 'snow', wind: 'wind', cloud: 'cloud', sun: 'clear', night: 'clear', none: 'none' }[value.effect];
  if (value.condition !== condition) return false;
  if (condition === 'clear') {
    const rise = isoTime(value.sunrise), set = isoTime(value.sunset);
    if (!Number.isFinite(rise) || !Number.isFinite(set) || rise >= set || set - rise > 20 * HOUR ||
        Math.abs(now - rise) > 30 * HOUR || Math.abs(now - set) > 30 * HOUR) return false;
    const daylight = now >= rise && now < set;
    if ((value.effect === 'sun') !== daylight || (now < rise && expires > rise) || (daylight && expires > set)) return false;
  }
  return true;
}

export function installWeather(script = document.currentScript) {
  if (!ENABLED || !script || !Object.hasOwn(LOCATIONS, location.pathname)) return;
  const place = LOCATIONS[location.pathname];
  if (script.dataset.location !== place) return;
  let endpoint;
  try {
    endpoint = new URL(script.dataset.endpoint);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/weather/' + place) return;
  } catch { return; }
  const control = document.querySelector('[data-sb-weather-toggle]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let closed = false, off = false, storageWorks = false, idle = 0, idleFallback = 0, timeout = 0, deadline = 0;
  let request = null, stopRenderer = null, observer = null;
  const readableStorage = () => {
    const used = sessionStorage.getItem(SESSION_KEY), preference = localStorage.getItem(OFF_KEY);
    if (![null, '1'].includes(used) || ![null, '0', '1'].includes(preference)) throw Error('Unknown preference');
    // Probe writes without consuming the session. Disabled/denied storage means no automatic effect.
    if (used === null) { sessionStorage.setItem(SESSION_KEY, ''); sessionStorage.removeItem(SESSION_KEY); }
    if (preference === null) { localStorage.setItem(OFF_KEY, '0'); localStorage.removeItem(OFF_KEY); }
    off = preference === '1';
    return used !== '1';
  };
  let unplayed = false;
  try { unplayed = readableStorage(); storageWorks = true; } catch { off = true; }
  const updateControl = () => {
    if (!control) return;
    control.setAttribute('aria-pressed', String(!off));
    control.textContent = 'Weather effects: ' + (off ? 'off' : 'on');
    control.title = storageWorks ? 'Turn weather decoration on or off. Turning on applies on the next eligible page.' : 'Weather effects are off because browser storage is unavailable.';
    control.disabled = !storageWorks;
  };
  updateControl();
  const existingEffectsOff = () => {
    const seasonal = document.querySelector('[data-seasonal-controller]');
    const mode = seasonal?.dataset.season || window.SourBouleSeasonalConfig?.CONFIG?.mode;
    return mode === 'off' || mode === 'normal';
  };
  const slowConnection = () => {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return connection?.saveData === true || ['slow-2g', '2g'].includes(connection?.effectiveType) ||
      (typeof connection?.downlink === 'number' && connection.downlink < 0.5);
  };
  const eligible = () => {
    try {
      return !closed && storageWorks && !off && localStorage.getItem(OFF_KEY) !== '1' &&
        sessionStorage.getItem(SESSION_KEY) !== '1' && !reduced.matches && !document.hidden &&
        !existingEffectsOff() && !slowConnection() && !document.getElementById('sb-nye-isolated-host');
    } catch { return false; }
  };
  const stop = () => {
    if (closed) return;
    closed = true;
    if (idle) window.cancelIdleCallback?.(idle);
    clearTimeout(idleFallback); clearTimeout(timeout); clearTimeout(deadline);
    request?.abort(); request = null;
    observer?.disconnect(); observer = null;
    window.removeEventListener('load', defer);
    window.removeEventListener('pagehide', stop);
    document.removeEventListener('visibilitychange', onHidden);
    if (reduced.removeEventListener) reduced.removeEventListener('change', onMotion);
    else reduced.removeListener?.(onMotion);
    const cancel = stopRenderer; stopRenderer = null; cancel?.('client-stop');
  };
  const onHidden = () => { if (document.hidden) stop(); };
  const onMotion = () => { if (reduced.matches) stop(); };
  // Only the small preference control and cross-tab preference listener persist after cleanup.
  control?.addEventListener('click', () => {
    off = !off;
    try { localStorage.setItem(OFF_KEY, off ? '1' : '0'); } catch { off = true; storageWorks = false; }
    updateControl();
    if (off) stop();
  });
  window.addEventListener('storage', event => {
    if (event.key !== OFF_KEY && event.key !== null) return;
    try { off = localStorage.getItem(OFF_KEY) === '1'; } catch { off = true; storageWorks = false; }
    updateControl(); if (off) stop();
  });
  if (!unplayed || !eligible()) { stop(); return; }
  window.addEventListener('pagehide', stop);
  document.addEventListener('visibilitychange', onHidden);
  if (reduced.addEventListener) reduced.addEventListener('change', onMotion);
  else reduced.addListener?.(onMotion);
  observer = new MutationObserver(() => { if (document.getElementById('sb-nye-isolated-host')) stop(); });
  observer.observe(document.body, { childList: true }); // Actual NYE host is a direct body child; closed shadow content is irrelevant.

  async function play() {
    idle = idleFallback = 0;
    if (!eligible()) { stop(); return; }
    request = new AbortController();
    timeout = setTimeout(stop, 3000);
    try {
      const response = await fetch(endpoint.href, { signal: request.signal, credentials: 'omit', mode: 'cors', cache: 'default' });
      if (!eligible() || !response.ok) { stop(); return; }
      const length = Number(response.headers.get('content-length'));
      if (Number.isFinite(length) && length > 2048) { stop(); return; }
      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > 2048) { stop(); return; }
      const data = JSON.parse(text);
      clearTimeout(timeout); timeout = 0; request = null;
      if (!eligible() || !validSnapshot(data, place) || data.effect === 'none') { stop(); return; }
      // Import has no abort API. The short deadline and guards make a late module inert.
      timeout = setTimeout(stop, 3000);
      const renderer = await import('/assets/js/weather-renderer.js');
      clearTimeout(timeout); timeout = 0;
      if (!eligible() || !validSnapshot(data, place)) { stop(); return; }
      const month = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'numeric' }).format(new Date()));
      stopRenderer = renderer.startWeather({ effect: data.effect, autumnLeaves: month >= 9 && month <= 11, onFinish: stop });
      if (!stopRenderer) { stop(); return; }
      // Synchronous start must succeed before a tab's one shared session is consumed.
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { stop(); return; }
      deadline = setTimeout(stop, 4000);
    } catch { stop(); }
  }
  function defer() {
    if (!eligible()) { stop(); return; }
    if (typeof window.requestIdleCallback === 'function' && typeof window.cancelIdleCallback === 'function') idle = window.requestIdleCallback(play, { timeout: 1500 });
    else idleFallback = setTimeout(play, 250);
  }
  if (document.readyState === 'complete') defer();
  else window.addEventListener('load', defer, { once: true });
}
if (typeof document !== 'undefined') installWeather();

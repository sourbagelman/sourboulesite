import { validScene } from './components-v3.mjs';
import { createReadout } from './readout-v3.mjs';

const ENABLED = true;
export const SESSION_KEY = 'sb-weather-session-played-v1';
export const OFF_KEY = 'sb-weather-disabled-v1';
export const LIGHTING_KEY = 'sb-weather-lighting-disabled-v1';
export const PLAYBACK_MS = 5000;
const HOUR = 3600000;
const LOCATIONS = { '/': 'fort-worth', '/index.html': 'fort-worth', '/fort-worth.html': 'fort-worth', '/willow-bend.html': 'willow-bend' };
const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' });
const isoTime = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) return NaN;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === (value.includes('.') ? value : value.replace('Z', '.000Z')) ? time : NaN;
};
export function snapshotProblem(value, location, now = Date.now()) {
  if (!value || value.version !== 3 || !Object.hasOwn(LOCATIONS, '/' + location + '.html') || value.location !== location || value.provider !== 'NWS' || value.station !== 'KFTW' || value.timezone !== 'America/Chicago') return 'invalid-snapshot';
  const observed = isoTime(value.observedAt), fetched = isoTime(value.fetchedAt), expires = isoTime(value.validUntil);
  if (![observed, fetched, expires].every(Number.isFinite)) return 'snapshot-timestamps';
  if (observed > now + 300000 || fetched > now + 300000 || observed > fetched + 300000 || now - observed > 2 * HOUR || now - fetched > HOUR || expires <= now || expires > observed + 2 * HOUR || expires > fetched + HOUR || expires <= fetched) return 'snapshot-freshness';
  const rise = isoTime(value.sunrise), set = isoTime(value.sunset);
  if (!Number.isFinite(rise) || !Number.isFinite(set) || rise >= set || set - rise > 20 * HOUR || day.format(rise) !== day.format(now) || day.format(set) !== day.format(now) || day.format(expires - 1) !== day.format(now)) return 'snapshot-solar';
  const daylight = now >= rise && now < set;
  if ((now < rise && expires > rise) || (daylight && expires > set)) return 'snapshot-solar';
  if (value.scene !== null && (!validScene(value.scene) || value.scene.daypart !== (daylight ? 'day' : 'night'))) return 'invalid-components';
  if (!value.controls || !['enhanced', 'readout', 'lighting'].every(key => typeof value.controls[key] === 'boolean')) return 'invalid-snapshot';
  if (value.temperatureF !== null && (typeof value.temperatureF !== 'number' || !Number.isFinite(value.temperatureF) || value.temperatureF < -150 || value.temperatureF > 150)) return 'invalid-snapshot';
  if (value.conditionLabel !== null && (typeof value.conditionLabel !== 'string' || !value.conditionLabel.trim() || value.conditionLabel.length > 120 || !/^[\p{L}\p{N} ,.'’()\/&+\-–—]+$/u.test(value.conditionLabel))) return 'invalid-snapshot';
  if (!['sun', 'moon', 'cloud', 'rain', 'snow', 'fog', 'neutral'].includes(value.icon) || (value.scene === null && value.icon !== 'neutral')) return 'invalid-snapshot';
  const f = value.fallback, conditions = { rain: 'rain', snow: 'snow', wind: 'wind', cloud: 'cloud', sun: 'clear', night: 'clear', none: 'none', fog: 'fog', drizzle: 'drizzle', storm: 'storm' };
  if (!f || typeof f.effect !== 'string' || !Object.hasOwn(conditions, f.effect) || f.condition !== conditions[f.effect] || typeof f.mist !== 'boolean' || typeof f.night !== 'boolean' || (f.mist && !['rain', 'drizzle'].includes(f.effect)) || (f.night && f.effect !== 'fog')) return 'invalid-snapshot';
  if ((f.condition === 'clear' && (f.effect === 'sun') !== daylight) || (f.condition === 'fog' && f.night !== !daylight)) return 'snapshot-solar';
  return '';
}
export const validSnapshot = (value, location, now = Date.now()) => !snapshotProblem(value, location, now);

export function installWeather(script = document.currentScript) {
  let status = Object.freeze({ version: 3, phase: 'starting', reason: 'initializing' });
  let readoutStatus = 'not-homepage';
  const report = (phase, reason, effect) => { status = Object.freeze({ version: 3, phase, reason, ...(effect ? { effect } : {}), readout: readoutStatus }); };
  const reportReadout = why => { readoutStatus = why; status = Object.freeze({ ...status, readout: why }); };
  try { Object.defineProperty(window, 'SourBouleWeatherStatus', { get: () => status }); } catch {}
  if (!ENABLED) { report('skipped', 'disabled'); return; }
  if (!script || !Object.hasOwn(LOCATIONS, location.pathname)) { report('skipped', 'ineligible-page'); return; }
  const place = LOCATIONS[location.pathname], home = location.pathname === '/' || location.pathname === '/index.html';
  if (home) reportReadout('loading');
  let endpoint;
  try {
    endpoint = new URL(script.dataset.endpoint);
    if (script.dataset.location !== place || endpoint.origin !== 'https://sour-boule-weather.lance-c84.workers.dev' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash || endpoint.pathname !== '/weather/v3/' + place) throw Error('Invalid endpoint');
  } catch { report('skipped', 'invalid-configuration'); return; }
  const readout = home ? createReadout(document.querySelector('[data-sb-home-weather]')) : null;
  const control = document.querySelector('[data-sb-weather-toggle]'), lightControl = document.querySelector('[data-sb-weather-lighting]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let off = false, lightingOff = false, storageWorks = false, animationClosed = false, stopRenderer = null, preparation = null;
  let playbackDeadline = 0, preparationDeadline = 0, idle = 0, fallbackIdle = 0, dataTimeout = 0, expiry = 0, returnTimer = 0;
  let dataRequest = null, pending = null, latest = null, serverLighting = null, initial = true, away = document.hidden, nye = !!document.getElementById('sb-nye-isolated-host');
  const preferences = () => {
    const used = sessionStorage.getItem(SESSION_KEY), preference = localStorage.getItem(OFF_KEY), light = localStorage.getItem(LIGHTING_KEY);
    if (![null, '1'].includes(used) || ![null, '0', '1'].includes(preference) || ![null, '0', '1'].includes(light)) throw Error('Unknown preference');
    if (used === null) { sessionStorage.setItem(SESSION_KEY, ''); sessionStorage.removeItem(SESSION_KEY); }
    if (preference === null) { localStorage.setItem(OFF_KEY, '0'); localStorage.removeItem(OFF_KEY); }
    off = preference === '1'; lightingOff = light === '1';
  };
  try { preferences(); storageWorks = true; } catch { off = lightingOff = true; }
  const updateControls = () => {
    if (control) { control.setAttribute('aria-pressed', String(!off)); control.textContent = 'Weather effects: ' + (off ? 'off' : 'on'); control.disabled = !storageWorks; control.title = storageWorks ? 'Turning on applies on the next eligible page.' : 'Weather animation is off because browser storage is unavailable.'; }
    if (lightControl) { const enabled = !lightingOff && serverLighting !== false; lightControl.setAttribute('aria-pressed', String(enabled)); lightControl.textContent = 'Storm lighting: ' + (enabled ? 'on' : 'off'); lightControl.disabled = !storageWorks || serverLighting === false; lightControl.title = serverLighting === false ? 'Storm lighting is disabled for this release.' : 'Saved lighting preference. Turning off stops the current decoration; turning on applies to a later eligible visit.'; }
  };
  updateControls();
  const reason = () => {
    try {
      const seasonal = document.querySelector('[data-seasonal-controller]');
      const mode = seasonal?.dataset.season || window.SourBouleSeasonalConfig?.CONFIG?.mode;
      const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      return animationClosed ? 'already-stopped' : !storageWorks ? 'storage-unavailable' :
        off || localStorage.getItem(OFF_KEY) === '1' ? 'preference-off' : sessionStorage.getItem(SESSION_KEY) === '1' ? 'played-session' :
        reduced.matches ? 'reduced-motion' : document.hidden ? 'hidden' : mode === 'off' || mode === 'normal' ? 'existing-effects-off' :
        connection?.saveData === true || ['slow-2g', '2g'].includes(connection?.effectiveType) || (typeof connection?.downlink === 'number' && connection.downlink < 0.5) ? 'slow-connection' :
        document.getElementById('sb-nye-isolated-host') ? 'nye-active' : '';
    } catch { return 'storage-unavailable'; }
  };
  const abortData = () => { dataRequest?.abort(); dataRequest = null; pending = null; clearTimeout(dataTimeout); };
  const clearIdle = () => { if (idle) window.cancelIdleCallback?.(idle); idle = 0; clearTimeout(fallbackIdle); fallbackIdle = 0; };
  const stopAnimation = (why = 'cancelled') => {
    if (animationClosed) return;
    report(status.phase === 'playing' ? 'finished' : 'skipped', why, status.effect);
    animationClosed = true; clearTimeout(playbackDeadline); clearTimeout(preparationDeadline); preparation?.abort(); preparation = null;
    const stop = stopRenderer; stopRenderer = null; stop?.('client-stop');
    if (!home) {
      abortData(); clearIdle(); observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('pagehide', onPageHide); window.removeEventListener('pageshow', onPageShow);
      if (reduced.removeEventListener) reduced.removeEventListener('change', onMotion); else reduced.removeListener?.(onMotion);
    }
  };
  const updateReadout = () => {
    clearTimeout(expiry);
    if (!home) return;
    const invalid = latest && snapshotProblem(latest, place);
    const why = nye ? 'nye-active' : document.hidden || away ? 'hidden' : !latest ? 'unavailable' : invalid ? invalid === 'snapshot-freshness' ? 'expired' : invalid : !latest.controls.readout ? 'disabled' : !latest.conditionLabel ? 'no-valid-label' : '';
    if (why) { readout?.hide(); reportReadout(why); return; }
    readout?.update(latest);
    reportReadout('fresh');
    expiry = setTimeout(() => { readout?.hide(); reportReadout('expired'); }, Math.max(0, Date.parse(latest.validUntil) - Date.now()));
  };
  async function animate(data) {
    const blocked = reason(); if (blocked) { stopAnimation(blocked); return; }
    const enhanced = data.controls.enhanced;
    if (enhanced ? !data.scene : data.fallback.effect === 'none') { stopAnimation('no-effect'); return; }
    const effect = enhanced ? data.scene.precip === 'none' ? data.scene.thunder ? 'thunder' : data.scene.mist !== 'none' ? data.scene.mist : data.scene.sky || 'none' : data.scene.precip : data.fallback.effect;
    report('loading-renderer', 'renderer-request', effect);
    preparation = new AbortController();
    preparationDeadline = setTimeout(() => stopAnimation('renderer-timeout'), 3000);
    try {
      let start;
      if (enhanced) {
        const renderer = await import('/assets/js/weather-renderer-v3.js');
        if (reason()) { if (!animationClosed) stopAnimation(reason()); return; }
        start = await renderer.prepareWeather({ scene: data.scene, lighting: serverLighting && !lightingOff, signal: preparation.signal });
      } else {
        const renderer = await import('/assets/js/weather-fallback-v3.js');
        start = options => renderer.startWeather({ ...data.fallback, autumnLeaves: [9, 10, 11].includes(Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', month: 'numeric' }).format(new Date()))), ...options });
      }
      clearTimeout(preparationDeadline);
      const blocked = reason(); if (blocked) { if (!animationClosed) stopAnimation(blocked); return; }
      const problem = snapshotProblem(data, place); if (problem) { updateReadout(); stopAnimation(problem); return; }
      if (!start) { stopAnimation('renderer-unavailable'); return; }
      stopRenderer = start({ onFinish: stopAnimation });
      if (!stopRenderer) { stopAnimation('renderer-unavailable'); return; }
      preparation = null;
      report('playing', 'started', effect);
      try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { stopAnimation('storage-unavailable'); return; }
      // Preparation and downloads are complete. The full five seconds starts here.
      playbackDeadline = setTimeout(() => stopAnimation('complete'), PLAYBACK_MS);
    } catch { if (!animationClosed) stopAnimation('renderer-failed'); }
  }
  async function fetchSnapshot() {
    if (pending) return pending;
    if (document.hidden || away || nye) return;
    const blocked = reason();
    if (!home && blocked) { stopAnimation(blocked); return; }
    if (latest && !snapshotProblem(latest, place)) { updateReadout(); return; }
    const operation = Promise.resolve().then(async () => {
      if (document.hidden || away || nye || (!home && animationClosed)) { if (pending === operation) pending = null; return; }
      const request = new AbortController(); dataRequest = request;
      let timedOut = false;
      const timer = setTimeout(() => { timedOut = true; request.abort(); }, 3000); dataTimeout = timer;
      if (!animationClosed) report('fetching', 'weather-request');
      try {
        const response = await fetch(endpoint.href, { signal: request.signal, credentials: 'omit', mode: 'cors', cache: 'default' });
        if (request.signal.aborted) return;
        if (!response.ok) throw Error('http-unavailable');
        if (Number(response.headers.get('content-length')) >= 2048) throw Error('invalid-payload');
        const text = await response.text();
        if (new TextEncoder().encode(text).byteLength >= 2048) throw Error('invalid-payload');
        let data; try { data = JSON.parse(text); } catch { throw Error('invalid-json'); }
        const problem = snapshotProblem(data, place); if (problem) throw Error(problem);
        if (request.signal.aborted || document.hidden || nye) return;
        clearTimeout(timer);
        latest = data; serverLighting = data.controls.lighting; updateControls(); updateReadout();
        if (!animationClosed) await animate(data);
      } catch (error) {
        if (request.signal.aborted && !timedOut) return;
        latest = null; readout?.hide();
        const known = ['http-unavailable', 'invalid-payload', 'invalid-json', 'invalid-snapshot', 'snapshot-timestamps', 'snapshot-freshness', 'snapshot-solar', 'invalid-components'];
        const why = timedOut ? 'request-timeout' : known.includes(error.message) ? error.message : 'request-failed';
        if (home) reportReadout(why);
        if (!animationClosed) stopAnimation(why);
      } finally { clearTimeout(timer); if (dataRequest === request) dataRequest = null; if (pending === operation) pending = null; }
    });
    pending = operation;
    return pending;
  }
  const returnToPage = () => {
    if (!home || returnTimer || document.hidden || away || nye) return;
    returnTimer = setTimeout(() => { returnTimer = 0; updateReadout(); void fetchSnapshot(); }, 0);
  };
  const observer = new MutationObserver(() => {
    const active = !!document.getElementById('sb-nye-isolated-host');
    if (active === nye) return;
    nye = active;
    if (active) { stopAnimation('nye-active'); abortData(); clearIdle(); readout?.hide(); if (home) reportReadout('nye-active'); }
    else returnToPage();
  });
  observer.observe(document.body, { childList: true });
  const onMotion = () => { if (reduced.matches) stopAnimation('reduced-motion'); };
  if (reduced.addEventListener) reduced.addEventListener('change', onMotion); else reduced.addListener?.(onMotion);
  const onVisibility = () => {
    if (document.hidden) { away = true; stopAnimation('hidden'); abortData(); clearIdle(); readout?.hide(); if (home) reportReadout('hidden'); }
    else if (away) { away = false; returnToPage(); }
  };
  const onPageHide = () => { away = true; stopAnimation('pagehide'); abortData(); clearIdle(); readout?.hide(); if (home) reportReadout('hidden'); clearTimeout(returnTimer); returnTimer = 0; };
  const onPageShow = event => { if (event.persisted) { away = document.hidden; returnToPage(); } };
  document.addEventListener('visibilitychange', onVisibility); window.addEventListener('pagehide', onPageHide); window.addEventListener('pageshow', onPageShow);
  control?.addEventListener('click', () => {
    off = !off;
    try { localStorage.setItem(OFF_KEY, off ? '1' : '0'); } catch { off = true; storageWorks = false; }
    updateControls(); if (off) stopAnimation('preference-off');
  });
  lightControl?.addEventListener('click', () => {
    lightingOff = !lightingOff;
    try { localStorage.setItem(LIGHTING_KEY, lightingOff ? '1' : '0'); } catch { lightingOff = true; storageWorks = false; }
    updateControls(); if (lightingOff) stopAnimation('lighting-off');
  });
  window.addEventListener('storage', event => {
    if (![null, OFF_KEY, LIGHTING_KEY].includes(event.key)) return;
    try { preferences(); } catch { off = lightingOff = true; storageWorks = false; }
    updateControls(); if (off || lightingOff) stopAnimation(off ? 'preference-off' : 'lighting-off');
  });
  const initialBlock = reason(); if (initialBlock) stopAnimation(initialBlock);
  function defer() {
    if (!initial) return; initial = false;
    if (!home && animationClosed || document.hidden || nye) return;
    if (typeof window.requestIdleCallback === 'function' && typeof window.cancelIdleCallback === 'function') idle = window.requestIdleCallback(() => { idle = 0; void fetchSnapshot(); }, { timeout: 1500 });
    else fallbackIdle = setTimeout(() => { fallbackIdle = 0; void fetchSnapshot(); }, 250);
  }
  if (document.readyState === 'complete') defer(); else window.addEventListener('load', defer, { once: true });
}
if (typeof document !== 'undefined') installWeather();

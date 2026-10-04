/* Static component adapted from the approved weather-display.js. No fixture data. */
const drawings = {
  cloud: ['M5 18a4 4 0 0 1-.5-8A6 6 0 0 1 16 8a5 5 0 0 1 1 10H5'],
  rain: ['M5 14a3.5 3.5 0 0 1 0-7 5.5 5.5 0 0 1 10.4-1A4 4 0 0 1 17 14H5', 'm7 17-1 3m6-3-1 3m6-3-1 3'],
  snow: ['M5 13a3.5 3.5 0 0 1 0-7 5.5 5.5 0 0 1 10.4-1A4 4 0 0 1 17 13H5', 'M8 17v4m-2-3 4 2m-4 0 4-2m6-1v4m-2-3 4 2m-4 0 4-2'],
  sun: ['M12 7a5 5 0 1 0 .01 0M12 1v2m0 18v2M1 12h2m18 0h2M4.2 4.2l1.4 1.4m12.8 12.8 1.4 1.4m0-15.6-1.4 1.4M5.6 18.4l-1.4 1.4'],
  moon: ['M20 15A8.6 8.6 0 0 1 9 4a8.6 8.6 0 1 0 11 11Z'],
  fog: ['M5 9a3 3 0 0 1 .2-5 5 5 0 0 1 9.5 0A3.5 3.5 0 0 1 19 9M3 13h18M5 17h14M7 21h10'],
  neutral: ['M4 7h16M4 12h16M4 17h16']
};
export const temperatureText = value => typeof value === 'number' && Number.isFinite(value) && value >= -150 && value <= 150 ? Math.round(value) + '°F' : null;
export function createReadout(slot) {
  if (!slot) return null;
  const card = document.createElement('aside'); card.className = 'sb-home-weather'; card.hidden = true;
  card.setAttribute('aria-label', 'Fort Worth area weather');
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true'); icon.setAttribute('focusable', 'false');
  const copy = document.createElement('div'); copy.className = 'sb-home-weather__copy';
  const line = document.createElement('div'); line.className = 'sb-home-weather__line';
  const temperature = document.createElement('span'); temperature.className = 'sb-home-weather__temp';
  const separator = document.createElement('span'); separator.className = 'sb-home-weather__separator'; separator.textContent = '·'; separator.setAttribute('aria-hidden', 'true');
  const condition = document.createElement('span'); condition.className = 'sb-home-weather__conditions';
  const area = document.createElement('span'); area.className = 'sb-home-weather__area'; area.textContent = 'Fort Worth area';
  line.append(temperature, separator, condition); copy.append(line, area); card.append(icon, copy); slot.append(card);
  let available = false, frame = 0;
  const position = () => {
    frame = 0;
    card.hidden = !available || document.hidden || !!document.getElementById('sb-nye-isolated-host') || !!document.querySelector('.site-header details[open]');
    if (card.hidden || matchMedia('(max-width: 767px)').matches) return;
    const box = card.getBoundingClientRect();
    for (const node of document.querySelectorAll('a.btn, button, input, summary, #sb-nye-pass-recovery')) {
      const r = node.getBoundingClientRect();
      if (r.width && r.height && r.left < box.right + 6 && r.right > box.left - 6 && r.top < box.bottom + 6 && r.bottom > box.top - 6) { card.hidden = true; break; }
    }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(position); };
  window.addEventListener('scroll', schedule, { passive: true }); window.addEventListener('resize', schedule, { passive: true });
  document.querySelector('.site-header')?.addEventListener('toggle', schedule, true);
  return {
    update(data) {
      available = !!data?.conditionLabel;
      if (!available) { position(); return; }
      const text = temperatureText(data.temperatureF);
      temperature.textContent = text || ''; temperature.hidden = separator.hidden = text === null;
      condition.textContent = data.conditionLabel;
      const key = Object.hasOwn(drawings, data.icon) ? data.icon : 'neutral';
      icon.replaceChildren(...drawings[key].map(d => { const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', d); return path; }));
      card.title = 'NWS nearby-station observation. ' + data.observedAt;
      position();
    },
    hide() { available = false; card.hidden = true; if (frame) cancelAnimationFrame(frame); frame = 0; },
    position
  };
}

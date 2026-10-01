/* Local/private deterministic weather fixture and measured whole-page comparison.
 * Does not change production source, observations, promotion clocks, or website files.
 */
import { createServer } from 'node:https';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { brotliCompressSync, gzipSync } from 'node:zlib';
const require = createRequire(new URL('../../new-year/package.json', import.meta.url));
const { chromium } = require(process.env.SB_PLAYWRIGHT || 'playwright');
const root = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
const section = process.env.SB_QA_SECTION || 'all';
const out = resolve(process.env.SB_WEATHER_QA_OUTPUT || '/tmp/sour-boule-weather-qa');
await mkdir(out, { recursive: true });
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', out + '/localhost-key.pem', '-out', out + '/localhost-cert.pem', '-days', '1', '-nodes', '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1'], { stdio: 'ignore' });
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };
let base;
let fixtureEffect = 'cloud';
const server = createServer({ key: await readFile(out + '/localhost-key.pem'), cert: await readFile(out + '/localhost-cert.pem') }, async (req, res) => {
  try {
    const url = new URL(req.url, base);
    if (url.pathname.startsWith('/weather/')) {
      const now = Date.now();
      const clear = fixtureEffect === 'sun' || fixtureEffect === 'night';
      // Clear fixtures place sunrise/sunset around now; production keeps actual restaurant solar times.
      const sunrise = fixtureEffect === 'night' ? now + 2 * 3600000 : now - 6 * 3600000;
      const sunset = fixtureEffect === 'night' ? now + 14 * 3600000 : now + 6 * 3600000;
      const payload = { version: 1, provider: 'NWS', location: url.pathname.split('/')[2], station: 'KFTW', timezone: 'America/Chicago', condition: clear ? 'clear' : fixtureEffect, effect: fixtureEffect, observedAt: new Date(now - 60000).toISOString(), fetchedAt: new Date(now).toISOString(), validUntil: new Date(now + 3590000).toISOString(), sunrise: new Date(sunrise).toISOString(), sunset: new Date(sunset).toISOString() };
      res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=60', 'timing-allow-origin': '*', 'x-sb-test-fixture': 'local-only' }); res.end(JSON.stringify(payload)); return;
    }
    const path = resolve(root, '.' + (url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(root + sep) || !(await stat(path)).isFile()) throw Error('missing');
    let body = await readFile(path);
    if (extname(path) === '.html') body = Buffer.from(body.toString().replaceAll('https://sour-boule-weather.lance-c84.workers.dev', base));
    const tag = '"' + createHash('sha256').update(body).digest('hex') + '"';
    const headers = { 'content-type': mime[extname(path)] || 'application/octet-stream', 'cache-control': 'public, max-age=300', etag: tag, vary: 'Accept-Encoding' };
    if (req.headers['if-none-match'] === tag) { res.writeHead(304, headers); res.end(); return; }
    if (/\.(js|html|css|svg)$/.test(path)) {
      if (req.headers['accept-encoding']?.includes('br')) { body = brotliCompressSync(body); headers['content-encoding'] = 'br'; }
      else if (req.headers['accept-encoding']?.includes('gzip')) { body = gzipSync(body); headers['content-encoding'] = 'gzip'; }
    }
    headers['content-length'] = body.length;
    res.writeHead(200, headers); res.end(body);
  } catch { res.writeHead(404); res.end('Not found'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
base = 'https://127.0.0.1:' + server.address().port;
const browser = await chromium.launch({ headless: true, ...(process.env.SB_CHROME ? { executablePath: process.env.SB_CHROME } : {}) });
const environments = [
  { name: 'desktop', width: 1440, height: 900, cpu: 1, mobile: false },
  { name: 'mobile390', width: 390, height: 844, cpu: 4, mobile: true },
  { name: 'mobile320', width: 320, height: 568, cpu: 6, mobile: true }
];
const network = { label: 'slow 4G emulation', latencyMs: 150, downloadBitsPerSecond: 1600000, uploadBitsPerSecond: 750000 };
const sourceHashes = {};
for (const path of ['index.html', 'about.html', 'menu.html', 'willow-bend-menu.html', 'assets/js/weather.js', 'assets/js/weather-renderer.js', 'assets/css/style.css', 'assets/css/seasonal.css']) sourceHashes[path] = createHash('sha256').update(await readFile(resolve(root, path))).digest('hex');
const evidence = { sourceHashes, kind: 'LOCAL browser emulation, no physical iPhone', generatedAt: new Date().toISOString(), browser: browser.version(), network, environments, fixture: 'cloud; HTTP fixture replaces only weather endpoint in served HTML', excludedNetwork: ['GA analytics', 'live New Year API'], runs: [], organic: [], allEffects: [] };
if (section === 'organic') {
  const saved = JSON.parse(await readFile(out + '/full-page-metrics.json', 'utf8'));
  if (JSON.stringify(saved.sourceHashes) !== JSON.stringify(sourceHashes)) throw Error('Source changed since performance checks');
  Object.assign(evidence, saved); evidence.organic = [];
}
async function instrumentation(context, off) {
  await context.addInitScript(({ off }) => {
    localStorage.setItem('sb-weather-disabled-v1', off ? '1' : '0');
    window.__weatherQA = { paint: {}, lcp: 0, cls: 0, shifts: [], longTasks: [], longFrames: [], frameCosts: [], frameTimes: [], canvasStarted: 0, canvasRemoved: 0 };
    const q = window.__weatherQA;
    for (const type of ['paint', 'largest-contentful-paint', 'layout-shift', 'longtask', 'long-animation-frame']) {
      try {
        new PerformanceObserver(list => { for (const e of list.getEntries()) {
          if (type === 'paint') q.paint[e.name] = e.startTime;
          else if (type === 'largest-contentful-paint') q.lcp = e.startTime;
          else if (type === 'layout-shift') { q.shifts.push({ at: e.startTime, value: e.value, recentInput: e.hadRecentInput, nodes: e.sources?.map(s => s.node?.tagName + '.' + s.node?.className) }); if (!e.hadRecentInput) q.cls += e.value; }
          else if (type === 'longtask') q.longTasks.push({ at: e.startTime, duration: e.duration });
          else q.longFrames.push({ at: e.startTime, duration: e.duration, scripts: e.scripts?.map(s => ({ url: s.sourceURL, duration: s.duration, fn: s.sourceFunctionName })) });
        } }).observe({ type, buffered: true });
      } catch {}
    }
    const original = window.requestAnimationFrame.bind(window), known = new WeakMap();
    window.requestAnimationFrame = fn => {
      let weather = known.get(fn);
      if (weather === undefined) { weather = new Error().stack.includes('/weather-renderer.js'); known.set(fn, weather); }
      if (!weather) return original(fn);
      return original(time => { const before = performance.now(); fn(time); q.frameCosts.push(performance.now() - before); q.frameTimes.push(time); });
    };
    new MutationObserver(() => {
      const canvas = document.querySelector('canvas[data-sb-weather]');
      if (canvas && !q.canvasStarted) q.canvasStarted = performance.now();
      if (!canvas && q.canvasStarted && !q.canvasRemoved) q.canvasRemoved = performance.now();
    }).observe(document, { childList: true, subtree: true });
  }, { off });
}
async function openContext(environment, off = false, throttle = true) {
  const context = await browser.newContext({ viewport: { width: environment.width, height: environment.height }, deviceScaleFactor: environment.mobile ? 2 : 1, isMobile: environment.mobile, hasTouch: environment.mobile, ignoreHTTPSErrors: true, reducedMotion: 'no-preference' });
  await instrumentation(context, off);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setBlockedURLs', { urls: ['*googletagmanager.com/*', '*google-analytics.com/*', '*celebrate.thesourboule.com/*'] });
  if (throttle) {
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: environment.cpu });
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: network.latencyMs, downloadThroughput: network.downloadBitsPerSecond / 8, uploadThroughput: network.uploadBitsPerSecond / 8, connectionType: 'cellular4g' });
  }
  return { context, page, cdp };
}
async function readMetrics(page) {
  return page.evaluate(() => {
    const q = window.__weatherQA, nav = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource').map(r => ({ name: r.name, duration: r.duration, transferSize: r.transferSize, encodedBodySize: r.encodedBodySize, decodedBodySize: r.decodedBodySize, initiator: r.initiatorType }));
    const weather = resources.filter(r => /\/weather(?:\.js|-renderer\.js|\/)/.test(r.name));
    const longWeather = q.longFrames.flatMap(frame => frame.scripts.filter(s => /\/weather(?:\.js|-renderer\.js)/.test(s.url)).map(script => ({ frameAt: frame.at, ...script })));
    return { ...q, loadMs: nav.loadEventEnd, domContentLoadedMs: nav.domContentLoadedEventEnd, navigationBytes: nav.transferSize, resourceCount: resources.length, networkResourceCount: resources.filter(r => r.transferSize > 0).length, resources, weather, weatherLongFrameScripts: longWeather, canvasRemaining: document.querySelectorAll('canvas[data-sb-weather]').length, overflow: document.documentElement.scrollWidth > innerWidth, pageHeight: document.documentElement.scrollHeight };
  });
}
try {
  if (section !== 'organic') for (const environment of environments) for (let repeat = 1; repeat <= 3; repeat++) for (const off of [true, false]) {
    const t = await openContext(environment, off);
    for (const cache of ['cold', 'warm']) {
      const responses = [];
      const onResponse = r => { if (/\/weather(?:\.js|-renderer\.js|\/)/.test(r.url())) responses.push({ url: r.url(), status: r.status(), headers: r.headers() }); };
      t.page.on('response', onResponse);
      const navigation = await t.page.goto(base + '/', { waitUntil: 'load', timeout: 60000 });
      if (!navigation.ok()) throw Error('Fixture page status ' + navigation.status());
      let played = false;
      if (!off && cache === 'cold') { try { await t.page.waitForSelector('canvas[data-sb-weather]', { state: 'attached', timeout: 6000 }); played = true; } catch {} }
      else await t.page.waitForTimeout(500);
      const beforeTap = await t.page.evaluate(() => performance.now());
      const order = t.page.locator('.site-header__order summary');
      if (environment.mobile) await order.tap(); else await order.click();
      const tapMs = await t.page.evaluate(start => performance.now() - start, beforeTap);
      const orderOpen = await t.page.locator('.site-header__order').evaluate(node => node.open);
      const options = await t.page.locator('#header-order-options a').count();
      if (environment.mobile) await order.tap(); else await order.click();
      await t.page.evaluate(() => scrollTo(0, 500));
      await t.page.waitForTimeout(150);
      const scrolled = await t.page.evaluate(() => scrollY > 0);
      await t.page.evaluate(() => scrollTo(0, 0));
      await t.page.waitForTimeout(played ? 4300 : 500);
      const metrics = await readMetrics(t.page);
      if (played && metrics.canvasRemaining) throw Error('Canvas did not clean up');
      if (!orderOpen || options !== 2 || !scrolled || metrics.overflow) throw Error('Interaction or layout failed: ' + JSON.stringify({ environment, orderOpen, options, scrolled, overflow: metrics.overflow }));
      if (repeat === 1 && cache === 'cold') await t.page.screenshot({ path: out + '/' + environment.name + '-' + (off ? 'off' : 'on') + '-after.png', fullPage: true });
      const record = { environment: environment.name, repeat, weatherMode: off ? 'off' : 'on', cache, played, interaction: { tapMs, orderOpen, orderLinkCount: options, scrolled }, responses, ...metrics };
      evidence.runs.push(record);
      await writeFile(out + '/full-page-metrics.json', JSON.stringify(evidence, null, 2));
      console.log(JSON.stringify({ environment: environment.name, repeat, weather: record.weatherMode, cache, played, fcp: metrics.paint['first-contentful-paint'], lcp: metrics.lcp, cls: metrics.cls, load: metrics.loadMs, weatherRequests: metrics.weather.length, frameCount: metrics.frameCosts.length, frameMax: Math.max(0, ...metrics.frameCosts), weatherLongScripts: metrics.weatherLongFrameScripts.length, tapMs }));
      t.page.off('response', onResponse);
    }
    await t.context.close();
  }
  // Focused responsive copy verification, with weather saved off; no menu/order data edits.
  for (const environment of environments) {
    const t = await openContext(environment, true, false);
    for (const path of ['/', '/about.html', '/menu.html', '/willow-bend-menu.html']) {
      await t.page.goto(base + path, { waitUntil: 'load', timeout: 60000 });
      const sentence = t.page.getByText('Fresh sourdough, made with organic flours.', { exact: false });
      const count = await sentence.count();
      if (count !== 1) throw Error('Organic wording not unique on ' + path + ': ' + count);
      await sentence.scrollIntoViewIfNeeded();
      await sentence.evaluate(node => {
        const header = document.querySelector('.site-header')?.getBoundingClientRect().bottom || 0;
        const categories = document.querySelector('.section-nav')?.getBoundingClientRect().bottom || 0;
        scrollBy(0, node.getBoundingClientRect().top - Math.max(header, categories) - 12);
      });
      const visible = await sentence.isVisible();
      const box = await sentence.boundingBox();
      const overflow = await t.page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (!visible || overflow) throw Error('Copy layout failure: ' + path);
      await t.page.screenshot({ path: out + '/' + environment.name + '-' + (path === '/' ? 'index' : path.slice(1, -5)) + '-organic.png' });
      evidence.organic.push({ environment: environment.name, path, count, visible, overflow, box });
    }
    await t.context.close();
  }
  // Real bootstrap + real renderer, six effects; the visual agent separately measures pixel parity.
  if (section !== 'organic') for (const effect of ['rain', 'snow', 'wind', 'cloud', 'sun', 'night']) {
    fixtureEffect = effect;
    const t = await openContext(environments[1], false, false);
    await t.page.goto(base + '/', { waitUntil: 'load', timeout: 60000 });
    await t.page.waitForSelector('canvas[data-sb-weather]', { state: 'attached', timeout: 6000 });
    await t.page.waitForTimeout(1300);
    await t.page.screenshot({ path: out + '/mobile390-' + effect + '-active.png' });
    await t.page.waitForTimeout(3000);
    const metrics = await readMetrics(t.page);
    if (metrics.canvasRemaining || !metrics.canvasStarted || !metrics.frameCosts.length) throw Error('Full-page effect failed: ' + effect);
    evidence.allEffects.push({ effect, canvasStarted: metrics.canvasStarted, canvasRemoved: metrics.canvasRemoved, frameCount: metrics.frameCosts.length, maxFrameMs: Math.max(...metrics.frameCosts), remaining: metrics.canvasRemaining });
    await t.context.close();
  }
  evidence.completedAt = new Date().toISOString();
  await writeFile(out + '/full-page-metrics.json', JSON.stringify(evidence, null, 2));
  console.log('Full-page evidence: ' + out + '/full-page-metrics.json');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }

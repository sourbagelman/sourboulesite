# Weather checks — October 1, 2026

## Local implementation evidence

These are local browser/fixture results, not proof of the live provider or production deployment.

- Backend mapping/cache/security: **20/20 focused tests passed**, including the final exact wind-threshold correction. Renderer lifecycle/resource tests: **15/15 passed**. The Cloudflare workerd live-provider check also passed after correcting its redirect-mode incompatibility.
- Visual source comparison: **36 matched comparisons passed** (six effects, 390/1440 px, 0.3/1.5/3.5 seconds). The original package hashes and cloud/night video playback were checked; no preview asset is shipped.
- Client lifecycle/schema: **40/40 tests passed** (27.94 seconds). A subsequent focused accessible-toggle check passed after the final `aria-pressed` correction.
- Whole-page comparison: **36 runs passed**: three repeats × three environments × saved weather on/off × cold/warm. Cold on loads play the real renderer using a local cloud observation fixture. Warm navigation preserves the real session marker and does not replay.
- Organic wording: **12/12 page/viewport checks passed** across `/`, `/about.html`, `/menu.html`, and `/willow-bend-menu.html`. Exactly one visible sentence per page, no horizontal overflow. Screenshots were inspected; menu paragraphs were scrolled below their existing sticky headers for inspection.
- Six full-page effects: rain, snow, wind, cloud, sun and night each rendered and cleaned up, with the current seasonal decoration still present. Canvas removal occurred 4,000–4,005 ms after insertion; no canvas remained. These runs used 390×844, no CPU/network throttle. Their visual-source parity is a separate renderer test, not inferred from this performance check.
- All 36 Order Online disclosure interactions and scroll checks passed. Both location ordering links remained in the disclosure. Automated tap elapsed time was 19.7–76.0 ms (automation round-trip measurement, **not INP**).

Environment: headless Chromium **151.0.7922.34** on the available Mac. Desktop: 1440×900, DPR 1, CPU 1×. Mobile emulation: 390×844/DPR 2/CPU 4× and 320×568/DPR 2/CPU 6×. All comparison runs used CDP slow-4G settings: 150 ms latency, 1.6 Mbps download, 750 Kbps upload. The local HTTPS server served actual current HTML/assets; only the weather endpoint was rewritten in test responses. Analytics and live promotion API requests were blocked in the harness. Google Fonts remained available in both variants. No production override, test observation, or promotion pass was introduced.

## Measured comparison

Medians of three runs, milliseconds; cells show **off → on**. Both modes retain the tiny bootstrap. “Warm on” is the normal consumed tab session, so only its cached bootstrap is loaded.

| Environment | Cache | FCP | LCP | Load |
|---|---|---:|---:|---:|
| Desktop, CPU 1× | Cold | 616 → 588 | 4,948 → 4,936 | 4,978.8 → 4,965.6 |
| Desktop, CPU 1× | Warm | 196 → 192 | 220 → 224 | 182.6 → 185.2 |
| 390 px, CPU 4× | Cold | 572 → 612 | 572 → 612 | 3,777.9 → 3,815.2 |
| 390 px, CPU 4× | Warm | 244 → 208 | 244 → 240 | 217.3 → 221.3 |
| 320 px, CPU 6× | Cold | 604 → 584 | 604 → 584 | 3,865.2 → 3,866.2 |
| 320 px, CPU 6× | Warm | 256 → 280 | 256 → 280 | 245.8 → 251.2 |

Cold CLS was identical on/off in every repeat: desktop **0.064526**, 390 px **0.032061**, 320 px **0.048899**. These existing initial-layout shifts occurred before weather playback. Warm mobile CLS was zero. Warm desktop CLS was normally 0.021183; one on run recorded 0.054789 at initial layout (~185 ms), despite no weather fetch/renderer/playback on that consumed-session visit. Exact shift nodes/timestamps are retained rather than averaging away the outlier. **There were zero layout shifts during every active weather run.** The timing results show run variability; they do not establish zero-byte/zero-time overhead or physical-phone performance.

Real renderer callback maximum during the repeated cloud runs: **0.3 ms desktop, 0.9 ms at CPU 4×, 1.2 ms at CPU 6×**. No weather-attributable long-animation-frame script or sustained drawing interruption was observed. The instrumentation records JavaScript callback work, not a standalone GPU benchmark. All nine cold cloud runs completed; all nine warm same-tab on visits skipped JSON and renderer.

## Bytes and requests

| Asset | Source bytes | gzip estimate | Brotli estimate / local HTTP body |
|---|---:|---:|---:|
| `assets/js/weather.js` | 5,773 | 2,616 | 2,304 |
| `assets/js/weather-renderer.js` | 9,380 | 3,770 | 3,363 |
| Combined JS | **15,153** | **6,386** | **5,667** |

These estimates exclude small page include/toggle markup. The fixture HTTPS responses actually used `Content-Encoding: br` for both JS files. Its uncompressed JSON was 329 bytes; three cold weather requests totaled **5,996 encoded body bytes** and **6,896 browser Resource Timing transfer bytes**. Resource Timing includes its reported response overhead; it is not packet/TLS accounting. Saved-off loaded only the 2,304-byte compressed bootstrap. Warm runs loaded one cached bootstrap with **zero Resource Timing network transfer bytes** and made no weather JSON/renderer request. Production encodings and payload sizes must be measured separately below.

## Evidence and reproduction

Complete local evidence, screenshot set, response headers, per-run timings, shift sources, RAF timings and source hashes:

`/Users/lancemisner/Documents/Codex/2026-09-25/work-only-on-the-current-main/work/weather-2026-10-01/qa/full-page/full-page-metrics.json`

The incomplete exploratory replay experiment is separately labeled and is **not** the source of the final table.

From the repository root, using the existing New Year development toolchain:

```sh
npm ci --prefix _features/new-year
node _features/weather/build-client.mjs
node --test _features/weather/tests/client.test.mjs
SB_WEATHER_QA_OUTPUT=/tmp/sour-boule-weather-qa node _features/weather/tests/full-page-check.mjs
```

If dependencies/browser binaries are already installed in another local checkout, set `SB_ESBUILD` and `SB_PLAYWRIGHT` to their absolute module paths, and `SB_CHROME` to the existing Chromium executable. That was the configuration used for these checks; no runtime dependency is added to the website. OpenSSL creates a temporary localhost certificate only in the output directory. `SB_QA_SECTION=organic` reruns only the copy/screenshot checks and requires matching source hashes, retaining the completed performance evidence.

Safari/WebKit is **not verified**: no WebKit browser was installed. The cancellable Safari-style idle fallback was tested in Chromium. Physical iPhone, mobile Safari GPU/thermal behavior, VoiceOver and real cellular performance remain **unperformed**, not passed.

## Production evidence

Before the website push, the final weather Worker version
`36d1a9f8-6b52-47d8-b7c8-08aa6974a4c4` was deployed and initialized with an
actual NWS report. Twenty production requests passed: KFTW observation 15:31Z,
manual fetch 15:54:17.589Z, expiry 16:54:17.589Z. Separate Fort Worth/Willow Bend
responses were 352/353 decoded bytes and **210/212 actual Brotli body bytes**.
Their stable timestamps, CORS, 300-second maximum HTTP cache and absolute expiry
were checked. Runtime samples returned successfully at 0–3 ms CPU; this limited
sample is not a latency guarantee. That initial deployment mapped mixed rain/fog to `none`; this historical result
predates the later narrow correction in BACKEND.md.

Cloudflare read-back confirms the hourly `47 * * * *` registration. No successful
unattended hourly tick had occurred at this checkpoint; the initialization is
explicitly **manual**. See BACKEND.md for actual-provider provenance and the
resolved runtime defect. This is separate from the local fixtures above.

The final owner delivery records GitHub Pages' resulting main revision, live
page hashes and browser/network measurements taken after publication. Those
post-publication results must not be inferred from this pre-publication test
record. No physical-device or unavailable WebKit check is marked passed.

## Narrow mixed-weather correction — October 1, 2026

Starting main: `60147b192ac73db6c159405285fc9af0e920ee2a`.

- **78/78** focused existing suites passed after the correction: 23 backend,
  40 client lifecycle/schema, 15 renderer/resource tests. The initial sandbox
  attempt could not launch Chromium; the browser-enabled rerun completed with
  no failed or skipped tests.
- **6/6** added mixed-weather browser integration tests passed at 1440×900 and
  390×844. Structured rain+fog_mist, drizzle+fog, and exact text-only fallback
  pass through the actual provider/observation/public-response functions to the
  unchanged shipped bootstrap and renderer. Painted rain, usable controls,
  four-second cleanup and no replay or optional requests on reload were checked.
  These are explicitly local fixtures, not live production observations.
- Unsupported-list permutations, fog alone, rain with cloud cover, exact text
  allowlisting and structured authority passed. Existing bad-data, identity,
  timestamp, freshness, lease, CORS, auth, reduced-motion, slow-connection and
  New Year priority checks remain passing. The no-cherry-picking fixture now
  uses a genuinely unsupported rain/thunderstorm report.
- A real NWS fetch in local workerd at **16:36:56.475Z** normalized the actual
  KFTW **16:10Z** rain+fog_mist report to rain. This is live-provider/local-runtime
  evidence, not a production refresh.
- The deployed correction is Worker revision
  `093777c2-16f6-4e29-a7df-a75c45ccb194`. The one authenticated production
  maintenance attempt at **16:37:16.747Z** returned
  `already-attempted-this-hour`. The next eligible slot is **16:47Z / 11:47 AM
  America/Chicago**. Storage, timestamps and the hourly schedule were not reset.

Reproduce the additional local integration coverage with the existing browser
setup described above:

```sh
node --test _features/weather/tests/mixed-weather-playback.test.mjs
```

### Genuine scheduled refresh and production playback

Cloudflare's live tail recorded an actual `47 * * * *` invocation with outcome
`ok` and `weather-hourly-refresh`, `refreshed: true`, `source: scheduled` at
**2026-10-01T16:47:27.017Z** (11:47:27 AM Chicago). This was the existing hourly
job, not a simulated trigger or second manual attempt. No lease, storage
identity, timestamp, schedule, authentication or kill-switch change was made.

Both production endpoints returned HTTP 200 and `condition/effect: rain`, with
`observedAt: 2026-10-01T16:30:00.000Z`,
`fetchedAt: 2026-10-01T16:47:27.017Z`, and
`validUntil: 2026-10-01T17:47:27.017Z`. The exact NWS observation matched:
“Rain and Fog/Mist”, structured `rain`/`RA` plus `fog_mist`/`BR`. The initial
16:47:15Z read preceded the job; the 16:48:15Z read verified its results. Existing
five-minute HTTP caching was honored, with no condition-override query or cache
mutation. CORS and freshness headers remained unchanged.

Fresh production Chromium contexts then showed actual rain at Fort Worth
(1440×900) and Willow Bend (390×844, DPR 2 mobile emulation). No observation or
clock fixture was used. Painted canvases were observed and removed after
**4,002/4,004 ms**; ordering controls worked, no JavaScript errors occurred, and
same-context reloads made no additional weather/renderer request or replay.
Physical-iPhone and Safari results are still not claimed.

Detailed readbacks, redacted Cloudflare cron log, screenshots and browser
measurements are retained outside the public site in the task workspace's
`work/weather-mixed-2026-10-01/` evidence directory.

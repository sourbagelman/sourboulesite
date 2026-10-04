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

## Weather Update 2 — October 2, 2026

Actual starting main: `d96ad6e045a87ec0b07bdb46ffdb789c0cd6aa19`.
The supplied nested manifest passed all 26 SHA-256/length checks. The approved
HTML, desktop/mobile videos and frame sheet were inspected. The drawing module
is copied byte-for-byte (SHA-256
`202137a12cbf3bc9a9482f268ca38c227403e8bd923f282be0c1b81f60449c76`).
No review backdrop, video, poster, comparison module or forcing hook is public.

### Incident evidence captured before any deployment or refresh

Both legacy endpoints returned fresh HTTP 200 rain, observed
`2026-10-02T14:25:00.000Z`, fetched `14:47:26.733Z`, expiring `15:47:26.733Z`,
with `refreshSource: scheduled`, exact site CORS and a 300-second maximum cache.
The provider's actual report said `Light Rain`. Live HTML on all three eligible
pages and both old browser assets exactly matched starting main; deployed Worker
revision was `093777c2-16f6-4e29-a7df-a75c45ccb194`.

Fresh production Chromium contexts at 15:12Z (Fort Worth desktop and Willow
Bend 390px mobile emulation) used no weather or clock fixtures. Initial session
and off-preference values were absent, motion/connection/visibility gates passed,
the real endpoint returned valid JSON, and the real renderer painted rain.
There were exactly three weather resources, no failed weather requests or JS
errors, and cleanup occurred after 4,005/4,002 ms. The stop reason on these
observed visits was ordinary completion, not a reproduced interruption.

The morning KFTW API records at 12:53/13:53Z said `Cloudy` with valid overcast
layers; the former exact-description table returned `none`. This reproduces a
mapping defect and the narrow verified alias repair. The 02:53Z Clear/CLR record
already maps to clear night. The additional supplied mapping reference was
checked against the actual 23-value API enum and observation payloads; METAR
abbreviations and displayed history labels were not copied as guessed API values.
KPHP's exact `Cloudy and Windy` alias was also verified; numeric wind, not that
adjective, determines whether the existing 20 mph threshold is met.

Historical overnight/morning refresh logs were not retained. These comparison
records do not establish what the Worker fetched or the owner's browser saw.
The larger intermittent incident remains **historically unconfirmed**. No claim
is made that adding artwork resolves it. Existing refresh failure clearing,
hourly lease, age limits and once-per-tab eligibility remain unchanged. New
bounded local browser reasons and protected server history support future
diagnosis without analytics, visitor identifiers, secrets or additional requests.

### Focused local verification

- **44 backend tests**, **64 client tests**, **26 renderer tests**, and **20
  provider-to-built-renderer integration tests** passed: **154 total**, no skipped
  tests. Existing weather suites are retained, including v1 mixed-rain coverage.
- All 23 weather enums, seven modifiers and seven sky categories have deliberate
  support/rejection coverage. Known unsupported, unknown, malformed/incomplete,
  stale, future, provider failure and browser skip reasons are distinct. Complete
  structured lists are authoritative and order-independent; incomplete fields
  cannot be rescued by appealing text. No substring or forecast matching is used.
- Sunset, Chicago midnight, sunrise, DST and hourly absolute expiry are tested
  using newly projected and unchanged cached-response payloads. Cloud/rain remain
  eligible after dark. A prepublication v2 calendar-validation regression was
  found and corrected: only solar-dependent fog/clear responses are bounded at
  local midnight. That new-code regression does not explain historical v1 visits.
- **108 exact PNG comparisons** passed: all six original effects versus starting
  main and all six additions versus supplied source, at 320/390/1440px and
  0.3/1.5/3.5 seconds with matching DPR and deterministic particles.
- **108 renderer setup/draw benchmarks** passed (12 scenes, three profiles,
  three repeats), with all resources released. CPU profiles were 1440×900/DPR1
  at 1×, 390×844/DPR2 at 4× and 320×568/DPR2 at 6×.
- **99 whole-page runs** passed: 54 repeated new/legacy/off cold and consumed
  comparisons, 18 new-scene runs, and 27 cold/fresh-tab/consumed runs. All used
  150 ms latency, 1.6 Mbps download and 750 Kbps upload. The actual homepage,
  ordering disclosure, scroll behavior and seasonal artwork were retained.
  These are local fixtures; no backend promotion clock or live pass was changed.

| CPU profile | Maximum renderer setup | Worst p95 draw (renderer benchmark) | Worst single callback (benchmark) |
| --- | ---: | ---: | ---: |
| 1× desktop | 2.7 ms | 0.2 ms | 2.7 ms |
| 4× mobile | 9.6 ms | 0.7 ms | 11.0 ms |
| 6× mobile | 16.1 ms | 1.1 ms | 8.7 ms |

Whole-page p95 drawing stayed below 0.7 ms across profiles. New-scene/fresh-tab
frame-interval p95 was 8.8/9.2/9.2 ms, with worst intervals 25/58.4/16.2 ms on
the available high-refresh-rate Mac. The thresholds remain unchanged and isolated
slow frames recovered. No weather-added layout shifts or weather-attributable
task of at least 50 ms was observed, including module evaluation and preparation.
Two long animation frames included only 5.3/5.6 ms of weather bootstrap work;
they are not mislabeled as weather tasks exceeding 50 ms.

Cold comparison load medians (off / legacy / new) were 4,919.9 / 4,943.8 /
5,010.6 ms desktop, 3,784.8 / 3,830.2 / 3,801.4 ms at 4×, and 3,859.2 /
3,859.5 / 3,860.4 ms at 6×. A later independent cold check gave legacy→new
4,912.7→4,921.4, 3,763.5→3,794.0 and 3,883.1→3,882.4 ms. The initial desktop
difference did not repeat at that magnitude. Automated ordering interaction
remained comparable (this is automation elapsed time, **not INP**). These
measurements demonstrate no consistent loading/interaction regression; they do
not claim zero overhead or physical-phone performance.

Final gzip JavaScript: **3,285-byte bootstrap + 5,964-byte renderer = 9,249
bytes**, below 10,240. Baseline was 6,386; delta **+2,863 bytes**. Cold eligible
visits still load one bootstrap, one JSON and one renderer. Consumed sessions
make no JSON or renderer request. Small diagnostic-only reason refinements were
built during verification; final client/integration tests and later cache checks
use the final hash. The rendering code and measured valid playback path remained
unchanged by those reason refinements.

Chromium 151.0.7922.34 was used. WebKit's executable was not installed; WebKit,
physical Safari/iPhone, VoiceOver, cellular and thermal/GPU behavior are
**unverified**, not passed. Reproduction and complete timing/capture evidence
are under `work/weather-update-2/` in the task workspace, outside the public
repository. `expansion-page-check.mjs` accepts `SB_QA_SECTION=warm` for separate
fresh-tab cache behavior and `SB_QA_SECTION=cache` for explicitly primed HTTP
cache checks; all forcing is confined to the local harness.


Six additional **actual HTTP-cache visits** passed across all three profiles,
bringing whole-page visits to **105**. Unconsumed sessions played with three
confirmed disk-cache hits (bootstrap, JSON, renderer), zero transfer bytes and
CDP `fromDiskCache: true`. Consumed reloads made no JSON/renderer request and
did not replay. The initial ignored self-signed local TLS certificate prevented
Chromium caching; the cache-only harness now pins its ephemeral public key within
that isolated browser process. No production or system trust was changed, and
the original cache assertions were retained and strengthened. These are distinct
from the earlier fresh-tab runs, which did not prove HTTP-cache hits.

### Backend deployment and genuine scheduled refresh

Backend source commit: `4a4ef0108617078b80106b2b4ff18644fd575e44`.
Worker revision: `7681e71c-8553-46ad-b066-a2c2a7cc5006`.
Existing Worker, Durable Object identity, hourly `47 * * * *` cron, lease,
origins, secrets and free-plan resources are retained. Upload was 28.62 KiB
(8.10 KiB gzip), startup 1 ms. No manual initialization or refresh was called.

After backend deployment, both legacy endpoints still served their prior rain
snapshot; v2 correctly returned 503 for that pre-expansion cache. Only after the
real unattended **2026-10-02T15:47:26.725Z** cron refresh did both v2 endpoints
return fresh 200 responses. Live tail captured the scheduled event, success and
235 ms wall time without exceptions; protected bounded history independently
records one KFTW fetch for the two locations. This is actual cron evidence, not
a simulated trigger or manual request.

Readback at 15:50Z: both versions at both locations returned `cloud`, observed
`2026-10-02T15:20:00.000Z`, fetched `15:47:26.725Z`, valid through
`16:47:26.725Z`, source `scheduled`. V2 includes `mist:false, night:false`.
Decoded v2 JSON is 384/385 bytes (226 bytes served Brotli each); legacy JSON is
357/358 bytes (209/211 Brotli). All returned the exact site CORS origin and
`public, max-age=300, must-revalidate`. Authenticated status returned 200;
an unauthenticated request returned 404. Fresh v2 was verified before switching
any public HTML include. Evidence is `scheduled-v2-readback.json` and the
redacted live tail in the task's weather evidence directory.


### Website publication and real-weather playback

Frontend source commit: `020d23aa50f99b52362f6c6467d551075296a248`.
The existing main/GitHub Pages build completed at `2026-10-02T15:53:25Z`.
At 15:55Z, all three live pages and all four new/retained weather assets returned
200 and matched repository SHA-256 hashes exactly. Public HTML changed only its
single weather include/endpoint on Home, Fort Worth and Willow Bend. Organic
copy, menus, prices, hours, ordering links, SEO, seasonal/New Year assets and
release controls are unchanged from the actual starting main.

Actual production gzip is **3,285 + 5,969 = 9,254 bytes**, below 10,240.
The retained production legacy files total 6,393 gzip bytes, so the served delta
is **+2,861 bytes**. Local compressor output differs by a few bytes (9,249 versus
6,386); the live transfer figures above are not inferred from local compression.
Pages reports a 600-second cache; the weather API retains its 300-second cache.
Both old assets remain available to previously cached HTML.

The exact KFTW report used by cron, `2026-10-02T15:20:00+00:00`, was retrieved
from NWS history: description `Cloudy`, empty present-weather list and valid
SCT/BKN/OVC layers. Both committed classifiers select cloud. This independently
checks the actual observation timestamp recorded in the shared production cache;
it does not reconstruct an older unrecorded refresh.

Three fresh production Chromium contexts used real pages, assets, observations
and clock, with no weather/date fixture: Fort Worth 1440×900/DPR1, Willow Bend
390×844/DPR2 and Home 320×568/DPR2. All painted actual cloud effects, made exactly
three weather requests, kept both header ordering actions usable, had no
horizontal overflow, JS errors or failed weather requests, and removed the
canvas after **4,001.9 / 4,001.4 / 4,001.7 ms** respectively. The local diagnostic
record finished with `reason: complete`. Each reload reported `played-session`,
with zero JSON/renderer requests and zero canvas. The mobile screenshot also
retained readable content and existing autumn artwork beneath the decoration.
These are live automated Chromium checks, not physical iPhone/Safari results.

The six new scenes were proven by controlled provider-to-renderer fixtures and
exact artwork comparisons, **not** by claiming the real weather currently
contains all six conditions. Real production playback on this check was cloud;
real pre-change playback was rain. No weather was forced, no old observation was
retimestamped, and no manual refresh/storage reset/lease bypass was used.

Local evidence: `live-assets.json`, `live-browser.json`, `live-*.png`,
`cron-observation.json`, `scheduled-v2-readback.json`, and `worker-tail.log` under
the task's weather evidence directory. The final documentation-only receipt
commit does not change the verified frontend or Worker artifact. No demonstrated
ongoing deployment defect remains; historical incidents and the unperformed
device checks remain explicitly unverified.

## Final 64-scene suite and Home readout — October 4, 2026

Starting live main: `e0c1b4bfba5f62c88630348a5f8d5d36ac48af72`.
Starting Worker: `7681e71c-8553-46ad-b066-a2c2a7cc5006`.
The controlling final instruction supersedes historical review-only package labels.
All **184 manifest files** passed SHA-256 and length verification. The approved
renderer is retained byte-for-byte, SHA-256
`7008f4f85bef13e088d22cce3983988d0cc261e81b0c8e0684b5123e47878744`.
No review HTML/video/fixture/sample-temperature interface is published.

### Focused local checks actually performed

- **119 backend + 26 retained renderer checks passed** (145/145, actual test exit
  0), including all 64 production-adapter component mappings. A final regression
  exposed a sky-label fallback when an oversized freezing-weather description
  had been omitted; the fixed adapter now preserves the omission rather than
  claiming clear weather. Known unsupported conditions retain accurate text;
  unknown structured qualifiers cannot become shortened misleading descriptions.
- **29/29 new renderer lifecycle/resource checks passed**. All four retained
  v1/v2 assets and their drawing sources remain unchanged.
- **59/59 v3 client/readout/lifecycle checks + 64/64 actual provider → v3 → built
  renderer scene cases passed**. The latter use an accelerated private RAF clock
  for functional checks, not for performance claims. They verify actual selected
  textures, painted scenes, cleanup and persistent text.
- **84/84 retained client/integration checks passed**, including 20 actual
  four-second v1/v2 fixture playbacks on desktop/mobile. They confirm cached old
  pages continue to work; their old duration is not the new v3 duration.
- A final malformed fallback-array rejection adds no valid-path behavior change;
  **4/4 focused pure contract/readout checks passed** against the final build.
- **960/960 exact PNG comparisons passed**: all 64 supplied compositions ×
  320/390/1440 pixels × 0.3/1.9/3.5/4.25/4.8 seconds. All **192** compositions
  clear at 5.0 seconds. Retained rain/rain-mist/fog/storm fallback rendering also
  remains visibly present at 4.25/4.8 seconds and clears at five seconds.
- **576 renderer setup/drawing benchmarks passed**, with **192 selected-texture
  decode measurements**. Maximum p95 draw was **0.2 / 0.9 / 1.4 ms** at
  1×/4×/6× CPU; max setup **2.2 / 2.1 / 3.4 ms**. Worst individual callback was
  **24.7 ms**, with no callback/setup ≥50 ms. Maximum individual asynchronous
  decode measurement: **3.8 / 12.2 / 12.8 ms**. Asynchronous decode wall time is
  not represented as a blocking JavaScript task.
- Eight current-page layout cases passed at **320/390/768/1440** with ordinary
  and long labels, navigation open/close and **200% CSS zoom**. The mobile slot
  reserves space before loading and can grow for zoomed long text. At the
  tablet breakpoint, a genuine ordering-button collision hides the card; normal
  scrolling restores it when the space clears. No horizontal overflow occurred.
- Real Chromium history restoration emitted **native `pageshow.persisted`** and
  restored the same document identity, readout and session without replay or
  an extra weather request. This is more than dispatching a simulated event.
- Tests cover same-observation C/F units, QC, valid zero, null replacement,
  unsupported artwork with neutral text, invalid/stale data, sunrise/sunset/
  Chicago midnight, failed resources, saved off, reduced motion, connection and
  storage gates, readout expiry/return, and immediate New Year priority.

Environment: Chromium **151.0.7922.34**, Mac, local HTTPS fixture server. Only
wall-clock Date is moved to the observation fixture; native Performance Timing,
RAF and timers remain real during page measurements. Static assets/HTML are the
actual current candidate with only the fixed Worker origin redirected privately.
No production demo switch, provider override or live promotion pass is used.

### Rendered light assessment

All eight thunder scenes × three widths were sampled at **60 fps, 301 samples
per composition**, using actual approved pixels with lighting on/off. Absolute
linear-sRGB luminance contribution was assessed over the current Home screenshots
and black/cream/white backgrounds; saturated-red and current-page backgrounds
were separately assessed using CIE1976 chromaticity distance. Maximum opposing
0.1-luminance transitions in any second: **4 (two flash pairs)**, with zero area
above three pairs. Maximum qualifying red chromaticity difference: **0.0960**,
below **0.2**, with no qualifying red transitions. Light contribution appears
only at **1.5667–2.6667 seconds**, with no fifth-second pulse.

The tested outputs meet the assessed [WCAG 2.3.1 frequency/red criteria](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html).
This bounded engineering assessment is not a whole-site, clinical or
physical-device safety certification. The approved lighting is enabled; the
independent saved lighting-off, weather-off and reduced-motion controls remain.

### Repeated actual-page comparison

**54 visits passed**: three repeats × three CPU/viewport profiles ×
weather-disabled/current-v2/new-v3 × cold/consumed-session. Network was
150 ms latency / 1.6 Mbps download / 0.75 Mbps upload. Profiles were desktop
1440×900/DPR1/CPU1×, 390×844/DPR2/CPU4× and 320×568/DPR2/CPU6×.
All ordering-disclosure/tap and scroll checks passed. Measured automated click/
tap round trips were **18.4–78.5 ms**, not a claim of measured field INP.

Medians of three cold runs, ms; columns are disabled / previous v2 / new v3:

| Profile | FCP | LCP | Load |
|---|---|---|---|
| Desktop 1× | 536 / 504 / 500 | 4872 / 4852 / 4840 | 4913 / 4890 / 4905 |
| 390px 4× | 536 / 532 / 560 | 536 / 532 / 560 | 3822 / 3748 / 3830 |
| 320px 6× | 612 / 584 / 576 | 612 / 584 / 576 | 3853 / 3829 / 3839 |

There was no weather-attributable ≥50 ms task and no layout shift during
playback. New readout-enabled and weather-disabled versions had identical cold
CLS in every repeat: **0.064526 desktop, 0.026647 at390, 0.034807 at320**;
these are existing initial seasonal-content shifts before weather. Previous v2
mobile CLS was 0.032061/0.048899; the new reserved readout space changes the
viewport geometry. CLS was zero for all27 consumed-session visits.
These measurements show variation and real overhead, not zero-cost decoration.

Final runtime sizes (gzip, build measurements): bootstrap/readout **5,956 B**,
enhanced renderer **7,392 B**, controlled fallback **5,955 B**; combined runtime
JS **19,303 B**, below25KiB. Home-only CSS is **894 B gzip**. Largest selected
catalog texture body is **104,634 B**, below128KiB. Logical decoded texture RGBA
backing is at most **1,609,728 B**; canvas is capped at2million pixels/DPR1.5.
Those are measured resource dimensions/allocations, not total browser/GPU memory.

In the repeated rain/mist fixture, v3 used **8 weather resources / 114,396 B
encoded bodies** (Brotli JS/CSS/JSON + already-compressed WebPs), versus previous
v2's **3 / 8,326 B**. Browser Resource Timing transfer totals were116,796 versus
9,226B, including reported response overhead, not packet/TLS accounting. Home
static-only used three resources (bootstrap, CSS, shared JSON); no renderer or
texture request. Consumed Home reused its HTTP-cached bootstrap/CSS/JSON with
zero Resource Timing network-transfer bytes, and no replay/texture/renderer.

### Actual deployed backend and unattended refresh

Backend source was committed and published before its Worker deployment, while
all public weather HTML/assets still pointed at v2. Stage1 old endpoint bodies
were byte-identical to baseline; v3 safely returned503 until a compatible normal
scheduled refresh. No manual refresh, storage reset, timestamp rewrite, new
hostname or cron change was used.

Final Worker revision: **`683e8e0e-86ae-4522-9e28-bbe3e4de3057`**, source at
`2aba94e` with lighting enabled after the assessment. All13 deployed immutable
WebPs passed exact local-byte hashes, MIME, exact-origin CORS and one-year
immutable Cache-Control. The local actual-workerd assets binding also passed
GET/HEAD, rejection, decoded-byte and hash checks before deployment.

A Cloudflare tail captured the genuine **`47 * * * *`** event with outcome`ok`,
`refreshed:true`, `source:scheduled` at **2026-10-04T15:47:26.749Z**.
Both v3 endpoints then returned200 from **KFTW 15:30:00Z**, fetched15:47:26.749Z,
valid until16:47:26.749Z; same source report, separate restaurant solar values.
The exact NWS record matched **Light Rain**, structured light rain/-RA, OVC,
**22°C, QC V →71.6°F**. V3 body sizes were **401/400 B Brotli** and under2KiB
uncompressed. V1/v2 also remained200 with rain from that same actual report.
This is live/provider/cron evidence; the 64 rare scenes remain controlled fixtures.

### Reproduction, evidence and unavailable checks

Evidence is retained outside the public tree in
`work/weather-final-2026-10-04/`: baseline/readback JSON, redacted cron tail,
source/asset hashes, exact observation, test logs and `qa/` PNG/results.
Test-specific certificates, local databases, .wrangler state and browser profiles
are never staged. The performance harness accepts `SB_QA_SECTION=comparison`,
`scenes`, `cache`, `layout` or `a11y`, `SB_WEATHER_BASELINE` pointing at a private
copy of the unchanged starting HTML/assets, and `SB_WEATHER_QA_OUTPUT` for evidence.
The fixture origin rewriting exists only in the test harness, not shipped pages.

**Unperformed:** no installed WebKit binary; physical iPhone/mobile Safari,
VoiceOver, actual cellular, device thermal/GPU and whole-site accessibility
certification were not tested or claimed. Chromium mobile/CPU/network emulation,
CSS zoom, native BFCache and rendered-light analysis do not substitute for them.

### Remaining page checks and publication hold

The21 representative current-page scene runs passed, covering clear day,
overcast night, rain/mist, heavy thunder/rain, hail storm, freezing rain and
blowing snow under all three CPU/network profiles. Five-second lifetimes were
5000.3–5002.2ms; maximum p95 callback0.7ms, individual callback4.8ms. Cold body
bytes peaked at**117,571B**, across4/7/8 requests by scene, below160KiB. Native
CDP whole-page JS heap peaked at4,798,604B while active and4,362,696B after
cleanup; these include page/test instrumentation, with no forced GC, and exclude
image/GPU allocations. They are not a weather-only heap attribution.

All9 cold/warm-new-tab/consumed cache visits verified actual immutable texture
reuse, static readout persistence, ordinary controls and no consumed-session
replay. However, **one desktop warm-new-tab first weather callback took190.5ms**,
with a matching194ms Long Task/196.6ms Long Animation Frame at88.7ms after
navigation. The RAF wrapper loses script-URL attribution, so an empty
`weatherLong` array is not evidence that this outlier is acceptable. The harness
now also explicitly asserts the measured callback ceiling and saves evidence
before that assertion. This original performance failure remains recorded in
`qa/page-cache/cache-results.json`; it has not been averaged away or overwritten.

Six focused desktop warm repeats (18 cold/warm/consumed visits) did not reproduce
the outlier. Three omitted active heap sampling; their warm callback maxima were
0.6/0.9/0.4ms. Three captured CPU profiles/native-call durations and inspector
timestamps; maxima were0.8/0.8/0.5ms, with no slow native call or Long Task.
First graphics initialization versus an inspector/host pause remains a hypothesis,
not an established root cause. No speculative renderer rewrite, artificial
production condition, safeguard relaxation or replay-policy change was made.

Three actual-page keyboard/accessibility checks also passed on Home and both
locations at320px: native buttons work with Space, minimum44px target height,
correct saved preferences/pressed states, no horizontal overflow, no animation
with reduced motion, and factual Home text remains. The readout is absent on
location pages and is not a live region. These checks do not replace VoiceOver
or physical Safari verification.

**Release acceptance is incomplete because the recorded startup stall exceeds
the50ms task ceiling and its cause is unresolved.** The frontend HTML/CSS/JS
changes are saved in the local candidate, not pushed to main or published.
The compatible production backend at revision
`683e8e0e-86ae-4522-9e28-bbe3e4de3057` is live; the website still serves its
previous v2 weather assets and has no new Home readout. Accordingly there is
**no production v3 five-second playback or Home-readout claim**. Real new API
observations/temperatures and the genuine cron event were verified separately;
all five-second/64-scene/readout visual results above are controlled local tests.

The protected business-content boundary remains intact: all150 existing tracked
files outside weather and the three eligible pages are byte-identical to baseline.
Removing only the exact weather additions from those three candidate pages
reproduces their starting bytes. No menu, organic wording, price, hours, order
URL, SEO, form, shared style/script, seasonal, New Year or release-control edit
is included. All four retained weather assets remain byte-identical.

## October 4 continuation — full tracing; publication still held

This continuation started from saved commit
`17c01afad32b99b837b68fbe511d7fe54fa08e7f` on
`feature/weather-final-homepage`. Remote main was still
`2aba94eab914702952675799b639053ec5317045`, already an ancestor of the candidate.
No newer main changes needed reconciliation. The production Worker remained
`683e8e0e-86ae-4522-9e28-bbe3e4de3057`; no Worker deployment was performed.
Only private test harnesses and weather documentation changed. The three generated
runtime hashes remain the saved candidate's hashes (bootstrap `54e92f8e…`,
enhanced `f88f04b1…`, fallback `92dadb67…`); no renderer, client, artwork, business,
seasonal, New Year, release-control or public-page source was modified.

### Original failure and what tracing established

The original `qa/page-cache/cache-results.json` remains byte-identical:
SHA-256 `1bfa07214d304e94a7684fdb0b839633755eee432fdbefbf3b134418447481b9`.
Its first warm-desktop callback is still **190.5 ms**, its Long Task **194 ms**.
No original full trace exists. This continuation does not replace that failure
with successful repetitions or attribute it to environmental noise.

Private instrumentation now separates renderer module evaluation, each texture's
fetch/body/decode, canvas/context preparation, particles, gradients, sprites,
DOM insertion, clock start and initial drawing. Full Chrome traces include task,
script, image, compositor/GPU, layout and GC events; screenshots are disabled.
The stage-marked bundle is served only by the isolated localhost harness and
never written into a production asset. Normal timing visits execute the unchanged
built asset, with only the existing private Worker-origin substitution.

One completely traced original-path warm visit measured **0.7 ms synchronous
setup**, **1.866 ms first draw wall time / 1.313 ms thread CPU**, including
**0.381 ms GPU command initialization**, **0.447 ms minor GC** and **0.211 ms style
work**. After that callback, canvas-resource production consumed **4.098 ms**
main-thread time. It decoded the same four WebPs again despite earlier completed
`image.decode()` calls (1.335 + 0.987 + 1.198 + 0.363 ms), with 0.153 ms of uploads.
The encompassing first-frame task was **6.448 ms**. Active heap inspection
occurred later, at 117.4–118 ms, not inside that draw.

Offline analysis of **all150 traces** found no missing trace, parse error or
timestamp-mapping warning. It links RAF request stacks to callback IDs and checks
whole main-thread tasks, including deferred work. The worst task overlapping
renderer preparation/playback was **33.896 ms**, the first warm rain/mist frame
at320px/6×: callback4.614 ms, deferred main-thread image decoding25.876 ms,
uploads0.923 ms and GPU initialization1.22 ms. These nested categories must not
be summed. The20-cycle desktop group peaked at9.124 ms for its full first-frame
task (21.35 ms for any task overlapping its wider weather interval). Temporal
overlap is a candidate attribution, not a claim that every task operation belongs
to weather. Pre-weather page tasks reached109.157 ms and are retained separately;
trace task counts and PerformanceObserver Long Task counts are different measures.
The reproducible offline analyzer is `tests/summarize-page-traces.py`; private
compact/full outputs are `qa/trace-continuation-{compact,summary}.json`.

This is evidence that browser canvas first-use work can occur outside the RAF
callback timer, and that HTTP/image decode readiness is not the entire graphics
cost. It is **not evidence explaining the missing 190.5 ms trace**. No duplicate
application request, decoder initialization or playback was found. No speculative
prewarming, batching, renderer rewrite or safeguard relaxation was applied.

### Executed matrix and retained failures

The matrix/rules were recorded in PERFORMANCE-CONTINUATION-PLAN.md before any
final acceptance attempt. All browser runs were sequential; capture/encoding and
other browser benchmarks did not run during timing. Chromium151.0.7922.34 used
native monotonic timing/RAF, 150 ms latency, 1.6 Mbps down /0.75 Mbps up, and the
same 1× desktop /4×390px /6×320px profiles. No browser clock acceleration was used.

| Timing group | Visits | Worst callback | Highest per-visit p95 |
| --- | ---: | ---: | ---: |
| 20 desktop rain/mist cold → cached-new-tab → consumed cycles | 60 | 4.6 ms | 0.2 ms |
| Six additional desktop families, all three cache/session states | 18 | 5.2 ms | 0.2 ms |
| Seven families at390px /4×, all three states | 21 | 3.9 ms | 0.7 ms |
| Seven families at320px /6×, all three states | 21 | 5.8 ms | 0.9 ms |

All120 timing visits satisfied their weather callback/resource/lifecycle assertions.
Every warm visit's complete renderer/selected-texture resource set was verified
cached, not merely one texture. Consumed visits loaded no renderer or texture.
The selected families were clear day, overcast night, rain/mist, heavy thunder/rain,
hail storm, freezing rain and blowing snow. No condition was replaced with a
cheaper scene. Nine mobile page Long Tasks (65–109 ms) are retained in these
traces: their LoAF script attribution is unchanged `seasonal.js`, before the
weather import/preparation/playback. They are not counted as weather work or
silently discarded, and seasonal code was not changed.

There were also nine initial stage/native/heap diagnostic visits and18 input-probe
visits plus three focused probe-correction visits: **150 traced visits total**.
All new weather callbacks were below50 ms, with a **5.8 ms** maximum. Instrumented
synchronous setup peaked at **6.0 ms**. Per-image asynchronous decode elapsed time
peaked at **48.1 ms** with concurrent user input; that includes waiting and is not
claimed to be48.1 ms of blocking decode CPU. Across the150 visits, measured canvas
lifetimes were **5000.2–5008.2 ms**, preserving the full logical five seconds.

One input-probe assertion failed and remains saved: desktop cold hail at180px
scroll expected a visible readout. The readout was correctly hiding to avoid
covering the **Fort Worth Details** button. The probe now records that exact
collision and fresh-data status; a separate three-visit rerun passed. Another
probe summary incorrectly compared scrolling against the position inside a
passive wheel listener, after compositor scrolling had already occurred. Its
raw records show0→180px during preparation. The corrected probe compares the
pre-input position and verified that movement in the focused rerun. Neither
measurement correction explains or removes the original194 ms failure.

The18 input visits retain two additional pre-weather seasonal Long Tasks
(105/106 ms). No new Long Task was recorded during their weather preparation or
playback. Six cold affected/heavy-scene visits exercised trusted Order Online,
Menu/More and wheel input during preparation at all profiles, with disclosure
state/RAF observations and scroll records. Warm windows were only partially
covered (one mobile warm visit missed the window altogether); those outcomes
are explicitly **not** all-inputs-passed claims. No artificial preparation delay
was added. Measured click Event Timing input delay reached156.4 ms in one emulated
mobile interaction; no matching main-thread Long Task was recorded. This input
queue delay is retained without guessing its cause or claiming physical-phone
latency. Controller round-trip durations are not labeled INP.

Three focused320px keyboard checks passed again on Home/Fort Worth/Willow Bend:
Space operates saved controls, target height≥44px, no horizontal overflow,
reduced-motion animation suppression, static Home readout persistence and no
readout on location pages. Existing381 functional checks,960 frame comparisons,
192 five-second clears, flash assessment and54 off/old/new baseline visits apply
to identical runtime source and were reused instead of unnecessarily rerun.
No new yielded preparation was introduced; its hypothetical cancellation cases
are not falsely claimed executed. Existing actual-renderer cancellation evidence
remains valid for the unchanged implementation.

Runtime gzip sizes remain **5,956 B static**, **7,392 B enhanced renderer** and
**5,955 B retained fallback** (19,303 B total). The normal timing matrix peaked
at **117,571 B cold weather bodies**, **4/7/8 requests by scene**; selected textures
remain within128KiB and snapshots under2KiB. These are measured local HTTPS/Brotli
fixture transfers, not claims that the unpublished website assets were fetched
from production. Existing whole-page heap measurements and texture/canvas caps
remain recorded above; no new total-GPU-memory claim is made.

Harness evidence retention was tightened: trace completion is bounded, trace
failures are recorded alongside the original error, performance errors are saved
before failure, continued diagnostic runs finish with a failing exit status when
any visit failed, and cache-evidence gaps are retained as failures. Instrumented
bundle identity is reported separately from the production asset hash. The first
localhost launch hit sandbox EPERM before any browser visit and was rerun with
local-server permission; it was not counted as a benchmark failure or pass.

### Current live service and publication state

A genuine unattended Cloudflare invocation of existing cron `47 * * * *` was
captured at **2026-10-04T16:47:26.750Z** (11:47:26 AM Chicago), outcome`ok`,
`refreshed:true`, both locations`rain`. No manual refresh, lease reset, storage
change or fabricated condition was used. All six v1/v2/v3 endpoints returned200;
protected diagnostics returned200 and unauthenticated diagnostics404.

Both v3 snapshots used KFTW **2026-10-04T16:15:00Z**, fetched16:47:26.750Z,
valid until17:47:26.750Z. The exact NWS observation verified light rain/-RA,
**22°C, QC V →71.6°F**, matching both locations. V3 bodies were402/400B Brotli.
Five-minute HTTP caching, exact-origin CORS and freshness limits remain unchanged.

At16:51:08Z, all three live eligible pages and all four retained weather assets
returned200 with their previous production hashes. **The website is unchanged;
no v3 five-second production playback or Home readout is claimed.** The original
stall remains unexplained, so the release acceptance condition is not met and
no frontend push/publication was performed. A passing repetition sequence and
better probes are not a demonstrated fix for that missing trace.

All raw traces and results are private under
`work/weather-final-2026-10-04/qa/trace-*`; the original failure and new failures
are preserved. Secrets, local databases, certificates, browser profiles,
.wrangler state and raw evidence are excluded from the commit. Physical iPhone,
Safari/WebKit, VoiceOver and actual cellular/thermal/GPU checks remain unperformed.


## October 4 owner release decision and bounded closeout

The owner explicitly accepted the unresolved original190.5 ms callback/194 ms
Long Task,156.4 ms emulated input delay, and disclosed physical-device/browser
coverage gaps. This supersedes only the historical requirement to establish
those observations' causes before publication. The observations are retained;
none is labeled repaired or passed. Ordering, security, weather-data validity,
lighting safeguards and new demonstrated failures are not waived.

Release resumes from`3a0c09a4ba15eb6d5f2bb431cd7b03f72c13e523`. Production runtime
JS/CSS and approved drawing source are byte-identical to the saved17c01af build
covered by the existing functional/parity/performance evidence. No further
benchmark campaign,64-scene rerun, bulk trace capture, renderer edit, external
browser installation or subagent investigation was performed.

One prepublication smoke pass completed four visits: cold and warm preparation
on1440×900 desktop and390×844 mobile emulation. All passed with zero runtime
errors. Menu/More and Order Online disclosures opened and closed; both existing
ordering links remained present; scrolling worked; no orders/payments were
submitted. Factual Home temperature/condition/area matched the shared fixture
snapshot; animation finished with no retained canvas or pending RAF loop.
Measured canvas lifetimes were4999.9–5003.7 ms (MutationObserver timestamps,
not a change to the5,000 ms contract), and maximum callback4.1 ms.

The remaining warm-preparation interaction check used actual HTTP-cached assets
and actual image decoding, followed by a private completion gate with an1,800 ms
hard limit. All four selected textures were cached. Trusted menu/ordering/scroll
input was verified while status remained`loading-renderer`, with no canvas and
no consumed session. The gate then released and the unchanged renderer played
normally. It did not expire; its observed held windows were approximately120 ms
desktop and380 ms mobile. This is a functional synchronization test, **not natural
warm-cache latency evidence**. It adds no shipped hook or delay. Raw results are
`qa/owner-prepublication-smoke/release-smoke-results.json` outside the public tree.

Before publication, remote main remained2aba94eab914702952675799b639053ec5317045.
GitHub reported main unprotected, no applicable branch rules/required checks,
and existing legacy Pages publication from main/root. No publishing setting or
protection is changed. The Worker deployment still uses683e8e0e-86ae-4522-9e28-bbe3e4de3057.
All six weather routes were200/fresh at17:18:10Z, using KFTW16:15Z Light Rain,
71.6°F, fetched by the previously verified genuine16:47:26.750Z cron and valid
until17:47:26.750Z. Diagnostics remained authenticated. No refresh/lease reset or
Worker redeployment is needed for compatibility.

Publication authorization is now satisfied by this bounded pass and the owner's
specific exception acceptance. Actual Pages completion, live asset hashes and
one real-weather desktop/mobile postpublication smoke are verified after the
push; their immutable commit/build identifiers and results belong in the release
receipt. If that smoke demonstrates a new functional or material performance
problem, disable only WEATHER_ENHANCED_ENABLED while leaving a safe working
readout enabled, and report it without starting another investigation.


## Bounded owner-authorized publication closeout — October 4, 2026

- Pages successfully published frontend `f650556c8df0f6e5b76f38ef29a1caf4591a26c5`, run `37220200649`, at 17:22 UTC. Nine live page/runtime hashes matched the saved bytes, including unchanged retained v2 assets. No runtime/artwork optimization was made during closeout.
- The prepublication desktop/mobile cold and warm-preparation functional smoke passed. The historical 190.5 ms callback / 194 ms Long Task and 156.4 ms emulated input delay remain unexplained owner-accepted exceptions. Physical-device/Safari/VoiceOver gaps remain unperformed, not passed.
- The first live desktop run passed its real-scene, five-second lifetime, ordering/menu, cleanup, freshness, overflow and runtime-error assertions, then failed the strict visible-readout assertion after navigation toggles: data status was fresh but the card was hidden. The harness closed before preserving its geometry. The existing collision guard is a possible explanation, not an established cause.
- The interrupted pass resumed with desktop playback already marked consumed solely in that isolated browser context, to check the readout without repeating the desktop animation. An initial harness synchronization error awaited the animation's skipped state before the independent readout request; its wait was corrected. The resumed desktop readout was visible and correct with no collision, so it does not explain the original visibility assertion.
- The remaining fresh production mobile homepage, desktop Fort Worth and mobile Willow Bend visits passed. Real KFTW light rain at 71.6°F produced the approved rain composition. Recorded canvas lifetimes were 5001.6, 5005.3 and 5001.4 ms. No runtime/weather-request errors or overflow; menu/ordering controls opened and closed, with no order/payment submitted. Cleanup removed the canvas; consumed-session reloads did not replay. Home displayed `72°F · Light Rain` / `Fort Worth area`; both location pages, both menu pages and About had no weather readout. Menu/About pages made no weather requests.
- Both live locations used observation 2026-10-04T16:15:00.000Z, fetched by the genuine unattended 16:47 scheduled refresh at 16:47:26.750Z, valid until 17:47:26.750Z. No provider refresh was forced. This is real-weather evidence, not fixtures.
- Because the initial postpublication visibility failure is unexplained, the owner's fail-safe is applied: `WEATHER_ENHANCED_ENABLED` becomes `false`; readout and retained fallback stay enabled. This is containment, not a repair or a claim the intermittent incident is resolved. No further investigation, benchmark campaign or additional animation smoke pass is performed.

Private evidence remains under `work/weather-final-2026-10-04/`: owner-production-hashes.json, owner-postpublication-smoke.json, owner-prepublication-live.json and qa/owner-prepublication-smoke/release-smoke-results.json. The first failed visibility assertion and the continuation synchronization failure are retained explicitly above; later success does not erase them.

The fail-safe was deployed as Worker revision `61cd12ad-e641-4f8e-a836-6ceffca767d9`. Both v3 endpoints returned HTTP 200 with `enhanced:false`, `readout:true`, and `lighting:true`, retaining the exact observation/fetch/expiry timestamps above. Assets were unchanged (Wrangler uploaded no new assets); cron and storage identity remained unchanged.

# Restaurant weather suite

**Publication held — October 4, 2026.** The compatible v3 Worker is deployed,
but the public website still uses retained v2. This local candidate has not been
published because a captured desktop warm-cache first callback took190.5ms
(194ms Long Task), exceeding the required50ms ceiling. The continuation recorded 150 traced diagnostic/timing/input visits, including
20 sequential desktop warm-cache repetitions, without reproducing that stall.
The original cause remains unproven; successful repeats do not explain it.
Production renderer bytes are unchanged from the saved candidate. See
TEST-RESULTS.md and PERFORMANCE-CONTINUATION-PLAN.md for the retained failure,
trace findings, corrected test probes and the still-incomplete acceptance gate.

The approved 64-scene suite runs for **5,000 ms total**, once per tab session,
on Home and the two location landing pages. Fade-in is 0–0.55 seconds and
fade-out is 4.1–5.0 seconds; texture loading happens before playback. Movement
and the single cloud-internal light envelope retain the supplied drawing source.
The existing session/off keys and replay frequency are unchanged. There is no
60-minute cooldown, production scene override, sample temperature or review UI.

Only canonical Home (`/` and `/index.html`) includes the static weather readout.
It uses the same validated NWS snapshot as the animation: icon, real Fahrenheit
temperature when available, complete observed label, and “Fort Worth area”.
Temperature, units and QC come from that same report. Unknown artwork can still
show valid factual text with a neutral icon; malformed/unrecognized qualifiers
never become a shortened misleading description. Missing temperature omits only
the number/separator. Expired data is hidden rather than displayed as current.

Home shares one coalesced JSON request between readout and animation. The readout
can remain with reduced motion, a saved-off preference or a consumed session,
without downloading renderer/textures. Return and real back-forward restoration
reuse fresh data; an expired return may make one request. The expiry timer only
hides text; it never polls or replays. Location pages keep their ineligible-visit
request savings. New Year takeover immediately wins over both decoration and text.

Mobile reserves space below the actual header and allows long/zoomed text to grow.
Desktop uses the approved lower-left card and hides it at control collisions.
The readout is ordinary text, not a live region. Footer controls save weather-off
and storm-lighting-off independently. The normal website remains usable on every
weather error, timeout, storage denial, slow connection or busy-device exit.

## Source and build

Starting main for this update: `e0c1b4bfba5f62c88630348a5f8d5d36ac48af72`.
The supplied manifest verified 184 files. `approved-renderer-v3.js` and
`approved-timing-v3.js` preserve the supplied bytes; the build imports them and
only adapts module boundaries, omitted unmeasured sky, and the pixel ceiling.
The source and tests are excluded from the public GitHub Pages site.

Using the existing New Year development dependencies, from the repository root:

```sh
node _features/weather/build-client-v3.mjs
node --test _features/weather/tests/backend.test.mjs _features/weather/tests/backend-v2.test.mjs _features/weather/tests/backend-v3.test.mjs
node --test _features/weather/tests/renderer.test.mjs _features/weather/tests/renderer-v3.test.mjs
node --test _features/weather/tests/client.test.mjs _features/weather/tests/mixed-weather-playback.test.mjs _features/weather/tests/client-v3.test.mjs _features/weather/tests/suite-playback.test.mjs
git diff --check
```

`SB_ESBUILD` and `SB_PLAYWRIGHT` may select existing modules in an adjacent
checkout; `SB_CHROME` selects an installed Chromium executable. No new browser
runtime dependency is introduced. See TEST-RESULTS.md for the exact evidence,
private visual/performance harnesses, and unavailable browser/device checks.

The new build emits `weather-v3.js`, `weather-renderer-v3.js` and the controlled
five-second `weather-fallback-v3.js`. All four previous v1/v2 JS assets remain
byte-for-byte available. The enhanced renderer downloads only the selected
scene's fingerprinted WebPs from the **same existing Worker**, never all textures.
Only those immutable assets and versioned JSON routes are added to that Worker;
no DNS, paid service, promotion binding or storage-identity change is involved.
The 2-million-pixel/DPR-1.5 ceiling and bounded decoding/setup remain enforced.

## Live configuration and independent disable controls

The Worker is `sour-boule-weather` at
`https://sour-boule-weather.lance-c84.workers.dev`. Both locations retain KFTW and
share the existing hourly fetch and durable cache. V1/v2 and `/weather/v3/{location}`
project the same observation. Read BACKEND.md for schema, freshness, CORS/auth,
lease, solar-boundary and diagnostic details. Never reset storage, retimestamp an
observation, fabricate a condition or bypass the hourly lease for a demonstration.

For any server flag change, edit **only** the named string value under `vars` in
`_features/weather/wrangler.json`, commit the scoped change, then deploy:

```sh
node _features/new-year/node_modules/wrangler/bin/wrangler.js deploy --config _features/weather/wrangler.json
```

Use the already installed Wrangler executable in an adjacent checkout if needed.
Keep the remaining variables, assets, secrets, bindings, migration and cron intact.

| Action | Exact variable change | Result |
|---|---|---|
| Disable enhanced suite | `WEATHER_ENHANCED_ENABLED: "false"` | Uses the retained lightweight drawing through the five-second fallback only when the same report supports it; otherwise skips animation. Readout continues. |
| Disable Home readout | `WEATHER_READOUT_ENABLED: "false"` | Hides factual text when the updated response is received; animation eligibility is independent. |
| Disable storm lighting | `WEATHER_LIGHTING_ENABLED: "false"` | Keeps the selected scene and motion; suppresses its lighting contribution. |
| Full weather shutdown | `WEATHER_ENABLED: "false"` | Public weather reads fail closed and scheduled provider refreshes stop. Website, seasons and New Year remain independent. |

To re-enable, set only that flag back to `"true"` after validation. Cached JSON
can retain the previous flag for **up to five minutes** on a new request, capped
at absolute/solar expiry. An already open Home may retain its validated local
readout until that snapshot’s `validUntil` (at most one hour after fetch, often
earlier); there is deliberately no remote polling. Reloading after the HTTP
window obtains the new flag. An already running animation ends within five
seconds. The saved footer
off controls act locally immediately and do not disable factual Home data.
`WEATHER_EXPANSION_ENABLED` remains the separate legacy v2 mapping control;
it is not the enhanced-suite switch.

For an emergency browser rollback, first disable enhanced mode as above. Make a
normal forward commit that changes only the three weather includes/endpoints to
the retained v2 files/routes and removes only the new Home readout include/slot
and storm-lighting controls. Leave all v1/v2/v3 assets and endpoints available for
cached pages. Do not revert a whole website commit or restore an old page snapshot.
Menus, organic wording, themes, New Year, release controls and mapping/diagnostic
repairs must survive rollback. The preferred enhanced-only switch preserves the
new factual readout and five-second fallback without changing page content.

## Diagnostics and rollout

`window.SourBouleWeatherStatus` is a read-only, bounded, local record: animation
phase/reason/effect plus an independent readout reason. It sends no analytics,
identifier or additional request. It distinguishes consumed session, preferences,
motion/connection/storage gates, data rejection/expiry, New Year, resource failure,
busy exits and completion. It cannot reconstruct an unrecorded historical visit.

Authenticated `GET /internal/status` returns bounded refresh outcomes and each
version's freshness. It accepts no browser Origin and uses the existing secret
only server-side. Never paste that secret into a URL, browser, page, log or issue.
This read-only operation neither fetches NWS nor consumes/changes a lease.

Rollout is deliberately backward compatible: commit and deploy backend first;
verify old endpoints and fresh v3 data for both locations; then publish the new
versioned browser assets and three narrow page edits through main/GitHub Pages.
No old `effect:none` record is upgraded into invented components. Before the next
normal hourly refresh, v3 safely returns unavailable while old pages continue.
Verify actual served hashes, exact observation provenance and real browser playback
separately from fixture tests. A genuine scheduled event is required for cron
verification; local triggers and manual refreshes do not count.

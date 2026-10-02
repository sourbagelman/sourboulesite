# Optional restaurant weather

This additive feature uses the approved four-second artwork. It runs once per
tab session on the home, Fort Worth and Willow Bend landing pages, after page
load and idle time. Standalone menus, ordering, staff and promotion pages do not
load it. Its footer toggle remembers a weather-only off preference. Reduced
motion, denied storage, slow connections, an active New Year takeover, stale
data or any failure leave the ordinary website usable without decoration.

Weather Update 2 bundles the supplied fog, drizzle, storm with rain, rain with
mist, drizzle with mist, and nighttime fog drawing source. The six original
effects remain unchanged. Fog's night palette follows the restaurant's solar
times. The API version is independent of the original artwork's “v2” label.

The initial weather/organic update baseline was main `a39cbf49b39364c97e003ddfcfc63b975405e77b`.
Weather Update 2 starts from `d96ad6e045a87ec0b07bdb46ffdb789c0cd6aa19`.
The accompanying organic-flour sentence changes only the existing bread/story
paragraphs in `index.html`, `about.html`, `menu.html` and
`willow-bend-menu.html`. All other business copy, metadata, links, seasonal
assets, promotion code and release controls are outside this change.

## Build and focused checks

Use the repository's existing `_features/new-year` development dependencies;
there are no new client runtime dependencies. From the repository root:

```sh
node _features/weather/build-client.mjs
node --test _features/weather/tests/backend.test.mjs _features/weather/tests/backend-v2.test.mjs _features/weather/tests/renderer.test.mjs
node --test _features/weather/tests/client.test.mjs _features/weather/tests/mixed-weather-playback.test.mjs
git diff --check
```

For an isolated checkout, `SB_ESBUILD` and `SB_PLAYWRIGHT` may point at the
installed esbuild/Playwright module directories in another checkout.
`SB_CHROME` may select the installed Chromium executable. `SB_BROWSER=webkit`
runs the client tests with WebKit when that browser is installed.
The build produces `assets/js/weather-v2.js` and
`assets/js/weather-renderer-v2.js`; that bootstrap pins that renderer. It retains
`weather.js` and `weather-renderer.js` byte-for-byte for cached old pages. Only
one bootstrap is included on each eligible page. The backend is bundled
separately by Wrangler. No 60-minute replay policy is included in this update.

Tests and deterministic forcing live under `_features/weather/tests`, excluded
from the public site by GitHub Pages' underscore-directory handling. No sample
page, MP4, override query, exported demo hook or weather simulation is shipped
in the production assets. Test evidence distinguishes fixtures from actual
provider and deployed-service checks; no physical-iPhone result is implied.

## Operation and weather-only disable

See [BACKEND.md](BACKEND.md) for source selection, freshness, hourly cache and
the fixed endpoints. The Worker has no DNS routes, promotion bindings or shared
secrets. Keep it on Workers Free; do not enable paid services for this feature.

Expansion-only disable: set only `vars.WEATHER_EXPANSION_ENABLED` to the string
`"false"` in `_features/weather/wrangler.json`, then run the existing deployment
command from the repository root:

```sh
node _features/new-year/node_modules/wrangler/bin/wrangler.js deploy --config _features/weather/wrangler.json
```

Use the already installed Wrangler executable if dependencies are held in an
adjacent worktree. Keep all other configuration, bindings, secrets and resources
unchanged. V2 then projects corrected legacy classifications from the same stored
observation: drizzle is rain; rain with fog remains rain; unsupported standalone
fog/storm is none. It makes no additional browser or provider request. The exact
`Cloudy` mapping repair remains enabled. An already cached response may retain
the expansion for at most five minutes; a running effect ends within four seconds.

Full weather server disable: set only `vars.WEATHER_ENABLED` to the string `"false"`
in this folder's `wrangler.json`, then deploy that configuration with the
existing authenticated Wrangler CLI. Public weather reads fail closed and cron
refreshes stop. An already cached response can remain eligible for at most five
minutes, and any already running effect lasts at most four seconds.

Complete browser disable: set only `ENABLED = false` in `client.mjs`, run the
weather build, and publish those scoped source/asset changes through the site's
normal main-branch process. This prevents optional JSON and renderer requests.
Restore these two flags to re-enable after the defect is corrected. Neither
switch alters seasonal themes or the New Year schedule.

For a permanent expansion rollback, first deploy expansion-disabled mode. Make
a normal forward commit changing only the three weather script includes back to
the retained `weather.js` and `/weather/{location}` endpoints. Keep the corrected
legacy Worker mapping, `Cloudy` repair, diagnostics, and old assets. Keep the v2
endpoints/assets available for cached pages; retire them only after their cache
window, in a scoped forward change. Do not revert a whole combined commit or old
HTML snapshot. Organic wording, themes, menus, New Year promotion and release
controls stay intact. The full kill switch is available independently.

## Playback and refresh diagnostics

`window.SourBouleWeatherStatus` is a read-only, nonpersistent local record with a
bounded phase/reason and optional effect. It can distinguish a consumed session,
saved-off setting, unavailable storage, reduced motion, slow connection, hidden
page, New Year interruption, timeout, rejected snapshot, no supported effect,
renderer failure/busy exit, and ordinary completion. Reading it does not replay,
fetch, reset preferences or send telemetry. A new page visit replaces the record;
it cannot reconstruct a prior unrecorded visit.

The authenticated `GET /internal/status` maintenance path returns bounded recent
refresh outcomes and snapshot freshness, using the existing server-only token.
It accepts no browser Origin and never triggers a provider fetch or changes the
hourly lease. Never paste the token into a URL, browser console, page, issue or
chat. See [BACKEND.md](BACKEND.md) for the exact response and retention limits.

## Rollout order

Publish backward-compatible Worker source first without changing public HTML or
browser assets. Deploy it, then verify both legacy endpoints and fresh valid v2
snapshots from the same real observation. Old cached records remain readable by
v1; v2 safely skips until a normal fresh expansion-capable refresh. Preserve the
hourly lease and HTTP cache windows. Only then publish the versioned browser
assets and three include changes through normal main/GitHub Pages publication.
Verify live hashes, real-weather playback and genuine scheduled refresh evidence.
Passing local fixtures or a green upload alone is not production verification.

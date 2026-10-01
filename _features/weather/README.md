# Optional restaurant weather

This additive feature uses the approved four-second v2 artwork. It runs once per
tab session on the home, Fort Worth and Willow Bend landing pages, after page
load and idle time. Standalone menus, ordering, staff and promotion pages do not
load it. Its footer toggle remembers a weather-only off preference. Reduced
motion, denied storage, slow connections, an active New Year takeover, stale
data or any failure leave the ordinary website usable without decoration.

The source baseline is live main `a39cbf49b39364c97e003ddfcfc63b975405e77b`.
The accompanying organic-flour sentence changes only the existing bread/story
paragraphs in `index.html`, `about.html`, `menu.html` and
`willow-bend-menu.html`. All other business copy, metadata, links, seasonal
assets, promotion code and release controls are outside this change.

## Build and focused checks

Use the repository's existing `_features/new-year` development dependencies;
there are no new client runtime dependencies. From the repository root:

```sh
node _features/weather/build-client.mjs
node --test _features/weather/tests/backend.test.mjs _features/weather/tests/renderer.test.mjs
node --test _features/weather/tests/client.test.mjs
git diff --check
```

For an isolated checkout, `SB_ESBUILD` and `SB_PLAYWRIGHT` may point at the
installed esbuild/Playwright module directories in another checkout.
`SB_CHROME` may select the installed Chromium executable. `SB_BROWSER=webkit`
runs the client tests with WebKit when that browser is installed.
The build produces only `assets/js/weather.js` and
`assets/js/weather-renderer.js`. The backend is bundled separately by Wrangler.

Tests and deterministic forcing live under `_features/weather/tests`, excluded
from the public site by GitHub Pages' underscore-directory handling. No sample
page, MP4, override query, exported demo hook or weather simulation is shipped
in the production assets. Test evidence distinguishes fixtures from actual
provider and deployed-service checks; no physical-iPhone result is implied.

## Operation and weather-only disable

See [BACKEND.md](BACKEND.md) for source selection, freshness, hourly cache and
the fixed endpoints. The Worker has no DNS routes, promotion bindings or shared
secrets. Keep it on Workers Free; do not enable paid services for this feature.

Fast server disable: set only `vars.WEATHER_ENABLED` to the string `"false"`
in this folder's `wrangler.json`, then deploy that configuration with the
existing authenticated Wrangler CLI. Public weather reads fail closed and cron
refreshes stop. An already cached response can remain eligible for at most five
minutes, and any already running effect lasts at most four seconds.

Complete browser disable: set only `ENABLED = false` in `client.mjs`, run the
weather build, and publish those scoped source/asset changes through the site's
normal main-branch process. This prevents optional JSON and renderer requests.
Restore these two flags to re-enable after the defect is corrected. Neither
switch alters seasonal themes or the New Year schedule.

For a permanent weather-only rollback, remove only the `data-sb-weather` script
include and `data-sb-weather-toggle` button from the three landing pages, and
remove the two weather assets in a normal forward commit. Disable the isolated
Worker. Keep the organic-flour paragraphs and all newer unrelated work. Never
reset main, restore old page snapshots, revert the whole combined release, or
use the retired release controller to publish this change.

# Isolated restaurant-weather cache

This Worker is only the decorative weather provider. It has no business/customer
records, D1 binding, cookie-promotion credentials, DNS routes or main-site release
controls. Its one SQLite-backed Durable Object uses `storage.get/put` for two
fixed weather snapshots and refresh bookkeeping; it is not a database application.
Workers Free supports this storage backend, and exceeding Free allowances fails
rather than adding a paid overage. Account plan confirmation and deployment are
recorded in the overall weather delivery evidence.

## Fixed location and station provenance

Current public source pages supply the unchanged addresses. The US Census
`Public_AR_Current` geocoder was queried on 2026-10-01:

| Location | Site address | Validated latitude, longitude | Station | Distance |
| --- | --- | --- | --- | --- |
| Fort Worth | 3801 Southwest Blvd, Fort Worth, TX 76116 | 32.717264292217, -97.441625546485 | KFTW | 14.0 km |
| Willow Bend | 280 Willow Bend Suite 300, Aledo, TX 76008 | 32.729383028691, -97.631901092125 | KFTW | 27.2 km |

The geocoder matched Willow Bend's base street address as `280 WILLOW BEND DR,
ALEDO, TX, 76008`. Suite numbers do not change the street coordinate. These are
address-geocoded coordinates, not surveyed building centroids, and the station
observes nearby regional weather, not a sensor at either restaurant.

Sources:

- [Census geocoder](https://geocoding.geo.census.gov/geocoder/locations/onelineaddress)
  using the addresses above, `benchmark=Public_AR_Current&format=json`.
- [Fort Worth NWS point](https://api.weather.gov/points/32.717264,-97.441626)
  and [regional stations](https://api.weather.gov/gridpoints/FWD/65,102/stations).
- [Willow Bend NWS point](https://api.weather.gov/points/32.729383,-97.631901)
  and [regional stations](https://api.weather.gov/gridpoints/FWD/58,102/stations).
- [KFTW metadata](https://api.weather.gov/stations/KFTW) and
  [actual observations](https://api.weather.gov/stations/KFTW/observations/latest).

KFTW, Fort Worth Meacham International Airport, was selected after sorting the
75 stations in each regional list by distance and inspecting recent reports
from KFTW, KFWS, KAFW, KGKY, KGPM, KCPT, KDFW, KGDJ, KMWL and KXBP. It is the
nearest actively reporting station with coherent present-weather/cloud reports
in those lists, not merely an unchecked first result. Alternatives include KFWS
(21.0/35.4 km from Fort Worth/Willow Bend), KGDJ (46.4/36.1 km), and KMWL
(40.5 km from Willow Bend). Additional closer CWOP examples from the NWS Texas
station listing were inspected: AT009 (6.0/16.0 km) and AU876 (18.8/14.5 km)
reported empty descriptions and cloud/current-weather arrays, while AR853,
AN595 and A4323 returned no current timestamp in the checked response. Those
cannot establish the required visual condition. No claim is made that this
comparison exhausts every private or unlisted weather sensor.

Real integration check at 2026-10-01T15:38:05.146Z called `fetchStation`, not a
fixture: KFTW's report was observed at 15:20Z and normalized to `none` because
rain mixed with unsupported fog/mist is conservatively unsupported. Both public
responses were fresh (expiry 16:38:05.146Z), 352/353 JSON bytes, and carried
separate location IDs and solar times. These are pre-deployment real-provider
results; deployed endpoint/cron evidence belongs in the final delivery report.

## Mapping and freshness

[NWS documentation](https://www.weather.gov/documentation/services-web-api) and
[OpenAPI observation schema](https://api.weather.gov/openapi.json) were checked
2026-10-01. NWS requires an identifying User-Agent; the server sends the website
and owner contact address. NWS warns that upstream QC can delay observations;
our 120-minute age limit is an implementation default, not a provider promise.

- Explicit structured rain/drizzle maps to `rain`; snow maps to `snow`. Showers
  are supported. Freezing/blowing/vicinity reports, rain+snow, fog/mist, smoke,
  hail, thunderstorms and other unsupported combinations map to `none`.
- Current supported precipitation precedes wind, cloud and clear effects.
- Sustained wind or gust at least 20 mph maps to `wind`; km/h, m/s, knots and
  mph have explicit conversions, rounded to one millionth of a mph to avoid
  binary floating-point noise at the exact 20 mph boundary. Missing, negative, unknown-unit or bad-QC
  measurements are not wind evidence.
- OVC/BKN/SCT map to cloud; CLR/SKC/FEW positively support clear. VV, unknown,
  contradictory or absent information does not imply clear skies.
- An exact, tested table of NWS current METAR descriptions (`Fair`, `Clear`,
  `A Few Clouds`, `Partly Cloudy`, `Mostly Cloudy`, `Overcast`, plain/light/heavy
  Rain/Drizzle/Snow) is the only text fallback. No substring matches, forecast
  probabilities or precipitation totals are used.
- Latest incomplete data permits one request for at most four recent whole
  observations. A coherent unsupported latest report is accepted as `none`;
  older attractive conditions are never cherry-picked to replace it.
- Observations older than 120 minutes, malformed timestamps or timestamps more
  than five minutes ahead are rejected. `validUntil` is at most the earlier of
  `observedAt + 120 minutes` and `fetchedAt + 60 minutes`. Re-fetching an old
  report cannot renew its observation age. Missing/failed refresh clears the
  weather snapshot until the next scheduled attempt.
- Clear maps to sun/night using the restaurant's Chicago date and NOAA/Meeus
  sunrise/sunset calculation. Its response expiry is shortened at the next
  solar boundary. Rain never changes to night solely because the sun sets.

[Solar equations](https://gml.noaa.gov/grad/solcalc/calcdetails.html) are approximate
astronomical calculations, not observed sunlight. For 2026-10-01 Fort Worth,
the calculation gave sunrise 07:23:58.853 and sunset 19:14:13.953 CDT. An actual
independent [US Naval Observatory query](https://aa.usno.navy.mil/api/rstt/oneday?date=2026-10-01&coords=32.717264,-97.441626&tz=-5&dst=false)
returned 07:24 and 19:14.

## Operation

- Public fixed GET endpoints: `/weather/fort-worth`, `/weather/willow-bend`.
  No parameters, coordinate proxy, visitor identity or provider response passthrough.
- Exact CORS: `https://thesourboule.com` and `https://www.thesourboule.com` only;
  no credentials. Replies vary by Origin. JSON is less than 2 KB per location.
- Public reads use only the shared cache. Missing or expired state returns 503
  and `effect: none`; a visitor can never initiate a provider fetch.
- [Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/)
  `47 * * * *` refreshes independently of visits. One unique station is fetched
  once and then written to both separate location keys. The refresh-slot lease
  is durable and aligned to minute 47, preventing duplicate trigger/maintenance
  requests in the same scheduled slot. Initial setup before the first minute-47
  tick does not suppress that tick. A delayed/dropped tick simply expires to no
  decoration; the normal website is unaffected.
- Each provider request has a 4.5-second abort deadline, zero retry loop and one
  optional bounded-history request. There is no per-visitor provider retry.
- Initial/manual maintenance uses `POST /internal/refresh` with server-only
  `Authorization: Bearer <REFRESH_TOKEN>` (minimum 32 random characters). The
  isolated Worker secret is set through authenticated Cloudflare secret tooling, never committed,
  logged or shipped to the browser. Browser-Origin requests cannot use this path.
- Client responses cache for at most 300 seconds and no longer than absolute
  expiry. Both server and browser validate absolute expiry again. Durable shared
  storage, rather than per-colocation Cache API or process memory, is authoritative.
- Weather-only server kill switch: deploy this Worker with `WEATHER_ENABLED`
  set to string `false`. It then refuses reads and skips cron refreshes. Existing
  HTTP responses may remain usable for at most five minutes; each effect itself
  lasts at most four seconds. Persist the false setting in its weather config
  for a durable disable; never change seasonal/NYE/release settings for this.

[Cloudflare Durable Objects Free-plan limits](https://developers.cloudflare.com/durable-objects/platform/pricing/)
were checked 2026-10-01: SQLite support, 100,000 requests/day, 5 million rows
read/day, 100,000 rows written/day and 5 GB storage. This cache holds only two
small reports and two metadata keys. No paid plan is necessary or authorized.

Run the focused backend suite:

```sh
node --test _features/weather/tests/backend.test.mjs
```

## Runtime compatibility evidence

The first deployed initialization returned unavailable snapshots. A bounded
local workerd reproduction found that `redirect: 'error'` throws an immediate
TypeError in the installed runtime, despite the current Cloudflare Request
reference listing that value. The provider now uses `redirect: 'manual'` and
rejects every non-2xx status, including redirects, preserving the intended
no-redirect behavior. No raw response, credential or browser session was logged.
Safe provider failures report only station, stage and a fixed reason category.

The full corrected provider and response code ran in workerd against the actual
NWS endpoint at 2026-10-01T15:51:19.165Z, accepting KFTW's 15:30Z report with
16:51:19.165Z expiry. This is local runtime/live-provider evidence, separate from
cloud endpoint verification. To reproduce with the existing Miniflare install:

```sh
node _features/weather/tests/workerd-live-check.mjs
```

An optional argument supplies the `package.json` path beside an already installed
Miniflare runtime if dependencies live in a separate development worktree. This
explicit integration command uses real NWS data and never substitutes fixtures.

Before frontend activation, the cache identity was changed once from failed
preflight `restaurant-weather-v1` to `restaurant-weather-live-v1` to initialize
freshly after the runtime correction without weakening the durable hourly lease.
The earlier object contains only two tiny failed-refresh bookkeeping entries,
no successful weather snapshots or customer information. No other storage was
changed.

## Verified production backend (2026-10-01)

Worker revision `36d1a9f8-6b52-47d8-b7c8-08aa6974a4c4` was deployed to the
existing approved Cloudflare Free account with the corrected runtime handling.
Production endpoints:

- [Fort Worth weather](https://sour-boule-weather.lance-c84.workers.dev/weather/fort-worth)
- [Willow Bend weather](https://sour-boule-weather.lance-c84.workers.dev/weather/willow-bend)

The authenticated manual initialization at **15:54:17.589Z** fetched a real NWS
KFTW observation dated **15:31:00Z**. Twenty subsequent GETs at 15:54:34–35Z
all returned HTTP 200 with the same fetched/observed timestamps, independent
location IDs and valid absolute expiry **16:54:17.589Z**. Normal page reads did
not renew the snapshot. The observed mixed conditions mapped conservatively to
`none`, which intentionally means no decorative playback. These were real
production responses, not mocked API fixtures.

Verified response headers: `Content-Encoding: br`, `Cache-Control: public,
max-age=300, must-revalidate`, absolute `Expires`, `Vary: Origin`, and the exact
allowed-origin CORS value without credentials. Actual HTTP Brotli response-body
measurements at 15:55:24Z were **210 bytes Fort Worth / 212 bytes Willow Bend**,
decoding to **352 / 353 bytes**. This counts response bodies, not TLS/header
overhead. Hostile origins returned 403; unknown locations 404; query overrides
400; unauthenticated refresh 404; approved-origin OPTIONS 204.

The production tail's limited successful sample showed 0–2 ms CPU for public
requests and 3 ms for the initial refresh's Durable Object work, with `ok`
outcomes and no exceptions. All twenty validated successful GETs returned
without a CPU-limit error. These observations do not guarantee worst-case CPU
or replace physical-phone performance measurements.

The hourly `47 * * * *` trigger is registered, but **a successful unattended
scheduled refresh has not yet been observed** in this verification. Successful
initialization was explicitly manual; the report does not relabel it as cron.
The scheduled function and durable slot behavior passed focused local tests.

The initial Python urllib probe was rejected by Cloudflare's edge with HTTP
403/error 1010 before Worker execution. Native Node HTTP checks then verified
the actual Worker responses above. This transport difference was not hidden
as a passing application test, and no security settings were weakened.

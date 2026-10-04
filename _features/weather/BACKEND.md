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
fixture: KFTW's report was observed at 15:20Z and normalized to `none` by the
initial rollout's mixed-weather restriction. That restriction is superseded by
the rain/fog correction documented below. Both public
responses were fresh (expiry 16:38:05.146Z), 352/353 JSON bytes, and carried
separate location IDs and solar times. These are pre-deployment real-provider
results; deployed endpoint/cron evidence belongs in the final delivery report.

## Corrected legacy mapping and freshness

[NWS documentation](https://www.weather.gov/documentation/services-web-api) and
[OpenAPI observation schema](https://api.weather.gov/openapi.json) were checked
2026-10-01. NWS requires an identifying User-Agent; the server sends the website
and owner contact address. NWS warns that upstream QC can delay observations;
our 120-minute age limit is an implementation default, not a provider promise.

- Explicit structured rain/drizzle maps to `rain`, including when accompanied
  only by ordinary `fog` or `fog_mist`; snow maps to `snow`. Showers remain
  supported for precipitation. Every structured entry is validated before a
  positive selection, independent of array order. Fog/mist alone, snow with fog,
  freezing/blowing/vicinity reports, rain+snow, smoke, hail, thunderstorms and
  unknown combinations remain `none`. Fog with a modifier is not ordinary fog.
- Current supported precipitation precedes wind, cloud and clear effects.
- Sustained wind or gust at least 20 mph maps to `wind`; km/h, m/s, knots and
  mph have explicit conversions, rounded to one millionth of a mph to avoid
  binary floating-point noise at the exact 20 mph boundary. Missing, negative, unknown-unit or bad-QC
  measurements are not wind evidence.
- OVC/BKN/SCT map to cloud; CLR/SKC/FEW positively support clear. VV, unknown,
  contradictory or absent information does not imply clear skies.
- An exact, tested table of NWS current METAR descriptions (`Fair`, `Clear`,
  `A Few Clouds`, `Partly Cloudy`, `Mostly Cloudy`, `Overcast`, `Cloudy`,
  `Cloudy and Windy`, plain/light/heavy
  Rain/Drizzle/Snow, plus the four verified rain/drizzle-with-fog phrases below)
  is the only text fallback. No substring matches, forecast
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
node --test _features/weather/tests/backend.test.mjs _features/weather/tests/backend-v2.test.mjs _features/weather/tests/backend-v3.test.mjs
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
not renew the snapshot. The initial mixed-weather restriction mapped those observations to
`none`; that historical result predates the correction below. These were real
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

## Narrow rain/fog correction — October 1, 2026

Structured observations remain authoritative. Ordinary `rain` or `drizzle` plus
`fog`/`fog_mist` selects the existing rain renderer; cloud cover does not override
precipitation. No new or combined animation is introduced. Fog alone cannot
invent rain from the description. A later unsupported phenomenon still rejects
the entire list, even when rain is its first entry.

Only these exact additional text fallbacks were verified against actual NWS
observations before adding them; no substring or forecast matching is used:

| Exact phrase | Actual observation evidence |
| --- | --- |
| `Light Rain and Fog/Mist` | KFTW, 2026-10-01 16:10Z |
| `Rain and Fog/Mist` | KFTW, 2026-10-01 16:05Z and preceding reports |
| `Heavy Rain and Fog/Mist` | KFTW, 2026-10-01 15:15Z, 15:10Z, 15:03Z |
| `Light Drizzle and Fog/Mist` | KISP, 2026-09-28 18:30–19:56Z |

Sources: [KFTW observations](https://api.weather.gov/stations/KFTW/observations?limit=20),
[bounded KISP history](https://api.weather.gov/stations/KISP/observations?start=2026-09-28T17:00:00Z&end=2026-09-28T20:00:00Z&limit=20),
and the [NWS schema](https://api.weather.gov/openapi.json). KISP is evidence for
the provider's exact phrase only; it never supplies either restaurant's weather.
The structured enum contains `fog_mist` and `fog`; a guessed literal `mist` is
not accepted. Unverified text variants remain unsupported.

Deployment must retain the same storage identity and hourly lease. An existing
snapshot keeps its original normalized condition and timestamps until a normal
eligible refresh. An authenticated maintenance request in a used hourly slot
must be reported as skipped; do not reset storage or add a bypass. HTTP clients
may additionally retain responses for up to five minutes after the shared cache
changes. Manual refresh results and fixture triggers are not cron-success proof.

## Weather Update 2: independent versioned classifications

The current [NWS OpenAPI schema](https://api.weather.gov/openapi.json) was read
again on 2026-10-02. `MetarPhenomenon` requires `intensity`, `modifier`, `weather`
and `rawString`, with optional boolean `inVicinity`; additional properties are
not permitted. Intensity is null/light/heavy. This integration supports ordinary
null modifiers, plus `showers` for rain/snow only. Freezing, blowing, patches,
low-drifting, shallow, partial, vicinity, malformed and unknown entries fail
closed. The provider's actual names are `fog`, `fog_mist` and `thunderstorms`;
there is no guessed `mist` phenomenon or `thunderstorms` modifier.

`normalizeExpansion` validates the complete structured list before selection.
Rain outranks drizzle; supported precipitation outranks fog/wind/cloud; fog
outranks wind/cloud. Rain/drizzle with ordinary fog has `mist: true`. Standalone
fog is `fog`. Thunderstorms require positively reported ordinary rain to select
`storm`; heavy rain alone remains `rain`. Snow plus ordinary fog remains the
original `snow` without an additional mist layer. Rain/snow mixtures, thunder
without rain and any unsupported third phenomenon produce `none`, regardless of
array ordering. A complete, schema-valid populated structured list is authoritative
over text, including different or unrecognized wording. An incomplete/malformed
list is never rescued by text. A text-only fallback must match the verified table
exactly; unrecognized wording (including unverified hazard or forecast phrases)
fails closed. No substring parsing attempts to reinterpret a structured report.

Both classifications are computed from the **same whole station report**.
Stored `condition` retains the corrected legacy behavior, while
`expansion: { version: 2, condition, mist }` carries the new interpretation.
V1 is not derived by translating v2: drizzle is still rain; standalone fog,
rain with thunder, and snow with fog remain legacy `none`. The only additional
legacy corrections are the verified exact `Cloudy` and `Cloudy and Windy`
descriptions described below.

The expansion retains the existing exact fallback table, differentiates drizzle
and positive fog accents, and adds only these newly verified exact phrases:

| Exact phrase | Actual NWS evidence | V2 |
| --- | --- | --- |
| `Fog` | KGPM 2026-10-01 13:55, 14:15, 14:35, 14:55Z; structured `fog`, raw `FG` | fog |
| `Heavy Thunderstorms and Heavy Rain` | KFWS 2026-10-01 14:50Z; separate heavy `thunderstorms`/`rain`, raw `+TS`/`+RA`, null modifiers | storm |

Sources: [bounded KGPM observations](https://api.weather.gov/stations/KGPM/observations?limit=30&start=2026-10-01T13:00:00Z&end=2026-10-01T16:00:00Z)
and [bounded KFWS observations](https://api.weather.gov/stations/KFWS/observations?limit=30&start=2026-10-01T14:00:00Z&end=2026-10-01T16:00:00Z),
read again successfully on October 2. These stations verify terminology only;
neither supplies restaurant observations. Unverified text variants still skip.

### API compatibility, cache boundaries and disable controls

- V1 routes remain `/weather/fort-worth` and `/weather/willow-bend`.
- V2 routes are `/weather/v2/fort-worth` and `/weather/v2/willow-bend` on the
  same Worker. Responses identify `version: 2`; condition/effect agree except
  clear becomes sun/night. Both `mist` and `night` are always booleans. Mist is
  permitted only for rain/drizzle. Night is true only for fog after dark; clear
  night uses `effect: night` with `night: false`.
- Fog uses the restaurant's calculated solar date, never a visitor timezone or
  phrase. Fog and clear v2 responses expire at the next sunrise, sunset or
  Chicago midnight, as applicable. Fresh reads recompute the current date's
  solar values without refetching observations. Rain/cloud/snow/wind do not
  switch to night or expire merely because the solar date changes.
- Both versions and locations share the same station fetch, object identity,
  storage keys and minute-47 hourly lease. No freshness duration, cron, retry,
  failure clearing or station changed. Public reads perform zero provider calls.
- An older cached record remains valid for v1. With expansion enabled, v2
  returns 503 until a normal eligible refresh stores expansion metadata; old
  `none` is never reinterpreted as fog/storm. Unknown expansion versions,
  malformed modifier combinations and conflicting station identities fail closed.
- Set only `WEATHER_EXPANSION_ENABLED` to string `false` in this Worker's
  `wrangler.json` and perform its normal scoped deployment to turn off the
  expansion. V2 then projects the independently stored corrected legacy
  classification, including old cached records, into valid v2 fields. No second
  request, observation refresh, source page rollback or storage reset is needed.
  Missing/other values also disable expansion. Restore string `true` to enable.
- The existing `WEATHER_ENABLED=false` remains the full weather kill switch,
  disabling all public reads and scheduled refreshes. Either switch may take up
  to five minutes to propagate through previously cached HTTP responses. Existing
  effects still end within four seconds. Neither flag affects seasonal or NYE code.
- A permanent rollback is a forward, weather-only commit and scoped Worker
  deployment. Restore the compatible v1 page asset references if desired while
  retaining their existing files; remove expansion support only after cached v2
  pages have aged out. Retain the Cloudy and earlier rain/fog corrections,
  organic wording, all newer content and the unchanged deployment controls.

### Intermittent playback investigation and bounded maintenance evidence

The October 2 investigation found a reproducible exact-text omission:
[KFTW reports at 12:53 and 13:53Z](https://api.weather.gov/stations/KFTW/observations?start=2026-10-02T12:50:00Z&end=2026-10-02T14:00:00Z&limit=30)
said `Cloudy`, with empty present weather and FEW/BKN/OVC or SCT/OVC layers.
The former table returned `none` before considering those valid layers. Adding
only the verified exact `Cloudy` fallback repairs that mapping in v1 and v2;
unsupported structured weather and contradictory clear/cloud data still reject.
[KFTW's 02:53Z Clear/CLR report](https://api.weather.gov/stations/KFTW/observations?start=2026-10-02T02:50:00Z&end=2026-10-02T03:00:00Z&limit=30)
already maps correctly to clear night.

The reference's displayed-history aliases were checked separately against actual
JSON; they were not copied wholesale into this table. [KPHP's API history](https://api.weather.gov/stations/KPHP/observations?limit=30)
at 2026-10-02 15:10Z supplied the exact `Cloudy and Windy` with empty current
weather, OVC and sustained wind 31.5 km/h. The verified alias supports cloud;
numeric speed/gust must still meet the existing 20 mph threshold to select wind.
The adjective itself cannot create wind. No `and Breezy` API alias was verified,
so it remains unrecognized. KPHP supplies terminology evidence only.

This proves the mapping defect, **not** which record a historical Worker refresh
actually fetched or the cause of every reported interruption. Historical refresh
logs were unavailable. Pre-change current endpoints were healthy, with real rain
observed 14:25Z, fetched by the scheduled trigger at 14:47:26.733Z, and expiring
15:47:26.733Z. Keep the earlier incident's broader cause unconfirmed.

The pre-existing failure policy intentionally removes snapshots after a failed
eligible refresh, retaining the used hourly lease. An observation older than
120 minutes, a fetch older than 60 minutes, or a delayed/missed next cron safely
removes the decoration; public visits never retry or extend the observation.
No change to that policy or the once-per-tab browser policy is part of this work.

To distinguish future outcomes, the existing server-only token now also protects
`GET /internal/status`. It refuses browser Origin, query parameters and wrong
methods/auth; unauthenticated callers receive 404. Replies are `no-store`.
This read-only endpoint returns current fixed-location snapshot status/timestamps,
the existing last-refresh summary, and at most eight subsequent refresh summaries
from the same object. Each summary contains only source/time, fixed station,
legacy/expansion conditions, bounded stage/reason categories and freshness dates.
The centralized classifier deliberately recognizes all 23 current API weather
enums: six supported categories, 16 unsupported categories and the provider's
`unknown` category. It also explicitly recognizes all seven modifiers and seven
sky codes. Protected `classificationReason` distinguishes `supported-condition`,
`unsupported-condition`, `unrecognized-condition`, `incomplete-observation`,
`contradictory-observation` and conflicting `invalid-station`. The entire list is
validated before a stable reason priority is selected, so reordering unknown,
malformed or unsupported items cannot change the reason or effect. Fog plus VV
is supported fog; VV alone supplies no fog evidence. No new rendering category
or unverified display alias is created from the supplemental mapping reference.

Classifier reasons remain separate from provider/network failures: recognized
hail produces a fresh `none` snapshot and a successful provider outcome with
`unsupported-condition`, not an invented server error. Failed latest observation
validation records a fixed `latestObservationReason` (invalid timestamp/station,
stale, future or incomplete) alongside bounded-history recovery/failure. Public
v1/v2 JSON deliberately excludes all these maintenance-only diagnostic fields.
No raw provider payload, visitor identifier, browser analytics or secret is stored.
It neither fetches NWS nor renews a lease. The history starts after this deployment;
it cannot reconstruct earlier missing logs. It remains readable with weather off.
History capture is best-effort: its storage failure emits only a fixed warning,
without changing successful snapshot results or allowing another refresh attempt.

Local backend validation: **44/44 passing** on October 2 (23 existing tests and
21 focused expansion/diagnostic tests). Coverage includes whole-list permutations,
all new mapping paths, unsupported third phenomena, thunder without rain, exact
fallbacks, the Cloudy reproduction, old/v1/v2 caches, both disable modes, shared
fetch count, zero public-read fetches, strict age/station checks, DST/sunrise/
sunset/midnight, failure clearing, bounded history and private status authorization.
Supplemental coverage exhausts documented phenomenon/modifier/sky categories,
fog with VV, layered clouds, numeric wind/QC, verified aliases, structured/text
precedence, deterministic mapping reasons and stale/incomplete report recovery.
These are local tests, not proof of deployment, physical phones or cron execution.


## Final approved component suite and homepage readout — October 4, 2026

This section describes the new v3 implementation; the v1/v2 rollout evidence
above remains historical. V1 and v2 public projections, observation acceptance,
station selection, maximum ages, provider requests, failure clearing, cache
identity, hourly lease and minute-47 cron are unchanged. V3 is additive:

- `/weather/v3/fort-worth`
- `/weather/v3/willow-bend`

All versions read the same two cached observations. V3 adds no provider request
and never reconstructs missing component data from an old `none` classification.
A pre-v3 cached record returns unavailable on v3 until an ordinary scheduled
refresh supplies the new metadata; v1/v2 remain usable throughout this transition.

### Actual-observation adapter

The [current NWS schema](https://api.weather.gov/openapi.json) was rechecked on
October 4, including all 23 phenomenon enums, seven modifiers, three intensity
values, seven sky amounts and the optional `inVicinity` flag. Source evidence
is saved outside the repository in `work/weather-final-2026-10-04/`.
`normalizeSuite` validates the complete structured list before choosing artwork.
The existing exact, verified description table is used only when structured
present weather is absent. No forecast, rain probability, precipitation total,
unverified alias, package scene ID or visual-review control enters production.

The compact components distinguish rain/snow and rain/hail mixtures, freezing
rain/drizzle, ice pellets, hail, falling/blowing/low-drifting snow, independent
thunder evidence, ordinary/dense fog, mist, haze and observed sky coverage.
Thunder never follows merely from heavy rain, hail never invents rain, freezing
liquid never becomes ice pellets, and ground snow never becomes falling snow.
Fog's dense visual tier requires the same report's validated visibility of at
most 400 metres. VV requires actual fog/mist; it is not fog evidence by itself.
Unobserved optional sky, wind, gust or visibility stays `null`, and the renderer
omits that layer. A record with no drawable layer has `scene: null`.

The adapter keeps known unsupported conditions distinct from unknown enums,
malformed reports and unsupported mixtures through protected `suiteReason`.
An unrecognized structured enum/modifier omits the label rather than showing only
the recognized portion of that mixture; known unsupported conditions retain their
complete decoded labels. The public response can retain factual text and temperature without artwork,
using a neutral icon. Structured words preserve qualifiers such as Freezing,
Blowing, Low drifting, Thunderstorms and Hail when a shorter description omits
or contradicts them. A verified exact description is retained only when its
complete phenomenon/modifier/intensity/vicinity signature agrees. Text is safe
plain text, at most 120 characters; oversized labels are omitted, not truncated
or replaced with a shorter phrase that drops a qualifier.

Temperature comes from this same cached report only. A finite numeric value
requires explicit `wmoUnit:degC` or `wmoUnit:degF`; Celsius is converted to
Fahrenheit and rounded to one decimal. Numeric zero remains valid. Null, missing,
strings, other units, non-finite/out-of-range values and suspect/rejected QC
values produce `temperatureF: null`, never yesterday's temperature. The current
schema makes QC optional; absent QC or Z/C/S/V/G is accepted, while X/Q/B/T or an
unknown QC value is not. This is input screening, not an independent sensor
certification; see [MADIS QC documentation](https://madis.ncep.noaa.gov/madis_sfc_qc_notes.shtml).

`publicSnapshotV3` supplies restaurant-specific request-time solar fields and
`daypart` for every scene, including cloud, rain and snow. Every v3 response
expires at the earliest observation/fetch limit, next sunrise/sunset, or next
Chicago midnight. A previously cached daytime storm therefore cannot remain a
daytime storm after sunset. The next valid read computes today's solar metadata
without fetching NWS again. The old v1/v2 response rules are unchanged.

### Protocol, assets and independent controls

V3 contains common provenance/freshness fields, validated `scene` or null,
`temperatureF`, short `conditionLabel`, `icon`, the unchanged v2-compatible
`fallback`, and three boolean `controls`. The browser's shared
`components-v3.mjs` guard rejects malformed combinations. Fixtures/catalogs stay
under the private `_features/weather/tests/` source directory and are not shipped.

- `WEATHER_ENHANCED_ENABLED=false`: use the compatible ordinary weather fallback.
- `WEATHER_READOUT_ENABLED=false`: omit the homepage readout independently.
- `WEATHER_LIGHTING_ENABLED=false`: suppress enhanced internal cloud lighting.
  The approved lighting is enabled after the rendered assessment below; saved off and reduced-motion gates remain independent.
- `WEATHER_ENABLED=false`: existing full weather/readout kill; reads return 503
  and cron skips provider work. Previously cached JSON may last at most five
  minutes, capped by absolute freshness. The new effect ends within five seconds.

The existing Worker also binds `WEATHER_ASSETS` to the 13 approved, fingerprinted
WebPs under `textures-v3/textures/`. Its exact manifest allowlist accepts only
GET/HEAD/OPTIONS at those immutable paths, with the same approved-origin CORS.
No arbitrary file, provider proxy, visitor location or new service is exposed.
`Cache-Control: public, max-age=31536000, immutable` is set with `Headers.set`,
replacing the asset service's default rather than appending a conflicting value.
`run_worker_first` ensures these guards apply before asset delivery. Cloudflare
[static-assets pricing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)
includes asset storage/serving; Worker-first requests use the existing Free
request allowance. No paid service, new DNS record or separate storage is added.

The protected status endpoint adds per-location `suiteStatus` and bounded
`suiteReason` metadata. It retains its existing authentication, no-Origin rule,
no-store replies, eight-summary limit and best-effort history writes. No raw
provider record, temperature history, browser identifier or secret is stored
for diagnostics, and status reads do not refresh or renew the lease.

### Focused local evidence, separate from deployment

The backend suite passes **119/119** tests: the prior 44 compatibility/diagnostic
tests, all **64 approved catalog scenes** converted to genuine NWS-shaped
records and projected through the adapter, and 11 focused v3 tests. Additional
assertions cover full-list permutations/unsupported third phenomena, invalid
measurements and zero, absent optional components, qualifier preservation,
unsupported factual readouts, strict shared component validation, old caches,
all-version shared fetch/lease behavior, independent flags, immutable assets,
solar/date boundaries and DST. Fixture v3 JSON bodies are at most **707 bytes**.
These tests use private fixtures and do not assert those weather conditions
were observed at the restaurant.

An actual local **workerd** check at **2026-10-04T15:22:28.201Z** called the real
NWS provider and produced valid v1/v2/v3 projections for both locations from
KFTW's **14:50Z** report: Rain and Fog/Mist, 21°C / **69.8°F**, OVC, current rain
and fog_mist, measured wind, null gust. V3 bodies were **699/700 bytes**, with
16:22:28.201Z maximum expiry and each restaurant's own solar coordinates. The
same runtime's real static-assets binding returned all 13 exact WebPs; GET/HEAD,
byte count, SHA-256, content type, CORS, immutable caching and unknown/hostile
requests passed. Evidence: `work/weather-final-2026-10-04/workerd-live-assets.json`.
This was local execution against the live provider, **not** a production refresh,
cloud deployment, physical-phone result or observed new cron tick. Production
verification is recorded separately by the delivery task after deployment.

The explicit live integration command above now bundles the actual backend
module graph and exercises the real local asset binding. It needs local listening
ports and outbound read access to NWS, and never substitutes a fixture when the
provider is unavailable. Deterministic tests require neither cloud access nor
any cloud mutation.

### Rendered lighting assessment — October 4

All eight thunder compositions at 320, 390 and 1440 pixels were sampled at
60 frames/second across the full five seconds (301 samples each), comparing the
actual lighting-on/off compositor over the current homepage backgrounds and
black/cream/white backgrounds. Maximum opposing 0.1-luminance transitions in
any second was four (two flash pairs), with no area above the three-pair
frequency criterion. Separate saturated-red and actual-page CIE1976 testing
found maximum chromaticity distance 0.0960, below 0.2, with no qualifying red
transitions. The measured light contribution spans 1.5667–2.6667 seconds;
there is no added pulse in the fifth second.

These bounded engineering measurements support enabling the unchanged approved
lighting under WCAG 2.3.1's tested frequency/red criteria. They are not a
whole-site, clinical or physical-device safety certification. Reduced motion,
weather-off and saved storm-lighting-off continue to suppress lighting.
The reproducible assessment and evidence are recorded in TEST-RESULTS.md.

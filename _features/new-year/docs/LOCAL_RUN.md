# Run the implemented feature locally

The current implementation is on local branch `feature/new-year-cookie-promotion`,
based on seasonal commit `b08545ed37a2e9388ff8e565c50ab36d2eb89712`.
The twelve current visitor pages each include one new, **disabled** loader.
No business markup or seasonal code was replaced. The loader makes no requests
and adds no DOM while disabled. Nothing here authorizes release.

## Prerequisites

Node 22.13+ with `node:sqlite` (tested on Node 25.9.0). From this feature directory,
run `npm ci` for the pinned local Worker validation tools. The Node/SQLite lab and
unit tests themselves need no npm dependencies. `npm run worker:check` performs
only a dry-run build; it does not create a Worker or database.

## Actual website with the isolated celebration

In terminal 1, from `_features/new-year`:

```sh
npm start
```

In terminal 2, from the same directory:

```sh
npm run site:preview
```

Open `http://127.0.0.1:8788/`. This serves the **current repository pages** and
temporarily enables the loader only in its loopback HTTP response. The backend is
`http://127.0.0.1:8787/`. No repository enable flag is changed. Both servers bind
only to `127.0.0.1` and reject foreign Host headers. Ctrl-C stops each process.

The clock starts at Dec 31, 2026, 11:50 PM Chicago. Backend terminal output gives
random **local-only** Fort Worth, Willow Bend, and clock-control tokens. At
`http://127.0.0.1:8787/__lab/login`, paste the relevant station token to rehearse the
fixed-location staff flow. These tokens are not Cloudflare credentials. Do not
copy lab data or tokens into a cloud environment.

The lab uses persistent `.local/nye-v2.sqlite` and `.local/lab-secret`. Restarting
the backend preserves passes. Override the data directory with `NYE_LAB_DATA` if
needed. The schema now includes `entries.pre_observed_ms`; an older package lab
database is rejected with an explanation. Preserve it and choose a new directory
instead of silently dropping or migrating its data.

To jump the lab clock, set the **control token printed by your backend**:

```sh
read -r LAB_CONTROL_TOKEN
curl -sS http://127.0.0.1:8787/__lab/time \
  -H 'Origin: http://127.0.0.1:8787' \
  -H 'Content-Type: application/json' \
  -H "X-Lab-Control: $LAB_CONTROL_TOKEN" \
  --data '{"now":1798783190000,"freeze":true}'
```

| Chicago event time | `now` value |
| --- | ---: |
| Dec 31, 11:50 PM | 1798782600000 |
| Dec 31, 11:59 PM | 1798783140000 |
| Dec 31, 11:59:50 PM | 1798783190000 |
| Jan 1, midnight | 1798783200000 |
| Jan 1, 12:05 AM | 1798783500000 |
| Jan 1, 1 AM — artificial lab redemption window | 1798786800000 |
| Jan 4, midnight — expired | 1799042400000 |

Register before midnight, remain visible at 11:59:50, then jump to midnight.
The next heartbeat reads the new server time. Switch away and back after a clock
jump to force a fresh parent clock read; the parent also refreshes every minute.
Keep the real event's monotonic clock running normally in a deployment.

Continue removes only the isolated layer. Dismissal persists for that browser tab
session, so normal site navigation does not reopen it. A new browser context or
closing the tab starts a fresh lab visit. After midnight, the actual site's footer
utility area exposes “My New Year cookie pass”; it stays available through the
configured support period. The service's `/?pass=1` recovers this browser's pass.

All lab passes and saved images are **TEST ONLY — NOT VALID FOR REDEMPTION**. The
lab exercises real five-digit allocation in an isolated test database. Offline
visual samples use `04271`; production rejects that reserved demo range.
Artificial lab operating windows are not business hours and are absent from the
production migration. Real January 1–3 hours remain an owner input.

## Offline visual preview

```sh
npm run preview:build
```

Open `Sour-Boule-New-Year-Preview.html`. It contains the approved simulated controls
and no network calls. Its return placeholder is intentional; use port 8788 to test
return to the actual current site. This file is outside Worker public assets.

## Repeat local verification

```sh
npm run integration:build
npm run preview:build
npm test
npm run worker:check
npm run runtime:check
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-test.txt
.venv/bin/python -m playwright install chromium
.venv/bin/python scripts/ui-check.py
.venv/bin/python scripts/year-check.py
.venv/bin/python scripts/frontend-check.py
```

For an already installed browser, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to its
executable. `NYE_QA_OUTPUT` selects a results directory (default `.local/qa`).
The original package's `docs/TEST_REPORT.md` is historical evidence only; current
results are recorded separately in the implementation report.

The included `e2e-local-check.py` uses a browser fetch bridge. Start a separate lab
with `LAB_STAFF_TOKEN=local-test-staff-token`,
`LAB_WB_STAFF_TOKEN=local-test-wb-token`, and
`LAB_CONTROL_TOKEN=local-test-control-token`, then run it. These published values
are deliberately LOCAL TEST substitutes. Do not run clock-changing suites at the
same time against the same lab. Native-cookie integration and workerd/D1 tests
have their own scripts and documented environment limits in the current report.

With both loopback servers running and those local fixture tokens selected:

```sh
npx playwright install chromium
npm run browser:check
```

For the native Node browser suite, `CHROMIUM_EXECUTABLE_PATH` selects an existing
browser, `NYE_QA_DIR` selects output, and `NYE_QA_SCOPE` can select `matrix`, `flow`,
`boundaries`, `failures`, or `checkpoint` (default: all, sequentially).
The checkpoint scope waits about 90 seconds on real timers to verify unattended
activation and the natural midnight/end transitions. For randomly generated
lab tokens set `NYE_CONTROL_TOKEN`, `NYE_STAFF_TOKEN`, and `NYE_WB_STAFF_TOKEN` to
the values printed by your local server. Do not substitute real credentials.

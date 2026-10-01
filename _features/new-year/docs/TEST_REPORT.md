> **Imported package test report, not current build results.** See
> [IMPLEMENTATION_REPORT.md](IMPLEMENTATION_REPORT.md) for tests rerun on this implementation.

# Verification report / Revision 4 (final no-purchase lock) / September 27, 2026

## Result summary

| Layer | Executed | Result | Important boundary |
| --- | ---: | --- | --- |
| Backend, authentication and content regression tests | 72 | 72 passed | Same Worker handler/SQL, local SQLite adapter; mocked Access key fetch |
| Chromium visual/UI checks | 41 | 41 passed | Standalone preview, desktop and mobile emulation |
| Focused year-transition checks | 13 | 13 passed | Same view, controlled monotonic/event clock; not a cloud clock test |
| Combined local browser/backend checks | 10 | 10 passed | Real local HTTP handler and persistent SQLite; Playwright fetch bridge and local staff-auth substitute |
| Real Cloudflare Worker/D1 deployment | 0 | NOT RUN | No resources provisioned |
| Real Cloudflare Access / native cross-origin cookies | 0 | NOT RUN | Real issuer, audience, staff roles and host not configured |
| Real phones / screen readers / traffic load | 0 | NOT RUN | Release checks; not inferred from emulation |

All four local suites were rerun for revision 4. These results establish an
exercised LOCAL prototype, not a functional live rewards system or cloud release
approval. All screenshots and logs in this package were regenerated; none retain
the superseded purchase condition.

## Revision 4 change and coverage

Final offer: **one free cookie, no purchase required**. The midnight presence
requirement, five-digit single-use pass, both locations, and January 3 deadline
are unchanged. The year transition, CSS, ball, fireworks, presence policy, code
allocation, security configuration and database schema are unchanged.

The guest registration copy, registered/pending copy, pass screen and generated
PNG explicitly state no purchase is required. The staff UI sends only `code` and
`requestId`. The Worker no longer requires a purchase-confirmation field.

Backend test 31 now proves a valid pass can be redeemed with no purchase data.
Two additional backend tests show that a retired false purchase flag does not
block a valid pass, and a retired true flag cannot bypass expiration. Four new
source/content checks guard exact offer consistency, the absence of the old
client/server gate, guest and staff copy, and rebuilt standalone preview content.
All existing positive redemption fixtures now omit the former purchase field.

The 41-check UI suite includes four new checks for registration copy, registered
rules, the actual canvas text used to export the PNG, and staff no-purchase copy.
It saves and renders the sample PNG; no OCR was used. The combined suite adds an
assertion that the real staff request contains only the code and idempotency key.

## Backend coverage

`qa/backend-tests.txt` records 72 passing tests: 68 retained/expanded backend and
authentication tests plus four no-purchase content/contract regressions. Coverage
includes exact Chicago/UTC boundaries, registration cutoff, names, session
isolation, secure-cookie attributes, CSRF protection, server time, presence,
reconnect bounds, duplicate claims, persistent recovery across restart, five-digit
allocation/collisions/capacity, authenticated verification, no-purchase redemption,
location permissions, operating hours, simultaneous double-redemption prevention,
response-loss idempotency, expiration, immutable audit, and rate limits.

Authentication tests sign real RSA JWTs locally and verify against mocked trusted
JWKS. They cover invalid signatures, algorithm, issuer, audience, expiry,
not-before, missing JWT and missing staff approval. They do not prove a real
Cloudflare Access integration or JWKS rotation.

## Visual, mobile and year coverage

`qa/ui-tests.json` records 41 checks: simulated opening clock, ivory 2026 before
midnight and 2027 at/after midnight with matching accessible labels, simulation
labels, registration, ball descent, midnight greeting, no-purchase pass terms and
PNG export, post-takeover recovery, five-digit staff flow, central-used-pass
simulation, reconnect state, widths 320/390/768/1440 without horizontal overflow,
mobile action sizes, reduced motion, zero external preview requests, and no
unhandled JavaScript errors. A partly typed name survives the 11:59 transition.

`qa/year-tests.json` records 13 focused checks at opening, final minute, final
second, one millisecond before midnight, exact midnight, one millisecond after,
late-open/resume, falsified device Date.now, reduced motion, dismissed preview,
12:05 return and JavaScript errors. A controlled monotonic clock and explicit
animation frame make the boundary checks repeatable; this is not remote clock QA.

Representative regenerated screenshots are under `qa/`. The exported sample is
marked TEST ONLY and has a demo-range code. This is not a full accessibility audit.

## Combined local flow

`qa/local-e2e-tests.json` records 10 checks:

Register in the guest UI -> persist entry -> receive pre/post server presence ->
issue a stored pass -> retrieve it after 12:05 -> verify in the station UI ->
redeem without purchase data -> verify the exact staff request contract -> show
centrally updated redeemed state -> reject reuse at Willow Bend -> verify no
browser JavaScript errors.

The test uses a Playwright fetch bridge to the loopback Node HTTP server with
persistent SQLite and local-only staff-auth substitutes. Native HTTPS cookie
acceptance, same-site/third-party policies, CORS enforcement, real Access sign-in
and the cross-origin iframe are NOT validated. The local adapter executes the
same SQL but is not Miniflare, workerd or the D1 service. Concurrency tests check
guards and invariants, not production burst capacity.

## Reproduction

```sh
npm run preview:build
npm test
python scripts/ui-check.py
python scripts/year-check.py
# Start the loopback lab with the LOCAL-ONLY tokens described in README.md.
python scripts/e2e-local-check.py
```

No production dependency was added. During this revision's first UI-test run,
a test-only canvas-text spy had an invocation error; it was corrected, and the
full UI suite passed on rerun. The year suite was rerun separately after a combined
command timeout and passed all 13 checks. These were test-harness/run issues, not
production application changes.

## Not completed / release blockers

No production domain, cloud database, remote migration, staff Access configuration,
holiday operating windows, native iPhone/Android tests, cross-origin modal QA,
load test, backup rehearsal, retention purge or October live integration has been
completed. `wrangler.toml` retains placeholders; the integration reference remains
disabled. Recheck the current website at integration time; do not replace it with
an earlier snapshot. Validate no-purchase redemption in real cloud staging.

Do not turn any NOT RUN item into PASS without testing its actual environment.

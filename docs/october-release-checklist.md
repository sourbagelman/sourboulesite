# October 1, 2026 combined website release candidate

Decision recorded September 27, 2026 (America/Chicago). The owner approved
**one October 1 release candidate** containing the final redesign, all approved
automatic seasonal themes, the complete New Year's celebration and no-purchase
cookie promotion, and the permanent protected employee verification/redemption
page. The experience, offer, eligibility/reconnect policy and five-digit staff
flow are locked. Upcoming owner content edits remain welcome before release.

The combined implementation is on **`release/2026-10-01`**, including current
`main` ancestry. The owner authorized pushing that non-production branch and
opening a **draft** PR to `main`, after verifying neither action publishes the
website. The owner separately authorized the isolated production promotion
service at `celebrate.thesourboule.com`. Neither approval authorizes merging,
auto-merge, changing the website publishing branch, or publishing the main site.

**Integrated in the release candidate is distinct from production-verified and
from owner-authorized website release.** The main website remains unchanged and
both checked-in loader copies remain `ENABLED=false`. The exact delivered branch
SHA, draft PR, production versions, endpoint verification and remaining checks
are recorded in the [production delivery record](../_features/new-year/production/DELIVERY.md).
Do not describe a production check as passed unless that record contains its
actual result.

This is the current combined release checklist. Historical package/local and
private-staging reports remain evidence for their own environments; their
completed checks must not be treated as production acceptance.

## Candidate and preservation boundary

| Component | Verified checkpoint |
| --- | --- |
| Current production `main` | `6d7ba10f370727f86d63a7e2d285152e23790f45` |
| Final pre-October redesign | `redesign/guest-experience-seo` — `d49eea7ac1969854d127023391d3c24aea08a6ac` |
| Combined redesign and approved seasonal website baseline | `feature/annual-seasonal-themes` — `b08545ed37a2e9388ff8e565c50ab36d2eb89712` |
| Approved New Year private-delivery checkpoint | `feature/new-year-cookie-promotion` — `651a435e8ef840eac5b0d84f73a86a7131a092a8` |
| Production integration preparation | `65b6f36a2edc0d12832e4a60f0fef10fdd43bee1` |
| Combined release branch | `release/2026-10-01`; final delivery SHA and draft PR in the production delivery record |
| Current-main history reconciliation | `78528e600ab476fd688b3ceb26628f191413eb85` — parents `65b6f36` and `6d7ba10`; website tree unchanged |

The New Year checkpoint descends from the seasonal checkpoint, which directly
descends from the final redesign. It already carries both approved website
layers. Current main's business edits and retired-feature removals had already
been reconciled manually in `87c8a5daef15e8d166b3208e2bf30e0626b104d8`. Its history
also contains a rollback of the redesign, so mechanically reapplying that history
would delete approved navigation/pages/icons and restore retired shared code.
The explicit ancestry-only merge at `78528e6` records current main as a parent
while preserving the reviewed combined tree byte-for-byte. No page was replaced
with an old main page, package snapshot or review export.

The September 27 reconciliation compared current main with the combined source:

- Fort Worth's entire menu body (111 text nodes) and Willow Bend's entire menu
  body (154 text nodes) are identical, including all 48 and 49 displayed prices.
- Both direct location pickup URLs remain intact. Contact, catering and events
  form actions and input contracts match main.
- Willow Bend remains Wed–Thu 11 AM–7 PM, Fri 11 AM–9 PM, Sat 8 AM–9 PM,
  Sun 8 AM–7 PM, Mon–Tue closed. Its structured data, postal address and phone
  match; Fort Worth remains Wed–Sun 8 AM–2 PM.
- `CNAME`, `robots.txt` and `images/logo.png` are byte-identical to main. Retired
  Bread Club and podcast pages and public references remain absent.

These comparisons establish preservation of the current business baseline, not
permission to freeze content. Reconcile subsequent owner edits additively before
the finalized release; do not undo the approved redesign or seasonal hooks.

The New Year additions to the twelve business pages are one disabled loader
include each. Existing menus, prices, hours, addresses, ordering links, forms,
photography, Bitcoin messaging, metadata and seasonal source remain the baseline.
Do not replace pages with package snapshots or staging exports. Re-read the then-
current website and production heads at release time and reconcile any newer
approved business edits additively. The older seasonal release procedure must
now be completed with this New Year feature in the same approved October release.

## Complete production scope

The release includes the production Worker and fresh D1 database configuration,
public real guest/pass page, persistent pass recovery, protected fixed-station
staff page and API, and the website's scheduled loader. Publishing only the visual
preview does not satisfy this scope.

Production preparation is isolated under
[`_features/new-year/production/`](../_features/new-year/production/). Its Worker,
configuration template, preparation command and production environment migration
must use real server time and a separate production database. The approved
production origin is `https://celebrate.thesourboule.com`; it must never be
substituted with either private staging hostname. Permanent endpoint verification
is recorded in the production delivery record, not inferred from authorization.

The narrowly authorized setup uses account
`c84d6dc733d90811006e8d8837dcd1c3` and fresh production D1
`1d1e7a58-44d6-4ea7-a114-b05ad3d9b377`, whose schema has been applied. The separate
staff Access application is `63f1c1ce-a257-4a4a-9212-8c246b7c7ee8`, with policy
`092088e7-0b40-47f9-ab42-346d26c937f1`. Approved email-code sign-in and 12-hour
application/policy sessions preserve mandatory organization/account security.
`lance@thesourboule.com` is fixed to Willow Bend and
`alexis@thesourboule.com` to Fort Worth; actual backend assignments must be verified
against their authenticated identities. Both use this one central production
database. No paid service, new expected charge, unrelated resource or main-site
DNS/routing change is authorized.

The guest experience is public: do not carry the private tester email allowlist
or tester Access application into production guest routes. Staff verification
and redemption remain protected by real Cloudflare Access JWT verification and
exactly one active backend station assignment per approved staff identity.
Names are not identifiers. Recovery retains the long, secure guest session;
there is no anonymous code/name lookup.

Exclude visual simulations, artificial event anchors, fixture dates/windows,
test entries/passes, local authentication substitutes, staging database IDs and
secrets from the production service. Publish only the reviewed production
entrypoint and allowlisted real service assets. Never upload `_review/`, feature
documentation, tests, local databases, profiles, or staging exports as website
content. Private review URLs may remain independently available and TEST ONLY.

## Delivery links and separation

| Link | Purpose and verification boundary |
| --- | --- |
| [Permanent employee login](https://celebrate.thesourboule.com/staff/) | Protected production station; deployment, Access login and fixed-station results belong in the production delivery record. |
| [Permanent guest / saved pass](https://celebrate.thesourboule.com/?pass=1) | Public production guest/pass recovery with real server time; registration is closed outside the approved event window. |
| [Combined website preview — PRIVATE, TEST ONLY](https://nye-staging.thesourboule.com/) | Existing approved redesign and seasonal website preview; this private export uses staging services and is never a production website artifact. |
| [Celebration simulation — TEST ONLY](https://nye-staging.thesourboule.com/new-year-preview/) | Approved visual controls available at any time; separate from production eligibility and records. |

The committed website loader points to the permanent production service. The
private preview's staging-only transforms do not change that source. Keep the
current review URLs available; no new timed rehearsal is part of this release.

## Automatic schedule installed with October

| America/Chicago | UTC instant | Required behavior |
| --- | --- | --- |
| December 31, 2026, 11:50 PM | `2027-01-01T05:50:00Z` | Automatically open on existing foreground pages and new arrivals |
| December 31, 2026, 11:59 PM | `2027-01-01T05:59:00Z` | Begin the final-minute ball descent |
| January 1, 2027, midnight | `2027-01-01T06:00:00Z` | Ivory 2026 becomes 2027; Happy New Year and approved fireworks |
| January 1, 2027, 12:05 AM | `2027-01-01T06:05:00Z` | Automatically close and reveal the same current website page and theme |

Enabling the real server-timed loader in October must leave the ordinary website
visible until the opening instant. There is no manual activation on New Year's
Eve. Preserve Continue's tab-session dismissal, reduced motion, failure recovery,
and access to earned passes after the takeover. Browser suspension and resumption
must still be tested on the actual phones; desktop timer evidence is not that test.

The locked reward is one free cookie, no purchase required, at either location
through January 3, 2027 during that location's confirmed operating hours. Keep
server-authoritative midnight eligibility, documented reconnect rules, single-use
five-digit codes and the counter sequence: Enter five digits → Check code → Redeem
cookie → Next guest. No purchase checkbox, receipt, per-guest login, location
picker or QR requirement is added.

## Existing evidence, with environment limits

- Prior local implementation/staging source suite: **184 passed**; local
  workerd/Miniflare: **86 passed**.
- Prior actual private cloud: **37 anonymous privacy checks**, **9 actual-site
  browser scenarios / 113 assertions**, and **41 API checks** passed. Real
  staff-app revocation and renewed sign-in passed. See the
  [cloud rehearsal record](../_features/new-year/staging/CLOUD_REHEARSAL.md).
- Approved private-delivery closeout: **23 focused local checks** and **103
  actual-cloud desktop Chromium assertions** passed. Simulation controls made
  no API requests and did not alter staging records or the event clock. See
  [private delivery](../_features/new-year/staging/PRIVATE_DELIVERY.md).
- Current candidate audit: **2 focused tests passed** — every baseline tracked
  file is byte-identical except one disabled include per visitor page; the
  production loader is disabled and has no DOM, storage or network effects.
- Current production preparation: **17 distinct focused local tests passed**
  (five preparation/schema/loader checks, nine production-route/auth checks and
  three website/service isolation checks). The new October-install test enables
  only an in-memory loader copy, verifies no immediate takeover, then crosses
  the trusted opening/closing times without a page refresh. Staff JWT tests use
  locally signed fixture keys and local SQLite; they are not real production
  Access or D1 checks. A test assertion initially used the wrong synchronous/
  asynchronous error helper; it was corrected and the database rejection check
  rerun successfully without changing the guarded migration behavior.
- At checkpoint `65b6f36`, production artifact preparation and the Wrangler
  4.142.0 **local dry run passed** (27.10 KiB Worker bundle). The artifact has seven real service files,
  no website snapshots, no cloud account/routes, unresolved production D1/AUD
  placeholders and `PRODUCTION_ENABLED=false`. No deployment occurred.
- Existing unattended opening, midnight, return, dismissal, failure and recovery
  test names/results are recorded in the
  [local checkpoint](../_features/new-year/docs/LOCAL_CHECKPOINT.md).

Those historical results do not establish production resource, DNS, Access or
device acceptance. Current focused integration, authentication and production
smoke results belong in the production delivery record. Do not rerun broad suites
without a relevant change or defect. No additional timed rehearsal is scheduled.

Reproduce the focused local checks from `_features/new-year`:

```sh
node --test tests/production-preparation.test.mjs tests/production-worker.test.mjs tests/integration-isolation.test.mjs
node production/prepare.mjs
```

The preparation command prints the fresh, ignored Wrangler configuration path.
A `wrangler deploy --dry-run --config <that-path>` validates the local bundle;
the dry run is not a release or production verification. See
[production setup](../_features/new-year/docs/CLOUD_RELEASE.md).

## Finite remaining release gates

Record result, environment, date and exact build SHA for each. Retain the existing
local/staging evidence and its limits. Unrun device/security/operational checks
remain pending; a working staff login alone does not complete event readiness.

### 1. Owner content and final website authorization

- [x] Assemble `release/2026-10-01` from the combined implementation and reconcile
  current main's ancestry/content without replacing approved website files.
- [x] Record explicit authorization for the isolated production promotion
  service, fresh central database, staff protection and only the necessary
  `celebrate.thesourboule.com` hostname. Paid changes still require approval.
- [x] Record the two production station assignments and 12-hour email-code policy.
- [ ] Incorporate upcoming owner menu/content edits, recheck current remote main
  for newer business changes, and record the final combined website SHA.
- [ ] Obtain explicit authorization to release that finalized website SHA and
  enable its scheduled loader. Keep the release PR draft and auto-merge off;
  no website publishing-branch or main-site DNS/routing change is authorized.

### 2. Production service verification

Use the production delivery record for the actual status of this bounded group:
production Worker/D1 bindings and environment marker; server-only secret; real
Access issuer/audience and exactly one active station for each approved identity;
public guest routes without tester restrictions; production HTTPS/cookies/CSP/
CORS and direct-origin defenses; real schedule and closed registration outside
its window; absence of staging clocks, records and preview assets. Every staff
verification/redemption endpoint remains protected. Do not manufacture live
eligibility or copy staging passes to obtain a production test result.

### 3. Dated redemption hours — before redemption opens

- [ ] Owner confirms January 1, 2 and 3, 2027 hours or closures for **each location**.
  Keep them unconfigured until supplied; do not infer regular hours or copy
  artificial staging windows. Closed days have no redemption window.
- [ ] Enter and independently verify the approved dated windows in Chicago/UTC,
  with the final cap `2027-01-04T06:00:00Z`. Missing hours do not block code
  integration or permanent staff login; they block redemption-window acceptance.

### 4. Physical devices and accessibility

- [ ] Test both **physical location iPhones**, real Safari/guest iPhone and Android
  behavior: numeric keyboard, code flow, saved pass, cookies/private mode,
  orientation/safe areas, foreground/background, screen lock, Wi-Fi/cellular loss,
  reconnect within/outside grace and multiple tabs.
- [ ] Verify VoiceOver/other required physical screen readers, focus management,
  text zoom, touch targets and Reduce Motion on actual devices. Desktop emulated
  viewport/reduced-motion tests are not physical-device passes.

### 5. Unverified security and operational acceptance

- [ ] Verify actual elapsed 12-hour session expiry,
  reauthentication, removed/revoked identities, wrong/expired JWT rejection,
  real JWKS rotation/outage and missing/multiple station assignments.
- [ ] Complete accepted burst/load and capacity tests, outage/retry handling,
  privacy-safe logging, tested backup restoration, retention operation and
  support/runbook ownership. Staging revocation is not session-expiry evidence.
- [ ] Owner confirms expected attendance/peak load, support owner, retention/
  cleanup and backup/restore policy. Do not invent retention dates or credentials.

### 6. Final integration and authorized website release

- [ ] Confirm all twelve pages retain approved seasonal hooks/designs and exactly
  one intended loader include. Verify menus, hours, prices, ordering URLs, forms,
  addresses and other business content against the current approved baseline.
- [ ] Complete appropriate source/build/security checks and `git diff --check`;
  retain exact results. Keep seasonal review flags and private review assets out
  of production. Confirm the recurring seasonal calendar remains approved.
- [ ] Carry forward focused event/persistence evidence for issuance, duplicate
  recovery, atomic cross-location redemption, audit/lost-response retry,
  no-purchase payload, wrong codes and expiry, alongside safe production smoke
  checks. Record which behaviors were isolated tests rather than live issuance.
- [ ] Verify automatic opening/arrival, descent, year change, same-page return,
  Continue dismissal, pass recovery and failure behavior against the final source
  and production configuration. October installation must not open early.
- [ ] As part of **that same October release**, configure the loader with the
  approved production endpoint, enable its real schedule and release the exact
  approved current website source through the existing production flow. Do not
  publish a staging export or create a separate New Year's Eve activation task.
- [ ] Verify deployed service and website versions match the approved release;
  confirm October's normal website remains visible, pass access is available,
  and the server reports the fixed December/January schedule. Record safe live
  smoke-check results and rollback versions without issuing simulated real passes.

The narrowly authorized promotion-service delivery may complete before website
publication. It does not enable the website takeover. After explicit finalized
website authorization, use the documented
[October activation command](../_features/new-year/production/ACTIVATION.md) in
the same release; it enables the real schedule without scheduling an immediate
takeover or a separate New Year's Eve launch. Until then, keep `main`, the live
website, its publishing configuration and the shipped loader state unchanged.

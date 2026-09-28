# October website release — New Year inclusion

Decision recorded September 27, 2026 (America/Chicago). The owner approved the
New Year's celebration and cookie promotion for inclusion in the **finalized
October website release**, not a separate launch. The experience, no-purchase
offer, eligibility/reconnect policy and five-digit staff flow are locked.

**Included in the release plan; local integration prepared. Not integrated into
the finalized release branch, not production-verified, and not authorized for
deployment.** No final October release SHA has been approved. Production remains
unchanged and both shipped loader copies remain `ENABLED=false`.

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
| Final October release candidate | Not yet assembled and approved; record its exact SHA before release |

The New Year checkpoint descends from the seasonal checkpoint, which directly
descends from the final redesign. It already carries both approved website
layers. Current remote `main`, redesign and seasonal branch heads match the table;
[seasonal PR #3](https://github.com/sourbagelman/sourboulesite/pull/3) remains open
and draft, targeting redesign. These are September 27 inspection results, not a
guarantee that branches will remain unchanged before release.

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
must use real server time and a separate production database. The planned service
origin is `https://celebrate.thesourboule.com`; it is a **production target awaiting
DNS/resource approval**, not a deployed or approved DNS record. The preparation
must not substitute either private staging hostname when production inputs are
missing.

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
- Production artifact preparation and the Wrangler 4.142.0 **local dry run
  passed** (27.10 KiB Worker bundle). The artifact has seven real service files,
  no website snapshots, no cloud account/routes, unresolved production D1/AUD
  placeholders and `PRODUCTION_ENABLED=false`. No deployment occurred.
- Existing unattended opening, midnight, return, dismissal, failure and recovery
  test names/results are recorded in the
  [local checkpoint](../_features/new-year/docs/LOCAL_CHECKPOINT.md).

These results do not mean production resources, public guest access, production
DNS, production holiday windows, physical phones, or production operations have
been verified. No additional timed rehearsal is scheduled by this checklist.

Reproduce the focused local checks from `_features/new-year`:

```sh
node --test tests/production-preparation.test.mjs tests/production-worker.test.mjs tests/integration-isolation.test.mjs
node production/prepare.mjs
```

The preparation command prints the fresh, ignored Wrangler configuration path.
A `wrangler deploy --dry-run --config <that-path>` validates the local bundle;
the dry run is not a release or production verification. See
[production setup](../_features/new-year/docs/CLOUD_RELEASE.md).

## Required release gates — pending unless explicitly recorded

All unchecked items remain required. Record result, environment, date and exact
release/build SHA for each; do not silently skip or mark an untested item passed.

### Owner inputs and approvals

- [ ] Confirm January 1, 2 and 3, 2027 hours or closures for **each location**.
  Keep them unconfigured until supplied; do not infer regular hours or copy
  artificial staging windows. Closed days have no redemption window.
- [ ] Approve the production account/resources, exact service hostname and DNS
  changes, and cost/usage proposal before creating or changing them. Existing
  staging approvals do not approve production resources, costs or DNS.
- [ ] Confirm production station identities and managers for the two designated
  iPhones, Access issuer/audience and sign-in/session/security policy. Staging
  identities and its 12-hour email-code policy are evidence, not automatic
  production authorization. Preserve mandatory account/organization security.
- [ ] Confirm expected attendance/peak load, support owner, retention/cleanup and
  backup/restore policy. Do not invent retention dates or production credentials.
- [ ] Approve the final combined October release SHA and scope, including service
  deployment and enabling the real scheduled loader, before production changes.

### Production setup and isolation

- [ ] Provision the separately authorized production Worker, fresh D1 and
  environment marker; inspect IDs/bindings to ensure no staging database reuse.
- [ ] Apply reviewed fresh schema and production environment migration; configure
  a new server-only secret through secure tooling, real Access settings and the
  approved exact website/service origins. Commit no secrets or generated sessions.
- [ ] Create the protected staff routes/app and verify one backend-fixed station
  for each actual signed identity. Keep the public guest page/API outside the
  tester-only Access policy while protecting every staff endpoint.
- [ ] Enter and independently verify all owner-confirmed dated redemption windows
  in America/Chicago/UTC, with the final cap `2027-01-04T06:00:00Z`.
- [ ] Inspect the production bundle/assets and website artifact for no staging
  anchors, preview controls, fixture records, tester restriction or auth bypass.
  Disable alternate public Worker/preview origins; verify direct-origin defenses.
- [ ] Verify actual production HTTPS, Secure/HttpOnly cookies, CSP, CORS, iframe
  embedding and pass recovery with the intended production hostnames.

### Behavior, devices, security and operations

- [ ] Revalidate the real guest/staff path: persistent issuance, duplicate-claim
  recovery, cross-location atomic single-use redemption and audit, lost-response
  retry, no-purchase payload, wrong-code handling, expiry and approved closures.
  Do not manufacture production eligibility or copy staging records for tests;
  use isolated evidence plus safe production smoke checks and record their limits.
- [ ] Verify automatic opening, active arrival, final-minute descent, year change,
  12:05 same-page return, tab-session Continue, earned-pass recovery and service
  failure behavior against the final integrated source and production config.
  An October installation must not open the takeover immediately.
- [ ] Test both **physical location iPhones**, real Safari/guest iPhone and Android
  behavior: numeric keyboard, code flow, saved pass, cookies/private mode,
  orientation/safe areas, foreground/background, screen lock, Wi-Fi/cellular loss,
  reconnect within/outside grace and multiple tabs.
- [ ] Verify VoiceOver/other required physical screen readers, focus management,
  text zoom, touch targets and Reduce Motion on actual devices. Desktop emulated
  viewport/reduced-motion tests are not physical-device passes.
- [ ] Verify actual elapsed 12-hour session expiry if that duration is approved,
  reauthentication, removed/revoked identities, wrong/expired JWT rejection,
  real JWKS rotation/outage and missing/multiple station assignments.
- [ ] Complete accepted burst/load and capacity tests, outage/retry handling,
  privacy-safe logging, tested backup restoration, retention operation and
  support/runbook ownership. Staging revocation is not session-expiry evidence.

### Final integration and authorized release sequence

- [ ] Re-read remote `main`, redesign, seasonal and integration heads; select and
  record the final combined candidate and previous production SHA. Preserve newer
  approved website edits; resolve integration additively without old snapshots.
- [ ] Confirm all twelve pages retain approved seasonal hooks/designs and exactly
  one intended loader include. Verify menus, hours, prices, ordering URLs, forms,
  addresses and other business content against the current approved baseline.
- [ ] Complete appropriate source/build/security checks and `git diff --check`;
  retain exact results. Keep seasonal review flags and private review assets out
  of production. Confirm the recurring seasonal calendar remains approved.
- [ ] After explicit finalized October release authorization and required
  cost/DNS approvals, deploy the production service, database configuration and
  protected staff setup; verify health, public guest access and staff protection.
- [ ] As part of **that same October release**, configure the loader with the
  approved production endpoint, enable its real schedule and release the exact
  approved current website source through the existing production flow. Do not
  publish a staging export or create a separate New Year's Eve activation task.
- [ ] Verify deployed service and website versions match the approved release;
  confirm October's normal website remains visible, pass access is available,
  and the server reports the fixed December/January schedule. Record safe live
  smoke-check results and rollback versions without issuing simulated real passes.

Until those gates and authorizations are satisfied, keep `main`, production DNS,
production resources and the live website untouched. Keep the shipped loader
disabled. Inclusion in this plan is not permission to push, merge or deploy.

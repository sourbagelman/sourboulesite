# October 1, 2026 combined website release candidate

Updated September 29, 2026 (America/Chicago). The owner approved
**one October 1 release candidate** containing the final redesign, all approved
automatic seasonal themes, the complete New Year's celebration and no-purchase
cookie promotion, and the permanent protected employee verification/redemption
page. The experience, offer, eligibility/reconnect policy and five-digit staff
flow are locked. The final Fort Worth and Willow Bend menu edits remain to be
incorporated before the exact website version is approved.

The combined implementation is on **`release/2026-10-01`**, including current
`main` ancestry. The owner authorized pushing that non-production branch and
updating the existing [draft PR #4](https://github.com/sourbagelman/sourboulesite/pull/4)
to `main`, after verifying neither action publishes the website. The owner
separately authorized the isolated production promotion
service at `celebrate.thesourboule.com`. Neither approval authorizes merging,
auto-merge, changing the website publishing branch, or publishing the main site.

**The candidate is prepared for publication; it has not been published or armed.**
The target is **September 30, 2026 at 11:59 PM America/Chicago**, equivalent to
**October 1 at `04:59:00Z`**. This website-publication target is distinct from the
New Year's midnight celebration. The current release SHA, prepared hosted
mechanism, control-only bootstrap, test results and exact arming/cancellation
procedure belong in [release publication](release-publication.md). GitHub queue
and Pages propagation limits are recorded there; the target is not a guarantee
of simultaneous global visibility.

The generated release artifact `assets/js/new-year-2027.js` is now enabled for
the real server-timed schedule. Its reference source remains disabled, and the
live main website remains unchanged. Default rebuilding preserves the artifact's
existing mode; an explicit publication guard prevents a menu/build step from
silently shipping a disabled or staging loader. No publication or arming occurred
on September 29, and no local Codex automation was scheduled.

The permanent service's September 27 production versions and actual endpoint/
authentication results remain in the
[production delivery record](../_features/new-year/production/DELIVERY.md).
Do not promote unrun security, device or live reward checks into passed results.

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
| Combined release branch | `release/2026-10-01`, existing draft PR #4; current publication candidate and control bootstrap in [release publication](release-publication.md) |
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

The New Year additions to the twelve business pages remain one loader include
each; the generated artifact now carries the enabled production schedule.
Existing menus, prices, hours, addresses, ordering links, forms,
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
`alexis@thesourboule.com` to Fort Worth; both actual backend assignments were
verified against authenticated manager identities in the September 27 delivery. Both use this one central production
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
- September 27 candidate audit: **2 focused tests passed** at the then-disabled
  checkpoint — every baseline tracked file was byte-identical except one loader
  include per visitor page. This historical result does not describe the now-enabled
  generated release artifact.
- September 27 production preparation: **17 distinct focused local tests passed**
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
- September 27 permanent-service delivery: **45 focused local checks** and
  **45 actual-cloud desktop Chromium assertions passed**, including both protected
  manager identities and correct fixed stations. Production had no entries,
  passes, presence, redemptions or holiday windows; no positive live rewards were
  manufactured. This is historical evidence, not a claim those suites ran today.
- September 29 activation/build work: **16 focused local checks passed**. The
  generated release artifact is enabled, default rebuilding preserves its mode,
  and release validation prevents silent disabled/staging output.
- September 29 endpoint smoke check: **four read-only requests** confirmed the
  guest/pass and server-time paths return 200 with live pre-event state, and the
  anonymous staff page redirects to Access. No records or configuration changed.
- Hosted scheduler verification results belong only in
  [release publication](release-publication.md); they are not inferred from local
  tests or an unarmed workflow file.
- Existing unattended opening, midnight, return, dismissal, failure and recovery
  test names/results are recorded in the
  [local checkpoint](../_features/new-year/docs/LOCAL_CHECKPOINT.md).

Each result retains its original date and environment. The September 27
production delivery record supplies the actual service acceptance evidence;
neither local nor cloud desktop tests establish physical-device acceptance.
Current hosted-publication evidence belongs in release publication. Do not rerun
broad suites without a relevant change or defect. No additional timed rehearsal
is scheduled.

Reproduce the focused local checks from `_features/new-year`:

```sh
node --test tests/production-preparation.test.mjs tests/production-worker.test.mjs tests/integration-isolation.test.mjs
node production/prepare.mjs
```

The preparation command prints the fresh, ignored Wrangler configuration path.
A `wrangler deploy --dry-run --config <that-path>` validates the local bundle;
the dry run is not a release or production verification. See
[production setup](../_features/new-year/docs/CLOUD_RELEASE.md).

## October website publication — finite remaining gates

The October website and later New Year event have different remaining checks.
Unconfigured holiday windows and unrun physical-device/security/operational
checks do **not** block the October menu integration or permanent employee login.
They remain required event-readiness work and are listed separately below.

- [ ] Incorporate the owner's final **Fort Worth and Willow Bend menus** on this
  same branch/PR. Preserve approved design, prices/content outside those edits,
  seasonal hooks, hours, addresses, ordering URLs, forms and the production loader.
- [ ] Review the final content diff, perform the focused artifact/content checks,
  recheck current main for newer business edits, and obtain owner approval of the
  **exact final candidate SHA**. Preserve the enabled generated loader through
  the final build; do not publish an older review export.
- [ ] Obtain explicit authorization to **arm the hosted publication** for
  September 30 at 11:59 PM Chicago. That approval must include installing the
  reviewed control-only bootstrap on main and locking the approved candidate,
  while leaving main's public website bytes unchanged until the target. Follow
  [release publication](release-publication.md), including its bootstrap checks
  and cancellation steps. The publishing job uses only narrowly scoped
  `GITHUB_TOKEN` permissions (`contents: write` and `pages: write` only in the
  publishing job); no PAT or new secret is needed. No main merge,
  publishing-branch change, DNS change or premature website publication is implied.
- [ ] After authorized publication, the hosted controller verifies the exact
  Pages commit and performs automatic website/service smoke checks. Confirm the
  normal October website remains visible and retain the rollback version. A ref
  update, successful API request or local dry run alone is not publication proof.

The mechanism is prepared and disarmed until that explicit approval. No local
Mac/Codex process must remain awake for the hosted mechanism. Updating PR #4 or
pushing the non-production release branch does not arm it.

## Later New Year event readiness — pending, separate from October publication

### Confirm dated redemption hours before redemption opens

- [ ] Owner confirms January 1, 2 and 3, 2027 hours or closures for each location.
  Do not infer ordinary website hours or copy artificial staging windows.
- [ ] Enter and independently verify the dated Chicago/UTC windows and the final
  `2027-01-04T06:00:00Z` cap. Unconfigured windows remain closed; permanent staff
  login remains available.

### Complete actual device and accessibility checks

- [ ] Both physical location iPhones and guest iPhone/Android: numeric code flow,
  saved pass, cookies/private mode, orientation/safe areas, foreground/background,
  screen lock, Wi-Fi/cellular loss, reconnect inside/outside grace and multiple tabs.
- [ ] Actual VoiceOver/required screen readers, focus management, text zoom, touch
  targets and Reduce Motion. Desktop Chromium/emulation is not a physical-device pass.

### Complete remaining security and operational acceptance

- [ ] Actual elapsed 12-hour expiry/renewal, real JWKS rotation/outage, and remaining
  identity revocation/wrong/missing/multiple-assignment cases. Keep completed local,
  staging and production checks distinct by environment.
- [ ] Approved attendance/peak-load target, accepted capacity/outage checks,
  support ownership, privacy-safe logging, retention/cleanup, backup/restore
  policy and a tested restore. Do not invent policies, dates or credentials.
- [ ] Carry forward final-source evidence for persistent issuance, duplicate-pass
  recovery, atomic cross-location redemption/audit, lost-response retry, no-purchase
  payload, wrong codes and expiry. No synthetic live eligibility or production
  passes are created merely to obtain a test result.

These pending checks do not reopen the approved experience, offer, eligibility or
staff flow. The real schedule will be installed with the approved October website;
there is no separate New Year's Eve website release or manual activation task.

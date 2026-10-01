# CODEX HANDOFF: The Sour Boule New Year's Eve celebration

## Current delivery: one October 1 release candidate and permanent service

The owner has locked the approved celebration and requires **one October 1, 2026
release candidate**: final website redesign, automatic seasonal themes, complete
countdown/no-purchase promotion, and permanent protected employee verification
and redemption. This is an implementation delivery, not another planning phase.
The current
[October release checklist](../../docs/october-release-checklist.md) records the
candidate lineage, preservation audit, real schedule and finite remaining gates.
The September 29 update keeps the same `release/2026-10-01` and
[draft PR #4](https://github.com/sourbagelman/sourboulesite/pull/4). The requested
website-publication target is **September 30, 2026 at 11:59 PM America/Chicago**
(**October 1 at `04:59:00Z`**), distinct from the New Year countdown schedule.
[Release publication](../../docs/release-publication.md) is the current record
for the prepared hosted mechanism, bootstrap, exact candidate, tests and
arming/cancellation procedure. It is prepared, not armed; no publication or
arming occurred on September 29 and no local Codex automation was scheduled.

The approved private-delivery checkpoint is
`651a435e8ef840eac5b0d84f73a86a7131a092a8` on
`feature/new-year-cookie-promotion`. Its descendant `65b6f36` and the approved
redesign/seasonal baseline are now combined in `release/2026-10-01`. Merge
`78528e600ab476fd688b3ceb26628f191413eb85` records current main `6d7ba10` as a parent
with the combined tree unchanged: main's business updates were already manually
reconciled in `87c8a5d`. Reapplying the historical redesign rollback would lose
approved work. The audit confirmed identical full menu bodies and 97 prices,
the same location ordering destinations and form contracts, correct hours and
unchanged postal addresses/phones. Upcoming owner edits must be incorporated
additively before release; never restore older page snapshots.

The feature includes the real Worker/D1 configuration,
public guest/pass recovery, protected fixed-station staff pages/API and scheduled
website loader. Private simulation/tester restrictions, artificial clocks and
test records are excluded from production.

The owner authorized pushing the non-production release branch and opening a
draft PR after checking they cannot publish the website. The owner also
authorized only the isolated permanent promotion service, fresh central D1,
protected staff application and necessary `celebrate.thesourboule.com` hostname
in Cloudflare account `c84d6dc733d90811006e8d8837dcd1c3`, without new expected
charges or paid services. Fresh production D1
`1d1e7a58-44d6-4ea7-a114-b05ad3d9b377` has its schema applied; separate staff
Access app `63f1c1ce-a257-4a4a-9212-8c246b7c7ee8` uses the approved 12-hour email
one-time-code policy. Lance (`lance@thesourboule.com`) is assigned Willow Bend;
Alexis (`alexis@thesourboule.com`) is assigned Fort Worth. Preserve mandatory
organization/account security. Never put either tester restriction on production
guest routes or add a staff location picker.

**Integrated into the release candidate, production-verified, and authorized to
publish the main website are separate states.** Current candidate/publication
details are in release publication. The September 27 delivered service versions
and actual endpoint/authentication results remain in
[production/DELIVERY.md](production/DELIVERY.md). Treat no endpoint as
verified merely because its URL or configuration exists. The isolated service
approval does not authorize main changes, merge/auto-merge, website publication,
publishing-branch changes or main-site DNS/routing changes.

The generated release artifact `assets/js/new-year-2027.js` now has its production
schedule enabled. The reference source stays disabled and the live main website
is unchanged. Default rebuilding preserves the generated artifact's mode, and
release validation prevents later menu/build work from silently disabling it or
substituting a staging endpoint. The prepared artifact follows the real
server-timed schedule: December 31, 2026 at 11:50 PM Chicago opening, 11:59 PM
descent, January 1 midnight 2027/fireworks, and 12:05 AM return. Installing in
October does not open the takeover then, and requires no manual New Year's Eve
activation. Approved design, no-purchase terms and eligibility are not reopened.
See [production/ACTIVATION.md](production/ACTIVATION.md) for the artifact build
controls. An enabled candidate artifact is not a published or armed website.

Permanent URLs (actual verification is recorded in the production delivery):

- [Employee login](https://celebrate.thesourboule.com/staff/): protected fixed
  station, Enter five digits → Check code → Redeem cookie → Next guest.
- [Public guest / saved pass](https://celebrate.thesourboule.com/?pass=1): real
  API-backed recovery and fixed schedule; registration stays closed outside its
  approved window.
- [Combined website preview — PRIVATE, TEST ONLY](https://nye-staging.thesourboule.com/):
  existing approved site/theme review; not the production website artifact.

The finite **October publication** gates are the owner's final Fort Worth and
Willow Bend menus, focused final content/artifact verification and approval of
an exact candidate SHA, then explicit authorization to install the control-only
main bootstrap and arm the hosted publication. Only the publishing job receives
the needed `contents: write` and `pages: write` permissions on its default
`GITHUB_TOKEN`, with no PAT/new secret.
Automatic post-publication checks must verify the exact Pages commit and current
website/service. Details and actual scheduler results belong in release publication;
an unarmed workflow or local test is not proof of an armed or successful release.

The permanent service's **September 27** delivery retains its 45 focused local
checks and 45 actual-cloud desktop Chromium assertions. **September 29** adds
16 focused local activation/build checks and four read-only endpoint checks:
guest/pass and live pre-event server-time responses returned 200; anonymous staff
access redirected to Access. No record or cloud configuration changed.

Holiday windows, physical devices/accessibility and outstanding event security/
operational acceptance remain **later New Year readiness checks**, not October
menu/publication or permanent-login blockers. January 1–3 hours remain unconfigured
until owner confirmation, and redemption stays closed without approved windows.
Desktop browser automation does not establish physical-iPhone, elapsed 12-hour
expiry, JWKS rotation/outage, load or backup/restore results.

## Completed private delivery retained

The deployed private review links, simulation controls, verification results and
pending release checks are in [staging/PRIVATE_DELIVERY.md](staging/PRIVATE_DELIVERY.md).
The visual preview works at any time without changing the server event clock.
Real API-backed guest and fixed-station staff pages remain separate. That record
describes the private checkpoint, not the later authorized permanent service.
The main website and its loader state remain unchanged. No further timed
rehearsal is scheduled.

The original package handoff below records the Revision 4 design and offer lock.
Its original statements about deployment/local-only status describe the package
at delivery; the current combined-candidate decision and production delivery
record supersede those statements. Holiday hours and unresolved production
inputs remain explicit gates, not guessed configuration or reasons to postpone
the completed code integration and employee login.

## Original Revision 4 package handoff

Delivery date: September 27, 2026 / Revision 4 (final no-purchase lock)

**This package supersedes revisions 1, 2 and 3, including the earlier Final package. The approved experience and no-purchase offer are locked; release authorization is still separate.**

## 1. Start here: scope and release prohibition

This is an isolated New Year's countdown/cookie promotion project. The Sour Boule's
seasonal website themes were approved in another conversation. They must not be
redesigned, inferred from this preview, or modified as part of this task.

**Do not deploy to the live website. Coordinate live implementation with the
October website update, and obtain explicit release approval first.**

This package has a working offline experience preview and a locally tested backend
prototype. It is NOT a deployed promotion. Never describe the production reward
system as functional before persistent cloud storage, real eligibility, and
protected redemption have been verified end to end.

No existing repository files were changed and no new repository branch or PR was
created. No Cloudflare resources, DNS records, staff identities, or real passes
were created. The package contains no production credentials.

## Revision 4: final offer change - no purchase required

The owner removed the purchase requirement entirely. A qualifying visitor receives
**one free cookie, no purchase required**. Do not require a purchase of any amount,
order details, a receipt, or a staff purchase attestation. Midnight eligibility,
one single-use five-digit code per entry, either location, and the January 3, 2027
operating-hours deadline are unchanged. This is still an earned cookie pass, not
a public giveaway to anyone who supplies a name or a code without eligibility.

Updated: registration and registered-state terms; on-screen and saved-image passes;
shared staff UI; the staff request payload; the backend redemption check; regression
tests; preview; and implementation documentation. The backend now redeems using
code + requestId under the protected station identity. No new database migration
is needed for this change; no purchase column existed. No cloud data was changed.

The 2026 -> 2027 transition, ball, fireworks, colors, schedule, presence policy,
central single-use redemption, and seasonal isolation remain unchanged. Do not
reintroduce purchase conditions from any earlier preview or handoff. Existing
cloud setup and release checks still apply; nothing is deployed.

## Revision 3: final year transition and design lock (historical)

The prominent takeover year is **2026 before midnight, switching to 2027 at
midnight** (January 1, 2027, 00:00 America/Chicago). It stays ivory, in its existing
position. Switch it on the same frame/phase as the Happy New Year message and
fireworks, using the existing server-anchored event clock, not the device calendar.
A page opened or resumed after midnight must immediately show 2027; opening/final-
minute preview controls must show 2026. The final-second display remains 2026 until
the exact midnight boundary. Reduced motion does not delay or disable the change.

The final year-change request was interpreted as 2026 -> 2027 and stated
explicitly to the owner. With that adjustment, the experience/design and
five-digit staff flow are locked. Do not redesign, alter offer
terms, or change the approved seasonal work. This is NOT approval to deploy. All
cloud, device, holiday-hours and release checks below remain required.

At revision 3, only the year display, focused regression tests, regenerated
preview and handoff changed. Revision 4 above subsequently removes the purchase
condition; the prior visual changes are retained. Preview passes remain simulated.

## Revision 2: owner-approved simplification

Use a five-digit numerical code. One shared iPhone at Fort Worth and one at Willow
Bend stay on the staff page. A manager signs each phone in and assigns its station
identity before service. The counter flow is **enter five digits -> Check code ->
Redeem cookie -> Next guest**. No location picker, account lookup, QR scan, name
search, or purchase checkbox. Under the final revision 4 offer, no purchase is
required and Redeem only records the cookie redemption. Do not reintroduce the
longer pass code, purchase attestation, or a per-customer staff sign-in.

The palette is retained. The sphere now uses projected curved crystal facets,
LED-style points, slow moving highlights and bloom. Fireworks now have launch
trails, dense gold/silver shells, willow embers and a 32-second staggered sequence
with a fuller finale. Respect reduced motion; no sound or full-screen flashes.

This revision includes schema changes for **a fresh, not-yet-provisioned database**.
Do not run CREATE IF NOT EXISTS against a populated v1 database and call it an
upgrade. No real v1 passes were issued by this project. The local harness uses
`.local/nye-v2.sqlite` to avoid quietly opening a v1 test database. Any unexpected
existing production data requires an explicit, reviewed migration before use.

## 2. Approved brief: do not re-negotiate these terms

Timezone: `America/Chicago`, for Fort Worth, Texas.

| Local time | UTC instant | Experience |
| --- | --- | --- |
| Dec 31, 2026, 11:50 PM | 2027-01-01T05:50:00.000Z | Begin fullscreen takeover |
| Dec 31, 2026, 11:59 PM | 2027-01-01T05:59:00.000Z | Ball starts its one-minute descent |
| Jan 1, 2027, midnight | 2027-01-01T06:00:00.000Z | Fireworks and Happy New Year |
| Jan 1, 2027, 12:05 AM | 2027-01-01T06:05:00.000Z | Remove takeover; reveal existing website/theme |

The takeover is active on the half-open interval `[start, end)`. Keep a Continue
to the website option available. Support reduced motion and mobile layouts. Put
the current celebration year prominently near the top in ivory or slate, NOT
gold: 2026 before midnight, then 2027 at midnight. Gold may decorate fireworks
and other accents. The visual preview retains the ivory year and slate/navy.

Approved offer wording, reproduced exactly:

> Ring in the New Year with us! Enter your name and stay until midnight to unlock one free cookie. No purchase required. Redeem at either Sour Boule location through January 3, 2027.

Guest entry: first name and Count me in. No guest account or email. A qualifying
guest must be present on the countdown page at midnight. Issue one unique,
single-use cookie pass. Allow an image save or screenshot, and keep the pass
accessible after the takeover. Staff at either location must verify and redeem
through one centrally updated, protected system. A name is not a unique identity.

## 3. Actual site inspection, and backend choice

Inspected connected GitHub repository: `sourbagelman/sourboulesite`, branch `main`.
Observed HEAD: `6d7ba10f370727f86d63a7e2d285152e23790f45`.
Repository metadata reported `has_pages: true`. The `CNAME` file contains
`thesourboule.com`. The complete inspected tree contains static HTML, shared
CSS/JS, images, sitemap and robots files, with no server/database configuration.
`brand-home.html` was inspected for current site structure. Live HTTP/DNS routing
could not be independently confirmed with the available network path; verify it
before configuring any custom domain. Do not infer that the website has a DB.

Chosen implementation target: a NEW Cloudflare Worker with static assets + a NEW
D1 database + Cloudflare Access for staff. Leave the existing static site in place.
Suggested service hostname is `celebrate.thesourboule.com`; it is a proposal, not a
created hostname. Keep its database and security configuration separate from unrelated projects.

The main site gets a small additive loader. During the event, it opens the service
in a full-viewport dialog/iframe over the current page. Closing removes only that
isolated layer, revealing the actual current page and already-approved theme.

Staff pages and APIs live on the service origin and use Cloudflare Access JWTs,
plus explicit active station identities with exactly ONE assigned location each in D1. Both locations write the
same passes table. There is no Square integration in this prototype. No purchase
or receipt check is required; staff verify the earned pass and record redemption.

## 4. Completed source and artifacts

- `Sour-Boule-New-Year-Preview.html`: self-contained offline preview, no API calls.
  Controls cover opening, final minute, last 10 seconds, midnight, sample reward,
  12:05 return, staff simulation, connection loss, reset. It can save a watermarked
  PNG sample pass. Browser-local simulation data is clearly separate from live data.
- `public/assets/view.js` and `nye.css`: shared responsive visual presentation,
  projected crystal-facet ball, final-minute descent, layered canvas fireworks, ivory year,
  registered/pending/pass/ended states, reduced motion, labeled forms and optional
  screen wake lock. No third-party fonts or assets.
- `public/assets/guest.js`: production-facing same-origin API adapter. Uses server
  time with monotonic display interpolation and response-latency adjustment. No
  simulated reward adapter or client time override in this entrypoint.
- `public/staff/`, `staff.js`, and shared `staff-ui.js`: real API-backed five-digit
  verification, fixed station badge, one-tap no-purchase redemption and
  Next guest. The same staff UI is used by the simulated preview and real adapter. Local
  sign-in exists only in `scripts/local-server.mjs`; production uses Access.
- `src/passes.mjs`: persistent 10000-99999 allocation with collision handling,
  unique constraints, idempotent entry recovery and atomic free-gap fallback.
- `src/worker.mjs`: server receipt-time eligibility, persistence, idempotent issuance,
  guarded redemption, rate limits, input checks, same-origin write protection,
  fail-closed errors, protected staff reads/writes and no-store API responses.
- `src/auth.mjs`: narrow RS256 Cloudflare Access JWT verification with issuer,
  audience, expiry, signature, active staff identity and trusted JWKS checks.
  It uses Web Crypto. Real Cloudflare key rotation/integration remains untested;
  review before release, or replace with a pinned, maintained JOSE library after
  preserving and expanding the negative authentication tests.
- `migrations/0001_initial.sql`: D1 schema, unique session/campaign entry, unique
  pass/entry and (campaign, short_code), location assignments, opening windows, persistent
  presence records, and transactional append-only redemption auditing.
- `scripts/local-server.mjs` / `sqlite-adapter.mjs`: loopback-only persistent local
  lab executing the same business handler and SQL. Local clock and staff controls
  are not in the production Worker. Lab files are not deployment assets.
- `src/integration-loader.js`: additive integration reference, `ENABLED=false`.
  Shadow-root styles + native modal dialog isolate it from site/theme CSS. It
  preserves the original DOM and restores focus, checks message origin/source,
  and provides a pass-recovery link. This loader is NOT yet site-integrated or
  browser-tested against a real cross-origin Cloudflare deployment.
- `tests/`, `scripts/ui-check.py`, `scripts/year-check.py`, `scripts/e2e-local-check.py`, `qa/`: tests,
  verification records and representative screenshots. Read TEST_REPORT for the
  exact scope; do not convert local results into a production PASS claim.

## 5. Concrete eligibility policy implemented for review

Registration currently opens with the takeover at 11:50 PM and closes exactly at
midnight. This is an implementation default within the approved experience, not
an additional reward term. Do not silently add an earlier guest registration flow.

The browser creates a server-issued anonymous session and submits a first name.
The server uses its own clock for all entry and presence timestamps. While the
countdown is visible, the client sends a heartbeat every five seconds. Visibility
change, pagehide, reconnect and pageshow handlers send or refresh relevant state.

A pass requires BOTH:

1. A server-received visible countdown heartbeat within the final 30 seconds
   before midnight: `[23:59:30, 00:00:00)` Chicago.
2. A server-received visible heartbeat from midnight through 90 seconds afterward:
   `[00:00:00, 00:01:30]` Chicago, using the same registered anonymous session.

A server-observed hidden/leave signal before midnight invalidates the pre-midnight
candidate. Returning visibly before midnight can establish a fresh candidate.
Only a qualifying post-midnight receipt latches eligibility. Registration or a
pre-midnight heartbeat alone does not qualify. After 90 seconds there is no new
eligibility based on an unverified client story or backdated client timestamp.

The post-midnight grace accommodates brief signal loss, browser scheduling delay,
and resumption. It is 90 seconds AFTER midnight, not a claim that the entire
unobserved gap is at most 90 seconds: the preceding observation can be up to 30
seconds before midnight. This is a deliberate benefit-of-the-doubt tradeoff.

The UI tells guests to keep the tab visible and phone unlocked. Wake lock is
optional and may fail or be released. Do not depend on background timers or mobile
browsers continuing work after screen lock. Explicit hidden signals disqualify
that candidate; lost signals cannot prove physical presence. A browser can lie
about visibility, and a script can send heartbeats. This is a reasonable low-value
promotion check, NOT proof of a human looking at a screen. Use one active countdown
tab; test multi-tab behavior before release.

Changing the phone clock cannot issue a pass: the Worker ignores client-selected
time, eligibility flags and preview parameters. All source dates are server-owned.
The only controllable clock is in the LOCAL, loopback-only harness.

## 6. Data, integrity, and staff flow

Session: 256-bit random bearer cookie, `__Host-sb_nye`, Secure, HttpOnly, SameSite=Lax,
Path=/, no Domain attribute. D1 stores only its hash. The service owns its cookie;
the existing website does not need a database or private guest storage.

Entry: `(campaign, session_id)` UNIQUE. Name is display data only. The browser
bootstraps its session once before registration, and disables repeat submit while
joining. A race before a brand-new browser receives any cookie and deliberate
cookie clearing cannot be made into reliable person-level deduplication.

Pass: one per entry; private UUID internally; a five-digit **10000-99999** code for
staff entry. That is 90,000 possible real codes, with no leading-zero ambiguity.
The code is stored as text in the private passes table and is UNIQUE per campaign.
It is NOT a cryptographic bearer token or a guest sign-in credential. Guest recovery
still requires the long HttpOnly session cookie. There is no public code-search or
code-recovery endpoint. Never move staff code verification to an anonymous API.

Random allocation uses Web Crypto with rejection sampling. A duplicate code retries;
a rare 12-collision case falls back to a single-statement free-gap allocation. An
entry uniqueness constraint handles simultaneous issuance. Recovery returns the
persisted winning code, not a new random one. Used and expired codes remain reserved
for the campaign; never delete/recycle them during promotion/support. Full capacity
fails closed while preserving eligibility. Do not silently expand the code format.

The **0xxxx** range is reserved for simulations, with sample code **04271**. It is
rejected by the real API and database constraint. Saved samples remain visibly
TEST ONLY. Do not seed demo codes or names into the real database.

Short codes are guessable in principle. Staff authentication, per-station request
limits and an 8-incorrect-code/minute lockout reduce exposure; they do not establish
person-level uniqueness. A signed-in staff user can still attempt guesses. Codes
must not be logged in analytics, URLs, request-body logs or public error telemetry.

If presence was persisted but issuing/returning the pass failed, a later state
request can complete issuance using the recorded eligibility. It cannot invent
missing presence. Issued passes remain retrievable from the same service session
via `/?pass=1` after the takeover. Session recovery is available until Jan 11 in
the current config, while actual redemption still expires earlier. Lost cookies
plus no saved pass cannot be recovered from a name alone.

Staff procedure: manager signs each designated iPhone into its approved station
identity before service. Provision one active identity for Fort Worth and another
for Willow Bend, each with exactly one staff_locations row. Employee enters the
five digits, taps Check code, and sees the guest first name plus availability.
Only a valid, unused pass in the station's open window offers Redeem cookie. Tap
Redeem cookie, wait for confirmation, hand over one cookie, then tap Next guest.
No purchase required. No purchase checkbox, receipt check, or location selector.

The backend derives the station from the approved identity, not a client-selected
location. Missing or multiple assignments fail closed. The audit records that
station identity, not which employee happened to hold the shared iPhone. It does
not independently prove the identity or physical location of the hardware.

Configure a shift-length Access session (proposed 12 hours) before rehearsal. The
manager handles sign-in on each phone; staff should not authenticate for every
cookie. Sessions are not permanent. At expiry, revocation, cookie loss or restart,
show a manager sign-in requirement, never bypass authentication. Test real Safari
session behavior before release. Retain worker JWT verification as well as Access.

The redeem action uses one conditional SQL UPDATE, requiring unused state, valid
expiry, staff authorization, and a configured operating-hours window. The audit
trigger commits with that update. A second simultaneous location cannot succeed.
Each submit has an idempotency key. A response-loss retry reports prior confirmation
without authorizing another cookie. An offline screenshot is never enough to mark
redemption valid; there is no offline redemption queue or guest-side Redeem button.

Global latest expiry is `2027-01-04T06:00:00Z` (end of Jan 3 Chicago). Location-specific
opening windows constrain redemption earlier. Production windows are deliberately
EMPTY; tests/lab seed clearly labeled artificial windows outside the migration.

## 7. Still-required setup and decisions

The next owner input is actual January 1-3, 2027 operating hours/closures for both
locations. Do NOT infer holiday hours from the September website or this lab.
Keep these centrally configured as event data, not embedded in countdown CSS/JS.
If holiday operating hours later change, update the central windows explicitly;
do not scrape hours from menu markup or overwrite the live site with a snapshot.

Before cloud verification: confirm the actual DNS/hosting path, the Cloudflare
account/zone to use, approved per-location station identities, and staging access. Create separate
staging and production resources only when authorized. Do not share secrets here.
Provision PASS_SECRET with the hosting secret mechanism, not source code or vars.
It protects rate-key salting; v2 codes are persisted, not derived from this secret.

No Wrangler dependency was downloaded/pinned in this offline build environment.
Pin the currently supported CLI and generate its lockfile during setup, review
`wrangler.toml`, create a NEW D1 database, insert the correct binding ID, apply the
migration, and configure Access issuer/audience. Protect BOTH `/staff*` and
`/api/staff/*`. Keep workers.dev/preview endpoints disabled or protected to prevent
an alternate staff-access path. Worker JWT verification must stay in place even
when the edge Access application is configured.

Do not copy the local SQLite DB, lab secrets, demo staff rows, or artificial
opening windows into staging/production. Production role creation requires the
actual verified Access subject and email for each station, not just a first name.
Assign exactly one location per station; no per-redemption location picker.

A staging rehearsal needs a separate, owner-protected deployment, separate data
and keys, and a SERVER-controlled test schedule/clock. The production entrypoint
must never expose a request/header/query time override. The supplied production
entrypoint has no such endpoint. Keep any staging clock harness outside the
production build allowlist and prove it cannot be reached on the production host.

Agree on peak expected attendance, test burst capacity, and tune rate limits
without treating a shared IP address as a person. Review backup/restore and a
retention cleanup policy before collecting real guest data. Proposed minimum:
keep only promotion-operational data, never add it to marketing lists, avoid raw
pass/name/request-body logs, then remove detailed guest/presence records after
support needs end while retaining minimal non-sensitive redemption accounting.
A scheduled retention purge is not yet implemented.

## 8. Website integration rules

Re-fetch CURRENT HEAD at implementation time. The inspected SHA is a reference,
not a base from which to restore pages. Never paste preview HTML over index,
brand-home, location, menu, contact, or other production pages.

Install the loader as a new versioned asset with a minimal additive script tag on
current visitor pages. Put pass recovery in the existing utility navigation; the
reference's appended link is a starting point, not approved final placement.
Never import seasonal CSS into this feature or edit seasonal scheduler logic.

The loader must keep working after menu/price/hours/link edits because it depends
only on its own service/time API and DOM host. Keep all event code/assets under a
dedicated namespace. No global `h1`, button, color or theme overrides on the main
site; presentation CSS is confined to the separate service document. Verify the
native dialog and focus trap with the cross-origin iframe, keyboard and screen
reader. Keep an escape path available even when iframe loading fails.

When the layer ends at 12:05, remove it instead of replacing the page, reloading an
old snapshot, or choosing a different seasonal design. A user who deliberately
continues to the website should not be forced back into the takeover on navigation
within the same origin/session. Earned pass recovery must remain independent of
whether the takeover is mounted.

## 9. Required release checks (not yet passed remotely)

- Real D1: migration, durable persistence across Worker revisions, guest session
  isolation, unique five-digit issuance, collision recovery, capacity handling,
  and simultaneous redemption from separate authenticated location phones.
- Access: real sign-in, approved roles/locations, expired/wrong-audience/forged JWT,
  removed staff, JWKS rotation/unavailability, direct-origin and alternate-host paths.
- Native browsers: HTTPS Secure/HttpOnly cookie behavior, same-site subdomain iframe
  storage, CORS, CSP, navigation, pass recovery, reload and private-browsing failures.
  Test actual iPhone Safari and Android Chrome, not only desktop emulation.
- Presence: lock screen, switch apps/tabs, background suspension, brief Wi-Fi/cell
  interruption, pageshow/bfcache, reconnect before/after grace, multiple tabs, and
  late arrivals. Verify device-clock changes do not grant a pass.
- Time: all exact event boundaries, global expiry and each actual operating-hours
  closing boundary. No client-selected clocks in production.
- Staff: five-digit numeric keyboard, fixed location, changed code invalidating prior verify,
  single-tap redemption without purchase data, Next guest, manager sign-in/session expiry,
  concurrent locations, double tap, response-loss retry and clear failure messaging.
- Accessibility: keyboard modal focus, focus restoration, screen reader announcements,
  reduced motion, text zoom, 320px width, safe areas, orientation and readable saved
  pass. No rapid strobe flashes or autoplay audio.
- Performance and operations: expected midnight burst, D1/Worker limits, bounded
  retry backoff, outage behavior, logs without raw secrets, backup/restore, support
  messaging, and privacy/retention cleanup.
- Site regression: compare current menus, prices, hours, ordering URLs, location
  selection, seasonal assets/scheduler and normal theme before/after the additive
  patch. Verify no prior preview snapshot was copied to any live page.
- Build/release gate: all automated tests, dry-run the Worker build, exclude preview
  and local lab routes from production, confirm placeholder config is gone, obtain
  explicit October release approval, then and only then enable/integrate.

## 10. How to report progress back to the owner

Separate VISUAL PREVIEW, LOCAL BACKEND, CLOUD STAGING and LIVE RELEASE status.
Revision 4 local test results are recorded in `docs/TEST_REPORT.md` and `qa/`.
Real cloud and physical-phone checks remain NOT RUN.

Report tests actually run, exact setup still needed, files changed and known limits.
Never call the standalone sample pass a real cookie reward. Never call cloud
persistence, eligibility or redemption verified on the strength of local tests alone.

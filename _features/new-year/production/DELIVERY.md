# Permanent promotion service and October release candidate

Delivered September 27, 2026 (America/Chicago). The permanent production
promotion service is deployed and the two approved manager sessions have been
verified against it. The combined website remains an unpublished release
candidate. Its loader is disabled; website release authorization is still needed.

## Links and release identity

| URL | Purpose and verified status |
| --- | --- |
| [Permanent employee login](https://celebrate.thesourboule.com/staff/) | Deployed. Anonymous visitors reach Cloudflare Access email-code sign-in. Both approved manager sessions opened the real station and authenticated API. |
| [Permanent guest / saved pass](https://celebrate.thesourboule.com/?pass=1) | Deployed and public; no private tester gate. Real server schedule, existing-browser recovery, and registration closed before December 31 at 11:50 PM Central. |
| [Combined website PREVIEW — private, TEST ONLY](https://nye-staging.thesourboule.com/) | Existing authenticated review site containing the approved redesign and automatic seasonal implementation. Both manager sessions opened it. Its website HTML/seasonal source is unchanged by this delivery; the private banner is review-only. |
| [Celebration visual PREVIEW — TEST ONLY](https://nye-staging.thesourboule.com/new-year-preview/) | Existing clock-independent visual simulation; never a production guest or employee endpoint. Prior closeout evidence remains applicable. |

Pushed release branch: [`release/2026-10-01`](https://github.com/sourbagelman/sourboulesite/tree/release/2026-10-01).
Release implementation commit:
[`2d4619624dc03f8d10c12ba7db8a1ce80a0b898c`](https://github.com/sourbagelman/sourboulesite/commit/2d4619624dc03f8d10c12ba7db8a1ce80a0b898c).
[Draft release PR #4](https://github.com/sourbagelman/sourboulesite/pull/4) targets
`main`; verified OPEN/DRAFT with a clean merge state and auto-merge unset.
This subsequent documentation receipt does not change the implementation;
the PR displays the exact current branch head. Do not merge or enable auto-merge
until the owner approves the finalized website release.

After publication of the release branch, the latest production Pages build was
still `6d7ba10f370727f86d63a7e2d285152e23790f45`, status `built`, last updated
`2026-09-26T01:06:32Z`. No website deployment resulted from the release push/PR.

The candidate starts with combined checkpoint
`65b6f36a2edc0d12832e4a60f0fef10fdd43bee1`. Commit
`78528e600ab476fd688b3ceb26628f191413eb85` records current main
`6d7ba10f370727f86d63a7e2d285152e23790f45` as a merge parent without changing the
already-reconciled website tree. The exact menu/price/hour preservation audit and
how to incorporate upcoming owner content edits are in the
[combined October checklist](../../../docs/october-release-checklist.md).

## Actual production resources

- Account `c84d6dc733d90811006e8d8837dcd1c3`; zone
  `ccc24f503b6009cf857e445d232c0e5e`.
- Worker `sour-boule-nye-production`; deployed version
  `1cbea44c-7da8-4b1e-a737-2a7c0149eb5c`.
- Fresh central D1 `sour-boule-nye-production`, ID
  `1d1e7a58-44d6-4ea7-a114-b05ad3d9b377`. Both fixed stations share this database.
  Initial schema and production marker `sb-nye-2027-production` are applied.
- Fresh random `PASS_SECRET` provisioned directly as a server-side Worker
  secret. It is absent from Git, public assets, committed configuration and chat.
- Only `celebrate.thesourboule.com` was attached as a new Worker Custom Domain.
  Its HTTPS guest page and API work. Existing staging domain mappings and the
  main site's apex A records / `www` CNAME remain unchanged.
- Production staff Access application
  `63f1c1ce-a257-4a4a-9212-8c246b7c7ee8`; policy
  `092088e7-0b40-47f9-ab42-346d26c937f1`. Protects `/staff`, `/staff/*`,
  `/api/staff`, `/api/staff/*`; only the two approved emails may enter.
- `lance@thesourboule.com` → Willow Bend; `alexis@thesourboule.com` → Fort Worth.
  Verified Access subjects are active and have exactly one backend assignment.
  No per-guest login, station picker, purchase check or QR requirement.
- Application and policy sessions are 12 hours; email one-time PIN is the
  selected identity provider. Actual production tokens carry the production
  audience and 43,200-second lifetime. HTTP-only/secure path-scoped Access
  cookies and SameSite Lax are present. No global session or mandatory MFA policy
  was changed, and the policy's MFA override is off.
- `workers.dev` and version-preview URLs are disabled. Public deployment contains
  seven allowlisted real guest/staff files; no website snapshot, visual simulation,
  fake clock, private tester guest restriction or staging data was deployed.
- Existing Workers Free and Teams Free Base plans were verified before creation.
  No plan upgrade, paid add-on or new expected charge was accepted.

`resources.json` contains only non-secret deployment IDs. To reproduce the exact
resource configuration and allowlisted assets locally:

```sh
cd _features/new-year
node production/build-deployment.mjs
```

This prints an ignored `.local/production-build-*/wrangler.json` path. It does
not deploy, change DNS, mutate D1, read secrets or enable the website. The deployed
Worker/backend/public service source is unchanged from the approved combined
checkpoint; this delivery adds reproducible resource configuration and an
explicit later website activation command.

## Checks actually run for this delivery

**Focused local: 45 tests passed.** Forty selected existing tests exercised the
production Worker boundary (9), backend issuance/recovery/concurrent redemption
(16), signed-JWT authentication (8), no-purchase requirements (2), inert disabled
integration (1), and production preparation/October real-clock behavior (4).
Five new activation/deployment-build tests also passed. These use local SQLite,
fixture clocks and locally signed JWKS where required; they are not claims of
real production pass issuance or physical-phone operation. Test files/names:

- `production-worker.test.mjs`: all nine production boundary cases, including
  anonymous real time, pinned CORS, staging/missing-marker rejection, protected
  routes, wrong/expired/forged/staging-audience tokens, fixed station and recovery.
- Selected `backend.test.mjs` cases 01, 02, 09, 10, 18, 19, 25, 26, 28, 31, 33,
  36, 37, 39; concurrent first issuance; recovery after failed issuance/restart.
- `auth.test.mjs` cases 46–50 and 54, unavailable JWKS and removed identity.
- `no-purchase.test.mjs`: both no-purchase/copy cases.
- `integration-isolation.test.mjs`: disabled loader has no DOM/storage/network effects.
- `production-preparation.test.mjs`: empty schema, real bundle, guarded marker,
  and **enabling the real loader in October does not open early and later follows
  only server event time**.
- `release-activation.test.mjs`: exact flag/default disabled; gate-only change;
  refusal of changed endpoint/ambiguous gates; temporary CLI enable/disable.
- `production-deployment-build.test.mjs`: only approved production service,
  database, staff audience and hostname; no deployment or website changes.

**Actual deployed HTTPS routes:** public `/api/time` and `/?pass=1` returned 200;
time reported `mode: live`, `phase: before`, actual current server time and the
locked event instants. Anonymous `/staff/`, its JavaScript and canonical staff
API redirected to the production Access application. `/new-year-preview/`,
`/preview/` and unprotected `/assets/staff.js` returned 404. CORS permits only the
two real website origins, not private staging. Guest CSP permits framing only by
the real apex and `www` website origins.

**Actual deployed desktop Chromium: 45 assertions passed**, using the existing
real manager Access sessions (no fixture identities or authentication bypass):

- Public guest/pass and recovery session: 13 assertions, including live clock,
  exact schedule, early-registration rejection (409), ignored artificial date
  parameters, secure HTTP-only host session cookie, same cookie after reload,
  no fake reward/registration, no simulation labels and mobile viewport overflow.
- Lance/Willow Bend: 14 assertions; Alexis/Fort Worth: 14 assertions. Both real
  staff pages and `/staff/api/me` loaded; the correct station was fixed in D1;
  numeric input/no purchase gate/no selector were preserved; sample code `04271`
  and its redemption were rejected; an unissued code returned 404; requesting
  the other station returned 403. Actual cookies and production 12-hour JWT
  lifetime were verified without exposing tokens.
- Existing combined private website: 2 assertions for each manager, verifying
  authenticated access and its explicit preview banner.

Production D1 readback after these checks: **0 entries, 0 passes, 0 presence rows,
0 redemptions, 0 holiday windows, 2 active staff, 2 fixed assignments**. Normal
browser session/rate-limit records may exist from HTTPS smoke visits; no staging
record, simulated pass or manufactured production eligibility was inserted.
Positive issuance/recovery/concurrent redemption evidence is the focused local
tests and prior actual private-cloud tests, not a fabricated production pass.

The first CLI HTTPS probe timed out on this computer's IPv6 route; the bounded
IPv4 retry and real Chromium checks passed. No application fix or broad test-suite
rerun was needed. Browser reports/session profiles remain in ignored `.local`;
session data, private logs and local databases are not committed.

`git diff --check` passed. No existing website HTML, menus, hours, prices, forms,
ordering links, SEO, photos or seasonal files changed in this delivery. The only
website JavaScript diff is a comment identifying the now-provisioned production
hostname; both loader gates remain false. Before branch publication, GitHub Pages
was verified as legacy deployment from `main:/`, with only its dynamic Pages
workflow and no repository webhooks. A release-branch push/draft PR does not
publish the main website.

## Finite remaining launch gates

1. **Final website release decision:** incorporate upcoming owner business edits,
   reconcile any newer main changes, then approve the exact final website SHA.
   The release PR stays draft and auto-merge off. Only that authorization enables
   the production loader and publishes the website through its existing flow.
2. **Dated redemption hours:** confirm January 1–3, 2027 hours/closures for both
   locations and enter/verify Chicago-to-UTC windows. They remain unconfigured;
   missing hours do not block this integration or the working permanent login.
3. **Physical devices/accessibility:** both actual station iPhones, guest Safari/
   Android, numeric keypad, saved pass, private mode, screen lock, reconnect,
   VoiceOver, zoom and Reduce Motion remain unverified. Desktop Chromium mobile
   viewport checks are not physical-device passes.
4. **Security/operational acceptance:** actual elapsed 12-hour expiry, real JWKS
   rotation/outage, relevant production revocation/assignment failure checks,
   accepted load/capacity, outage recovery and a tested restore remain pending.
   Confirm expected peak attendance, responsible support owner, retention/cleanup
   and backup policy. Existing local/private-cloud results remain identified by
   environment; none of these unrun checks is marked passed.
5. **Authorized final-origin smoke check:** after publication, verify the exact
   website/service versions together and normal October visibility, scheduled
   polling, CORS/cookies and recovery. Do not create artificial production passes
   or alter the real clock to obtain a passing result.

The complete code and permanent promotion service are delivered; the combined
website is **not yet cleared for publication or event readiness**. The service
uses the real server schedule: December 31, 2026 11:50 PM opening, 11:59 PM descent,
January 1, 2027 midnight year change/fireworks, 12:05 AM return, all Chicago time.
Installing the authorized website release in October will not open the takeover.
Use [ACTIVATION.md](ACTIVATION.md) only for that finalized website release; no
manual New Year's Eve activation or separate feature launch is needed.

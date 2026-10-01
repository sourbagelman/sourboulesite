# Production service and the combined October website release

The owner authorized the isolated permanent promotion service and one combined
`release/2026-10-01` candidate containing the approved redesign, seasonal themes,
New Year promotion and protected employee app. The service is deployed and its
public and authenticated manager paths have been verified. **Publishing the main
website and enabling its loader remain unauthorized.** The
[combined checklist](../../../docs/october-release-checklist.md) records the
preservation audit and finite remaining gates. The
[production delivery record](../production/DELIVERY.md) records exact versions,
final candidate/PR and verification limits.

## Permanent service and actual verification

The deployed Worker is `sour-boule-nye-production`, version
`1cbea44c-7da8-4b1e-a737-2a7c0149eb5c`. Its only Custom Domain is
`celebrate.thesourboule.com`; workers.dev and version-preview access are disabled.
If a later focused correction supersedes this version, the current version and
results belong in the production delivery record.

| Item | Production configuration |
| --- | --- |
| Account | `c84d6dc733d90811006e8d8837dcd1c3` |
| Zone | `ccc24f503b6009cf857e445d232c0e5e` |
| Fresh central D1 | `sour-boule-nye-production` — `1d1e7a58-44d6-4ea7-a114-b05ad3d9b377` |
| Staff Access app | `63f1c1ce-a257-4a4a-9212-8c246b7c7ee8` |
| Staff policy | `092088e7-0b40-47f9-ab42-346d26c937f1` |
| Staff issuer | `https://sourbagelman.cloudflareaccess.com` |
| Guest / saved pass | [Permanent guest page](https://celebrate.thesourboule.com/?pass=1) |
| Employee login | [Permanent staff page](https://celebrate.thesourboule.com/staff/) |

Fresh schema and the production environment marker are applied. A fresh
`PASS_SECRET` is configured only as a server-side Worker secret. Both locations
use this one central production database and the approved fixed assignments:

- `lance@thesourboule.com` — Willow Bend.
- `alexis@thesourboule.com` — Fort Worth.

The approved email-code policy uses 12-hour application/policy sessions without
an override of mandatory account/organization security. Both managers reached
their correct backend-fixed station in actual authenticated desktop Chromium
checks. Every staff page/API path remains protected by Access and Worker
JWT/station verification. The employee sequence remains five digits → Check
code → Redeem cookie → Next guest, without a location picker, purchase
requirement or per-customer sign-in.

Focused actual-cloud checks passed: public guest HTML and `/api/time` return 200
with live time before the fixed real event; anonymous staff routes redirect to
Access; simulation routes and unprotected staff assets return 404. The
45 desktop Chromium assertions include both manager logins/fixed assignments,
actual token audience and 12-hour lifetime/cookie checks, reserved sample-code
and redemption rejection (400), wrong-location rejection (403), unknown-code
handling (404), closed registration (409), ignored artificial-date inputs and
persistent guest session after reload. These do not prove an actual elapsed
12-hour expiry or physical-iPhone behavior.

Production readback found zero entries, passes, presence and redemption records,
zero holiday windows, and two active staff identities with two assignments. No
staging records, simulated eligibility or test clock entered production. Positive
live pass issuance, earned-pass recovery and successful live redemption were not
manufactured before the real event. Existing isolated persistence/recovery/atomic
redemption evidence and its limits remain in the production delivery record.

This authorization covers only the isolated service and necessary hostname.
It does not permit main-site DNS/routing changes, unrelated resources, new
expected charges or paid services. Main website publication, merge/auto-merge
and publishing-branch changes remain separate from this service delivery.
The existing main-site DNS and Pages main-branch publishing configuration remain
unchanged.

## Reproduce the production build locally

From `_features/new-year`:

```sh
node production/build-deployment.mjs
```

The command reads the non-secret identifiers in
[`production/resources.json`](../production/resources.json), uses the production
entrypoint and writes a fresh ignored `.local/production-build-*` directory.
It performs no network calls, deployment, DNS changes, database mutation, secret
retrieval or website activation. Its output contains:

- Exactly seven allowlisted real guest/staff assets, retaining the approved
  experience and no-purchase offer. Staff references use protected
  `/staff/assets/*` and `/staff/api/*` namespaces.
- A Worker-first Wrangler configuration with actual production D1/Access IDs and
  the one approved Custom Domain. No staging binding or clock.
- Fresh schema and production marker migration as source artifacts, not
  instructions to rerun initialization against the existing database.
- A source/build manifest. A local build is not a live verification result.

`node production/prepare.mjs` remains the generic fail-closed preparation command:
it produces unresolved identifiers, no routes and `PRODUCTION_ENABLED=false`.
Use `build-deployment.mjs` to reproduce the configured permanent service. Neither
command publishes the website or enables its loader. Never copy the private
staging entrypoint, database, audiences, artificial windows or review export.

The website source points to `https://celebrate.thesourboule.com`; both checked-in
loader copies remain disabled. The existing
[private website preview — TEST ONLY](https://nye-staging.thesourboule.com/) uses
staging-only export transforms and is not a production website artifact.

## Outstanding gates

Use the finite categories in the combined checklist and actual results in the
production delivery record:

1. Incorporate upcoming owner content edits and obtain explicit authorization
   for the finalized website SHA. Preserve the reconciled business content,
   redesign, seasonal hooks, publishing branch and live website until then.
2. Carry forward the final production evidence and its stated limits; do not
   treat configured resources or a successful login as proof of live issuance.
3. Obtain January 1–3 hours or closures for both locations and independently
   verify the dated Chicago/UTC redemption windows. None are guessed or entered.
   Final cap: `2027-01-04T06:00:00Z`; no window means redemption remains closed.
   Missing holiday hours do not block code integration or permanent staff login.
4. Complete the documented checks on both actual location iPhones and guest
   devices, including accessibility, saved passes, background/lock/reconnect
   behavior and the numeric staff flow. Desktop automation is not this evidence.
5. Resolve actual elapsed 12-hour expiry, real JWKS rotation/outage, accepted
   traffic/load, backup/restore, retention/cleanup, privacy-safe logging and
   support ownership. Record approved policies and actual operational tests.
6. After finalized website authorization and required checks, activate/publish
   the exact combined candidate through the existing website flow, then record
   real-origin smoke results and rollback versions.

## One October release, automatic New Year schedule

Service provisioning does not activate the main website. Follow
[`production/ACTIVATION.md`](../production/ACTIVATION.md) only after explicit
finalized October website authorization. The prepared command is:

```sh
node scripts/build-integration.mjs --enable-for-approved-october-release
```

It enables only the generated website loader; its reference source remains
disabled. Review that asset change as part of the authorized website SHA.
No separate New Year's Eve activation task or manual clock change is needed.

The loader follows real server time. October installation neither displays the
takeover nor permits October registration. America/Chicago: opening December 31,
2026 at 11:50 PM; descent at 11:59 PM; 2027 and fireworks January 1 at midnight;
return to the same current website/theme at 12:05 AM. Continue remains scoped to
the browsing session; recovery retains the secure service session.

Keep `CNAME`, Pages configuration and the approved seasonal calendar intact.
Do not create a separate website launch or publish a private export.

Cloudflare references: [Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/),
[Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/),
[D1 transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/).

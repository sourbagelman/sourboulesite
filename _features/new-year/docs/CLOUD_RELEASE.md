# Cloud setup and release gate — not authorized or executed

## Environment verified read-only on September 27, 2026

- GitHub Pages serves `sourbagelman/sourboulesite`, `main`, root `/`, with custom
  domain `thesourboule.com`. Latest built commit is
  `6d7ba10f370727f86d63a7e2d285152e23790f45` (September 26).
- The domain resolves to the four GitHub Pages IPv4 addresses. Authoritative DNS
  nameservers are `alfred.ns.cloudflare.com` and `lily.ns.cloudflare.com`.
- Proposed `celebrate.thesourboule.com` had no DNS answer. It remains a proposal.
- Local Wrangler `whoami` could not authenticate (token refresh failed; not
  logged in). No account, zone, Worker, D1 database, Access application, policy,
  identities, bindings or secrets could be verified from an authenticated cloud
  account. Nothing was provisioned.
- Existing separate seasonal review hosting was not changed or reused.

Cloudflare documents D1 batches as transactions, so the eligibility batch and
single conditional redemption update plus audit trigger fit the target model.
The application still must be exercised on real D1. Access JWT validation must
verify signature, trusted issuer, application audience and validity, followed by
the application's approved active identity and fixed station assignment.

Primary references checked during implementation:

- [D1 batch transactions and bindings](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Cloudflare Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)
- [Workers static asset routing](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)

## Owner inputs needed before dependent cloud work

1. Explicit authorization for isolated cloud staging, approved Cloudflare account
   and zone, staging hostname/access policy, and eventual production service
   hostname. Cloud credentials should be entered through Cloudflare/CLI secret
   facilities, not sent in chat or committed.
2. Actual January 1, 2 and 3, 2027 opening/closing times or closures for **both**
   locations in America/Chicago. Do not infer them from regular website hours.
3. Two approved station identities: verified Access subject and email for Fort
   Worth, and a distinct subject/email for Willow Bend. Each identity gets one
   active staff record and exactly one backend location assignment. Identify the
   manager responsible for signing in the two designated iPhones.
4. Approved shift session length (handoff proposes 12 hours), MFA/access policy,
   manager reauthentication procedure, expected peak attendance, support owner,
   operational data retention/cleanup date, and backup/restore expectations.

The event times, no-purchase offer, design, code length and guest/staff flows are
already approved; they are not new decisions.

## Exact remaining setup, once separately authorized

- Create separate new staging and production Worker/D1 resources and separate
  keys. Confirm resource/zone ownership and billing before provisioning. No
  reusable cloud database is assumed. Keep source on the approved release branch.
- Replace the staging `database_id` placeholder with the created D1 binding ID;
  retain `ASSETS` and `DB`. Apply `migrations/0001_initial.sql` **only to a fresh
  database**. The reviewed initial schema adds `entries.pre_observed_ms`. A
  populated older database requires a separately reviewed migration, not this
  `CREATE IF NOT EXISTS` file.
- Set `PASS_SECRET` through Worker secrets with at least 32 random bytes. It is a
  server-only rate-key salt. Never copy `.local`, lab staff/control tokens, test
  station rows, sample passes, or artificial opening windows.
- Configure the actual Access issuer/team URL and staff application's audience
  in `ACCESS_ISSUER`/`ACCESS_AUD`. Protect both `/staff*` and `/api/staff/*`. Keep
  Worker JWT verification enabled. Keep workers.dev and public preview URLs
  disabled; test direct origins and alternate hostnames cannot bypass staff auth.
- Provision each actual verified subject/email into `staff_users`, active=1, and
  one corresponding `staff_locations` row. Verify missing/multiple assignments
  fail closed. Client input must not choose the station.
- Enter owner-confirmed dated windows into `redemption_windows` with half-open UTC
  boundaries `[opens_ms, closes_ms)`. January dates are CST (UTC−06:00); validate
  every conversion against America/Chicago. Closed days get no window. No window
  means no redemption. No window may extend redemption beyond
  `2027-01-04T06:00:00Z`. Keep ordinary website hours unchanged.
- Configure the approved service domain/HTTPS only after DNS authorization. Allow
  only actual website origins in `WEBSITE_ORIGINS` and iframe CSP. If choosing a
  different hostname, review the explicit service/parent allowlists together.
- Use a staging-only server clock harness and isolated data for rehearsal; never
  ship that clock or test auth in the production entrypoint. Production's default
  entrypoint uses server time, real Access validation and live cookie policy.
- Agree and implement scheduled cleanup/backup operations after the owner chooses
  retention. Current code intentionally does not invent a retention date or run a
  purge. Retain code reservations through support; never recycle used codes.

## Release checklist

- [ ] Real cloud staging: migrations; persistence across Worker revisions; same
  pass after retry/reconnect; simultaneous issuance; two-location atomic
  redemption/audit; no-purchase payload; expiry and every approved closing time.
- [ ] Real Access: two fixed stations, session expiry/revocation, removed users,
  forged/expired/wrong-audience JWTs, JWKS rotation/outage, direct-origin bypass.
- [ ] Physical iPhone Safari at each station and guest iPhone/Android: native HTTPS
  Secure/HttpOnly cookie handling, same-site iframe storage, private mode, saved
  pass, numeric keyboard, orientation/safe areas, screen lock, app/tab switching,
  Wi-Fi/cell loss, reconnect inside/outside grace, and multi-tab behavior.
- [ ] Accessibility: physical screen reader, keyboard focus trap/restoration,
  text zoom, reduced motion, touch targets, clear connection failure and no strobe.
- [ ] Operational load/burst, database capacity, retry behavior, backup/restore,
  log redaction (no names/codes/secrets/request bodies), retention and support.
- [ ] Recheck current site and seasonal baseline at release time; apply additive
  loader only. No snapshots, ordering/form/price/hour/content replacements.
- [ ] Build only Worker `src/worker.mjs` plus `public/`; inspect bundle for absence
  of local clock/auth routes. Never upload offline previews or lab data. Re-run
  local suites and dry-run with final reviewed configuration.
- [ ] Obtain separate explicit production release approval, including the
  authorized website branch/release, service/DNS changes and enabling the loader.
  Until then `ENABLED=false` stays in both source and generated website asset.
- [ ] With that approval only: deploy service, verify health/protection, point the
  versioned loader to the approved HTTPS service and enable it, then run live
  smoke checks without creating fake production eligibility or sample passes.

No cloud staging, public preview, production deployment, DNS changes, pushes,
merges or cloud resource creation occurred in this implementation pass.

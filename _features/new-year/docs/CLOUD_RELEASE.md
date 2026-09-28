# Production setup for the combined October release

The owner has approved inclusion of the locked New Year feature in the finalized
October website release, not a separate launch. This is **not deployment approval**.
The authoritative combined checklist is
[docs/october-release-checklist.md](../../../docs/october-release-checklist.md).
The approved feature checkpoint is `651a435e8ef840eac5b0d84f73a86a7131a092a8`.

## Current boundary

The latest remote seasonal candidate `b08545e` contains redesign `d49eea7`; the
approved New Year checkpoint already descends from both. Preparation remains on
`feature/new-year-cookie-promotion`. No existing website or seasonal file needs
replacement. Re-read remote heads and reconcile newer business edits before the
final October candidate is approved. Never restore pages from this package.

Private staging is complete; its evidence is in
[PRIVATE_DELIVERY.md](../staging/PRIVATE_DELIVERY.md) and
[CLOUD_REHEARSAL.md](../staging/CLOUD_REHEARSAL.md). Those are not production
verification. Do not deploy the staging entrypoint, assets, database, audience,
tester allowlist, artificial time anchors or preview controls to production.

## Prepared production artifacts

Run locally from `_features/new-year`:

```sh
node production/prepare.mjs
```

This creates a fresh ignored `.local/production-build-*` directory containing:

- Exactly seven real guest/staff service assets. Guest renderers, offer, recovery
  and visual design remain unchanged. Staff HTML/client references use the
  authenticated `/staff/assets/*` and `/staff/api/*` namespace already exercised
  in staging, without staging labels or simulated responses.
- A production-specific Wrangler configuration targeting
  `production/worker.mjs`, separate `sour-boule-nye-production` Worker/D1 names,
  Worker-first assets, disabled workers.dev/version-preview access and no routes.
- The existing fresh schema plus a production environment marker migration.
  Both contain zero guest/test/staff records and no guessed holiday hours.
- A manifest clearly marked preparation only, with current source hashes and
  pending setup. It does not copy, replace, enable or deploy website pages.

The template intentionally has no account assignment or DNS route, unresolved
production D1/AUD placeholders, and `PRODUCTION_ENABLED=false`. The actual
website loader remains `ENABLED=false`. These gates must be changed only during
preparation of the explicitly authorized final October release.

The production target is `https://celebrate.thesourboule.com`, as already used by
both disabled loader copies. It is a **proposed production hostname**, not an
already provisioned or DNS-approved production endpoint. Production links will
be `/` for guests, `/?pass=1` for recovery and `/staff/` for stations. No staging
URL is a production fallback.

## Required setup and owner inputs

1. Confirm the production account/zone, exact Worker/D1/domain proposal and costs,
   then obtain the existing separate DNS/cost approvals. The account verified
   for private staging does not itself authorize production resource creation.
2. Create a fresh production D1 and Worker only with authorization. Set the actual
   D1 ID; apply `0001_initial.sql` then `0002_production_environment.sql` to that
   fresh database. Never migrate by copying staging/lab databases. The production
   wrapper requires its own marker and rejects a staging database.
3. Provision a fresh server-side `PASS_SECRET` with at least 32 random bytes via
   secure Worker secret input. No secret belongs in JSON, source, Git or chat.
4. Configure a separate production staff Access application and real production
   `ACCESS_AUD`. Use the verified team issuer only after production configuration
   is approved. Protect `/staff`, `/staff/*`, `/api/staff` and `/api/staff/*` at the
   edge. The Worker also verifies JWT signature/issuer/audience/expiry, active
   staff identity and exactly one backend station. Verify all alternative paths.
   **Do not put a tester-only Access application over the public guest service.**
5. Confirm the production managers, distinct station emails/verified subjects,
   fixed assignments, session length and sign-in/MFA policy. Existing private
   staging assignments are evidence, not production setup approval. Shared-phone
   flow stays five digits → Check code → Redeem cookie → Next guest.
6. Obtain actual January 1–3 hours or explicit closures for both locations. Enter
   dated half-open UTC windows validated against America/Chicago, ending no later
   than `2027-01-04T06:00:00Z`. No window means redemption remains closed. Do not
   infer holiday hours from the website or change the website's ordinary hours.
7. Resolve support ownership, expected traffic, load acceptance, retention/
   cleanup, privacy-safe logs and backup/restore policy. Implement and verify
   the approved operations without inventing dates, credentials or policies.
8. Complete every outstanding physical-device, security and operational check
   in the combined checklist before launch. Keep production verification distinct
   from local mocks and prior private-cloud results.

## One October release, automatic New Year schedule

After explicit authorization of the exact final October website release and its
resource/DNS/cost changes: deploy the production service with the reviewed fresh
bindings and real staff protection; verify public guest/time access, session/pass
recovery and protected station behavior; then enable the scheduled loader in that
same October website release. Rebuild the loader only from its current approved
source; the current disabled-only builder deliberately refuses an enabled source
and must be updated under that release authorization. Do not ship a private build.

The real loader polls the server clock. Installing/enabling it in October does
not display the takeover or permit October registration. It automatically opens
December 31 at 23:50 Chicago, descends at 23:59, changes to 2027/fireworks at
January 1 00:00, and removes the takeover at 00:05. No New Year's Eve manual
activation or browser clock override is needed. Continue remains session-scoped;
recovery uses the service's existing secure session cookie after the takeover.

Keep `CNAME`, Pages configuration and the approved seasonal calendar intact.
If a service/release gate fails, leave the website loader disabled and report the
blocker; do not turn the feature into an unapproved separate launch.

Cloudflare references: [Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/),
[Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/),
[D1 transactions](https://developers.cloudflare.com/d1/worker-api/d1-database/).

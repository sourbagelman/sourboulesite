# Private cloud rehearsal

**TEST ONLY — NOT REDEEMABLE**

Private staging delivery is complete. Use [PRIVATE_DELIVERY.md](PRIVATE_DELIVERY.md)
for the final review links, the always-available visual simulation, actual test
results and pending release checks. The setup instructions below are retained for
operators; they are not a request to schedule or start another rehearsal.

This separate entrypoint builds on local checkpoint
`84dfcb3c77e7f2e233de39e9817668b82f4ab89e` on
`feature/new-year-cookie-promotion`. It does not enable the production loader,
change business content, or deploy anything when built. The existing production
entrypoint remains `src/worker.mjs`; it does not import this directory.

## Verified account and approval record

Inspected September 27, 2026 (America/Chicago), using the owner's renewed CLI
OAuth login and authenticated Cloudflare dashboard. OAuth credentials are stored
through Wrangler's OS-keychain option; no credential values belong in this repo.

- Owner-approved account: **Lance@thesourboule.com's Account**,
  `c84d6dc733d90811006e8d8837dcd1c3`.
- Active zone: `thesourboule.com`, `ccc24f503b6009cf857e445d232c0e5e`.
- Dashboard subscriptions: **Workers Free** and **Teams Free Base**, both active.
  The separate existing R2 subscription and unrelated Workers are not part of
  this feature and must not be changed or reused.
- Existing Zero Trust team: `sourbagelman`, Zero Trust Free. Only email One-time
  PIN was configured at inspection; it is not an MFA identity provider.
- The initial D1 inventory was empty. CLI OAuth returned a filtered empty Access
  list and denied per-application reads; the authenticated dashboard was used
  to create and verify Access. An empty OAuth list is not proof no apps exist.
- After account inspection, the owner separately approved testers
  `lance@thesourboule.com` and `alexis@thesourboule.com`, with Lance fixed to
  Willow Bend and Alexis fixed to Fort Worth. Lance Misner and Alexis manage
  their respective station sign-ins. This assignment was explicit, not inferred
  from Cloudflare administrator access.
- Owner approved 12-hour application **and policy** sessions and email One-time
  PIN for this rehearsal, with no additional MFA step. The dashboard showed the
  global session set to follow application timeout and no enabled independent
  MFA methods. No organization-wide security/session setting was edited.
- Verified team issuer: `https://sourbagelman.cloudflareaccess.com`.

The requested resource/DNS proposal is one new Worker and one fresh D1, each
named `sour-boule-nye-private-staging`, plus two Access applications:

1. `Sour Boule NYE testers — TEST ONLY — NOT REDEEMABLE`, covering both complete
   proposed staging hostnames with an explicit tester allowlist and eager cookies.
2. `Sour Boule NYE stations — TEST ONLY — NOT REDEEMABLE`, covering service
   `/staff`, `/staff/*`, `/api/staff`, and `/api/staff/*`, with the independently
   complete approved station allowlist. Its audience must differ from the tester
   app's audience. Staff JS/CSS are served below `/staff/assets/`.

The derived staff client sends API requests under `/staff/api/*`; after real
station authentication the staging wrapper maps them to the unchanged
`/api/staff/*` handlers. This keeps page, assets and browser API requests inside
the same path-scoped Access cookie. The direct canonical API paths remain
protected independently. Real Access cookie behavior was exercised in the cloud rehearsal; future changes
require the same checks. See [CLOUD_REHEARSAL.md](CLOUD_REHEARSAL.md).

Owner-approved custom domains are `nye-staging.thesourboule.com` and
`nye-service-staging.thesourboule.com`. Both are deployed; current evidence is in [CLOUD_REHEARSAL.md](CLOUD_REHEARSAL.md).
Attaching these Worker Custom Domains creates DNS records; the owner explicitly
approved that exact change before execution. No production record is included.

The proposal uses only the existing Free plans, with an expected incremental
charge of $0 **within their allowances**, at most 10,000 Worker requests for the
initial rehearsal, monitored D1 usage, and no paid upgrades/add-ons. This is not
a promise about unlimited usage or unrelated account costs. Stop before any
paid change; the owner must approve it separately. Current published limits and
prices are documented in [security-review.md](security-review.md).

The owner explicitly approved this resource/DNS/usage proposal and the identities
and session/sign-in policy above before provisioning. No paid upgrade is
authorized. Verified Access subjects were obtained through actual identity sign-in, as recorded
in [CLOUD_REHEARSAL.md](CLOUD_REHEARSAL.md).
An accessible account or admin email is never a substitute for those approvals.

## Local artifact preparation

Run from `_features/new-year`. Install pinned dependencies with `npm ci` if
needed. `npm test` tests the source and staging boundaries without cloud access.
`npm run staging:runtime` additionally exercises the actual generated assets and
staging wrapper in local workerd/Miniflare using clearly identified local test
JWT keys and local D1 storage. It is not a real Access or cloud D1 result.

Store reviewed **non-secret** configuration under ignored `.local/`, using this
shape after actual resources and Access apps exist:

```json
{
  "accountId": "c84d6dc733d90811006e8d8837dcd1c3",
  "databaseId": "REPLACE_WITH_FRESH_STAGING_D1_UUID",
  "environmentId": "nye-private-staging-2027",
  "websiteOrigin": "https://nye-staging.thesourboule.com",
  "serviceOrigin": "https://nye-service-staging.thesourboule.com",
  "accessIssuer": "REPLACE_WITH_VERIFIED_ACCESS_ISSUER",
  "testerAudience": "REPLACE_WITH_TESTER_APP_AUD",
  "staffAudience": "REPLACE_WITH_STAFF_APP_AUD",
  "testerEmails": ["REPLACE_WITH_APPROVED_TESTER_AND_STATION_EMAILS"],
  "realAnchorUtc": "REPLACE_WITH_REHEARSAL_REAL_UTC_INSTANT",
  "eventAnchorUtc": "2027-01-01T05:48:50Z"
}
```

```sh
npm run staging:prepare -- .local/approved-staging.json
```

Missing or placeholder values fail closed. Preparation writes a **new** ignored
`.local/staging-build-*` directory containing an `assets/` tree, manifest,
`wrangler.json`, and `staging-initial.sql`. It never replaces source pages or
previous builds. The twelve pages are read from the current working tree, not a
historical package. The manifest records every input/output hash and source HEAD.
Only the staging copies receive test notices and the enabled, origin-pinned,
credentialed loader. Shared code, seasonal assets, business URLs and content are
copied unchanged. The site's staging-only response CSP blocks analytics, external
form submissions and production service connections; production headers/source
are unchanged. Expected GA4 CSP blocks must not be reported as feature errors.

The generated configuration initially has **no routes**, and always has
`workers_dev=false`, `preview_urls=false`, Worker-first authentication for every
asset, and observability disabled. After separate DNS approval, the explicit
`--attach-approved-domains` preparation option generates only the two concrete
Custom Domain bindings. This option itself does not grant approval or deploy.
Use Wrangler `deploy --dry-run --config <generated-wrangler.json>` to inspect the
bundle before any separately approved cloud command.

## Isolated cloud setup order

1. Verify the recorded approvals and tester/station emails, manager, session
   length, allowed sign-in method and MFA requirement. If MFA is required,
   configure a separately approved compatible provider; do not call email PIN
   MFA or silently weaken the requirement.
2. Create the two Access apps and explicit Allow policies first. Do not add
   Everyone, Bypass, email-domain-wide, or account-admin exceptions. Set both
   applications' display name to include the test label. Confirm the actual
   issuer, distinct audiences, multi-host eager cookies, session expiry and
   policy precedence. Do not change account-wide Worker protection.
3. Create the fresh staging D1, then apply only its generated initial SQL. Never
   apply that SQL to a shared/populated database. It adds a required environment
   marker and **artificial** windows for both locations: January 1 at 00:00–01:00
   Chicago in virtual event time. These are rehearsal fixtures, not business
   hours. The production migration still inserts no redemption windows.
4. Upload the staging Worker with no routes, workers.dev or preview URLs. Set a
   newly generated `PASS_SECRET` through `wrangler secret put PASS_SECRET` using
   secure stdin; no secret in command arguments, chat, config, logs, or Git.
5. With DNS approval, attach the two precise hostnames. Staff operations remain
   denied until the verified assignments below exist. Probe privacy before sharing
   a rehearsal link; verify no public interval, direct-origin bypass, workers.dev/
   version URL, asset alias or API bypass exists.
6. Obtain each approved station's verified Access subject/email through its real
   sign-in to the protected `/staff/identity` setup endpoint. Populate exactly one
   active `staff_users` record and one `staff_locations` row per station. Fort Worth
   and Willow Bend must use distinct subjects/emails. No invented subject, tester
   token or admin role may substitute.
7. Establish each real browser's Access cookies by top-level sign-in. Eager
   cookies and the staging notice's service sign-in link support this; do not
   assume an Access login can complete inside the iframe. Run the cloud matrix
   below, measure CPU/D1 usage, and stop before the approved request budget or any
   paid change. Never reduce authentication or cookie security for a passing test.

The timeline is controlled exclusively by deployed server variables: virtual
event time equals `eventAnchorUtc + (real server time - realAnchorUtc)`. It runs
at real speed, preserving the approved 30-second/90-second eligibility windows.
There is no public clock-setting URL, header or query parameter. JWT expiration
and JWKS caching use actual server time. A later expiry rehearsal requires a
separate operator configuration revision, not a guest override.

## Required cloud evidence

Use **real Access and real D1**. Local mock-JWKS, SQLite and Miniflare results do
not satisfy this list. Do not store cookies, tokens, names, pass codes, request
bodies or browser profiles in committed evidence.

- Anonymous-with-respect-to-the-promotion guest session, registration, pre/post
  midnight server receipts, brief reconnect and too-late rejection; changing the
  device clock must not qualify a guest.
- Durable unique five-digit issuance, interrupted-response recovery, retry and
  reload recovery, same pass after a Worker revision; retained access after exit.
- Two actual approved station identities, backend-fixed locations, no-purchase
  verify/redeem payloads, concurrent cross-location single winner and one audit
  row; double taps and response-loss retry must not issue another cookie.
- Invalid/used/expired/outside-artificial-window statuses; removed station,
  expired Access session, actual Access revocation, wrong audience and forged
  tokens. Revoke only rehearsal users/sessions, never unrelated account access.
- Secure HttpOnly host-only HTTPS cookies; authenticated cross-origin/same-site
  iframe; exact credentialed CORS; direct/alternate-host and asset/API probes.
- Actual current website already open before start automatically activates;
  active arrival activates; Continue persists through same-tab navigation;
  prominent year changes 2026→2027; auto-end reveals the identical current page;
  saved pass stays available; service/iframe failures leave the page usable.
- Inspect mobile layouts/reduced motion and label every screenshot/pass as test
  only. Physical iPhones remain distinct from desktop browser automation.

Anonymous privacy check after the approved deployment:

```sh
npm run staging:privacy -- --site APPROVED_SITE_ORIGIN --service APPROVED_SERVICE_ORIGIN --issuer VERIFIED_ACCESS_ISSUER
```

Add `--alternate` only for exact alternate URLs actually returned by Cloudflare.
The bounded probe sends at most 39 GETs, no credentials, and follows no redirects.
It does not prove authenticated behavior, revocation, D1 correctness or iPhone
compatibility. It returns failure/inconclusive rather than treating missing
configuration or network errors as a passing privacy check.

Physical steps: [IPHONE_REHEARSAL.md](IPHONE_REHEARSAL.md). All device boxes stay
pending until performed on the designated two iPhones.

## Disable/removal and production gates

Revoke only staging Allow policies or deploy a deny-all staging response first.
Remove its Custom Domains/routes and verify they no longer serve. Only then
remove its Access apps. Export/delete the staging database according to the
owner-approved retention decision, revoke staging secrets and remove the Worker.
Do not delete protection while an origin remains reachable. No production
resource belongs in this cleanup.

Still needed for production: confirmed January 1–3 hours/closures for both
locations; support owner; traffic assumptions/load acceptance; retention and
cleanup date; backup/restore policy and tested restore; final staff identities,
MFA/session and manager procedure; real cloud and physical-device acceptance;
fresh production resources/secrets/config without staging code/data; current-site
boundary verification; and a separate explicit release/DNS/loader authorization.
No holiday hours are inferred from the current website or artificial fixtures.

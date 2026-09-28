# Private staging deployment record

**TEST ONLY — NOT REDEEMABLE**

This is the historical rehearsal evidence from checkpoint `d87788f`. For the
completed private delivery, final URLs and focused closeout results, see
[PRIVATE_DELIVERY.md](PRIVATE_DELIVERY.md). The closeout preserves the clock and
records below and adds an independent visual simulation; it schedules no rehearsal.

This record covers the private deployment authorized September 27, 2026
(America/Chicago). It does not authorize production. Work started from local
checkpoint `84dfcb3c77e7f2e233de39e9817668b82f4ab89e` on
`feature/new-year-cookie-promotion`. No source website or seasonal file changed
in this staging pass; both shipped loaders remain `ENABLED=false`.

## Resources and authorization

- Approved account: `c84d6dc733d90811006e8d8837dcd1c3`.
- Approved zone: `thesourboule.com`, `ccc24f503b6009cf857e445d232c0e5e`.
- Worker: `sour-boule-nye-private-staging`.
- Separate D1 with that same name: `191f1e9c-b291-43bd-841f-5cfb514835e2`.
- Tester Access app: `febe6b39-c663-44f2-8a48-cc3a111434fb`.
- Staff Access app: `9119238c-e6eb-42e3-9dd3-3f2d49c1dd70`.
- Issuer: `https://sourbagelman.cloudflareaccess.com`.
- Website: <https://nye-staging.thesourboule.com/>.
- Guest/pass service: <https://nye-service-staging.thesourboule.com/>.
- Staff: <https://nye-service-staging.thesourboule.com/staff/>.

The owner approved these exact staging DNS changes and the existing Workers Free
and Teams Free Base plans. Expected incremental cost is $0 within plan allowances;
initial rehearsal is limited to 10,000 Worker requests, with D1 usage monitored.
No paid upgrade/add-on or unrelated resource change is authorized or performed.

The two Access apps each have a separate exact-email Allow policy for
`lance@thesourboule.com` and `alexis@thesourboule.com`; app and policy sessions
are 12 hours, using the existing email One-time PIN identity provider. No
organization-wide session, mandatory MFA, or account-security policy was changed.
The owner assigned Lance Misner/Lance's email to Willow Bend and Alexis/Alexis's
email to Fort Worth. Backend assignments require verified signed Access subjects;
an allowlisted email alone does not enable a staff operation.

Managers enter their PIN directly into Cloudflare's sign-in form. They do not
share passwords, codes or tokens in chat. Shared phones need only their own Access
application session, not an email inbox or Cloudflare administrator login.

## Deployment evidence

- Created Access apps before exposing the Worker.
- Installed the fresh D1 schema and a staging-only environment marker.
- Installed two labeled artificial virtual-time windows, January 1 00:00–01:00
  America/Chicago. These are fixtures, not approved holiday business hours.
- Uploaded the Worker without routes, then provisioned a fresh server-side secret
  through secure stdin, then attached only the two approved Custom Domains.
- Initial routed Worker version: `ce5e4234-a692-42dd-9ecd-285f2fa52747`.
- Cloudflare read-back confirms both staging domains map to this Worker and
  preview URLs are disabled. `workers.dev` and preview flags both read false.
- The account's observed workers.dev hostname gives a 404 for this Worker.
- D1 read-back after installation: 10 tables, 122,880 bytes. These metadata do
  not prove issuance or redemption behavior.

Cloudflare's API calls the default environment of this dedicated **staging**
Worker `production`; that provider label does not mean the live Sour Boule site
or its GitHub Pages deployment was changed.

## Verification status

The following checks were actually run against the deployed resources. Local
results and physical-device checks remain separate.

- Latest full source suite with cloud-harness guardrails: **184/184 passed** locally.
- Actual local workerd/Miniflare staging runtime: **86/86 passed** with local
  test keys and local D1. This is not real Access or cloud D1 evidence.
- Initial anonymous cloud probe: website paths redirected to the expected Access
  issuer. Service-path results were inconclusive because the local resolver
  retained NXDOMAIN after new DNS publication. Authoritative/public DNS returned
  the new addresses; an HTTPS request using that verified address returned 302.
  This transient result was not counted as a complete privacy pass.
- Repeated cloud privacy probe: **37/37 passed**. All 36 normal staging paths
  redirected to the expected Access login; the observed Worker default hostname
  returned 404. Only this process mapped the service hostname to its verified
  published IPv4 address; TLS verification and Access remained enabled. Ordinary
  local DNS propagation was still pending at that check.
- Final native-browser anonymous privacy recheck: **37/37 passed** using ordinary
  Chromium DNS, fresh empty cookie jars, normal TLS validation, and redirect
  interception before a follow-up request. Both staff pages also returned 200
  with correct locations using ordinary Chromium DNS. Public resolvers and the
  local DNS query returned the new record. A final Node/system-resolver attempt
  still retained a negative service result; it was marked inconclusive, not passed.
- Both approved managers completed real Access sign-in. Their distinct signed
  subjects were verified and each received exactly one backend location. Both
  actual staff pages and `/staff/api/me` returned 200 with the correct assignment.
- Actual-site cloud browser checks: unattended opening 12 assertions,
  active arrival 10, Continue across reload/navigation 17, time-service failure
  recovery 10, iframe-failure recovery 9, and a client-Date-skew simulation 14.
  The date-skew test changed only a temporary browser context; it did not change
  the server or OS clock. Guest iframe authentication and no-overflow assertions
  passed at the tested phone/tablet/desktop sizes.
- Actual-site natural midnight transition and real D1-issued no-purchase pass:
  **17/17 assertions passed** at 375×812, including native HTTPS guest-cookie
  flags and authenticated iframe behavior.
- The first automated API phase stopped at its first time request because of an
  Access redirect in the test transport; it registered no guests and issued no
  passes. This is recorded as a failed attempt, not a passing cloud phase.
- Natural 12:05 closure restored the identical Contact page and seasonal DOM:
  **14/14 passed**. Post-takeover recovery/reload and saved PNG download:
  **10/10 passed**. The saved image was visually inspected and its exact test
  label and no-purchase terms are clear.
- Total actual-site cloud browser results: **9 scenarios / 113 assertions passed**,
  zero uncaught JavaScript errors and zero unexpected CSP violations. Tested
  viewports were 320×568, 375×812, 768×1024, 1366×768 and 1440×900, distributed
  across the focused scenarios; this is not a full page-by-viewport matrix.
- Corrected API transport performs ordinary top-level Access renewal before its
  synthetic client transport document. All subsequent API calls use real HTTPS,
  genuine native cookies, the real Worker and D1; no response, token or clock
  substitute is used. This API transport is separate from actual-site UI proof.
- All five cloud API phases passed: eligibility **15**, redemption **11**,
  outside-hours **6**, expired passes **6**, and deactivated Fort Worth identity
  **3**: **41 checks**, 172 explicit API requests plus 24 read-only Access
  preflight navigations and their SSO redirects. The temporarily deactivated
  Fort Worth row was restored in a finally step and verified active again.
- Real staff-app token revocation passed: both signed-in stations first returned
  200; the dashboard revoked tokens only for the staging staff application; both
  unchanged sessions then received Access redirects with no staff data. No
  organization-wide policy, duration or identity-provider setting was changed.
  Both managers then renewed through ordinary Access sign-in, and their staff
  pages and `/staff/api/me` again returned 200 with the correct assignments.
- Remote D1 audit read-back found four issued passes, two redeemed passes and
  exactly two audit rows, with zero duplicate audit records and two active stations.
- Actual elapsed **12-hour session expiration is not yet verified**. Revoking an
  app token is a distinct test, not an expiry substitute. Real JWKS rotation or
  outage, sustained peak load, physical iPhones and physical screen readers are
  also not verified. Prior local fixtures do not change these statuses.

## Resource snapshot and final state

At 2026-09-28 01:38:59 UTC, the preceding 24-hour snapshot for this Worker showed
488 invocations and zero runtime errors. D1 showed 1,024 rows read, 338 rows
written, 862 read queries, 155 write queries and 122,880 bytes of storage. Tests
were still running and recent metrics lag, so these are a measured snapshot,
not final whole-rehearsal totals. Worker CPU quantile fields returned raw values
`cpuTimeP50=2361`, `cpuTimeP99=12091`; their units were not independently confirmed,
so no CPU limit/headroom conclusion is claimed. Load acceptance remains pending.
[Cloudflare metric semantics](https://developers.cloudflare.com/workers/observability/metrics-and-analytics/)

The private Worker version at that rehearsal checkpoint was
`c477e24c-bcc5-4cbc-bfc7-ba8d14a895d5`. It was left **after the takeover**, anchored
at real `2026-09-28T01:41:30.227Z` to virtual `2027-01-01T06:07:00.000Z`, advancing
one second per real second. The current website is visible and existing test
passes remain accessible subject to that advancing server clock. A new physical
rehearsal needs an operator to set a new reviewed staging-only anchor before its
opening; visitors have no clock-control endpoint. The existing real January
holiday-hour windows remain unconfigured.

No codes, JWTs, credentials, browser profiles, local databases, or secret values
belong in this record or in Git. Generated builds and test state stay in ignored
`.local/`.

## Local checkpoint scope

That local checkpoint contains only 30 feature source, test and documentation files.
The staged boundary and `git diff --check` passed. No credentials, databases,
profiles, generated deployment artifacts or unrelated files were staged. The
website/seasonal baseline comparison passed: every original tracked file is
byte-identical except the twelve disabled loader includes saved in the earlier
implementation checkpoint. Main remained clean at
`6d7ba10f370727f86d63a7e2d285152e23790f45`; no push or merge was performed,
production was not deployed, and no production DNS or GitHub Pages setting changed.
Use `git log -1` on `feature/new-year-cookie-promotion` for the local checkpoint
commit hash.

## Rehearsal and remaining release gates

Use [IPHONE_REHEARSAL.md](IPHONE_REHEARSAL.md) for the two-device sequence. Physical
device rows remain pending until performed on the actual iPhones. Desktop browser
automation is reported separately.

Production still requires confirmed January 1–3 hours/closures for both locations,
support ownership, expected traffic and accepted load results, retention/cleanup
policy, backup/restore policy and a tested restore, production station/security
acceptance, completion of cloud and physical-device checks, separate production
resources/configuration without staging fixtures, and explicit production release
and DNS/loader approval. None of these decisions is inferred from staging.

To disable safely, keep Access in place while denying staging or detaching only
its two Custom Domains, verify it no longer serves, and only then remove the
staging Access apps. Handle D1 export/deletion according to an approved retention
decision. See [README.md](README.md) for the full removal sequence.

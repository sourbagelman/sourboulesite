# Private staging architecture review

Reviewed September 27, 2026 against the Cloudflare sources linked below.
This is a source/configuration review, not proof that cloud authentication or
deployment tests have passed. The owner approvals and observed resource state
are recorded separately in [README.md](README.md). Those approvals now include
the exact account, two hostnames, resource/cost proposal, tester identities,
fixed stations, twelve-hour sessions and email One-time PIN. No organization-wide
security settings or independent MFA requirements are overridden here.

## Resource and privacy boundary

The approved minimum is one new staging Worker, one new staging-only D1 database,
and two Access applications. The Worker serves two explicit owner-approved HTTPS
hostnames: the current website rehearsal and the isolated celebration service.
Use sibling hostnames within the same registrable domain so the iframe is
cross-origin but same-site. No wildcard route, existing application, production
hostname, existing database, or separate seasonal review host is included.

The first Access application covers both complete hostnames, including guest
pages, assets and APIs, with only the explicit tester allowlist. The second
application covers the service's staff page/assets and staff API paths with only
approved station identities. A station identity must also be approved for the
private rehearsal. A more-specific Access application replaces the broader
application's policy; it does not inherit the tester restriction. Therefore the
staff policy must be independently complete. Verify exact path matches, including
the directory root and slash variants. [Access path precedence](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)

The Worker must additionally reject unapproved hostnames and validate the
appropriate Access JWT before serving any asset or API response. Require the
tester audience for ordinary staging traffic and the separate staff audience
for staff paths. A tester token must never authorize staff verification or
redemption. After staff authentication, require an active verified subject/email
and exactly one backend location assignment. Keep the conditional redemption
authorization check and single-use database update.

Set `assets.run_worker_first = true` for every path. Default asset-first routing
can bypass application middleware; wildcard exclusions are inappropriate for
private staging. This guard also means asset requests invoke the Worker and must
be included in usage estimates. [Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/),
[asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)

Set both `workers_dev = false` and `preview_urls = false` explicitly. Disabling
the former alone does not disable version/preview/deployment URLs. Do not create
preview environments or aliases. Inventory and negatively test every actual
alternate URL returned by deployment tooling, even if the intended custom
hostnames work correctly. [workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/),
[version URLs](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/)

Current Cloudflare documentation also supports Worker-level Access across all of
a Worker's routes and previews. It is a possible additional safeguard after
account capability review, but no account-wide setting or unrelated Worker may
be changed. Hostname/path rules still take precedence. This review does not
silently add a third Access application. [Worker Access scope](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)

## Authenticated browser behavior

Use two concrete hostnames in the tester Access application and explicitly
enable its Eager redirect cookie setting. The initial top-level sign-in can then
establish Access cookies on both hostnames before the parent requests service
time or embeds the guest application. Do not rely on a login redirect completing
inside a fetch or iframe. The derived staff client now uses `/staff/api/*`, so
its page, assets and API requests share the `/staff` cookie scope. The staging
Worker authorizes that original staff path before mapping it to the unchanged
business API. The separate staff Access application also protects the original
`/api/staff` destinations. Official documentation describes eager cookies per
concrete hostname; it does not establish whether every distinct path on one
hostname receives a cookie. Verify actual root and staff cookie coexistence,
identity discovery, and staff API requests after real sign-in. [Access multi-domain cookies](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/)

The release-disabled production loader currently uses `credentials: 'omit'` for
its public time request. A fully private staging service requires the derived
staging loader to use `credentials: 'include'`. Return the exact approved staging
website origin, `Access-Control-Allow-Credentials: true`, and `Vary: Origin` from
the staging time response. Never use a wildcard credentialed origin or bypass
Access on the real time endpoint. A simple GET avoids preflight; if future
requests need preflight, configure Access's narrow OPTIONS response while leaving
the actual resource authenticated. Access documents that browser preflight
requests carry no cookies. [Access CORS](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/)

Retain Secure, HttpOnly, host-only guest cookies and the real Access checks. Do
not loosen browser tracking protection or cookie attributes to obtain a passing
test. The service's staging CSP must allow only the approved parent to frame it;
parent messages must validate both the service origin and the exact iframe
window. If Access expires, a time request fails, or the iframe cannot load, the
existing website must remain usable and the parent Continue control must work.
Actual Safari/private-mode behavior remains a cloud and physical-device test.

Validate RS256 signatures against the configured team's HTTPS JWKS endpoint,
matching `kid`; pin issuer and route-specific audience and enforce expiration
and not-before. Never follow token-supplied key URLs. Refresh unknown keys and
bounded caches, and fail closed when no usable trusted key is available.
Cloudflare specifically recommends origin JWT verification and documents key
rotation. [JWT verification](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)

Authentication and key-cache expiration must use actual server wall time, never
the artificial rehearsal clock. Only promotion eligibility, visual phases and
clearly labeled rehearsal redemption windows use the synthetic timeline.
Synthetic January time would otherwise expire a real September Access token.
Do not expose a guest-callable clock-control endpoint or trust a browser clock.

The owner approved twelve-hour application and policy sessions using the
existing email PIN provider, without an additional MFA step. The account review
record says global session duration follows the application and independent MFA
is currently off. App and policy payloads omit MFA overrides and do not alter
organization settings. Access has global, application and policy session
settings; verify the actual token duration rather than assuming the configured
shift length is effective. Test expired sessions and
real Access revocation, as well as immediate removal of the active database
station assignment. [Access sessions](https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/)

## Final local privacy review

The reviewed generated configuration uses only the new approved Worker and D1,
has no routes in its initial upload variant, disables `workers_dev` and
`preview_urls`, invokes the Worker before every asset, disables observability,
and contains no plaintext secret variable. The separate custom-domain variant
must still contain exactly the two approved hostnames. A secret missing at
runtime results in a configuration failure before any asset is served.

Source review confirms exact hostname checks, distinct staff JWT audience,
approved email checks, and the staging database marker precede content access.
The read-only `/staff/identity` endpoint requires the staff audience, approved
email, valid real-time JWT, and correct database marker before returning only
that sign-in's subject and email. It does not create a station, change an
assignment, or bypass fixed-station checks on staff assets and operations.

The anonymous probe includes `/staff/identity` and `/staff/api/me` on both
hostnames. It makes 36 fixed GET requests and accepts at most three explicitly
observed alternate URLs, keeping one run at no more than 39 requests. Any 2xx
response fails, even if its body contains a test label; transport failures and
unexpected responses remain inconclusive. Sixteen local tests pass, including
independent leakage detection at all four new staff URL combinations. This is
test-harness validation; it is not a claim that a cloud probe has run or passed.

Remaining deployment evidence must include read-back of both complete Access
policies and distinct audiences; anonymous probes against actual deployed hosts
and returned alternate URLs; real tester and both station sign-ins; actual cookie
paths and iframe/CORS behavior; exact fixed D1 assignments; session expiration
and revocation; and measured Worker/D1 usage. Physical iPhone behavior remains
unverified until tested on those devices.

## Current published cost exposure

These rates are reference inputs, not an approved quote or a promise of free
staging. Existing account usage, purchased seats, contract terms and taxes are
unknown. The owner must approve the exact resource/DNS change and expected cost
before paid services or expected charges are incurred.

| Product | Published allowance and excess usage |
| --- | --- |
| Workers Free | 100,000 requests/day; 10 ms CPU per invocation. |
| Workers Standard | $5 monthly subscription; 10 million requests and 30 million CPU-ms/month included; excess $0.30/million requests and $0.02/million CPU-ms. |
| D1 on Workers Free | 5 million rows read/day; 100,000 rows written/day; 5 GB total storage. |
| D1 on Workers Paid | 25 billion rows read/month, 50 million rows written/month and 5 GB included; excess $0.001/million reads, $1/million writes, $0.75/GB-month. |
| Access | Product page advertises a free plan for teams under 50 users or proof-of-concept tests; pay-as-you-go lists $7/user/month, paid annually. Confirm account checkout terms and existing seats before selecting anything. |

Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/),
[Access pricing](https://www.cloudflare.com/sase/products/access/).

Our implementation performs a visible guest heartbeat every five seconds and
state synchronization every fifteen seconds; the parent refreshes time every
minute. A fifteen-minute registered foreground visit contributes approximately
240 guest periodic calls and 15 parent time calls, plus initial requests, assets,
registration, transitions, retries and staff actions. This is a source-code
estimate, not a cloud measurement. D1 billing counts scanned/written rows rather
than HTTP calls; indexes, transactions and audit writes matter. Measure actual
Worker CPU and D1 metadata before any approved scale test. Do not run an
unbounded test, assume all account allowances are unused, or enable paid logging,
analytics, load testing or unrelated services.

## Provisioning sequence with no public interval

1. Inspect authenticated account/zone ownership and current plan/usage read-only.
   Record exact new names, both hostnames, allowlisted testers, verified station
   identities, session/MFA policy, intended usage and expected cost. Obtain the
   owner's required cost and staging DNS approvals. Credentials remain in secure
   CLI/dashboard mechanisms, never chat or committed files.
2. Create and verify both narrow Access applications before connecting public
   routes. Record their distinct audiences and issuer. Do not add Bypass,
   Everyone, broad email-domain, or account-admin policies as substitutes for
   the approved lists.
3. Create the fresh staging D1 resource and apply only the reviewed staging
   schema. Prepare a Worker that denies every request with missing/invalid
   configuration, rejects non-approved hosts and validates JWTs before assets.
   Upload with no custom domains/routes, `workers_dev=false`,
   `preview_urls=false`, and no preview/deployment aliases. Configure fresh
   staging secrets through the secret facility.
4. Prepare fail-closed station authorization and artificial rehearsal windows
   separately from unconfigured production holiday hours. Verify the derived
   bundle, current-page preservation and exact TEST ONLY — NOT REDEEMABLE labels.
   Staff operations remain denied until signed identities are provisioned.
5. After explicit DNS approval, attach only the two approved custom hostnames.
   Attaching a Worker Custom Domain creates a DNS record automatically, so it
   is a DNS change even without a separate DNS command. [Custom Domain behavior](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)
6. Before sharing links, probe without cookies: every page, asset and API on
   both hosts; each staff path; all known Worker/version/preview/alternate URLs;
   and an unapproved hostname. Authentication redirects or denial are expected;
   business pages, celebration assets and API data must not be returned. Verify
   an allowed tester reaches guest content but cannot access staff, and each
   actual station identity is independently restricted to its backend location.
7. After real protected sign-in, provision only the verified approved subjects
   and their single fixed assignments. Run the real Access/D1 cloud tests with
   approved accounts. Redact JWTs,
   cookies, names, pass codes and request bodies from durable artifacts. Report
   browser automation separately from actual iPhone checks. Keep the production
   loader and all production routing unchanged and disabled.

To disable staging, first revoke its allow policies or deploy a staging-only
deny-all response while protection remains present. Remove only its approved
custom domains/routes and confirm they no longer serve staging; only then remove
Access applications. Delete/export the staging database according to the owner's
retention decision, revoke its secrets, and remove its Worker. Check any
staging-created certificate remains isolated before removal. Never delete Access
first while a serving origin is still reachable. No production cleanup is
included.

Cloud results, real Access revocation/expiry, JWKS rotation/outage, HTTPS cookie
behavior, D1 race/retry behavior and the two physical iPhones remain pending until
tested. This document alone marks none of them passed.

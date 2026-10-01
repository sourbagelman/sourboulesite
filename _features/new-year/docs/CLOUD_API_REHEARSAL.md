# Real-cloud API rehearsal

`staging/cloud-api-check.mjs` uses Playwright HTTP contexts with **genuine browser
storage states from real Cloudflare Access sign-ins**. It sends requests to the
approved private staging service and its real D1-backed handlers. It does not
inject JWTs, substitute authentication, provision resources, modify Access/DNS,
or expose/set a clock endpoint. Running it intentionally creates and redeems
**TEST ONLY — NOT REDEEMABLE** staging passes.

This harness has been prepared and locally unit-tested. Those tests are not a
claim that a cloud phase has passed. Each actual cloud invocation writes a
sanitized result with request count and individual observed checks.

## Private inputs

Use `context.storageState()` files from the real guest/tester and each approved
station sign-in. The guest file must include the service-root tester Access
cookie; station files must include their protected `/staff` Access cookie.
The native browser setup helper establishes these scopes through ordinary
sign-in. Never paste cookie/JWT contents into a terminal command or conversation.

All storage-state inputs and outputs must be JSON inside this feature's ignored
`.local/` directory. Existing source files cannot be chosen as output. Generated
run data and reports have mode `0600`. The private run file contains anonymous
session cookies and test codes: never commit or publish it. Reports omit names,
emails, subjects, pass codes, headers, cookies and raw network error details.

The same genuine browser state may serve as the guest and Fort Worth input if
that signed-in identity is approved for both. Fort Worth and Willow Bend must
be different approved station identities; the API verifies their fixed backend
assignments before any redemption.

The approved staging assignments are **Lance → Willow Bend** and **Alexis → Fort
Worth**. Use `.local/cloud-browser-lance/storage-state.json` for `--wb-state` and
`.local/cloud-browser-alexis/storage-state.json` for `--fw-state`. Either approved
root tester profile can supply `--guest-state`.

## Invocation and timing

From `_features/new-year/`, use actual approved paths and service origin:

```sh
node staging/cloud-api-check.mjs \
  --phase eligibility \
  --service https://APPROVED-PRIVATE-STAGING-SERVICE \
  --guest-state .local/GUEST/storage-state.json \
  --fw-state .local/FORT-WORTH/storage-state.json \
  --wb-state .local/WILLOW-BEND/storage-state.json \
  --run-file .local/cloud-rehearsal-01.json
```

Without `--execute`, this only validates options and prints a dry-run notice. It
makes no requests. Add `--execute` only when the actual private staging setup,
profile files and deployment-owned timeline are ready. Known production origins
are rejected. Do not point this tool at another project.

If this computer retains a stale negative DNS answer after the approved domain
was created, add `--browser-dns`. This resolves only the exact approved service
hostname through `1.1.1.1`, then runs headless Chromium with a DNS-only host rule.
The HTTPS hostname, SNI, certificate checks, Secure/HttpOnly cookie handling and
real Access authorization remain intact. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to
an installed Chromium executable if Playwright's default is unavailable.

Each authenticated context first navigates normally to read-only `/api/time`.
This allows Cloudflare Access to renew its cookie through the already signed-in
SSO session when required. It must return the actual service's JSON successfully;
otherwise the phase stops. No login credential is invented or supplied. Empty
anonymous contexts skip this preflight. Reports distinguish these navigations
and their ordinary SSO redirects from the explicit API request count.

That optional transport intercepts exactly one unique blank document **inside
the test browser** so native same-origin `fetch` can run without the application's
heartbeat or the JSON document's restrictive CSP. It does not create a server
route or change any server CSP. Every API request still goes to real HTTPS
staging; no API route is intercepted. Browser cookies select their real path and
audience naturally. Reports explicitly identify this synthetic client transport
document. A blocked opaque redirect is reported only as no direct anonymous API
success; the separate privacy probe verifies the actual Access login destination.
The browser stays headless and does not take focus from foreground visual tests.

The operator changes the **deployment's server-only staging anchor**, using the
existing approved staging configuration workflow, between phases. The script
never changes time, and does not accept a timestamp command-line option. Do not
reanchor while a phase is running.

| Phase | Required virtual server time | Actual checks |
| --- | --- | --- |
| `eligibility` | Start 15–60 seconds before midnight | Six registered anonymous sessions; final pre-observations at −12 seconds; concurrent normal qualification at +1 second; discarded-response recovery in a fresh HTTP client; hidden and post-only rejection; late registration rejection; brief reconnection at +45 seconds; late reconnection rejection after +93 seconds; unique stable codes for equal display names; repeated claims; client timestamp/eligibility claims cannot unlock a pass |
| `redemption` | After 00:05 and before the artificial 01:00 closing | Same stored pass after the earlier phase, real fixed station identities, invalid demo code rejection, verification, simultaneous two-location redemption with one winner, retry confirmation, other-location used state, same-request-ID double tap, no-purchase payload, and no-Access denial |
| `outside-hours` | After artificial 01:00 closing, before global expiry | Both locations reject verification/redemption of the reserved unredeemed test pass |
| `expired` | January 4, 2027, after 00:00 Chicago and before session support cutoff | Saved pass changes to expired; verification and redemption enforce expiry |
| `revoked-fw` | After the operator temporarily deactivates the approved Fort Worth staging row | Fort Worth `me`, verify and redeem are denied while Willow Bend remains assigned; the harness makes no role changes |

Eligibility takes roughly 2–3 minutes of real elapsed time. It stops after four
minutes or 200 requests rather than polling indefinitely. Later phases are
shorter and use the same private run file. Complete eligibility before other
phases; complete outside-hours before expiry. A completed redemption phase will
not silently run again. Use a new run filename and fresh eligibility rehearsal
when new passes are needed. Leave the reserved reconnect pass unused until the
outside-hours/expiry checks finish.

The currently prepared staging SQL uses artificial windows from virtual midnight
to 01:00 for both locations. These are **not restaurant hours**. If a reviewed
staging fixture changes, update the expected phase assertions explicitly; never
infer or populate actual January 1–3 holiday hours from this harness.

## Interpretation and limits

The result is real cloud API evidence only when the actual invocation succeeds
with genuine Access cookies on the deployed service. Its Node unit tests use
local fixtures to test guardrails and redaction, not cloud substitutes.

The lost-response case deliberately discards the real issuance response body and
creates a new HTTP context with the saved session. This is a **client simulation
against real cloud state**, not proof of Wi-Fi failure or Safari suspension.
Server presence timing and both-location writes are real remote requests. The
harness does not deliberately corrupt or bypass Access cookies to fabricate an
expired session.

Actual Access session expiry/revocation, native authenticated iframe behavior,
saved image usability, numeric keyboard, physical iPhone connectivity, and
screen-reader checks must be recorded separately. A `revoked-fw` pass means the
backend identity row was really deactivated, not that an Access login session
was revoked. Restore that test row only through the approved operator workflow.
No physical-phone check is inferred from these HTTP tests.

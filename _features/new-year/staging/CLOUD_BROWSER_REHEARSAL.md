# Authenticated private-cloud browser rehearsal

This helper opens a real headed Chromium browser against the approved private
staging hosts. It never deploys, changes the server clock, injects Access tokens,
sets station assignments, or changes production. Run it from `_features/new-year`.
The configuration is the already reviewed `.local/approved-staging.json`.

## Sign in privately

```sh
node staging/cloud-browser-check.mjs login .local/approved-staging.json --profile lance --staff
node staging/cloud-browser-check.mjs login .local/approved-staging.json --profile alexis --staff
```

Run these sequentially. The owner completes genuine Cloudflare Access sign-in
directly in each browser window. Never send PINs, passwords, cookies or tokens to
chat. The helper visits the service top-level pass page, the website, and then
`/staff/identity`. This establishes the separate tester and staff Access scopes.
An authenticated staff identity does not itself assign a location; that remains
an independently approved server setup step. The identity page has a restrictive
CSP, so the helper reads its rendered JSON without issuing a fetch from that page.

The private browser profiles are `.local/cloud-browser-lance` and
`.local/cloud-browser-alexis`. Each holds `storage-state.json` (Playwright's native
cookie/storage format) and, with `--staff`, `verified-identity.json`. Directories
are mode 0700 and JSON files mode 0600. All are ignored by Git. A genuine storage
state can be consumed by the API rehearsal helper without exposing a JWT to chat
or adding an authorization header. Never run two Chromium instances against the
same profile, copy these files outside `.local`, or commit them. A profile is
sensitive even after its exported JSON has been removed.

If the operating system temporarily caches a negative DNS result, the operator
may append `--resolve-ip PUBLIC_IPV4` **only after independently verifying that
address for both approved hosts**. This changes Chromium's host resolver for the
two exact hosts; certificate verification remains enabled. Never use a wildcard
resolver rule, ignore HTTPS errors, or disable browser security. The default
uses ordinary DNS. An optional `PLAYWRIGHT_CHROMIUM_EXECUTABLE` names an installed
Chromium executable; the default uses Playwright's installed browser.

## Run one bounded scenario

```sh
node staging/cloud-browser-check.mjs run .local/approved-staging.json --profile lance --scenario opening --page index --viewport 375x812
```

Keep the headed browser foreground while a boundary scenario is running. The
helper reads authenticated server time, then waits for normal application timers.
There are no guest clock parameters, fake lifecycle events, refresh shortcuts at
the event boundary, or local-lab controls. Only the separately named `device-clock`
scenario simulates browser Date; all other scenarios leave it untouched. The only
shadow-root instrumentation observes the real parent's closed root so its
independent Continue control can be tested with a native mouse click.

The operator configures the server anchors separately, using the authorized
staging deployment workflow. This helper cannot set them. Fixed Chicago event
times remain authoritative: opening `2027-01-01T05:50:00Z`, midnight
`2027-01-01T06:00:00Z`, and ending `2027-01-01T06:05:00Z`.

| Scenario | Required server time | Checks |
|---|---|---|
| `opening` | 12–125 seconds before opening; about 90 seconds is practical | Already-open current page opens automatically without refresh; exact staging labels, year, iframe layout. |
| `active` | During the active window, at least 20 seconds before ending | A new arrival opens the actual embedded experience immediately; correct year and no horizontal overflow. |
| `continue` | Active window, at least 20 seconds before ending | Guest Continue restores the same original page and its existing DOM; dismissal survives reload and same-tab navigation. |
| `midnight` | 12–125 seconds before midnight; about 60 seconds is practical | Fresh promotion session registers, stays visible, switches ivory 2026 to 2027, displays Happy New Year, receives a server-issued non-redeemable pass, and uses the Secure HttpOnly host cookie. |
| `ending` | 12–125 seconds before ending; about 60 seconds is practical | The takeover disappears naturally at 12:05 AM, preserving the exact original URL, content, order links and seasonal nodes. |
| `recovery` | After midnight and before session expiry; this profile already earned a pass | Top-level recovery and reload preserve the same code; native image download succeeds; all pass text remains test-only/no-purchase. |
| `failure-time` | Active window | Explicit browser network-loss injection for `/api/time` leaves the actual website and Order Online disclosure usable. |
| `failure-frame` | Active window | Explicit browser network-loss injection for the embedded document retains the independent labeled Continue button and original website. |
| `device-clock` | Active pre-midnight window, at least 20 seconds before midnight | Explicit client Date simulation advances browser Date beyond midnight in a separate context; real server time must still show 2026 and withhold eligibility and a pass after test registration. |

Every run opens a new tab in the selected authenticated profile. Only the
`continue` scenario checks dismissal within the same tab. Existing earned passes
and native guest cookies remain across runs. Therefore, run `midnight` once with
a fresh promotion session; it intentionally refuses to overwrite an existing
entry. To test a second issuance, use a separately prepared authenticated test
profile or an explicitly approved fresh promotion session. Never reset real
Access authentication or server records merely to make a check pass.

The `device-clock` scenario clones genuine Access cookies into a separate native
browser context and removes only `__Host-sb_nye` from that temporary context. It
does not change the main profile, the OS clock, or the server clock. Browser Date
is simulated only on the two staging origins; `performance.now()` stays real,
and Access sign-in hosts are not modified. The test guest's temporary promotion
cookie is not exported. This is an explicitly labeled **client Date simulation**,
not evidence of a physical iPhone clock-setting test. Existing seasonal client
code may naturally reflect that simulated browser date during this scenario;
the approved source and server configuration remain unchanged.

Supported viewports are `320x568`, `375x812`, `768x1024`, `1366x768`, and `1440x900`.
Supported pages are the 12 current public pages: `index`, `brand-home`,
`fort-worth`, `willow-bend`, `menu`, `willow-bend-menu`, `menus-order`, `locations`,
`about`, `catering`, `events`, and `contact`. Repeat the applicable scenarios and
pages at the necessary sizes; one successful size does not imply all sizes pass.
An Access redirect, stale session, wrong timing window, or missing earned pass
must be resolved as its own prerequisite. Do not weaken authentication.

The helper stores sanitized reports and screenshots under the selected private
profile's `run-*` directories. Saved test PNGs include codes, so they must remain
private and must visibly say **TEST ONLY — NOT REDEEMABLE**. Inspect the saved PNG
watermark and approved fireworks visually; automated canvas/download presence
checks alone do not establish visual approval. No HAR or trace captures are
generated. Unexpected browser error details and cookies are not printed. Staging
deliberately blocks production analytics via CSP; those expected violations are
counted separately. It preserves business links and form markup, so do not follow
production order links or submit customer forms during manual inspection.

These are real-cloud desktop Chromium checks only when actually run against
authenticated deployed staging. The unit tests merely validate harness guards;
they do not prove cloud success. Physical iPhone sign-in, Saved Photos watermark,
touch keyboard, foreground reconnect/screen-lock behavior, station switching and
real-device cookie policy still require the separate `IPHONE_REHEARSAL.md` pass.

# Completed private staging delivery

**TEST ONLY — NOT REDEEMABLE. Production is not launched.**

Delivered September 27, 2026 (America/Chicago), on
`feature/new-year-cookie-promotion`, starting from `d87788f16a8d7d03c5365035f6dece6098a97ce9`.
The approved experience is unchanged. No further timed rehearsal is scheduled.

## Final private links

| Link | Purpose |
| --- | --- |
| [Visual celebration preview — TEST ONLY](https://nye-staging.thesourboule.com/new-year-preview/) | Review the entire approved experience at any time, independently of the staging event clock. |
| [Private current website](https://nye-staging.thesourboule.com/) | Current website and approved seasonal implementation, with a private-only banner linking to the simulation and API-backed guest page. |
| [API-backed guest / saved pass](https://nye-service-staging.thesourboule.com/?pass=1) | Actual isolated staging service and previously earned staging passes, governed by the unchanged server clock and eligibility rules. |
| [Authenticated staff station](https://nye-service-staging.thesourboule.com/staff/) | Actual fixed-station staging verification/redemption. Lance remains Willow Bend; Alexis remains Fort Worth. |

Both approved testers use the existing Cloudflare Access email one-time-code
sign-in and 12-hour sessions. Staff retains its independent Access application
and backend station assignment. No account-wide sign-in or MFA setting changed.

Use the preview's existing buttons: **11:50 / Opening** (2026), **Final minute**
(ball descent), **Last 10 seconds** (watch the natural year transition),
**Midnight** (2027 and fireworks), **Cookie unlocked** (sample earned pass), and
**12:05 / Return**. **Continue to the website** also opens the return screen;
**Open private website** returns to the actual private website in another tab.
The private website's banner links back to the same visual preview.

The existing **Staff flow**, **Connection loss** and **Reset** controls remain
visual simulations. Their sample code begins with zero, which the real backend
rejects. They change only the preview's separate local-storage record. They
cannot change server time, eligibility, real records or staff authentication.
The preview has no API adapter and its response policy blocks all fetch/XHR/
WebSocket connections, form submissions, iframes and workers. On-screen and
saved sample passes are explicitly **TEST ONLY — NOT REDEEMABLE**.

## Closeout changes and verification

- Derived five allowlisted static preview assets from the existing approved
  preview/renderers; preserved the original CSS and controls.
- Added the private website banner link and the authenticated, read-only preview
  route with an isolated content-security policy.
- Kept the seven real guest/staff service assets byte-identical to the preceding
  deployed build. Source website pages, seasonal files, both shipped loaders,
  backend business logic, Access apps and station assignments are unchanged.
- Focused local source/build/client checks: **18/18 passed**.
- Focused signed-JWT route/authentication checks: **3/3 passed**, including no D1
  writes for preview requests and no staff-authentication bypass.
- Independent website/seasonal isolation checks: **2/2 passed**. Every baseline
  tracked file remains byte-identical except the twelve previously approved
  disabled loader includes. Both source and generated loaders remain disabled.

- Focused actual-cloud Chromium closeout: **103 assertions passed**. Nine
  anonymous URL/asset checks redirected to the approved Access sign-in. Both
  existing manager sessions opened all four final links and retained the correct
  backend-fixed station. Simulation checks covered the natural 2026-to-2027
  transition, painted fireworks, descending ball, sample pass and PNG, Continue,
  return navigation, pass recovery, existing reset/offline/staff-demo controls,
  zero fetch/XHR/WebSocket/API requests, unchanged cookies and unrelated storage,
  and no unexpected preview CSP violations or JavaScript errors.
- All five scenes were checked for labels and horizontal overflow at 320×568,
  375×812, 768×1024, 1366×768 and 1440×900. Browser-emulated reduced motion passed.
  The saved TEST ONLY sample PNG and mobile return screen were visually inspected.
  This is desktop Chromium automation, not a physical-iPhone result.
- Two initial closeout harness attempts were incomplete: a network-idle timeout
  and a response-status property typo in the harness. The harness was corrected
  to use document readiness/the native Fetch status property; the final focused
  run passed. Neither attempt changed the event clock or issued/redeemed a pass.
- Read-only cloud comparison before/after passed: same Worker variables, event
  anchors, Custom Domain mappings, disabled workers.dev/preview URLs, four passes,
  two redeemed passes, two audit rows, two active stations, eight entries, 31
  presence rows and two artificial staging windows. No migration or reset ran.
- Final private Worker version: `96cd2040-45a8-486e-964b-0479c51d7bb5`.
  No full test-suite rerun was needed for this closeout.

Focused local commands (from `_features/new-year`):

```sh
node --test tests/staging-visual-preview.test.mjs tests/staging-build.test.mjs tests/staging-client.test.mjs
node --test --test-name-pattern='visual preview|every staging site/service/asset/API path|distinct staff Access audience' tests/staging-worker.test.mjs
```

The closeout browser report, screenshots and read-only cloud snapshots are private
local artifacts under ignored `.local/closeout-*`; no session data is committed.
The source commit can be identified by the message
`complete private New Year staging delivery` on the feature branch. The deployed
asset hashes match the source and transforms saved by that checkpoint.

## Existing evidence retained

The prior checkpoint's [cloud rehearsal record](CLOUD_REHEARSAL.md) retains the
actual results and limitations: **184 local source tests**, **86 local
workerd/Miniflare checks**, **37 anonymous cloud privacy checks**, **9 actual-site
cloud-browser scenarios / 113 assertions**, and **41 cloud API checks**. It also
records real staff-app revocation and renewed sign-in for both stations. These
are prior results, not a claim that the full suites were rerun for closeout.

## Pending release checks — not private-handoff blockers

- Both physical location iPhones; Safari, VoiceOver and Reduce Motion checks on
  those devices. Desktop Chromium automation is not physical-device validation.
- Actual elapsed 12-hour session expiry; real JWKS rotation/outage; sustained
  load and traffic acceptance; tested backup/restore and retention operation.
- Confirmed January 1–3 holiday hours/closures for each location, production
  support ownership, retention/cleanup and backup policies, production station
  and security acceptance, separate production configuration/resources, and
  explicit production release/DNS/loader authorization.

Holiday hours and unresolved production settings remain unconfigured. Existing
artificial staging windows are test fixtures only. The staging event clock is
unchanged from the preceding checkpoint, continues to advance, and is already
after the takeover. API-backed staging passes retain their actual expiry rules;
the visual simulation is available independently at any time.

No new resources, paid services, DNS changes, broader permissions, main changes,
push, merge or production deployment were performed for closeout. Only the
existing private staging Worker was updated. Secrets, local databases, browser
profiles, cookies and generated artifacts remain outside Git in ignored local
storage.

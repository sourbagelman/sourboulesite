# Local New Year checkpoint

Branch: `feature/new-year-cookie-promotion`.
Implementation baseline: `b08545ed37a2e9388ff8e565c50ab36d2eb89712`.
The local checkpoint commit contains the intended feature source, tests and
documentation plus the disabled website loader and its twelve additive includes.
Use `git log -1` on this branch to identify the checkpoint commit.

No release is enabled or authorized by this checkpoint. No push, merge, public
preview, deployment, DNS change, or cloud resource creation was performed.

## Actual website integration coverage

Source: `scripts/browser-integration-check.cjs`, running the actual repository
pages through the loopback site harness and the service in a different loopback
origin. This is not the standalone celebration preview. The harness substitutes
an enabled loader only in its local HTTP response; the shipped source and asset
both retain `const ENABLED=false;`.

The original 60 page/viewport matrix proves page preservation and dismissal after
reload, but it deliberately dispatches a visibility event when jumping the lab
clock. It therefore was not, by itself, sufficient proof of unattended activation
at 11:50. The focused checkpoint scope adds real advancing-clock coverage without
refresh, synthetic visibility/pageshow events, direct application sync calls, or
application timer overrides.

| Required behavior | Specific test / result |
| --- | --- |
| Visitor already on a normal page receives the takeover at 11:50 PM Chicago | `Already-open homepage crosses 23:50 automatically; Continue persists through ticks and same-tab navigation` — PASS |
| Visitor arriving during the active window receives the takeover | `Active-window arrival naturally changes the prominent year from 2026 to 2027 at midnight` — PASS |
| Continue prevents reopening in the same browsing session | `Already-open homepage crosses 23:50 automatically; Continue persists through ticks and same-tab navigation` checks ongoing ticks and same-tab navigation; existing `Current <page> at <width>x<height>` matrix also passes reload persistence for all 60 combinations |
| Prominent year changes from 2026 to 2027 at midnight | `Active-window arrival naturally changes the prominent year from 2026 to 2027 at midnight` — PASS; existing `Native guest/staff flow at <width>x<height>` also passes server-anchored year change at all five sizes |
| 12:05 automatically removes the takeover and reveals the same current page | `Natural 00:05 removal reveals the same original current-page DOM` compares original DOM node identity and business/seasonal markup; existing `Long-open event reaches 12:05 and recovery expiry without reload` passes |
| Earned pass remains available afterward | `Native guest/staff flow at 320x568`, `375x812`, `768x1024`, `1366x768`, `1440x900`: all pass, 121 assertions total; each recovers the same persisted pass through the actual site's post-event link and native browser cookie |
| Service failure does not trap the visitor | `Time-service failure leaves the website usable`: pass; `Iframe failure retains an independent parent Continue control`: pass. Missing trusted time leaves the normal page visible; iframe failure retains a working independent exit |

The earlier native integration suite passed 74 scenarios / 1,113 assertions with
zero findings, JavaScript errors, CSP violations or unexpected external requests.
These existing results apply to unchanged runtime code. The focused checkpoint scope additionally passed **3 scenarios / 49 assertions**,
with zero findings, JavaScript errors, CSP violations or unexpected external
requests.

## Focused timer results and reproduction

- `Already-open homepage crosses 23:50 automatically; Continue persists through ticks and same-tab navigation`: **23/23 assertions passed**. The parent made its scheduled time request at 60.427 seconds and opened at 70.482 seconds after a server-clock start 70 seconds before 11:50. The 500 ms loader poll accounts for the sub-second opening delay. No refresh or synthetic lifecycle event was used. Continue suppressed later ticks and same-tab navigation to Locations.
- `Active-window arrival naturally changes the prominent year from 2026 to 2027 at midnight`: **13/13 passed**. The advancing clock reached midnight after seven seconds; the visible/accessibility year changed at 7.013 seconds, without a state jump or page refresh.
- `Natural 00:05 removal reveals the same original current-page DOM`: **13/13 passed**. The overlay closed at 7.013 seconds in a run started seven seconds before 12:05. The same Contact document, main/header/footer and seasonal DOM nodes remained, with unchanged markup/ordering and a visible recovery link.

The 11:50 case exercises normal periodic polling and monotonic elapsed time on an
already-open, foreground page. It does not assert exact scheduling on a suspended
physical phone. Dismissal uses the documented same-origin **tab session**; it is
not an account-wide or cross-device preference.

With the loopback backend and current-site preview running, from the feature
directory execute:

```sh
NYE_QA_SCOPE=checkpoint npm run browser:check
```

Set `NYE_CONTROL_TOKEN` to the backend's local control token if not using the
published local test fixture token. An existing browser can be selected with
`CHROMIUM_EXECUTABLE_PATH`; `NYE_QA_DIR` selects output. The checkpoint scope takes
about 90 seconds because it waits on real browser timers. See [LOCAL_RUN.md](LOCAL_RUN.md)
for server commands. The only new runtime test behavior is in the test harness;
no feature application source, website content or approved styling changed in
this checkpoint pass.

## Change boundary and commit review

The test `every original tracked file is byte-identical except one disabled
script include per visitor page` passes against the implementation baseline.
It compares the Git blob of every original file after stripping exactly one
intended include from each of the twelve visitor pages. Menus, hours, prices,
ordering URLs, forms, SEO, photos, shared code and all approved seasonal files
remain unchanged. No page was restored from a snapshot.

The pages are `index.html`, `brand-home.html`, `about.html`, `catering.html`,
`contact.html`, `events.html`, `fort-worth.html`, `locations.html`, `menu.html`,
`menus-order.html`, `willow-bend.html`, and `willow-bend-menu.html`.
Their only addition is:

```html
<script defer src="assets/js/new-year-2027.js"></script>
```

`production loader is disabled and has no DOM, storage or network effects` and
`service public assets exclude local lab, samples, preview controls and
credentials` both pass. The complete Node suite was rerun for this checkpoint:
**95/95 passed**.

The staged diff is limited to `_features/new-year/`, the generated disabled
`assets/js/new-year-2027.js`, and the twelve includes. Local databases, secrets,
browser profiles, dependency directories, runtime wrappers, QA output and
temporary files are excluded. The offline preview is an intentional, labeled
feature artifact outside the service's deployment assets. The local harnesses
and test fixtures are intentional test source, not production credentials.

## Inputs and authorizations for a separate private cloud rehearsal

1. Explicit approval to create and deploy a **private staging-only** Worker, a
   separate fresh D1 database, Access applications/policies and staging secrets
   in the specified Cloudflare account/zone; approve any associated costs.
   Separately authorize any staging hostname/DNS changes if needed. No production
   deployment, live-loader activation or main-branch push is included.
2. Approved private staging hostname and allowed tester identities, plus secure
   account/CLI access to perform that setup. Configure the resulting D1 ID,
   Access team/issuer and audience, and a separately generated server-side secret
   through Cloudflare tooling. Do not send credentials in chat or commit them.
3. Two station identities, each with its verified Access subject/email and exactly
   one backend assignment: Fort Worth or Willow Bend. Identify the manager who
   will sign in each designated iPhone; approve the session duration and MFA/
   reauthentication policy.
4. Actual January 1–3, 2027 hours or closures for both locations to verify real
   operating-window boundaries. Artificial hours may be used only as explicitly
   labeled, isolated rehearsal fixtures; they must never become production hours.
5. Expected peak attendance, support owner, and approved test-data retention and
   backup/restore expectations for the private rehearsal.

Full setup and release gates remain in [CLOUD_RELEASE.md](CLOUD_RELEASE.md).
Cloud resources, real Access, production-style HTTPS/subdomain cookies, cloud
persistence/concurrency/load, backup/restore and retention operations are **not
yet verified**. Neither physical station iPhone has been tested. iPhone Safari
sign-in/session behavior, touch/keyboard use, guest screen lock/reconnect and
screen readers remain **not yet verified**. Desktop Chromium automation at phone
viewport sizes is not a physical-device test.

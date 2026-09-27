# New Year implementation — local preparation, September 27, 2026

Implemented the locked revision 4 countdown and **one free cookie, no purchase
required** promotion in a separate local feature worktree. Live integration is
disabled. This implementation is saved in the local checkpoint described in
[LOCAL_CHECKPOINT.md](LOCAL_CHECKPOINT.md). No push, merge, deployment, public
preview, DNS change, cloud resource creation, or production configuration change
was made.

## Repository and package

- Repository: `sourbagelman/sourboulesite`.
- Local branch: `feature/new-year-cookie-promotion`.
- Implementation baseline: `b08545ed37a2e9388ff8e565c50ab36d2eb89712` — the approved
  seasonal integration. The subsequent local checkpoint preserves this baseline;
  its commit is available through `git log -1` on the feature branch.
- Remote `main` remains `6d7ba10f370727f86d63a7e2d285152e23790f45`; remote redesign
  remains `d49eea7ac1969854d127023391d3c24aea08a6ac`. Remote seasonal branch remains
  `b08545ed37a2e9388ff8e565c50ab36d2eb89712`.
- GitHub Pages remains built from the same `main` commit. Existing worktrees and
  earlier uncommitted manual-update work were preserved.
- The supplied `New Year Codex Package.zip` was extracted separately. Its folder
  `sour-boule-new-year-locked` identifies revision 4 as authoritative. Handoff,
  README and test report were read before implementation. Old test results were
  retained as historical context, not counted as verification of this build.

## What changed

The feature is isolated under `_features/new-year/`: Worker source, fresh D1
migration, service guest/staff assets, offline preview, local harnesses, tests and
setup documentation. The Worker deploy allowlist consists of `src/worker.mjs`
and its imports plus the seven `public/` files. Preview controls, simulated auth,
test clocks, sample passes, local databases, and generated runtime wrappers are
outside deployment assets.

`assets/js/new-year-2027.js` is generated from the feature loader and has
`ENABLED=false`. Exactly one deferred include was added to each of these current
pages: `index.html`, `brand-home.html`, `about.html`, `catering.html`,
`contact.html`, `events.html`, `fort-worth.html`, `locations.html`, `menu.html`,
`menus-order.html`, `willow-bend.html`, and `willow-bend-menu.html`.

An automated Git-blob comparison verifies every pre-existing tracked file is
byte-identical after removing only those twelve exact script includes. This
covers menus, prices, hours, addresses, phone numbers, ordering URLs, forms,
analytics, Bitcoin copy, metadata, photography and all approved seasonal files.
The disabled loader makes no requests and changes no DOM. No preview snapshot
replaced a website page.

Implemented defect fixes while preserving the approved experience:

- Server time is sampled after complete request-body receipt, preventing delayed
  registration/presence/redemption requests from retaining an earlier timestamp.
- Ordered pre-midnight observations prevent an older visible signal overwriting
  a newer hidden signal, or an older hidden signal erasing a valid return.
- The atomic redemption write rechecks the active staff identity and its single
  fixed station, including a revocation/reassignment racing the request.
- Continue exits immediately even if the network is slow. Escape from inside the
  cross-origin iframe uses that same exit path. Parent Continue remains usable
  even if the iframe fails to load.
- Stale asynchronous state responses cannot rewind the view/year or repaint a
  destroyed preview. Reconnect clears stale errors. Registration retry retains
  the name after uncertain state recovery.
- Staff retries after JSON or HTML server failures reuse the same redemption
  request ID; they do not authorize an extra cookie.
- Pass recovery survives overlapping initial/pageshow requests. Unchanged pass
  refreshes preserve keyboard focus on Save/Copy. Ended live pass views return to
  the actual website. Accepted long names wrap safely at 320 pixels.
- The loader validates the event schedule, ignores obsolete time responses,
  updates recovery visibility at event/support boundaries, restores focus without
  jumping scroll, and includes mobile safe-area spacing. It retains the actual
  underlying document and its theme.
- Local servers use distinct loopback origins, explicit lab-only cookies/auth,
  loopback-only iframe policy and foreign-Host rejection. Lab passes and exported
  images remain TEST ONLY. Production cookies/CSP/Access checks stay separate.
- Pinned reproducible test tooling and build checks. Dependency audit reports
  zero known vulnerabilities; production has no npm runtime dependencies.

The D1 initial schema adds `entries.pre_observed_ms`. It is for a fresh database;
it is not an implicit upgrade of an earlier populated database. The lab rejects
an older schema rather than silently losing data.

## Locked behavior retained

All event instants use America/Chicago: takeover Dec 31, 2026 at 11:50 PM;
descent at 11:59 PM; ivory **2026 → 2027**, Happy New Year and approved fireworks
at midnight; takeover removal Jan 1 at 12:05 AM. Reduced motion and earned-pass
access remain available. The ball/fireworks design and seasonal themes were not
redesigned.

Eligibility still requires a server-received visible observation in the final
30 seconds before midnight and a visible observation from midnight through
90 seconds afterward. Observed pre-midnight hidden/leave evidence invalidates
the candidate. Names remain display data, not unique identifiers. Device clocks
and query parameters cannot issue passes.

One persisted, single-use five-digit code per eligible entry; either station
can redeem it once, with atomic shared state and audit. Staff enter five digits,
Check code, Redeem cookie, Next guest. No guest login, location picker, QR scan,
purchase minimum, receipt or purchase checkbox was added. Redemption ends by
January 3 during the selected station's actual operating hours; unconfigured
windows fail closed. No January holiday hours were invented.

## Tests actually executed on this implementation

| Layer | Result | Scope |
| --- | --- | --- |
| Node backend/auth/content/isolation suite | 95/95 pass | Original 72 plus 23 new regressions; SQLite and locally signed JWTs/mocked JWKS |
| Local workerd + Miniflare D1 | 17/17 pass | Actual local runtime/binding, persistent storage across restart, duplicate recovery, atomic concurrent redemption and one audit |
| Supplied visual UI suite, expanded | 47/47 pass | Offline approved preview, five widths, no-purchase copy, sample PNG and controls |
| Supplied exact year-boundary suite | 13/13 pass | Monotonic event clock, midnight boundary, altered device clock, reduced motion |
| Added frontend regressions | 17/17 pass | Retry/focus/async/recovery defects, long names, labeled lab pass/PNG |
| Supplied combined HTTP/browser suite | 10/10 pass | Local backend with persistent SQLite through a fetch bridge; rerun on final frontend |
| Native cross-origin current-page matrix | 960 assertions pass | All 12 pages at all five required viewports; actual DOM/theme retained |
| Native cookie guest/staff flows | 121 assertions pass | All five viewports; current final frontend, recovery after 12:05, both fixed stations, no-purchase payload and single use |
| Final native boundaries and failure modes | 32 assertions pass | Native iframe Escape, reduced motion, expiry, forged messages, outages and disabled integration |
| Worker bundle dry run | Pass | Final source, no deployment; local lab controls absent from production entrypoint |
| Git/whitespace/content verification | Pass | `git diff --check`, new-file whitespace checks, original-file hash comparison |

Viewports: **320×568, 375×812, 768×1024, 1366×768, 1440×900**. Screenshots were
inspected, including mobile guest and station screens. Font rendering differs
between the package's OS and this Mac; the supplied font stack was preserved.
The native suite totals **74 scenarios and 1,113 passing assertions**, with zero
findings, JavaScript exceptions, CSP violations or unexpected external requests.
No horizontal overflow was found in the completed matrix and native flows.

Runtime versions: Node 25.9.0; Wrangler 4.142.0; Miniflare 5.20260926.0-alpha;
workerd 1.20260926.1; Playwright 1.63.0. The local Cloudflare simulator is not the
remote Cloudflare service. Native browser checks use desktop Chromium mobile
emulation and different loopback ports, not real Safari/iPhones or HTTPS
subdomain cookies. Synthetic fixtures and passes are not production rewards.

## How to run

From `_features/new-year`, run `npm start` in one terminal and `npm run site:preview`
in another. Open `http://127.0.0.1:8788/` for the current website beneath the local
takeover. Guest backend is `http://127.0.0.1:8787/`; staff lab sign-in is
`http://127.0.0.1:8787/__lab/login`. The backend prints local-only station/control
tokens. Follow [LOCAL_RUN.md](LOCAL_RUN.md) for clock controls, persistent data,
offline preview, setup and complete test reproduction.

## Still required before release

**Not run:** remote Worker/D1 deployment, real Access sign-in/key rotation,
production HTTPS/cross-subdomain/Safari cookie checks, physical iPhone/Android,
screen readers, expected-attendance load testing, actual holiday closing
boundaries, cloud backup/restore, and approved retention/purge operations.

Owner inputs: actual January 1–3 hours/closures for both locations; authorized
Cloudflare account/zone and service/staging hosts; the two verified station
identities; Access session/MFA policy; capacity/support/retention expectations;
and separate authorization for cloud staging followed by production release.
No credentials or holiday hours were guessed. Missing setup blocks cloud and
physical-device verification, not this completed local implementation.

See [CLOUD_RELEASE.md](CLOUD_RELEASE.md) for the read-only hosting findings, exact
resource/binding/secret/Access/window setup and release checklist. The production
loader remains disabled. Nothing was pushed, merged, published or deployed,
and no DNS or cloud resources were changed.

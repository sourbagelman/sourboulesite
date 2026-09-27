> **Current local implementation:** see [Local run instructions](docs/LOCAL_RUN.md),
> [Cloud setup and release checklist](docs/CLOUD_RELEASE.md), and
> [Current verification](docs/IMPLEMENTATION_REPORT.md), and
> [Local checkpoint](docs/LOCAL_CHECKPOINT.md). The original package
> description below is retained as provenance; its past test counts are not proof
> of this build. Website integration remains disabled.

# The Sour Boule / New Year 2027 / Revision 4 - final no-purchase lock

**Status: working visual preview + locally tested backend prototype. Not live.**

No GitHub writes, website deployments, DNS changes, Cloudflare resource creation,
or modifications to the approved seasonal designs were made for this delivery.

## Open the experience

Open `Sour-Boule-New-Year-Preview.html` in a modern browser. It is a self-contained
file: no installation, external images, fonts, network access, or backend is needed.
The prominent year reads 2026 until midnight, then switches to 2027 with the
fireworks. One free cookie, no purchase required. This package replaces the earlier
Final package; the remaining approved experience and five-digit flow are unchanged.
Use the top controls for opening, final minute, last 10 seconds, midnight, cookie
success, the 12:05 return, and staff flow. Registration in this file is simulated.
Every sample pass says TEST ONLY and uses 04271, a demo-range code rejected by the
real API. Choose Staff flow, enter 04271, tap Check code, then Redeem cookie. The
preview location-phone controls are NOT a location picker in the real staff UI.

The normal-site return deliberately contains a placeholder, not an old website
snapshot or a recreation of the approved seasonal theme.

## For Codex

Start with `CODEX_HANDOFF.md`. The architecture is in `docs/ARCHITECTURE.md` and the
verified testing scope is in `docs/TEST_REPORT.md`. `docs/SOURCE_NOTES.md` records
the repository inspection and primary technical references.

## Run the local backend lab

Use Node.js 22.13 or newer with its `node:sqlite` API. No npm packages are required
for this local harness; the runtime may print an experimental SQLite warning.

```sh
npm test
npm start
```

The console prints the loopback-only guest URL, staff sign-in URL, and randomly
generated Fort Worth / Willow Bend station tokens and a control token. Open the staff sign-in URL and paste the
LOCAL staff token. Do not reuse a lab token as a production secret.

The lab starts with a simulated server clock at 11:50 PM Chicago time on Dec 31.
Its SQLite database `.local/nye-v2.sqlite` and rate-key secret persist under `.local/`, which is excluded
from this delivery and version control. Restarting the process does not delete
entries or invalidate already-issued lab pass codes.

To set the LOCAL server clock for a test, use the control token printed by your
own process. This endpoint exists only in the loopback harness, not in the Worker.

```sh
curl -X POST http://127.0.0.1:8787/__lab/time \
  -H 'Origin: http://127.0.0.1:8787' \
  -H 'Content-Type: application/json' \
  -H 'X-Lab-Control: PASTE_YOUR_LOCAL_CONTROL_TOKEN' \
  --data '{"now":1798783190000,"freeze":true}'
```

That example is 11:59:50 PM Chicago. Register and remain on the guest page, then
set `now` to `1798783200000` for midnight. The browser reconnect/visibility event
or next heartbeat will perform the server eligibility check. A test redemption
window starts at `1798786800000` (1 AM) in the LOCAL lab only. This is deliberately
not a claim about either restaurant's actual hours.

To rebuild the standalone preview after source edits:

```sh
npm run preview:build
```

## Important separation

| Component | What it does | What it does not do |
| --- | --- | --- |
| Standalone HTML preview | Visual simulation, sample saved pass, simulated cashier flow | Real registration, eligibility, or shared redemption |
| Local backend lab | Same Worker business logic and SQL against persistent local SQLite | Real Cloudflare runtime, production Access, native cross-origin cookie verification |
| `public/` production-facing client | Calls server API; has no fake success adapter | Deploy itself or bypass staff security |
| `src/worker.mjs` | Real-time server checks, D1 queries, protected staff operations | Accept a client-selected event time |
| `src/integration-loader.js` | Proposed additive modal integration, disabled by default | Replace menus, hours, ordering, or seasonal themes |
| `wrangler.toml` | Unconfigured staging template | A working deployment or a live route |

The staff UI uses five-digit entry on one location-assigned iPhone per restaurant.
No QR scanner, location picker or purchase checkbox is needed. No purchase is
required. Redeem records only the single-use cookie redemption. Production codes
are 10000-99999.

**Fresh v2 database only:** the initial schema supersedes the unshipped v1 schema;
it is not an in-place migration for a populated v1 database. Never discard real
data. No production database is created by this package. Physical mobile testing, real Access authentication, cloud D1 verification,
holiday windows, capacity checks, and explicit release authorization remain open.


## Re-run browser checks locally

Python Playwright and Chromium must already be installed for these checks:

```sh
python scripts/ui-check.py
python scripts/year-check.py
# In another terminal start a fresh local lab for the combined check:
LAB_STAFF_TOKEN=local-test-staff-token LAB_WB_STAFF_TOKEN=local-test-wb-token LAB_CONTROL_TOKEN=local-test-control-token npm start
# Then:
python scripts/e2e-local-check.py
```

These published tokens are LOCAL-ONLY test substitutes, never real credentials.
Do not provision them in any cloud environment. The combined test uses a browser
fetch bridge and does not validate production HTTPS cookies or real Access.

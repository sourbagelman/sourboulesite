# Backend and data flow

## Topology

```text
Existing GitHub Pages site (keep current pages + approved seasonal theme)
    |
    +-- isolated, release-disabled loader --> GET service /api/time
    |                                          (public time only; narrow CORS)
    |
    +-- fullscreen dialog + service iframe during the 15-minute event
    |          |
    |          +-- Cloudflare Worker: static UI + same-origin guest API
    |                     |
    |                     +-- NEW D1 database
    |                         sessions / entries / presence / passes
    |                         staff roles / location windows / redemption audit
    |
    +-- permanent-through-support recovery link --> service /?pass=1

Approved staff browser --> Cloudflare Access --> protected Worker staff UI/API
                                                    |
                                                    +-- same D1 pass row
```

The event is a separate service, not a migration of the website. Main-site code
is an isolated loader, not a second copy of live content. A Workers custom domain
is only proposed; no hostname or resources were created. GitHub has Pages enabled
for the inspected repository, but DNS/proxy settings still need release-time review.

## Endpoint contract

| Endpoint | Authentication | Purpose |
| --- | --- | --- |
| GET `/api/time` | Public; narrow main-site CORS | Server time and immutable event schedule |
| POST `/api/session` | Same-origin request | Create/reuse anonymous secure browser session |
| GET `/api/state` | Optional session cookie | This session's entry/pass plus server time |
| POST `/api/register` | Session + same origin | Idempotent first-name entry during window |
| POST `/api/presence` | Session + same origin | Record visible/hidden server receipt; evaluate eligibility |
| POST `/api/claim` | Session + same origin | Idempotent retrieval/issuance using recorded eligibility |
| GET `/api/staff/me` | Verified Access JWT + active staff role | Identity and exactly one assigned station |
| POST `/api/staff/verify` | Same + same-origin write | Check pass status; does NOT consume it |
| POST `/api/staff/redeem` | Same + server-derived station | Atomic redemption and audit |

Guest writes do not accept client-selected eligibility time. A malformed request,
missing secret/database, unauthorized staff or outage cannot produce a successful
reward/redemption response. API responses are `no-store`. Input lengths and
content types are bounded. All SQL values are bound, not interpolated.

## Registration and eligibility

The session token is 256 random bits. A session has one entry per campaign,
enforced by the DB. First names are validated display data, never an identifier.
Repeated taps reuse the existing entry. Different sessions may share a name.

A visible heartbeat every five seconds updates a server-observed pre-midnight
candidate. A visible heartbeat within 90 seconds after midnight qualifies only
when a pre-midnight receipt occurred in the preceding 30 seconds. A known hidden
signal before midnight clears that candidate. Eligibility is latched in a D1 batch
with its presence data, before pass issuance. No cron has to issue every pass at
exactly the same instant.

Grace is an inference, not exact proof of attention. Device/app suspension can
prevent delivery; scripts can lie about visibility. The offer's low value and
accountless entry make conservative server timing plus a modest reconnect grace
a proportionate default. See the handoff for precise inclusive/exclusive bounds.

## Issuance and recovery

A five-digit code (10000-99999) is allocated and persisted for each eligible entry.
A private UUID is the record ID. Unique entry and campaign/code constraints prevent
duplicate issuance and code collisions. A lost response retrieves the same stored
code. A 12-collision fallback selects an unused gap atomically. Used codes are never
recycled during this campaign. The public API does not accept a five-digit code as
a session credential or provide public code search. 0xxxx codes are demo-only.

The API stores eligibility and passes centrally. The display never grants a
reward from localStorage, a phone clock, a name lookup, or a fake success screen.
Only the offline preview uses its own clearly labeled local simulation store.

After the takeover, the existing site links to the same service origin's recovery
screen. Its host-only cookie can retrieve the earned pass; a PNG/screenshot also
preserves the five-digit redemption code for protected staff verification. A lost session without a saved code is not recoverable
by name. Codes may be forwarded or copied, but only the first valid redemption
succeeds. No claim is made that a saved pass proves the presenter's identity.

## Shared staff iPhones

Two identities, one station each. A manager signs the Fort Worth and Willow Bend
phones into their corresponding protected sessions before service. The UI displays
the server-assigned station and no selector. Check code -> Redeem cookie -> Next
guest. No purchase is required. Redeem sends only `code` and `requestId`; the
backend does not require purchase confirmation, an amount, or a receipt.
The audit attributes use to the station identity, not an individual employee.

A missing/multiple location assignment fails closed. Verification requires staff
Access and active identity even though the code is short. Eight wrong codes per
minute temporarily lock the station lookup; tune after rehearsal. Never expose
this lookup to guests. Plan a 12-hour shift session, with manager reauthentication
on expiry; a shared phone is not assumed to be permanently authenticated.

## Atomic redemption

Verifying a pass is advisory; it does not reserve it. The final UPDATE checks
`redeemed_ms IS NULL`, expiry, issued time, and a currently open location window.
Only a matching unused row transitions. The audit trigger is part of that same
transaction. A parallel attempt at the other location cannot also win.

A staff-generated request ID supports safe retries after a lost response. The same
request can report that it was already confirmed, but cannot mark another new
redemption or tell staff to hand out a second cookie. Staff must wait for an online
confirmed result; there is no offline approval path.

The global cutoff is the end of Jan 3 Chicago. Configured windows enforce each
location's actual operating hours. The production migration seeds none. Artificial
local test windows must never be promoted into real configuration.

## Abuse, privacy, and failure limits

One entry per session is not one entry per person. Guests can clear cookies, use
private browsing, switch browsers/devices, or automate legitimate-time heartbeat
requests. Rate limits reduce abuse but do not solve identity. Do not add guest
accounts, email verification, aggressive device fingerprinting or new offer limits
without the owner's approval. Do not use IP address as a unique human identifier.

The Worker hashes its short-lived rate-limit key with a server secret and day
component; it does not store raw IP addresses in the application tables. Hosting
logs may have their own retention and must be reviewed. Names are used for the
promotion, not for unsolicited marketing. The service needs an agreed retention
cleanup and backup/restore plan before real collection.

The existing site must remain accessible during an API or iframe outage. The
loader fails open when it cannot obtain trusted time; its parent-level Continue
button remains available if the iframe fails. The guest view displays connection
failure rather than faking registration or issuing a reward. The current prototype
does not establish remote runtime capacity or promise issuance through a prolonged
backend outage with no recorded post-midnight presence.

## Isolation and change safety

The countdown does not parse a menu or derive event dates from live HTML. It has no
Square/API integration. Styling is confined to its service document; the small
main-site modal wrapper uses a shadow root. No normal-site body/theme state is
replaced. Exit restores the same document and focus. Add the loader to the latest
site revision with a minimal diff and a versioned asset URL.

Event redemption windows are explicit central operational data. Updating a menu
or routine hours display must not touch countdown logic. A real change to the
January 1-3 operating schedule must separately update those central event windows.
Keep normal menu data out of this package and never copy local preview pages into
the current public site.

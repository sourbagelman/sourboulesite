# Release gate

All unchecked items are still required. This is not permission to deploy.

- [x] Approved offer and dates reproduced in an isolated preview.
- [x] Simulations labeled and sample passes watermarked.
- [x] Current repository inspected read-only; Pages enabled and static source observed.
- [x] Backend target chosen without assuming an existing website database.
- [x] Local storage, eligibility, duplicate issuance and redemption logic implemented.
- [x] 72 backend/auth/content-regression tests passed locally.
- [x] 41 Chromium UI checks and 13 focused year-transition checks passed.
- [x] 10 combined local browser/backend checks passed with disclosed transport/auth substitutes.
- [x] Live website and approved seasonal designs untouched.
- [x] Final visual lock: hero 2026 before midnight -> 2027 at midnight; unchanged ivory styling.
- [x] Final offer lock: one free cookie, no purchase required; client and backend purchase gate removed.
- [ ] Verify the no-purchase offer and redemption without purchase data in actual cloud staging.
- [ ] Owner confirms January 1-3 hours/closures at both locations.
- [ ] Confirm Cloudflare account/zone and actual live DNS/proxy routing.
- [ ] Approve staff identities and location permissions.
- [ ] Provision separate authorized staging resources and secret.
- [ ] Pin tooling, validate config and run a Worker build/dry run.
- [ ] Apply real D1 migration; never copy the local lab database or artificial windows.
- [ ] Real Access sign-in/JWKS/role checks and alternate-origin protection verified.
- [ ] Native HTTPS cookie, iframe, CORS and CSP behavior verified.
- [ ] Real iPhone Safari and Android Chrome foreground/background/reconnect tests.
- [ ] True simultaneous cross-location cloud redemption and lost-response retry verified.
- [ ] Test all exact time, grace and operating-hours boundaries remotely.
- [ ] Review code-entry usability; QR/camera scanning is an optional later feature, not implemented.
- [ ] Keyboard, screen reader, text zoom, safe-area and reduced-motion checks on actual devices.
- [ ] Midnight burst/load, outage behavior, backup restore, logs and retention cleanup reviewed.
- [ ] Re-fetch latest website HEAD and apply only additive integration changes.
- [ ] Verify menus, prices, hours, ordering URLs and seasonal themes are unchanged.
- [ ] Confirm all preview/local clock controls are excluded from production assets/entrypoint.
- [ ] Record explicit October release approval before enabling any live integration.


## Revision 2 station and code gates

- Provision a fresh v2 schema; do not mistake CREATE IF NOT EXISTS for a v1 upgrade.
- Confirm exactly one location per station identity, one designated iPhone each.
- Configure manager-run sign-in and shift-length Access sessions; test session expiry.
- Confirm numeric input, Check code -> Redeem cookie -> Next guest without scrolling
  to hunt for the redeem action on the actual phones. No location picker/checkbox.
- Test guest recovery still needs the long session cookie; no anonymous code lookup.
- Verify 0xxxx samples cannot be issued/redeemed by the real backend.
- Test unique code assignment, collision fallback, non-recycling and capacity failure
  against real D1. Keep redeemed codes reserved through the support window.
- Review authenticated wrong-code limits, privacy-safe logging and station-level audit.
- Rehearse upgraded fireworks on both iPhones; tune particle limits if needed.

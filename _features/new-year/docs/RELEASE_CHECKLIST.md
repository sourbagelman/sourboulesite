# New Year requirements inside the October release

**Included in the release plan; not deployed or production-verified.**
The current combined decision, exact candidate lineage, approval gates and
release procedure are in
[the October release checklist](../../../docs/october-release-checklist.md).
This file records the feature-specific checks that travel with that release.

## Approved and retained

- [x] Locked experience, 2026 → 2027 ivory year, fireworks and Chicago schedule.
- [x] One free cookie, no purchase required, either location through January 3
  during that location's confirmed operating hours; no purchase/receipt gate.
- [x] Server-authoritative eligibility/reconnect rules and five-digit single-use
  code flow; names are not identifiers.
- [x] Additive disabled loader on the current twelve website pages; seasonal and
  business content preserved at the approved checkpoint.
- [x] Private staging delivered. Its labeled results remain in
  [CLOUD_REHEARSAL.md](../staging/CLOUD_REHEARSAL.md) and
  [PRIVATE_DELIVERY.md](../staging/PRIVATE_DELIVERY.md). This is not production sign-off.
- [x] Complete feature included in the same October release plan: production
  Worker/D1, public guest/pass, protected fixed stations, recovery and scheduled
  loader. No separate feature launch or manual New Year's Eve activation.

## Production setup and release checks — pending

- [ ] Exact final October candidate SHA approved after reconciling newest website
  changes; compare all menus, prices, hours, addresses, links, forms and seasons.
- [ ] Production resource/account/zone/cost/DNS proposal approved; service endpoint
  provisioned separately from private staging with a fresh D1 and secret.
- [ ] Production Worker/assets built from the production entrypoint, never staging
  or preview exports; no artificial dates, fixtures, tester guest gate or test data.
- [ ] Fresh schema and production marker applied; production binding/AUD verified.
- [ ] Real January 1–3 hours/closures explicitly confirmed and UTC windows checked
  at exact opening, closing and final campaign boundaries for both locations.
- [ ] Production station subjects/emails, one location per phone, responsible
  managers, session/sign-in policy approved and entered through secure setup.
- [ ] Public guest access plus staff-only Access/JWT protection, wrong audience,
  expired/revoked identity, missing/multiple assignment, direct origin and alternate
  asset/API route protection verified in the production configuration.
- [ ] Real HTTPS cookie/iframe/CORS/CSP behavior and earned-pass recovery verified.
- [ ] D1 persistence, duplicate-claim recovery, simultaneous cross-location atomic
  redemption/audit, lost-response retry and no-purchase payload verified for the
  final configuration. Prior staging results remain evidence, not an automatic pass.
- [ ] Code uniqueness/collision fallback/capacity, no code recycling, reserved
  `0xxxx` demo rejection, wrong-code limits and station audit reviewed.
- [ ] Actual Fort Worth and Willow Bend iPhones, guest iPhone/Android, screen lock,
  foreground/background, Wi-Fi/cellular reconnect inside/outside grace, saved
  passes, private mode and multiple tabs verified.
- [ ] Numeric keypad and Check → Redeem → Next guest usable on both actual phones;
  no per-guest login, location picker, purchase checkbox or QR requirement.
- [ ] Physical screen reader, keyboard/focus restoration, text zoom, reduced motion,
  safe areas and fireworks accessibility verified.
- [ ] Actual 12-hour expiry if retained for production, real JWKS rotation/outage,
  sustained midnight load/capacity and outage recovery verified.
- [ ] Support owner, retention/cleanup, privacy-safe logging, backup/restore policy
  and a tested restore completed. Code reservations last through support.
- [ ] Exact October install smoke check: before event, no takeover; trusted server
  schedule opens 23:50, descends 23:59, changes year/fireworks 00:00, closes 00:05;
  Continue prevents reopening and recovery remains accessible afterward.
- [ ] Owner explicitly authorizes the finalized October release, including service
  deployment and loader enablement. No additional New Year's Eve activation step.
- [ ] Deploy and verify service first, then enable the real loader in that same
  authorized website release; record final commit/Worker version and rollback.
- [ ] Post-release real-origin smoke checks pass without synthetic production
  eligibility, forged clocks, sample rewards or production data resets.

Unchecked items must not be silently skipped. Production settings and holiday
hours remain unresolved until supplied; the approved design/offer are not reopened.

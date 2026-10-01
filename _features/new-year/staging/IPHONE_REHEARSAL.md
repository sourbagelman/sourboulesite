# Two-iPhone private staging rehearsal

Status: **PENDING — not yet performed on either physical iPhone.** Desktop mobile
viewports do not count as a physical-device result. This is a rehearsal only;
every application screen and saved pass must say **TEST ONLY — NOT REDEEMABLE**.
Do not hand out a real cookie for a staging code.

Private links: [website](https://nye-staging.thesourboule.com/),
[guest/pass](https://nye-service-staging.thesourboule.com/?pass=1), and
[staff](https://nye-service-staging.thesourboule.com/staff/). Access allowlists are
configured. See [CLOUD_REHEARSAL.md](CLOUD_REHEARSAL.md) for actual deployment
evidence and the operator-controlled timeline. Never put credentials or
authentication cookies in this checklist, screenshots, or chat.

## Before starting

1. A manager signs the Fort Worth iPhone into the approved Fort Worth station
   identity and the Willow Bend iPhone into its distinct approved station identity.
   Use normal Safari tabs and the approved MFA/sign-in policy. Check the fixed
   location badge on each staff page; there must be no location picker. Employees
   do not sign in again for each guest. Staging sessions are 12 hours. Alexis uses
   `alexis@thesourboule.com` at Fort Worth; Lance Misner uses
   `lance@thesourboule.com` at Willow Bend. Use email One-time PIN. Read the code
   privately on another device and enter it in Cloudflare on the station phone;
   do not leave an inbox or Cloudflare administrator session on the shared phone.
   Mandatory existing security remains in effect.
2. In the guest browser, open the private celebration service as a **top-level
   tab** and complete its Access sign-in. Then open the private website. The
   website and service may each need an Access application cookie. Do not attempt
   to fix an embedded sign-in failure by disabling Access or weakening cookies.
   The guest tester must be on the explicit allowlist. The promotion itself still
   registers only a first name using its anonymous browser session.
3. The operator records the server-controlled rehearsal timeline and artificial
   location windows from the deployment record. Do not alter the phone's clock
   to advance the rehearsal. Actual January holiday hours are not staging hours.
4. Keep the guest countdown visible and the phone unlocked. A third guest device
   is convenient but not required: the Fort Worth iPhone can first earn a guest
   test pass and then open its fixed staff page without clearing Safari data.

## Short counter test

1. On the guest browser, open a current-page copy on the private website **before
   the rehearsal opening**. Leave it open. Confirm the countdown appears without
   refreshing; also try a separate arrival during the active window.
2. Enter a test first name and tap **Count me in**. Stay visible through the final
   30 seconds and midnight. Confirm the ivory year changes from **2026 to 2027**,
   Happy New Year appears, and the test pass displays one five-digit code. The
   offer must say one free cookie, no purchase required.
3. Save the pass image. Confirm **TEST ONLY — NOT REDEEMABLE** is readable in the
   saved image. After the takeover ends, verify the same website page is revealed.
   Use its pass link and reload the pass page: the same five-digit code must remain.
4. On the Fort Worth station, enter those five digits. Confirm the numeric keyboard,
   tap **Check code**, then **Redeem cookie**, then **Next guest**. No purchase,
   receipt, checkbox, QR scan, guest login, or location selection may be required.
   A test redemption confirmation must never direct a real cookie handout.
5. On the Willow Bend station, check the **same code**. It must show **Already used**
   and offer no successful second redemption. Confirm the original station also
   rejects a repeat. Keep the five-digit value out of shared test logs; record a
   case number and result instead.

## Brief device checks

- **Continue and return:** tap Continue, navigate to another page in that same
  tab, and confirm the takeover stays dismissed. The pass remains accessible.
- **Connection interruption:** with a qualifying pre-midnight heartbeat already
  recorded, briefly interrupt the test network while the countdown remains
  visible and unlocked; reconnect within 90 seconds after midnight. Confirm
  recovery. A tester can interrupt the test Wi-Fi/router from another device.
  Switching apps, locking the phone, or using a control that hides the page is a
  different case: a server-observed hidden signal before midnight invalidates
  that candidate. Record that case separately; do not call it a successful
  foreground reconnect. Reconnecting after the grace period must not create new
  eligibility.
- **Session recovery:** reload the staff page during an approved session, then
  repeat the next-guest flow. Separately expire/revoke a station through the
  authorized control process: checking/redeeming must fail until the manager
  signs in again. Do not remove protections to complete the test.
- **Lost response/double tap:** the operator uses the isolated rehearsal's fault
  test procedure. A repeated redemption must preserve confirmation or show used;
  it must never authorize a second cookie. Offline is never a valid redemption.
- **Accessibility:** test portrait/landscape, Safari text zoom, VoiceOver names and
  announcements, visible keyboard focus with a hardware keyboard if available,
  and Reduce Motion. Check safe areas and that controls remain reachable.
- **Clock and expiry:** a changed phone calendar must not earn a pass. Verify an
  ineligible guest, an invalid code, an expired pass, and an artificial closed
  window against the operator's server-controlled scenarios.

## Results to record

Record device model, iOS/Safari version, date, tester case identifier, server
scenario, and PASS/FAIL/PENDING for each row. Do not record tokens, cookies, raw
pass codes, real guest names, or request bodies.

| Check | Fort Worth iPhone | Willow Bend iPhone |
| --- | --- | --- |
| Manager sign-in, fixed station, approved session policy | PENDING | PENDING |
| Five-digit numeric keyboard and no-purchase flow | PENDING | PENDING |
| First redemption succeeds; same pass is already used elsewhere | PENDING | PENDING |
| Guest iframe, actual-page return, saved pass and reload recovery | PENDING | PENDING |
| Foreground reconnect and hidden/late rejection cases | PENDING | PENDING |
| Expired/revoked session, invalid/expired/outside-hours pass | PENDING | PENDING |
| Double tap/lost response and no second redemption | PENDING | PENDING |
| VoiceOver, reduced motion, text zoom and orientation | PENDING | PENDING |

Physical results remain PENDING until these steps have actually been performed.
Any failure blocks the affected release check; no result authorizes production.

Access preparation reference:
[Cloudflare Access CORS and top-level authentication](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/cors/).

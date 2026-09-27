# Site maintenance

Business content lives in the existing public HTML pages. Preserve current menus,
prices, hours, addresses, phones, ordering URLs, form contracts, analytics, Bitcoin
copy, photography, metadata, and navigation unless the owner requests a change.
Historical package review pages are not a content source and must never replace
current pages.

## Seasonal layer

- Keep `assets/css/seasonal.css` after all existing styles, including inline styles.
- Keep deferred `assets/js/seasonal-config.js` before deferred
  `assets/js/seasonal.js`. Include each exactly once per public page.
- Retain one `data-seasonal-anchor` on a safe introduction/hero container, one
  initially hidden `data-seasonal-art` child with `aria-hidden="true"`, one
  initially hidden `data-seasonal-year` span immediately before the main H1, and
  one initially hidden `data-seasonal-trim` element inside the end of main with
  `aria-hidden="true"`.
- These hooks are stable structure. Menu, price, hour, address, phone, and order-link
  edits must not remove or relocate them. Do not select decorations by text,
  menu-item names, paragraph order, or current wording.
- Keep seasonal CSS, scripts, and `images/seasonal/*.svg` separate from business
  content. Scope presentation to `data-sb-season`, dedicated hooks, and `sb-*`
  names. Do not reuse these names for the separate New Year event project.
- `assets/js/seasonal-config.js` is the single configuration for the recurring
  Chicago calendar and the independent January–February 2027 year mark. The
  holiday overrides take precedence. Do not restore the old 2026 restriction,
  January 3 cutoff, or a year-mark dependency for decorations.
- For a manual site-wide theme, change `CONFIG.mode` to an approved theme ID; use
  `off` to disable decorations or `auto` to restore the calendar. An optional
  `data-season` attribute on the controller script can override one page.
  The year mark remains independent, including when decorations are off.
- Production includes must omit `data-allow-preview`. Only an explicitly prepared
  isolated review build may add `data-allow-preview="true"` to the seasonal
  controller. Query strings alone must never enable review behavior.
- `_review/` contains review tools, not public business pages. Publish these only
  to the isolated review environment. Set its `data-review-enabled` marker only
  in that exported environment. Do not add review tools to navigation or sitemap.
- Preserve `aria-hidden`, `hidden` defaults, pointer-event exclusions, focus
  visibility, and non-overlapping artwork space. Missing scripts or art must
  leave the base site usable. Never add decorations over food photos, menu text,
  navigation, or ordering controls.

## Required verification

Run `node --test tests/seasonal-schedule.test.cjs` after changing seasonal logic.
Check public pages at desktop, 320px, and 390px widths. Inspect all ten themes,
off mode, and the separate year mark; verify contrast, text zoom, keyboard focus,
unobstructed links, and no horizontal overflow. Calendar changes require Chicago
midnight, DST, leap-day, Easter, year rollover, and March 1 year-mark tests.

Before release, compare business content and ordering URLs with the approved
baseline, verify the production includes have no review flag, and run
`git diff --check`. Do not merge or deploy a review branch without owner release
authorization. See `docs/seasonal-maintenance.md` for architecture and release steps.

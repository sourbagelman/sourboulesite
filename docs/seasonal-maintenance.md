# Seasonal maintenance and release

## Architecture

The existing static pages remain the source of business content. The seasonal
layer has no dependencies, transactions, cookies, local storage, or backend.

| File | Responsibility |
| --- | --- |
| `assets/js/seasonal-config.js` | One annual America/Chicago schedule, manual mode, Western Easter calculation, independent 2027 year window |
| `assets/js/seasonal.js` | Apply the chosen state to dedicated hooks; refresh at the next minute boundary and on focus, visibility, or restored pages |
| `assets/css/seasonal.css` | Scoped palettes, artwork space, contrast, and year presentation |
| `images/seasonal/*.svg` | The supplied artwork, preserved without drawing changes |
| `_review/seasonal.html` and companions | Isolated review controls; never a replacement business page |
| `tests/seasonal-schedule.test.cjs` | Calendar and year-window regression tests |

Only include lines and empty dedicated hooks were added to the business HTML.
Content edits need no seasonal code changes. Keep the includes and hooks described
in `AGENTS.md`; the layer never searches business wording or menu items.

There is one decoration anchor and one year placement per public page. The art
occupies its own row before the introduction, and the trim occupies an empty
band inside the end of main. Neither is announced by screen readers or receives
clicks. The year is real text immediately before the main heading, not in the
footer. The layer does not implement a countdown, registration, cookie passes,
or staff redemption.

## Readability and text zoom

The seasonal stylesheet also includes narrowly scoped compatibility fixes found
in browser QA: the shared header can wrap at enlarged text sizes; its mobile
controls and category anchor targets remain clear of the measured header height;
the Contact closing action area retains readable
copy width; and off-mode Willow Bend menu and Fort Worth hero text retain
sufficient contrast. These selectors require the dedicated seasonal-page hooks.
Header and category heights use a ResizeObserver with resize/font/page-restoration
fallbacks; CSS provides conservative no-script clearance. This measurement is
independent of the calendar module. Existing shared CSS and JavaScript remain unchanged. Normal-size header and
closing-action geometry is verified against the approved baseline.

## Controls and review separation

`CONFIG.mode` defaults to `auto`. Set it to `off` for a site-wide decoration kill
switch, or one of the ten IDs in `THEMES` for a manual theme. The independent year
mark continues to follow its own dates. Restore `auto` when a manual override ends.

Production pages omit `data-allow-preview`; their `season`, `date`, and `year`
query parameters are ignored. An isolated export may add
`data-allow-preview="true"` to the controller script and set the review tool's
`data-review-enabled="true"`. Neither flag is a public URL switch.

Review-only parameters are `season=auto|off|normal|<theme ID>`, an optional valid
Chicago calendar `date=YYYY-MM-DD`, and `year=auto|off|2027`. Forced 2027 is allowed
for New Year’s, winter, Valentine’s, and off mode to verify independent behavior.
Other themes omit the mark. Invalid dates are ignored. Review state is not stored
and does not change the source or future visitors.

The review interface renders the full date schedule from `CONFIG.schedule`.
Easter is the fourteen calendar days from Easter Sunday minus thirteen days
through Easter Sunday, inclusive. Overrides outrank seasons. The annual calendar
never returns an automatic off period, including leap day or December/January.
The actual year mark appears only January 1–February 28, 2027 in Chicago; it never
automatically appears in December 2026 or later years.

## Release procedure — owner approval required

1. Review the isolated site's complete calendar, all themes, and year states.
   Confirm the final October menus and hours separately; this integration does
   not approve future business-content changes.
2. Merge the seasonal feature PR into `redesign/guest-experience-seo` using a
   merge commit so the seasonal implementation commit remains identifiable.
   Do not point GitHub Pages at the feature or redesign branch.
3. Complete the final approved redesign review, then open a separate release PR
   from `redesign/guest-experience-seo` to `main`. Record its exact final SHA and
   the previous production SHA before authorizing the merge.
4. Run the schedule tests and `git diff --check`. Verify all twelve business HTML
   pages, asset paths, current order URLs, forms, menu prices, and hours. Confirm
   `CONFIG.mode` is `auto` and the business HTML contains no review-enable flag.
5. Release the repository source through the existing `main` GitHub Pages flow
   only after explicit owner approval. Never upload the isolated review export:
   its noindex/robots protections and review flags are intentionally different.
   Do not copy `_review/`, `tests/`, `docs/`, or maintenance instructions into a
   manually assembled production artifact; include current HTML, assets, images,
   robots, sitemap, and CNAME as appropriate to the existing host.
6. Verify the production Pages build commit matches the authorized release SHA,
   check the live site in ordinary automatic mode, and confirm preview query
   parameters cannot simulate production dates. Keep the earlier production SHA
   and the seasonal implementation SHA with the release record.

## Rollback

- Decoration-only disable: set `CONFIG.mode` to `off`, commit that one change on
  the authorized release branch, and publish through the existing approved
  process. This intentionally does not suppress the independent year mark.
- Entire seasonal layer: revert the ordinary seasonal implementation commit
  (`git revert <seasonal-implementation-sha>`) through a reviewed rollback PR.
  This removes its includes/hooks and assets. Preserve any later business-content
  edits when resolving conflicts. Verify menus/hours/orders and deploy only after
  rollback authorization.
- For a manual HTML release, remove the three seasonal include lines from every
  public page. The empty hidden hooks can remain safely. Existing shared CSS/JS
  and business content work without the seasonal assets.

Removing or hiding the year mark is never a seasonal-decoration kill switch.

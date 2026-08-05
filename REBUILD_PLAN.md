# Sour Boule Guest Experience Rebuild Plan

Last audited: 2026-08-04

Branch: `redesign/guest-experience-seo`

Audit starting commit / branch fork point: `c832217ad1ffc968da3cc7f2bd8b97839a2211bc`

Remote default branch at audit: `main` at the same commit

## Safety and deployment status

- The work is isolated on `redesign/guest-experience-seo`; `main` is not checked out and will not be modified, merged, rebased, reset, or deployed by this rebuild.
- The starting worktree was clean and the redesign branch tracked `origin/redesign/guest-experience-seo`.
- The repository is a static, dependency-free HTML/CSS/JavaScript site. There is no `package.json`, framework, build tool, test runner, `.github/workflows`, Netlify/Vercel/Cloudflare config, or `.openai/hosting.json`.
- `CNAME` contains `thesourboule.com`, which is the local evidence of GitHub Pages/custom-domain production hosting. The GitHub repository default branch is `main`. No branch-triggered deployment workflow exists in the repository.
- Residual deployment risk: a repository-level GitHub Pages source setting or an external host could be configured outside the repository to deploy a non-default branch. The available repository metadata confirms `main` is default but does not expose the Pages source setting, and the local environment has no `gh` CLI. No production setting was changed. Before any future push/preview, verify Pages “Build and deployment” source in repository settings and use an isolated preview host that cannot claim the production `CNAME`.

## Architecture and complete file inventory

### Public/customer routes

| Route | Customer purpose and primary question | Primary conversion | Navigation relationships |
| --- | --- | --- | --- |
| `/` (`index.html`) | Zero-content entry point: “Which Sour Boule location do I need?” | Automatic redirect to `brand-home.html` | Meta refresh and JS replace to brand home. |
| `/brand-home.html` | Location chooser: “Fort Worth or Willow Bend?” | Select a location | Links to both location pages and telephone numbers. |
| `/fort-worth.html` | Fort Worth landing page: “What is here, when is it open, and how do I order?” | Cash App order; secondary menu | Links to shared brand nav, Fort Worth menu, Bread Club, catering, events, contact. |
| `/willow-bend.html` | Willow Bend/Aledo landing: “What can I order and where is pickup?” | Menu/order; secondary phone | Links to location chooser, Willow Bend menu, Bread Club/account. |
| `/menu.html` | Fort Worth menu: “What food and pricing are available?” | Cash App order | Shared brand nav and footer. |
| `/willow-bend-menu.html` | Willow Bend menu: “What food and pricing are available?” | Return to Willow Bend/order pathway | Willow Bend navigation. |
| `/breadclub.html` | Subscription signup: “How does Bread Club work and what will I receive/pay?” | Live Square/Supabase signup | Shared nav, account management, location/menu links. |
| `/breadclub-account.html` | Member self-service: “How do I view or change my subscription?” | Magic-link login, then pause/resume/cancel | Bread Club and shared nav; includes one broken Gallery link. |
| `/about.html` | Brand story/trust: “What makes this bakery different?” | Order or explore location/menu | Shared brand nav/footer. |
| `/catering.html` | Lead capture: “Can Sour Boule cater my group?” | Formspree inquiry | Shared nav/footer; Fort Worth fulfillment context. |
| `/events.html` | Lead capture: “Can I host an event here?” | Formspree inquiry | Shared nav/footer; Fort Worth venue context. |
| `/contact.html` | Routing/help: “Which location should receive my question?” | Formspree message | Links to both locations/menus and shared nav/footer. |

### Administrative/internal routes

| Route | Purpose | Exposure/navigation |
| --- | --- | --- |
| `/admin-breadclub.html` | Supabase-authenticated Bread Club member and subscription administration | Not linked from public nav or sitemap, but crawlable because `robots.txt` allows all and the page has no `noindex`. |
| `/admin-push.html` | Supabase Edge Function push send/history console | Not linked from public nav or sitemap, but crawlable and has no `noindex`. |

### Source, configuration, and assets

- HTML: `index.html`, `brand-home.html`, `fort-worth.html`, `willow-bend.html`, `menu.html`, `willow-bend-menu.html`, `breadclub.html`, `breadclub-account.html`, `about.html`, `catering.html`, `events.html`, `contact.html`, `admin-breadclub.html`, `admin-push.html`.
- Shared CSS: `assets/css/style.css` (layout, navigation, cards, forms, Bread Club, location system, responsive rules; now also foundational tokens/utilities).
- Shared JavaScript: `assets/js/main.js` (GA4, favicon injection, order-click analytics, and Bread Club preview/date logic).
- Assets: `images/logo.png` (approximately 32 KB) and `images/.keep`; no other local images, icons, font files, SVGs, or videos.
- Search/domain configuration: `robots.txt`, `sitemap.xml`, `CNAME`.
- Audit/control documents: `REBUILD_PROTECTION_MAP.md`, `REBUILD_PLAN.md`.
- No framework, templates/includes, package manager, dependency lockfile, bundler, backend source, API route, database migration, environment file, or CI workflow exists.

### Reusable and repeated sections

- Shared pages repeat topbar, sticky header, logo/brand, navigation links/actions, container/stack layouts, cards, hero patterns, location calls to action, and footer markup by copy/paste.
- `assets/css/style.css` centralizes the primary visual primitives, but hundreds of inline styles remain (especially menu and Bread Club) and three standalone pages embed large style blocks.
- `brand-home.html`, `admin-breadclub.html`, `admin-push.html`, `breadclub-account.html`, `breadclub.html`, and `willow-bend-menu.html` contain significant page-local CSS or JavaScript.
- The Bread Club preview/date behavior is duplicated between `assets/js/main.js` and `breadclub.html` inline JavaScript; both bind to the same elements.
- Navigation is not one system: shared Fort Worth pages, Willow Bend pages, Bread Club account, location chooser, and admin tools each use different link sets or standalone structures.

### Third-party scripts and integrations

- Google Analytics GA4, ID `G-Y9L47GTRMD`, dynamically loaded by `assets/js/main.js`.
- Google Fonts: Inter and Playfair Display, with three different weight-query combinations.
- Unsplash: seven remote CSS background images.
- Square Web Payments SDK plus Square application/location IDs on `breadclub.html`.
- Supabase JS from jsDelivr or esm.sh; Supabase Auth/data/Edge Functions on Bread Club signup, customer account, admin, and push pages.
- Formspree endpoints on catering, events, and contact.
- Cash App ordering links in two URL shapes.

## Audit findings ordered by severity

### Critical: protected live flows are fragile and cannot be casually redesigned

1. Bread Club is selector- and order-coupled. Inline code and `main.js` query positional `.breadclub-note` elements, button text, active classes, and exact IDs. DOM cleanup could silently submit the wrong fulfillment/product data or break Square mounting.
2. Two Bread Club implementations calculate and render the same preview. `main.js` uses base prices 11/11/13 while the inline checkout uses 11.35/11.35/13.35 before the member discount. Both run on the same page. This is a correctness and trust risk, but it is protected business behavior and must be resolved only with owner-approved integration testing.
3. Admin pages are public static URLs. `admin-push.html` persists its admin secret in `localStorage` and inserts API-returned title/body into `innerHTML`; `admin-breadclub.html` relies on Supabase policy plus an allow-list query. These need a dedicated security review, not a visual refactor.

### High: discoverability, page semantics, and navigation are inconsistent

1. `/` is an empty client-side redirect while `brand-home.html` is separately canonical and both URLs appear in the sitemap. This duplicates the entry route, weakens crawl/render resilience, and can split signals.
2. `about.html`, `catering.html`, `contact.html`, `events.html`, and `menu.html` have no H1; their main page headings begin at H2. Admin Bread Club also has no H1.
3. `breadclub-account.html` links to missing `gallery.html`, creating a customer-facing dead end.
4. No page implements Open Graph or Twitter/social-card metadata. Structured data exists only on the location chooser and two location pages.
5. Admin pages have no `noindex` metadata, while `robots.txt` allows every route. `breadclub-account.html` also lacks a crawl directive despite being an auth utility page.
6. Shared navigation is dense, wraps unpredictably on mobile, has no menu control, and changes between page families. “Home” sometimes means the location chooser and sometimes `index.html`.
7. Cash App order URLs differ between `/order/$thesourboule` and `/$thesourboule`; GA click tracking only recognizes the former. The URLs are protected and require owner verification before normalization.

### Medium: accessibility baseline is incomplete

1. Most logo images lack `alt`; only `brand-home.html` and `willow-bend.html` contain alt attributes. Decorative CSS imagery has no accessible equivalent where imagery conveys context.
2. Pages have no skip links and repeated headers require many Tab presses. The new CSS supports a skip link, but markup insertion belongs in command 2.
3. Existing global anchors remove underlines, so links embedded in paragraphs may rely on color alone. Active nav is generally visual only; `aria-current` is inconsistent.
4. Bread Club pickup choice is represented by buttons and an `active` class, without `aria-pressed` or a fieldset/legend relationship. Several quantity labels are not explicitly associated with their selects.
5. Status/error regions on Bread Club/admin pages are not consistently live regions, so async results may not be announced.
6. `admin-push.html` uses clickable buttons with inline global handlers but no semantic form; its two H1s weaken hierarchy. The file also contains a stray Markdown code fence after `</html>`.
7. Header/nav wrapping and wide admin tables are likely difficult at narrow widths. The nested fixed-height `story-scroll` region creates an extra keyboard/scroll context.
8. Focus styles were inconsistent and button motion ignored reduced-motion preferences. The safe foundation now adds a shared focus-visible ring, forced-colors handling, and reduced-motion behavior.

### Medium: performance and Core Web Vitals opportunities

1. Seven Unsplash images are remote CSS backgrounds. They cannot use native lazy loading, width/height attributes, responsive `srcset`, or stable aspect-ratio reservations; the hero image is a likely LCP dependency.
2. Google Fonts are requested on nearly every public HTML document with inconsistent font variants. There is no local subset/preload strategy, increasing connection and render-blocking cost.
3. Square and Supabase scripts load on protected pages from third-party CDNs; Square is head-blocking. These require careful defer/load-state validation rather than blind optimization.
4. Repeated inline styles and embedded page CSS prevent reuse and make caching/minification difficult. `breadclub.html` has more than 100 inline-style occurrences and duplicated application logic.
5. Logo images generally omit intrinsic `width`/`height`, allowing small layout shifts. CSS backgrounds likewise lack explicit content sizing in some contexts.
6. GA is dynamically async, which is reasonable, but loads on every page that includes `main.js`; consent/privacy requirements are undocumented.
7. There is no build pipeline to minify or fingerprint assets, no automated link/accessibility/HTML validation, and no performance budget.

### Low/content-quality findings

1. The location chooser says Willow Bend is in Aledo while route and schema naming mix “Willow Bend” and “Aledo”; keep one customer-friendly naming convention with accurate locality schema.
2. `brand-home.html` contains the apparent typo “hit dogs.”
3. The sitemap has no `lastmod` values and omits account/admin routes appropriately.
4. Favicon injection declares the PNG logo as `image/jpeg`.

## Page-by-page SEO, accessibility, UX, and performance audit

| Page | Current strengths | Main gaps / command 2–4 action |
| --- | --- | --- |
| `index.html` | Fast redirect and canonical | Replace the zero-content/duplicate URL pattern with a hosting-safe canonical entry strategy; provide a real fallback; verify redirects before changing. |
| `brand-home.html` | Clear location choice, description, canonical, two-location schema, one H1, logo alt | Add social metadata; reconcile root canonical; fix typo; tighten decision copy; establish shared header/footer without obscuring location selection. |
| `fort-worth.html` | Strong title/description/canonical, Restaurant schema, H1, conversion links | Add logo alt/social metadata, consistent nav/current state, map/address semantics, local image strategy, and rel protection on every external target. |
| `willow-bend.html` | Description/canonical/schema/H1 and focused local flow | Add social metadata; validate locality/naming and order URL; align shared navigation; retain location-specific menu/account actions. |
| `menu.html` | Descriptive title/description/canonical, comprehensive menu | Add H1, logo alt/social/schema/breadcrumb context; improve scanability and mobile section navigation; remove inline presentation safely. |
| `willow-bend-menu.html` | Descriptive metadata, H1, focused route | Add image alt/social/schema/breadcrumbs; verify order conversion path and consistent location nav; reduce embedded CSS. |
| `breadclub.html` | Strong metadata, H1, labels on primary identity fields, live pricing/signup | Do not restructure until protected-flow tests exist; add social/product/service schema, group semantics, live regions, loading/failure states, and truthful price/cutoff copy. |
| `breadclub-account.html` | H1 and recognizable self-service actions | Add description/canonical/noindex, logo alt, remove broken Gallery link only after nav replacement, improve status announcements/confirmations, and retain all auth/action contracts. |
| `about.html` | Useful trust story, title/description/canonical | Promote one H1, add logo alt/social/organization links, shorten long scroll region, and end with a location-aware conversion. |
| `catering.html` | Clear lead intent, metadata, associated field labels | Add H1/logo alt/social/service schema; use a date input where safe; clarify lead time/fulfillment; preserve Formspree endpoint/names. |
| `events.html` | Clear lead form and metadata | Add H1/logo alt/social/event-venue schema; clarify capacity/availability; preserve Formspree; improve async/confirmation expectations. |
| `contact.html` | Good location routing, metadata, associated labels | Add H1/logo alt/social/local-business links; expose phone/address/map actions earlier; preserve endpoint and location values. |
| `admin-breadclub.html` | Auth and allow-list gating | Add `noindex`, H1, robust responsive table/labels/live regions; keep it out of public components and preserve every auth/data contract. |
| `admin-push.html` | Send confirmation and history | Add `noindex`, one H1, labels/form/live regions, safe history rendering in a dedicated security command, and remove stray code fence when explicitly approved. |

All public marketing pages have titles and canonicals; most have descriptions. None has Open Graph/Twitter metadata. Schema is limited to `brand-home.html`, `fort-worth.html`, and `willow-bend.html`. Logo alt text and H1 coverage are incomplete as detailed above.

## Frontend conventions established for commands 2–5

### Component architecture without a framework

Keep the static architecture and add no major dependency. Because plain HTML has no include mechanism, use shared class contracts plus a documented canonical snippet for repeated markup. Only consider a tiny build-time include step if command 2 proves copy/paste cannot be maintained and the owner accepts a build requirement.

Planned component families:

1. `site-header`: skip link, location-aware logo/home target, compact primary nav, location switcher, menu and order actions, consistent `aria-current`.
2. `page-hero`: eyebrow, single H1, customer answer, primary/secondary actions, optional optimized media.
3. `location-card` / `info-card`: address, hours, phone, menu/order actions with consistent semantics.
4. `menu-section` / `menu-item`: structured category heading, item name, description, price/dietary note.
5. `lead-form`: field grouping, label/help/error/status patterns while retaining Formspree names and endpoints.
6. `site-footer`: location contact data, primary links, legal/feed links.
7. Protected shells: `breadclub-shell`, `account-shell`, and `admin-shell` style existing markup without changing integration contracts.

### Design tokens

`assets/css/style.css` now defines brand, surface, text, border, focus, typography, 4px-based spacing, radius, and container tokens while retaining existing variables as compatibility aliases. Later pages should use semantic tokens, not new one-off hex values. Existing Sour Boule colors remain: warm canvas `#f4f1ea`, ink `#161412`, muted brown `#5a524a`, wheat `#e6c98f`, and strong wheat `#c9a96d`.

### Typography hierarchy

- Display family: Playfair Display/Georgia for the single H1 and section headings.
- Body/UI family: Inter/system sans for paragraphs, navigation, labels, controls, and prices.
- One descriptive H1 per public page; descend without skipping levels.
- Body text at least 1rem with approximately 1.6 line height; supporting text no smaller than 0.875rem except nonessential labels.
- Keep measure near 60–70 characters for body copy and avoid all-caps for sentences.

### Spacing and containers

- Use the 4px token scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, and 64px equivalents.
- Use narrow (48rem), content (73.75rem/current 1180px), and wide (90rem) containers.
- Prefer `.flow`, `.cluster`, `.auto-grid`, and `.section` utilities for predictable composition; avoid inline margins/padding.
- Preserve touch targets of at least 44×44 CSS pixels and enough separation between conversion actions.

### Responsive breakpoints

Use content-driven layouts, with project conventions documented at 43.75rem/700px (phone navigation and compact padding), 61.25rem/980px (stack primary grids), and 68.75rem/1100px (Bread Club/gallery complexity). Treat these as maximum-width transition points, not device names. Test at 320, 375, 768, 1024, and 1440 CSS pixels plus 200% zoom.

### Accessibility baseline

- WCAG 2.2 AA target: semantic landmarks, skip link, one H1, logical heading order, keyboard access, visible focus, 4.5:1 normal-text contrast, 3:1 large text/UI, labels/help/error associations, and no color-only meaning.
- The foundation provides `:focus-visible`, `.visually-hidden`/`.sr-only`, `.skip-link`, reduced-motion, forced-colors, and target scroll-offset rules.
- Use `aria-current` for active navigation, `aria-pressed` or native radio semantics for choices, and `aria-live`/`role=status` for async results.
- Preserve zoom/reflow without two-dimensional scrolling except essential admin tables, which get labeled responsive overflow.
- Decorative images use empty alt; meaningful images get concise purpose-oriented alt. Set intrinsic dimensions.

### SEO baseline

Every indexable page must have a unique title, concise unique description, self-referencing canonical, one H1, stable crawlable internal links, Open Graph title/description/type/url/image, Twitter card metadata, and appropriate JSON-LD. Use `LocalBusiness`/`Restaurant` entities with stable `@id`s for locations, `Organization` for the brand, `BreadcrumbList` where useful, and `Service` for catering/events/Bread Club. Account/admin pages should be `noindex, nofollow` while remaining allowed to load. Align `/`, sitemap, canonicals, internal links, and redirects.

### Image strategy

- Replace stock CSS backgrounds with owner-approved local photography in AVIF/WebP plus JPEG fallback where practical.
- Use `<picture>`/responsive `srcset`, explicit width/height or `aspect-ratio`, appropriate `sizes`, and `loading="lazy"` below the fold.
- Prioritize the LCP hero with a right-sized eager image/fetch priority only on the page that uses it; do not preload every image.
- Keep the logo as a local asset, correct its MIME declaration, provide intrinsic dimensions, and generate dedicated favicon/social-card assets.
- Record licenses/ownership and descriptive alt decisions.

### Performance strategy

- Performance budgets for representative mobile pages: LCP ≤2.5s, INP ≤200ms, CLS ≤0.1 at the 75th percentile; initial transferred page resources targeted below 1 MB excluding protected payment/auth SDKs.
- Consolidate font variants; evaluate self-hosted subsets with `font-display: swap` or retain Google Fonts with only required weights and consistent preconnects.
- Move repeated inline CSS to the shared stylesheet in page-sized increments; remove dead/duplicate rules after visual comparison.
- Resolve duplicate Bread Club preview logic only through a dedicated protected-flow change with explicit owner approval and sandbox/test credentials.
- Defer noncritical scripts where integration lifecycle allows; never defer Square/Supabase blindly.
- Add lightweight automated HTML, local-link, JSON-LD, accessibility, and performance checks without introducing a runtime framework.

### Safe treatment of protected integrations

`REBUILD_PROTECTION_MAP.md` is authoritative. Style protected elements in place first. If markup must change, preserve IDs, names, data attributes, order-dependent nodes, option/button text and values, external URLs, request contracts, and handler attachment. Create a before/after contract snapshot and validate only with inert mocks or approved sandbox credentials. Never submit production forms, tokenize/charge a real card, change a live subscription, or send a push as part of visual QA.

## Page-by-page rebuild sequence

1. Global shell and SEO route model: decide `/` versus `/brand-home.html`, then implement shared skip/header/footer/nav patterns and base metadata conventions.
2. Location chooser, Fort Worth, and Willow Bend pages: establish customer location context, trust, hours/address/phone, and location-aware order/menu actions.
3. Fort Worth and Willow Bend menus: create accessible/scannable menu components and mobile category navigation.
4. About, catering, events, and contact: reuse the shell/cards/forms and strengthen location-aware lead paths.
5. Bread Club marketing shell: improve explanation and semantics around the untouched live application.
6. Bread Club signup/account protected UI: style in place, add accessible grouping/status behavior without contract changes, then run approved integration-level checks.
7. Admin pages: keep separate from public navigation; add noindex and accessibility/responsive polish, with security behavior changes handled separately and explicitly.
8. Search/performance pass: sitemap/canonicals/schema/social cards, images/fonts, link validation, cross-browser/mobile/zoom/accessibility checks.

## Completion criteria for commands 2–5

### Command 2 — shared guest shell and primary location journey

- Root/canonical strategy is implemented safely and documented.
- Shared header, navigation, skip link, footer, page hero, and metadata patterns are applied to `brand-home.html`, `fort-worth.html`, and `willow-bend.html`.
- Location choice, hours/address/phone, menu, and protected ordering links answer the first guest questions on mobile and desktop.
- H1, alt, keyboard/focus, social metadata, and location schema baselines pass on these pages.
- No protected integration behavior or production deployment setting changes.

### Command 3 — menus, trust, and inquiry journeys

- Both menus are accessible, easy to scan, location-labeled, and conversion-aware.
- About, catering, events, and contact use the shared shell and semantic components.
- Formspree endpoints/field contracts remain intact; forms have grouping, labels, help, error/status expectations, and mobile-friendly controls.
- Broken/inconsistent public navigation is eliminated, including the missing Gallery link.
- Public image assets are optimized and licensed/owner-approved placeholders are clearly identified.

### Command 4 — Bread Club, accounts, and internal tools

- Bread Club marketing and protected UI are visually coherent and accessible without changing payment/subscription contracts.
- Account/admin routes receive correct `noindex`, responsive layouts, keyboard behavior, and live-status semantics.
- Any duplicate Bread Club logic change has separate approval and integration tests; otherwise it remains documented and untouched.
- Security concerns in admin tools are either fixed under explicit authority or recorded as owner-review blockers.

### Command 5 — release-candidate validation and owner review package

- Every route passes local-link, HTML, metadata, heading, image-alt, keyboard, 200% zoom, responsive, contrast, and reduced-motion checks.
- Structured data, sitemap, robots, canonicals, social cards, favicon, and production-domain links are consistent.
- Representative mobile Lighthouse results meet or have documented explanations against the performance budgets.
- Protected-contract diff is clean; approved sandbox tests cover Bread Club signup/account/admin behavior without production mutations.
- No production deployment occurs. The branch is clean, commits remain on `redesign/guest-experience-seo`, and the final output is ready for owner review and a draft PR only.

## Command 2 blockers / owner-verification items

These do not block foundation work, but they must be resolved before the affected implementation is finalized:

1. Verify the GitHub Pages source setting before pushing/previewing any redesign commit; the repository itself does not encode it.
2. Choose the canonical public homepage (`/` recommended) and confirm whether `brand-home.html` can be redirected after links/canonicals are migrated.
3. Confirm whether both Cash App URL shapes are intentional and which order destination belongs to each location. They remain unchanged meanwhile.
4. Provide/approve real photography and a social-sharing image, or explicitly approve temporary optimized stock imagery.
5. Schedule a protected-flow review for the duplicated Bread Club pricing/preview logic and admin security concerns; command 1 intentionally does not alter them.

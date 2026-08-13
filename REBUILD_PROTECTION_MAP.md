# Sour Boule Rebuild Protection Map

Last audited: 2026-08-04

Protected branch: `redesign/guest-experience-seo`

Audit starting commit: `c832217ad1ffc968da3cc7f2bd8b97839a2211bc`

## Purpose and change rule

This is the mandatory safety boundary for commands 2–5. The repository is a static site, but several pages are clients for live Supabase Edge Functions, Supabase Auth/data, Square Web Payments, Formspree, Cash App ordering, and Google Analytics. Their HTML selectors are part of the integration contract because inline and shared JavaScript query them directly.

Before changing any protected file, compare the proposed edit with this map. Visual changes may wrap or style protected elements, but must not rename, move, remove, reorder, or reinterpret a protected selector, field, value, URL, request header, request body, table/column name, action string, public application identifier, callback URL, storage key, or event name. Do not invoke live signup, payment, subscription, push, or form-submit flows during visual testing.

## Repository-level contracts

| Path | Purpose | Protected region or contract | Why it must remain stable |
| --- | --- | --- | --- |
| `CNAME` | GitHub Pages custom domain | Exact value `thesourboule.com` | Changing it can detach the live domain or alter production routing. |
| `index.html` | Canonical public homepage | Root canonical, homepage metadata/structured data, shared navigation, location discovery, and conversion paths | Root traffic and the sole canonical homepage depend on this page remaining a complete, indexable experience. |
| `robots.txt` | Crawler policy | Sitemap URL and crawl policy | A mistake can de-index the public site or hide the sitemap. |
| `sitemap.xml` | Search discovery | Production URLs under `https://thesourboule.com/` | URL changes must be coordinated with canonicals and redirects. |
| `assets/js/main.js` lines 1–53 | GA4 bootstrap and order-click analytics | `GA_ID`, dynamic `gtag.js` URL, `window.dataLayer`, `window.gtag`, `order_click`, URL matching for `squareup.com` and `cash.app/order` | Renaming events or changing URL matching breaks analytics continuity. |
| All public HTML files | Shared order and contact pathways | Existing `cash.app`, telephone, Formspree, Bread Club, and location links | These are working customer conversion contracts; do not “clean up” or substitute them without owner verification. |

## Bread Club signup and Square payment

### `breadclub.html`

Purpose: customer Bread Club configuration, Square card tokenization, and subscription creation.

Protected regions and identifiers:

- Square SDK script: `https://web.squarecdn.com/v1/square.js`.
- Root and form: `#breadclub-app`, `#breadclub-form`.
- Customer fields: `#bc-full-name`, `#bc-email`.
- Product quantity controls: `#bc-plain`, `#bc-rosemary`, `#bc-jalapeno`.
- Fulfillment controls: `#bc-pickup-location`, `#bc-frequency`, `#bc-start-date`, and `.breadclub-darkpill` button text/active state.
- Payment mount: `#card-container`.
- Status target: `#breadclub-status`.
- Preview DOM contracts: `.breadclub-note` positional order, `.breadclub-next p:nth-of-type(2)`, and related classes queried by `assets/js/main.js` and the inline application.
- Supabase function URL: `https://wbhedqwubgmsqgcugimf.supabase.co/functions/v1/create-breadclub-subscription`.
- Square public IDs: `SQUARE_APP_ID = "sq0idp-7pAIehxXOmEZV0HxnW48bg"` and `SQUARE_LOCATION_ID = "L1KAC6DSKSQ9M"`.
- Tokenization details: `intent: "STORE"`, `customerInitiated: true`, `sellerKeyedIn: false`, and billing-contact field mapping.
- Edge Function request method, `Content-Type` header, and body keys: `full_name`, `email`, `phone`, `pickup_location`, `pickup_day`, `frequency`, `start_date`, `plain_qty`, `rosemary_qty`, `jalapeno_qty`, `status`, and `card_token`.
- Allowed values and action semantics: pickup-day button text, frequency option text, product names/prices/discount, pending status, date format, and first-pickup cutoff logic.
- Square lifecycle: `payments`, `card`, `attach`, `tokenize`, `destroy`, and reattachment after success.
- Account link target: `breadclub-account.html`.

Why protected: selector order and text are used as data; the card token is exchanged with a live Edge Function that creates a Square-backed recurring subscription. Seemingly visual DOM reordering can change the submitted product, date, frequency, preview, or payment mount.

### `assets/js/main.js` lines 55–380

Purpose: shared Bread Club date, quantity, pricing, and preview behavior.

Protected regions and identifiers:

- `#breadclub-app` guard and all `bc-*` element IDs.
- `.breadclub-darkpill`, `.breadclub-next`, and positional `.breadclub-note` queries.
- Product keys, quantities, prices, frequency strings, pickup-day strings, cutoff/date calculations, and generated preview class names.
- Event bindings for pickup day, customer identity, product quantities, frequency, and start date.

Why protected: `breadclub.html` also has an inline application that touches the same controls. The two implementations currently overlap and contain different base-price assumptions; changing or “deduplicating” either one without an integration test can alter customer-visible totals or payloads.

## Bread Club customer account

### `breadclub-account.html`

Purpose: passwordless customer login, account lookup, and pause/resume/cancel operations.

Protected regions and identifiers:

- Supabase client script: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`.
- `SUPABASE_URL`, publishable `SUPABASE_ANON_KEY`, and `FUNCTION_URL` for `customer-manage-breadclub-subscription`.
- Auth/UI selectors: `#loginView`, `#noAccountView`, `#accountView`, `#loginForm`, `#email`, `#loginBtn`, `#status`.
- Account selectors: `#accountEmail`, `#statusPill`, `#pickupDay`, `#frequency`, `#startDate`, `#plainQty`, `#rosemaryQty`, `#jalapenoQty`, `#notes`.
- Action selectors: `#pauseBtn`, `#resumeBtn`, `#cancelBtn`, `#reloadBtn`, `#logoutBtn`, `#signOutNoAccountBtn`, `#actionStatus`.
- Redirect URL: `https://thesourboule.com/breadclub-account.html`.
- Supabase Auth calls and options: `exchangeCodeForSession`, `signInWithOtp`, `emailRedirectTo`, `shouldCreateUser`, `getUser`, `getSession`, and `signOut`.
- Table/query contract: `bread_club_members`; columns including `email`, `created_at`, `status`, `square_subscription_id`, `id`, quantities, fulfillment fields, and notes.
- Function request authorization header and body keys `action`, `subscription_id`, and `member_id`; exact action strings `pause`, `resume`, `cancel`.

Why protected: changes can break magic-link completion, row-level-security expectations, member lookup, bearer authorization, or Square subscription management.

## Bread Club administration

### `admin-breadclub.html`

Purpose: authorized admin login, member listing, and Square subscription management.

Protected regions and identifiers:

- Supabase module: `https://esm.sh/@supabase/supabase-js@2`.
- `SUPABASE_URL`, publishable `SUPABASE_ANON_KEY`, `MEMBERS_TABLE = "bread_club_members"`, and `MANAGE_SUBSCRIPTION_URL` for `manage-breadclub-subscription`.
- Auth views/forms/status IDs: `#loadingView`, `#loginView`, `#unauthorizedView`, `#adminView`, `#loginForm`, `#email`, `#loginBtn`, `#status`, and logout/reload/table IDs referenced in the inline script.
- Supabase client auth settings, redirect-code exchange, session/user checks, OTP login, auth-state handler, and sign-out calls.
- Authorization table/query: `breadclub_admins`, email lookup, and the full `bread_club_members` listing/order.
- Bearer `Authorization` header; request body keys `action`, `subscription_id`, `member_id`; exact action strings.
- Generated `data-action`, `data-member-id`, and `data-subscription-id` attributes and their delegated bindings.
- Member/Square columns, statuses (`active`, `paused`, `canceled`), and enable/disable logic.

Why protected: the page enforces an admin allow-list before exposing member operations. DOM/data-attribute changes can target the wrong member or subscription; auth/query changes can expose private records or lock out admins.

## Push administration

### `admin-push.html`

Purpose: password-gated UI for sending push notifications and reading send history through Supabase Edge Functions.

Protected regions and identifiers:

- Endpoints `send-push` and `get-push-history` under the current Supabase project.
- Storage contract `STORAGE_KEY = "sour_boule_push_password"`.
- Request header `x-push-admin-secret`, JSON content type, and request keys `title` and `body`.
- Response fields `sent`, `error`, `sent_at`, `title`, and `body`.
- IDs `#loginCard`, `#password`, `#sender`, `#title`, `#message`, `#counter`, `#status`, `#historyCard`, and `#history`.
- Global function names used by inline handlers: `login`, `logout`, `updateCounter`, `sendNotification`, `loadHistory`, and `showAdmin`.
- Confirmation step and 150-character UI contract.

Why protected: the secret/header pair is the live authorization contract and global function names are called directly from HTML attributes. Note for later security review: the secret persists in `localStorage` and history fields are interpolated into `innerHTML`; do not silently refactor these protected behaviors during visual work.

## Form submissions

| Path | Endpoint | Protected form contract |
| --- | --- | --- |
| `catering.html` | `https://formspree.io/f/mvzvrerj` | POST method; `_subject`; `catering_location`; names/IDs for `name`, `email`, `phone`, `event_date`, `guest_count`, `catering_type`, and `details`; required flags. |
| `events.html` | `https://formspree.io/f/mreoknlz` | POST method; `_subject`; `event_location`; names/IDs for `name`/`event-name`, `email`/`event-email`, `phone`/`event-phone`, `preferred_event_date`/`event-date`, `estimated_guest_count`/`event-guests`, `event_type`/`event-type`, and `event_details`/`event-details`; required flags. |
| `contact.html` | `https://formspree.io/f/xojpwgwb` | POST method; `_subject`; names/IDs for `name`/`contact-name`, `email`/`contact-email`, `phone`/`contact-phone`, `location`/`contact-location`, `topic`/`contact-topic`, and `message`/`contact-message`; required flags; exact location option values `Fort Worth`, `Willow Bend`, and `General`. |

Why protected: Formspree routing and owner notifications depend on the exact endpoint and submitted field names. Labels/classes may be improved only while retaining the input IDs and submission contract.

## External ordering, phone, analytics, and content services

### Ordering and telephone links

All public ordering actions use the protected shared URL `https://cash.app/order/$thesourboule`. Guests choose their pickup location after opening Square; no public order action claims to preselect Fort Worth or Willow Bend.
- `tel:+16822503052` for Fort Worth and `tel:+16822240888` for Willow Bend/Willow Park where present.

Do not change the shared ordering URL without owner validation. `assets/js/main.js` records order analytics for `cash.app/order` (and `squareup.com`), so its URL shape also affects reporting.

### Third-party presentation/content dependencies

- Google Fonts (`fonts.googleapis.com`, `fonts.gstatic.com`) on public pages.
- Unsplash image URLs in `assets/css/style.css`.

These are not backend logic, but their URLs are current content/performance contracts. Replace only through the documented image/font migration plan, with visual and feed validation.

## Backend and environment inventory result

- There are no tracked serverless function sources, API route files, webhook implementations, database migrations, environment-variable files, framework configuration, or secrets files in this repository.
- All live backend behavior is remote: Supabase Edge Functions/Auth/data, Square Web Payments, Formspree, Cash App, and GA4.
- The Supabase anon/publishable key and Square application/location IDs are intentionally public client identifiers, but their exact values are still protected integration configuration.
- Webhooks may exist behind the remote Supabase/Square system, but no webhook code is present here. Do not infer permission to change remote functions, Supabase configuration, Square settings, or deployment secrets.

## Required verification for every later command

1. Diff the protected files and regions above before staging.
2. Confirm integration URLs, identifiers, selectors, names, data attributes, option values/text, and payload contracts are byte-for-byte unchanged unless the owner explicitly approves a backend change.
3. Use inert/local visual checks; never complete a real charge, subscription change, push send, or Formspree submission.
4. Verify keyboard/focus behavior without altering handler semantics.
5. Record any protected-file visual edits and the specific preserved contract in the command handoff.

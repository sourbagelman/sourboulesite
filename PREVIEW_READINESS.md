# Preview readiness

## Recommended command 5 preview

Use an immutable export of the approved `redesign/guest-experience-seo` commit and upload that export to a new, temporary HTTPS static-site project with no repository connection.

Prepare the upload outside the repository working tree. Omit `CNAME` from the exported copy only, add a preview-only `X-Robots-Tag: noindex, nofollow` response header (and a disallow-all preview `robots.txt` as defense in depth), and use the provider's generated preview hostname. Do not change the tracked `CNAME`, GitHub Pages source, DNS, production project, or live domain.

This is safer than changing GitHub Pages configuration because the repository contains a production `CNAME` and no verified branch-preview integration. A reproducible localhost server remains the fallback if no isolated temporary provider is available. Use HTTPS for the remote preview so Square can initialize in a secure context, but do not submit a payment or subscription.

Before sharing the preview, verify `/`, all `.html` routes in `sitemap.xml`, `brand-home.html`, the social card, icons, and direct deep links. Confirm the preview response header prevents indexing and that the generated hostname does not redirect to `thesourboule.com`.

## Command 4 browser baseline

Measured on 2026-08-05 with a localhost static server and fresh, unthrottled headless Chromium context per route. These are browser trace measurements, not Lighthouse scores; the environment did not include a Lighthouse binary. External fonts and images were enabled, so network variance affects the numbers.

| Route | FCP | LCP | CLS | Blocking time equivalent | Transfer | Requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 232 ms | 684 ms | 0.0237 | 0 ms | 816 KB | 11 |
| `fort-worth.html` | 176 ms | 244 ms | 0.0049 | 0 ms | 391 KB | 8 |
| `willow-bend.html` | 152 ms | 152 ms | 0.0257 | 0 ms | 94 KB | 7 |
| `menu.html` | 156 ms | 156 ms | 0.0295 | 0 ms | 105 KB | 7 |
| `breadclub.html` | 180 ms | 180 ms | 0.0119 | 0 ms | 174 KB | 9 |
| `catering.html` | 136 ms | 136 ms | 0.0448 | 0 ms | 97 KB | 7 |
| `contact.html` | 204 ms | 204 ms | 0.0105 | 0 ms | 96 KB | 7 |

All tested routes returned HTTP 200, logged no local resource or page errors, contained one H1, and had no horizontal overflow. All public routes also passed 320 px, 390 px, 768 px, and representative desktop overflow checks. The mobile navigation closed on Escape, returned focus to its summary control, and synchronized `aria-expanded="false"`.

The homepage remains the largest route because its visual design uses several remote Unsplash images. Command 4 reduced requested dimensions and quality conservatively, added a high-priority hero preload, and added asynchronous decoding to the below-fold story image without replacing or downloading the existing sources.

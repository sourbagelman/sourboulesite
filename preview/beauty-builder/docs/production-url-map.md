# Production URL and Canonical Map

The preview remains `noindex, nofollow`. No `<link rel="canonical">` tags are present in the preview HTML. Add the recommended production canonical only after the site is served from `https://thebeautybuilderco.com` and the corresponding clean routes resolve.

| Preview path | Future production path | Recommended production canonical |
|---|---|---|
| `/preview/beauty-builder/` | `/` | `https://thebeautybuilderco.com/` |
| `/preview/beauty-builder/services.html` | `/services/` | `https://thebeautybuilderco.com/services/` |
| `/preview/beauty-builder/treatments.html` | `/treatments/` | `https://thebeautybuilderco.com/treatments/` |
| `/preview/beauty-builder/microneedling.html` | `/treatments/microneedling/` | `https://thebeautybuilderco.com/treatments/microneedling/` |
| `/preview/beauty-builder/skin-classic.html` | `/treatments/skin-classic/` | `https://thebeautybuilderco.com/treatments/skin-classic/` |
| `/preview/beauty-builder/get-glowing-peel.html` | `/treatments/get-glowing-peel/` | `https://thebeautybuilderco.com/treatments/get-glowing-peel/` |
| `/preview/beauty-builder/elaine-brennan-peel.html` | `/treatments/elaine-brennan-peel/` | `https://thebeautybuilderco.com/treatments/elaine-brennan-peel/` |
| `/preview/beauty-builder/faq.html` | `/faq/` | `https://thebeautybuilderco.com/faq/` |
| `/preview/beauty-builder/policies.html` | `/policies/` | `https://thebeautybuilderco.com/policies/` |
| `/preview/beauty-builder/visit.html` | `/visit/` | `https://thebeautybuilderco.com/visit/` |
| `/preview/beauty-builder/forms.html` | `/client-forms/` | `https://thebeautybuilderco.com/client-forms/` |

## Activation notes

- Configure the clean routes before adding canonical tags.
- Redirect legacy `.html` and current GoDaddy paths to the closest mapped clean route with one permanent redirect.
- Choose either `www` or non-`www` as the primary host. The metadata currently assumes non-`www`.
- Keep query parameters out of canonical URLs unless a future page intentionally represents distinct content.
- Structured data, Open Graph URLs, and `sitemap.xml` already use the recommended production paths; they are preparation data, not preview canonical directives.


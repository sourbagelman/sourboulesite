# Production Launch Checklist

## Content and owner verification

- [ ] Reconfirm business name, phone, current hours, service prices, policies, treatment claims, forms, and social links with the owner.
- [ ] Confirm whether the street address remains private and how Google Business Profile should handle it.
- [ ] Recheck every Square booking and gift-card link.
- [ ] Recheck every Jotform, Google Form, and PDF.
- [ ] Review all treatment language with the owner for scope-of-practice and regulatory accuracy.

## URLs, crawlability, and metadata

- [ ] Make every clean route in `production-url-map.md` resolve on `https://thebeautybuilderco.com`.
- [ ] Add the documented production canonical URL to each page only after its production route works.
- [ ] Remove `noindex, nofollow` only from the production copies after final approval.
- [ ] Replace the preview `robots.txt` with `docs/robots.production.txt` at the production domain root.
- [ ] Keep the production `sitemap.xml` at the domain root and verify every URL returns `200`.
- [ ] Ensure the Sour Boule preview remains blocked or remove it after the production launch is safely complete.
- [ ] Choose and enforce either `www` or non-`www`; redirect the alternate host permanently.
- [ ] Configure one-hop permanent redirects from current GoDaddy URLs and any `.html` URLs to the clean production routes.
- [ ] Test the favicon and social image on the real domain.
- [ ] Test Open Graph and X cards with production URLs.
- [ ] Create and test a useful branded `404` page.

## Hosting, HTTPS, and security

- [ ] Verify HTTPS and the full certificate chain on the primary and redirecting hostnames.
- [ ] Apply and test the production security headers in `security-production-notes.md`.
- [ ] Confirm redirects do not loop and preserve only intentional query parameters.
- [ ] Run desktop, mobile, keyboard, accessibility, structured-data, link, and performance tests against production.
- [ ] Confirm there are no console errors, mixed-content requests, or blocked required resources.

## Search and measurement

- [ ] Verify the production property in Google Search Console and submit `sitemap.xml`.
- [ ] Verify the Google Business Profile and connect the final website URL.
- [ ] Verify Bing Webmaster Tools and submit `sitemap.xml`.
- [ ] Decide whether analytics is necessary, select a privacy-appropriate implementation, and document consent requirements before adding scripts.
- [ ] Monitor indexing, crawl errors, structured-data reports, Core Web Vitals, and local-profile accuracy after launch.

## DNS, email, backup, and rollback

- [ ] Export or otherwise back up the current live GoDaddy website before changing anything.
- [ ] Record all current DNS entries before cutover.
- [ ] Verify email DNS separately, including MX, SPF, DKIM, and DMARC.
- [ ] Confirm MX records will remain untouched during the website DNS cutover.
- [ ] Lower DNS TTL only if an approved cutover plan calls for it.
- [ ] Prepare the exact DNS changes, responsible person, launch window, and rollback threshold.
- [ ] Keep the previous website available until the new site, redirects, HTTPS, forms, booking, and email have been verified.
- [ ] Document and rehearse the rollback plan before cutover.
- [ ] Only cancel GoDaddy website services after the production site has been verified and the backup is confirmed usable.


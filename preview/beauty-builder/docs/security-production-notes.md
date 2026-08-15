# Static Security and Production Header Notes

## Current review

- The preview contains no API keys, access tokens, passwords, database credentials, analytics identifiers, or private configuration.
- The site has no backend, authentication layer, local form handler, cookies, or storage.
- Booking and gift-card transactions remain on Square.
- Consent and acknowledgement forms remain on their existing Jotform and Google Forms destinations.
- External links that open a new tab use `rel="noopener"`.
- No mixed HTTP content or unnecessary third-party scripts are present.
- The only executable JavaScript is the local deferred `assets/js/site.js` navigation helper.
- JSON-LD blocks are inert structured data and contain only public business facts.
- PDFs and images are local preview assets. No secrets or credentials were found in HTML, CSS, or JavaScript.

## Recommended production HTTP headers

Apply these at the final production host only after testing them in a staging environment.

```text
Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-src https://form.jotform.com https://docs.google.com https://forms.gle; form-action 'self' https://form.jotform.com https://docs.google.com https://forms.gle https://squareup.com; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; upgrade-insecure-requests
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

Notes:

- Inline `style` attributes are currently present in a few visual components, so the initial CSP example allows inline styles. A future CSP-hardening pass can replace those attributes with classes and remove `'unsafe-inline'`.
- Confirm whether embedded forms are used in the final design before retaining `frame-src`.
- Add HSTS only after HTTPS works correctly on every required host and subdomain. Add `preload` only after a separate readiness review.
- If analytics is later approved, add only the specific required origins to `script-src`, `connect-src`, and `img-src`.
- Keep hosting and email DNS changes separate. Security headers do not require MX-record changes.


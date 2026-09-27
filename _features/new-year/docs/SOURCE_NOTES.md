# Inspection and primary technical references

## Repository inspection

Inspection date: September 27, 2026. Read-only connected GitHub operations.

- Repository: https://github.com/sourbagelman/sourboulesite
- Default branch: main
- Observed tree SHA: 6d7ba10f370727f86d63a7e2d285152e23790f45
- Repository metadata: `has_pages: true`, `language: HTML`, public repository.
- CNAME: `thesourboule.com`.
- Inspected complete tree: static root HTML pages, assets/css/style.css,
  assets/js/main.js, images/logo.png, robots.txt and sitemap.xml. No database or
  server configuration found in that inspected tree.
- Inspected current brand-home.html for site structure. No content copied into
  preview return screens, and no code write/commit/PR/deployment was performed.

The public root was reachable to the web tool but yielded no parsed page content.
The brand-home HTTP request could not be retrieved on the available web path, and
the container could not resolve the public host. Thus this package does not claim
an independent DNS/proxy/deployed-content verification. GitHub metadata and source
are the evidence for the static site architecture, not an assumption of a server.
Recheck the actual live routing before deployment.

## Primary documentation consulted

GitHub Pages static hosting:
https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages

Cloudflare D1 Worker API, prepared statements, batches/transaction behavior and
primary/read-session behavior:
https://developers.cloudflare.com/d1/worker-api/d1-database/

Cloudflare Access JWT verification, trusted issuer/audience and public signing keys:
https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/

MDN Page Visibility API, visibilitychange and browser background throttling:
https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API

The exact grace windows, UI, application schema, SQL guards, retention proposal,
and hosting topology are project implementation decisions, not claims copied from
these documents. Verify current platform limits, CLI compatibility, costs, domain
requirements and deployment configuration during the authorized setup phase.


## Revision 2 reference

Cloudflare Access session management (reviewed September 27, 2026):
https://developers.cloudflare.com/cloudflare-one/access-controls/access-settings/session-management/

Access application/policy session lifetime is configurable, not a permanent device
login. This revision proposes 12 hours for a shift, subject to actual staging setup.
No live Access configuration was changed. Five-digit allocation, collision handling
and UI behavior are project implementation decisions backed by the local tests,
not claims that Cloudflare itself issues these promotional codes.

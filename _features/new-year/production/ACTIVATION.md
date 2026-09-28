# October website activation

The production promotion service and the website loader are separate release
controls. Provisioning the service does not activate or publish the main website.
The checked-in loader source and current generated website asset remain disabled.

The approved permanent service's public resource IDs are in `resources.json`.
To reproduce its Worker configuration and real guest/staff assets locally, from
`_features/new-year` run:

```sh
node production/build-deployment.mjs
```

The command produces an isolated `.local/production-build-*` directory and prints
the exact generated Wrangler configuration path. It targets the approved fresh
production database and only the `celebrate.thesourboule.com` custom domain. The
production service is enabled in that generated configuration; the checked-in
template remains disabled. The command does not deploy, alter DNS or records,
read or write secrets, or change any website file. `PASS_SECRET` must remain a
server-side Worker secret. Rebuilding is not evidence of successful deployment or
live verification; use the release handoff for actual cloud results.

After the owner explicitly authorizes the finalized October website release,
finish production service verification and release checks first. Then, from
`_features/new-year`, generate the release website asset:

```sh
node scripts/build-integration.mjs --enable-for-approved-october-release
```

This command changes only `assets/js/new-year-2027.js` at the repository root,
setting its existing release gate to true. It preserves the current pages,
seasonal implementation, permanent `https://celebrate.thesourboule.com` endpoint,
and fixed event schedule. It does not deploy anything. Review that single asset
change as part of the exact website revision approved for publication.

The source at `src/integration-loader.js` intentionally remains the disabled
reference. Production preparation runs before this final activation step because
it requires the generated asset to match that disabled source. Do not rerun the
default integration build after activation: its safe default disables the asset.

October installation polls the real service time but does not open the takeover.
The existing schedule opens automatically December 31, 2026 at 11:50 PM
America/Chicago, starts the final-minute descent at 11:59 PM, changes 2026 to 2027
with fireworks at midnight, and returns to the same website page January 1, 2027
at 12:05 AM. No New Year's Eve activation command or simulated date is used.
Existing session dismissal, fail-open behavior, and earned-pass recovery remain
unchanged.

To generate the disabled asset explicitly without changing any page:

```sh
node scripts/build-integration.mjs --disable
```

Focused evidence is in `tests/release-activation.test.mjs` and the existing
`production-preparation.test.mjs` test named **enabling the real loader in October
does not open early and later follows only server event time**. These are local
tests; they do not replace production integration or physical-iPhone verification.

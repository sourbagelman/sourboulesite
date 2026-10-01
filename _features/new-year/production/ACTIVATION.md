# October website activation

The production promotion service and the website loader are separate release
controls. The prepared October release artifact at
`assets/js/new-year-2027.js` is now enabled with the real production endpoint and
server-timed schedule. This is a prepared release-branch file, not evidence that
the main website has been published. The source reference at
`src/integration-loader.js` remains disabled. Website publication follows the
owner-authorized release process separately.

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

The enabled release asset was prepared with this explicit command, run from
`_features/new-year`:

```sh
node scripts/build-integration.mjs --enable-for-approved-october-release
```

This command changes only `assets/js/new-year-2027.js` at the repository root,
setting its existing release gate to true. It preserves the current pages,
seasonal implementation, permanent `https://celebrate.thesourboule.com` endpoint,
and fixed event schedule. It does not deploy anything. Review that single asset
change as part of the exact website revision approved for publication. It is not
an instruction to publish outside that release process.

The source at `src/integration-loader.js` intentionally remains the disabled
reference. Production and staging preparation accept only an exact copy of that
reference or the exact enabled release transformation, record the generated
asset's actual mode, and never rewrite the website. A default integration build
preserves the existing generated mode. If the generated asset differs from the
source beyond its release gate, the build fails before writing anything so a
later menu or normal build cannot silently disable or replace the approved asset.

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

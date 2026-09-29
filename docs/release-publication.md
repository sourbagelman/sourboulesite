# September 30 publication control — prepared, NOT armed

This is the publication runbook for existing `release/2026-10-01` and draft
[PR #4](https://github.com/sourbagelman/sourboulesite/pull/4), not a new release
project. The [single release checklist](october-release-checklist.md) remains
authoritative. The target is **September 30, 2026, 11:59 PM America/Chicago**,
**`2026-10-01T04:59:00Z`**, replacing earlier website-midnight wording. New Year's
event instants are unchanged.

## Prepared now

- The generated `assets/js/new-year-2027.js` is enabled and points to the existing
  permanent production service. Its disabled source/reference is preserved.
  Default integration builds preserve the exact generated mode; unexpected drift
  fails instead of overwriting it. The publication artifact guard requires the
  exact enabled transform, twelve current page includes and seasonal hooks, and
  rejects private preview flags/hosts. Later menu builds cannot pass release
  validation with a disabled loader or a substituted preview page.
- All current business HTML, seasonal designs, menus/prices/hours, ordering
  destinations and the already-deployed promotion service are preserved. This
  preparation does not rebuild or deploy that service.
- The hosted GitHub Actions controller is in
  `.github/workflows/release-2026-10-01.yml`, with source/tests in `_release/`.
  Pushing relevant candidate/menu changes runs only its **read-only dry run**.
  The publish job cannot run on a release-branch push.
- Checked-in `plan.json` is permanently disarmed. No actual arming variable or
  cancellation/lock tag has been created; no scheduler has been installed on
  `main`, no publishing setting or DNS changed, and no production ref was moved.

## Actual unattended behavior

GitHub's scheduler runs workflows only from the default branch. A schedule merely
stored in a release branch would be inactive. Therefore final arming must first
install a reviewed **control-only bootstrap commit** on `main`. That commit adds
only this workflow and `_release/` control files; every existing production file
remains byte-identical. It may cause GitHub Pages to rebuild the old, unchanged
website, but it cannot publish the candidate's redesign/menu/theme changes early.
The bootstrap is prepared as an object/ancestor of the release now, without
moving main. Final menu commits can therefore descend from it and receive a
single exact-SHA approval without a later ancestry rewrite.

After final approval, the existing owner-operated `gh` authorization installs
that exact bootstrap and records the final candidate SHA/tree in the repository
variable `SOUR_BOULE_RELEASE_LOCK`. A contents-readable Git tag
`release-lock/website-2026-10-01` pointing to that exact candidate is a second,
late-checked cancellation switch. Neither switch exists during preparation.

GitHub-hosted Linux runners then operate without the owner's Mac, browser or
Codex task. At the target cron trigger, the job:

1. Requires the exact repository, default `main`, approved lock, fixed **2026**
   UTC window, release-branch SHA and tree, and unchanged control-file blobs.
   Verifies bootstrap ancestry and that it did not modify production content.
2. Rechecks the live cancellation tag and release/main refs immediately before
   writes. Rejects unexpected movement and preserves the old production SHA under
   `rollback/website-before-2026-10-01`.
3. Fast-forwards `main` with `force:false` to the exact approved commit. It creates
   no merge commit and does not choose an unapproved later branch tip.
4. **Explicitly calls `POST /repos/sourbagelman/sourboulesite/pages/builds`.** A
   `GITHUB_TOKEN` ref update does not itself trigger legacy Pages, so this call is
   essential. Existing `main:/` publishing configuration stays unchanged.
5. Observes Pages' completed build **commit**, not just HTTP 201 or a ref update.
   Fetches and hashes all twelve public HTML pages, the enabled loader, seasonal
   JS/config/CSS, and verifies the real promotion time endpoint. Rechecks main
   and Pages after health checks. Only exact matching results report VERIFIED.

Runs are serialized. A retry after the ref update requests only a missing/failed
same-SHA build; an already queued build is polled, and a completed matching build
is health-checked without republishing. Unexpected SHA changes fail closed.
Cron wakeups are at 04:59 UTC and bounded retry opportunities at 05:04, 05:09,
05:14, 05:19, 05:24, 05:29 UTC on October 1. **Publication may start only during
`[2026-10-01T04:59:00Z, 2026-10-01T05:30:00Z)`**. A delayed run after that cutoff
does not publish; next-year cron wakeups cannot publish. No annual release occurs.
Disable the controller/clear its lock after the one-time result is recorded.

The 11:59 PM time is the earliest requested trigger, **not guaranteed public
visibility**. GitHub may delay or drop cron runs; queueing, the Pages build and
cache propagation add delay. Pages documents that propagation can take up to
ten minutes, and this is not a hard end-to-end SLA. If every bounded trigger is
missed, the release stays unpublished and needs a new explicit timing decision.

## Final-menu and approval sequence

1. Owner supplies finalized Fort Worth and Willow Bend menus. Apply only those
   approved content edits to this same candidate; preserve integrations/themes.
   The relevant release push runs the artifact guard/read-only hosted check.
2. Reconcile any newer production work; do not overwrite it. If main has moved
   from the recorded baseline, the prepared bootstrap/lock must be rebuilt and
   the resulting candidate reviewed **before** exact-SHA approval.
3. Owner approves the finalized candidate SHA and the following narrowly scoped
   arming actions together: install the unchanged-content bootstrap on main,
   record the immutable lock/tag, and allow the release job's temporary
   `contents:write` and `pages:write` GitHub token. No PAT, new secret, new cloud
   resource, paid service, DNS change or Pages setting change is needed. Existing
   repository/owner credentials already have the necessary scope; no protection
   is removed. These arming/publication permissions are **not exercised now**.
4. From a clean checkout at the exact approved commit, run the read-only check,
   then arm only after that explicit approval:

   ```sh
   node _release/arm.mjs --check APPROVED_FULL_SHA BOOTSTRAP_FULL_SHA
   node _release/arm.mjs --arm APPROVED_FULL_SHA BOOTSTRAP_FULL_SHA --confirm-owner-approved
   ```

   The helper validates all content/refs first, preserves rollback, installs only
   the control bootstrap, confirms the scheduler is registered, then creates the
   tag and arming variable. A partial failure does not imply it is armed; inspect
   both switches. It refuses late arming and does not publish the candidate.
5. Record the final SHA, lock, scheduler state and target in the single checklist.
   Keep PR #4 draft/auto-merge off until the scheduled exact-ref publication has
   completed. Do not separately merge it early.

The reviewed bootstrap SHA and actual hosted dry-run result are recorded in the
execution receipt below. They are not a final-menu approval.

## Cancellation and failure reporting

Before publication, delete the lock tag and variable, disable the workflow, and
cancel any queued/in-progress runs of this workflow. Use the existing account:

```sh
gh api --method DELETE repos/sourbagelman/sourboulesite/git/refs/tags/release-lock/website-2026-10-01
gh variable delete SOUR_BOULE_RELEASE_LOCK --repo sourbagelman/sourboulesite
gh workflow disable release-2026-10-01.yml --repo sourbagelman/sourboulesite
gh run list --repo sourbagelman/sourboulesite --workflow release-2026-10-01.yml
gh run cancel RUN_ID --repo sourbagelman/sourboulesite
```

A missing tag/variable is already disarmed. Cancel the matching active runs;
do not cancel unrelated jobs. The live tag is re-read before publication writes,
so deleting it also stops a run whose initial variable snapshot was armed.
Cancellation after Pages has accepted a build cannot undo that build: inspect
main/Pages first, then use the rollback procedure if required.

The [GitHub Actions run page](https://github.com/sourbagelman/sourboulesite/actions)
provides durable status, logs, a step summary and the explicit failure result.
Failed verification exits nonzero and never reports successful publication.
GitHub Actions email/web notifications are available via the owner's GitHub
notification settings; their delivery is not claimed or newly configured here.
No email address, webhook, paid monitor or additional messaging permission is
required. Failure summaries explain that main may have advanced before a build
failure; retry handles that state safely.

## Rollback

The previous production SHA is `6d7ba10f370727f86d63a7e2d285152e23790f45` and is
retained by the prepared ancestry and, when armed, an explicit rollback tag.
The permanent promotion service is independent and remains in place.

For an owner-authorized rollback, first cancel/disarm as above. Read the current
main SHA, obtain the saved previous commit's tree, create a new commit with that
exact saved tree and current main as its parent, then update main with
`force:false`. Explicitly request a Pages build and verify the rollback commit
and old website. This is a normal forward history change, not a force push.
No rollback is performed automatically or during preparation.

## Verification boundaries and provider references

Focused mocks exercise writes, exact-SHA binding, retries, failures, cancellation
and date guards without changing production. The hosted dry run exercises the
real workflow, native GitHub token, Pages/ref/blob reads and actual release
artifact with **zero publication writes**. The actual future Pages POST/write
path cannot be live-tested without violating the owner's no-publication boundary;
its API/permission behavior is documented by GitHub and covered by focused mocks.
Physical iPhones, elapsed-session/security/load/restore checks and January 1–3
holiday windows remain later event-readiness items, not completed tests or menu
preparation blockers. Redemption remains fail-closed without configured windows.

- [Default-branch scheduling and delays](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [GITHUB_TOKEN and branch-based Pages publishing](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [Explicit Pages build API](https://docs.github.com/en/rest/pages/pages#request-a-github-pages-build)
- [Minimal job token permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions)
- [Standard public-runner billing](https://docs.github.com/en/actions/concepts/billing-and-usage)
- [Pages propagation timing](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site)

## Execution receipt

- Initial hosted implementation: `8604213292fe3f4018b92bc1910d456b7be4bb22`.
  A focused CLI correction at `2379965714b6d071f3b681377c94a3b2379ff47c` filters
  large GitHub comparisons to the required ancestry fields; the initial real
  arming preflight exceeded Node’s stdout buffer and performed no writes.
- Prepared bootstrap: **`ff2b5a873775b5e66e905cc859a72da5f59d594a`**, directly
  parented by the unchanged production SHA. Its seven-file diff contains only
  the workflow and `_release/` controller/tests/config. All non-control tree
  entries are unchanged. This commit is only an object/ancestor in the release;
  it has **not** been installed on main.
- Release ancestry merge `d25c2912a3a0449bf5aae27b4a5988734adc8e6f` preserves the
  tested candidate tree byte-for-byte. Subsequent documentation-only commits do
  not change the tested website or controller; the final branch SHA is in PR #4.
- **16 focused activation/build/isolation tests passed** locally, including
  September/October normal-page behavior and automatic trusted-server opening/
  closing. The generated asset differs from its disabled source only by the
  enabled release gate; default rebuilding preserves that gate.
- **70 focused scheduler/arming tests passed** with mocked writes, covering
  timing/year guards, immutable SHA/tree, unchanged bootstrap content, non-force
  refs, cancellation, duplicate/retry recovery, explicit Pages build requests,
  wrong build/content failure, final health checks and scheduler registration.
- **[Actual GitHub-hosted dry run passed](https://github.com/sourbagelman/sourboulesite/actions/runs/36587070087)**
  on September 29 at 15:02 UTC. The runner showed `Contents: read`, `Pages: read`;
  all 70 scheduler tests passed there. Actual API reads validated the current
  `main:/` Pages configuration, commit/tree and 16 public files. Its report was
  `armed: false`, `publicationWrites: 0`; the publish job was **skipped**.
- Four fresh anonymous production-service reads passed September 29: guest/pass
  and live time returned 200; staff page and staff API redirected to the approved
  Access login. Actual schedule remains correct and before-event. No service
  deployment, authentication renewal or event data mutation was needed.
- Main remains `6d7ba10f370727f86d63a7e2d285152e23790f45`; all public HTML,
  seasonal files, business content, DNS and publishing settings are unchanged.
  No release lock/tag has been created. No new expected charge or permission
  expansion was needed for this preparation. `git diff --check` passed.

The release remains **DISARMED**. This is completed technical preparation;
final menus and exact-version/arming approval are intentionally still pending.

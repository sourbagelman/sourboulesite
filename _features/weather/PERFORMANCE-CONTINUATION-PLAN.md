# Final weather performance continuation

**Historical investigation plan.** The owner's October4 release decision explicitly
supersedes the cause-before-publication gate for the recorded190.5/194 ms event,
156.4 ms emulated input delay and disclosed device/browser testing gaps. The
observations below remain intact as accepted exceptions. No further benchmark
campaign is authorized; release uses one focused prepublication smoke and one
postpublication smoke. See the latest TEST-RESULTS.md entry.

Predeclared on 2026-10-04, before the continuation's final acceptance runs.
Implementation baseline: `17c01afad32b99b837b68fbe511d7fe54fa08e7f` on
`feature/weather-final-homepage`. The owner's latest continuation instruction
controls this work. This document defines checks; it does not claim they passed
or authorize a different appearance, offer, replay policy, or release scope.

## Preserved failure and release gate

Keep the original `work/weather-final-2026-10-04/qa/page-cache/cache-results.json`
and `page-cache.log` unchanged. Their failing sample is:

- Scene `rain-mist-day`, desktop 1440×900, DPR 1, CPU 1×, HTTP-cached new tab
  with fresh renderer/session state; all eight weather resources were disk-cached.
- Canvas insertion at 83.8 ms after navigation; first RAF timestamp 88.7 ms.
- First measured playback callback: **190.5 ms**; corresponding Long Task
  starts at 88.8 ms and lasts **194 ms**; Long Animation Frame starts at 82.9 ms
  and lasts **196.6 ms**. Later callbacks were substantially shorter.
- The anonymous test wrapper loses the Long Animation Frame script URL. The
  empty `weatherLong` list does not make the callback acceptable.

The measured interval is the first playback callback, not the earlier dynamic
import or synchronous atmosphere construction. Its particular expensive operation
is not established. Later successful repeats and CPU profiles cannot establish
the cause of this earlier failure. No original full browser trace has been found.

Frontend publication remains blocked until there is a demonstrated correction
or trace-supported measurement explanation, followed by acceptance below. A new
sequence of passes alone, a raised threshold, a shortened scene, or suppressing
all enhanced playback will not close the failure. Preserve uncertainties in the
report and keep the frontend unpublished if the cause remains unexplained.

## Diagnostic investigation, separate from acceptance

Record the commit, exact generated asset hashes, fixture, browser version,
viewport/DPR, CPU/network settings, cache evidence, lifecycle events and diagnostic
instrumentation for each attempt. Freeze these inputs for the final rerun.

Reproduce the original cold-prime → close tab → cached new-tab path. Capture a
full browser trace from before navigation through cleanup. Include browser/main
thread tasks, script evaluation, User Timing, image decode/first use, graphics
and raster work where available, layout/style, input and garbage collection.
Disable trace screenshots. CPU sampling may supplement a trace; it does not
replace one. Preserve traces even when the harness assertion fails.

Use bounded local instrumentation to distinguish:

1. Bootstrap work, import request, module evaluation and import completion.
2. Each selected texture fetch/body completion, decode start/end and first use.
3. Main canvas/context allocation, particles/gradients, sprite/glaze preparation
   and readiness. Count preparations, resources and retained objects.
4. Canvas insertion/start, first draw, subsequent draws, first texture/canvas
   native operations and cleanup. Do not attribute a wrapper's entire elapsed
   interval to an inner operation without trace evidence.
5. Inspector commands and harness callbacks, layout, input and GC where the
   trace identifies them. A competing task or pause is a hypothesis until shown.

Investigate duplicate initialization, redundant decode/preparation, and cached
Promise completions grouping setup into one task. Compare instrumented and
minimal-instrumentation runs if the instruments themselves are implicated. Keep
active-playback heap sampling and expensive per-call instrumentation out of final
timing runs; diagnose their effects separately rather than discarding evidence.

Only an evidenced expensive stage should change. If preparation needs batching,
bound each batch, yield using a feature-detected scheduling API with a compatible
fallback, and check cancellation between batches. Moving the entire blocking
operation into one timer is insufficient. Measure first-use work as well as
setup. Preserve deterministic composition, movement, the revised single lighting
event, selected textures and the full five seconds after preparation completes.

## Final timing matrix

Run sequentially in one benchmark process with no concurrent browser benchmarks,
bulk image/video generation or screenshot encoding. No screenshots inside timing
visits. Use native monotonic time, real RAF/timers, 150 ms latency, 1.6 Mbps
download and 0.75 Mbps upload. Fixtures may set only wall time/observed weather
inside the isolated harness; they are not production weather evidence.

| Profile | Viewport | DPR | CPU |
| --- | --- | --- | --- |
| Desktop | 1440×900 | 1 | 1× |
| Mobile | 390×844 | 2, renderer capped at 1.5 | 4× |
| Narrow mobile | 320×568 | 2, renderer capped at 1.5 | 6× |

Use these seven existing fixtures, without substituting cheaper scenes:
`clear-day`, `overcast-night`, `rain-mist-day`, `heavy-thunder-rain-day`,
`hail-storm-night`, `freezing-rain-day`, `blowing-snow-night`. They include the
affected scene and the previously measured heavier cloud, hail, freezing and
snow families. Lighting remains enabled for applicable private fixtures.

The final matrix is:

- **20 consecutive desktop rain/mist cycles**, each with a cold visit in a
  new context, close that tab, open a fresh tab sharing the context's HTTP cache,
  then a consumed-session navigation: **60 visits**, including 20 exact warm
  paths. Do not replace these with reloads of an already-consumed document.
- Each remaining desktop family: cold, cached fresh tab, consumed navigation:
  **18 visits**.
- All seven families at each mobile profile: cold, cached fresh tab, consumed
  navigation: **42 visits**.
- Matched weather-disabled and unchanged current-production controls, three
  repeats of cold/consumed visits per profile: **36 visits**. Compare loading
  and ordering to the corresponding new rain/mist runs. Keep baseline source
  hashes and differences explicit.

This is **120 new-suite visits plus 36 control visits**. Warm means verified HTTP
cache reuse with a new document and new renderer state, not an in-memory module
reuse claim. Confirm the expected selected textures and renderer are cached, not
just one resource. Record cold encoded/transfer bytes separately from logical
cached body sizes. Keep all failures in the sequence and report their positions;
do not replace them with successful retries or relabel a diagnostic run as final.

Every timed visit retains a trace through cleanup, with result/trace files saved
before asserting acceptance. Preserve unattributed long tasks overlapping weather
for investigation. Flush trace output between visits, after timing ends.

## Input, resource and memory measurement

Exercise the existing menu and Order Online disclosures and scrolling with
trusted browser input **during preparation**, including the cached path. Verify
the input actually falls between preparation start/end marks; a command after
canvas insertion is not a preparation check. Use a separately labeled controlled
gate for functional cancellation if needed, never to make performance look better.
Do not submit an order or follow a transaction URL.

Capture Event Timing input delay/processing/duration and the visible disclosure
state/next rendering opportunity; capture wheel/scroll timestamps and outcome.
Playwright click/tap wall time includes actionability checks and round trips and
must not be called INP. Report the actual supported event metrics and any missing
browser data. Ordering must remain operable with no weather-attributable ≥50 ms
blocking interval. Measure both the preparation window and active animation.

Count every selected request, decode, preparation, starter, canvas insertion,
peak active canvas and pending animation chain. One successful visit has one
preparation/start and at most one active decorative canvas/loop. Consumed visits
must request no renderer or textures; Home may still read its one factual JSON.
Record first-frame and steady-state distributions separately.

Run memory checks separately using the same representative scenes/cache states.
Report whole-page JS heap separately from logical texture/sprite/canvas backing;
neither is total browser/GPU memory. Keep before/active/after-cleanup measurements
and inspector timestamps. Verify image references, blob URLs, abandoned sprites,
canvas buffers, timers and RAF chains are released. Do not infer a leak solely
from an uncollected heap snapshot or claim a total-memory ceiling that was never
specified. Retain the original resource and pixel caps.

## Unchanged acceptance requirements

- No weather-attributable task, preparation batch, first-use operation or drawing
  callback **≥50 ms**. Investigate overlapping unattributed long tasks; an empty
  URL filter is not a pass. Drawing p95 remains **<4 ms at 4×** and **<8 ms at 6×**.
- No weather-added layout shift. Compare initial/readout/animation/cleanup shifts
  against matched controls, including the setup period before canvas insertion.
- Full **5,000 ms** playback after preparation, approved fade and motion intact;
  cleanup must complete without late insertion, duplicate playback or restart.
- Static bootstrap/readout JS ≤8 KiB gzip; all runtime weather JS ≤25 KiB gzip;
  selected cold textures ≤128 KiB; total cold weather bodies ≤160 KiB; snapshot
  <2 KiB decoded. Report served encodings, request counts and overhead honestly.
- Canvas ≤2,000,000 pixels and DPR ≤1.5. Preserve selective resource loading,
  bounded failure behavior and existing motion/data/storage/session safeguards.
- Factual Home readout remains independent of animation eligibility, failure and
  cancellation; no unsupported inference or extra rendering request is introduced.

## Affected regression checks

If preparation changes, test cancellation at the new yield boundaries and late
texture/decode/module completion: effects off, lighting off, reduced motion,
hidden/pagehide/navigation, New Year takeover and preparation deadline. Also
test viewport changes before start. Exercise both native scheduler and fallback
paths when introduced. Assert no late canvas/RAF, no consumed session before
start, complete resource release, no duplicate fetch/setup/loop, and no automatic
replay on return. The Home readout stays usable when appropriate and recovers
after visibility/New Year return with its existing freshness policy.

Reuse existing unaffected adapter, endpoint, business-content and session tests.
Rerun the focused client/renderer/pipeline cases affected by an actual fix. Run
visual parity separately from timing against the approved 64 compositions at
320, 390 and 1440 px, including lighting peak, 4.25/4.8 s and five-second cleanup.
Run the affected keyboard/control/zoom/accessibility checks separately. No visual
capture or accessibility browser run may overlap a timing run.

Chromium CPU/network emulation is local automation. Unavailable WebKit, physical
iPhone/Safari, VoiceOver and real cellular/thermal checks remain unperformed.
The final report must retain the original failure, every new failure, demonstrated
cause/correction, unresolved uncertainty, worst setup/first-use/draw/task values,
test counts and bytes. Publication remains conditional on this acceptance;
successful repeats alone do not remove the original blocker.

## Execution disposition

The continuation ran the 120 new-suite timing visits above as diagnostic evidence:
20 desktop affected-scene cycles, six additional desktop families, and all seven
families at each mobile profile. The desktop repetition harness launched a fresh
browser per cycle, while each cold/warm pair shared one context's HTTP cache.
No screenshots, video generation or other browser benchmark ran concurrently.
All selected warm renderer/texture URL sets and cache flags were also checked
against the saved results after execution; consumed visits loaded no renderer or
textures. Every visit retained its trace.

Nine initial stage/native/heap diagnostic visits and 21 separate preparation-input
visits were also recorded. The input probes preserve partial/missed warm windows
rather than labeling them passed. The original failure remains unresolved, so
these are **not a final release acceptance or an optimization validation**.
The separate 36 control visits were not repeated: production runtime bytes did
not change, and the existing 54 off/legacy/new comparison visits remain valid.
The original 381 functional checks and 960 frame-parity comparisons are reused
for the same unchanged source. Three focused page accessibility checks were rerun.
See TEST-RESULTS.md for measurements, all recorded failures and limitations.

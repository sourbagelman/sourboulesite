#!/usr/bin/env python3
"""Offline, streaming Chrome trace summary. Reads evidence; writes only --out.

Usage: python3 _features/weather/tests/summarize-page-traces.py --out summary.json
       /path/to/trace-original /path/to/trace-desktop-20
       /path/to/trace-desktop-families /path/to/trace-mobile-families

Input: CDP trace JSON with one event per line, and cache-results.json runs in
the same order as N-kind.trace.json. A task overlapping weather's time interval
is a CANDIDATE, not exclusive weather attribution. Category costs overlap and
MUST NOT be added. No browsers/network/repository changes are performed.
"""
import argparse
import collections
import datetime
import json
from pathlib import Path
import re
import statistics
import sys

RENDERER = re.compile(r"(?:^|/)weather-(?:renderer|fallback)-v3\.js(?:[?#]|$)")
TASKS = {"RunTask", "ThreadControllerImpl::RunTask", "ThreadControllerWithMessagePumpImpl::RunTask"}
GROUPS = {
    "canvasResource": {"Canvas2DResourceProviderSharedImage::ProduceCanvasResource"},
    "imageDecode": {"GpuImageDecodeCache::DecodeImage"},
    "imageUpload": {"GpuImageDecodeCache::UploadImage"},
    "gc": {"MinorGC", "MajorGC", "V8.GCScavenger", "V8.GCCompactor"},
    "styleLayout": {"Blink.Style.UpdateTime", "Blink.Layout.UpdateTime", "UpdateLayoutTree", "Layout"},
    "gpuInitialization": {"GpuChannelHost::CreateViewCommandBuffer", "CommandBufferProxyImpl::Initialize", "RenderThreadImpl::EstablishGpuChannelSync"},
    "gpuRaster": {"RasterDecoderImpl::DoEndRasterCHROMIUM::Flush"},
    "sharedImageAllocation": {"SharedImageStub::OnCreateSharedImage"},
}
KEEP = set().union(*GROUPS.values(), TASKS, {
    "thread_name", "process_name", "navigationStart", "TracingStartedInBrowser",
    "RequestAnimationFrame", "FireAnimationFrame", "ResourceSendRequest",
    "EvaluateScript", "CompileScript", "Decode Image", "ImageDecodeTask",
})
TOKENS = tuple('"' + n + '"' for n in KEEP) + ('"weather:',)


def read_trace(path):
    kept, bad, lines = [], 0, 0
    with path.open(encoding="utf-8") as stream:
        for line_number, line in enumerate(stream, 1):
            line = line.strip().rstrip(",")
            if not line.startswith("{"):
                continue
            if '"traceEvents"' in line:
                if '"ph"' in line:
                    raise ValueError(f"{path}:{line_number}: expected one event per line")
                continue
            lines += 1
            if not any(token in line for token in TOKENS):
                continue
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                bad += 1
                continue
            if isinstance(e, dict) and (e.get("name") in KEEP or e.get("name", "").startswith("weather:")):
                kept.append(e)
    if bad:
        raise ValueError(f"{path}: {bad} relevant event lines failed parsing")
    return kept, lines


def data(e):
    return e.get("args", {}).get("data", {})


def numeric(n):
    return isinstance(n, (int, float)) and not isinstance(n, bool)


def span(e):
    return e["ts"], e["ts"] + e.get("dur", 0)


def overlap(a, b):
    return a[0] < b[1] and a[1] > b[0]


def union(spans):
    spans = sorted((a, b) for a, b in spans if b > a)
    if not spans:
        return 0
    total = 0
    start, end = spans[0]
    for a, b in spans[1:]:
        if a > end:
            total += end - start
            start, end = a, b
        else:
            end = max(end, b)
    return total + end - start


def brief(e, origin):
    r = {"name": e.get("name"), "atMs": round((e["ts"] - origin) / 1000, 6),
         "durationMs": round(e.get("dur", 0) / 1000, 6), "pid": e.get("pid"), "tid": e.get("tid")}
    if "tdur" in e:
        r["threadCpuMs"] = round(e["tdur"] / 1000, 6)
    if e.get("args"):
        r["args"] = e["args"]
    return r


def outer_tasks(events):
    names = {e["name"] for e in events}
    chosen = "RunTask" if "RunTask" in names else next((n for n in sorted(TASKS) if n in names), None)
    candidates = sorted((e for e in events if e["name"] == chosen), key=lambda e: (e["ts"], -e.get("dur", 0)))
    output, end = [], -1
    for e in candidates:
        if span(e)[1] <= end:
            continue
        output.append(e)
        end = span(e)[1]
    return output, chosen


def costs(events, bounds, origin):
    answer = {}
    for group, names in GROUPS.items():
        selected = [e for e in events if e["name"] in names and overlap(span(e), bounds)]
        clips = [(max(e["ts"], bounds[0]), min(span(e)[1], bounds[1])) for e in selected]
        answer[group] = {
            "count": len(selected), "unionWithinWindowMs": round(union(clips) / 1000, 6),
            "maxWholeEventMs": round(max((e.get("dur", 0) for e in selected), default=0) / 1000, 6),
            "largestEvents": [brief(e, origin) for e in sorted(selected, key=lambda e: e.get("dur", 0), reverse=True)[:6]],
        }
    return answer


def analyze(path, run, index):
    events, lines = read_trace(path)
    navs = [e for e in events if e.get("name") == "navigationStart" and
            (data(e).get("isOutermostMainFrame") is True or data(e).get("isLoadingMainFrame") is True)]
    # Chrome also emits empty-URL provisional/isolated-document navigation marks.
    # The committed top-level fixture navigation has the actual https URL.
    committed = [e for e in navs if str(data(e).get("documentLoaderURL", "")).startswith(("https://", "http://"))]
    if committed:
        navs = committed
    if len(navs) != 1:
        raise ValueError(f"Expected one main-frame navigationStart, found {len(navs)}")
    nav = navs[0]
    origin, pid, tid = nav["ts"], nav["pid"], nav["tid"]
    main = [e for e in events if e.get("pid") == pid and e.get("tid") == tid]
    complete = [e for e in main if e.get("ph") == "X" and numeric(e.get("dur"))]
    tasks, task_name = outer_tasks([e for e in complete if e["name"] in TASKS and span(e)[1] > origin])
    if not tasks:
        raise ValueError("No outer main-renderer tasks found")
    marks = collections.defaultdict(list)
    for e in main:
        if e.get("name", "").startswith("weather:"):
            marks[e["name"]].append(e["ts"])
    for values in marks.values():
        values.sort()
    positions, offsets = collections.Counter(), []
    for m in run.get("marks", []):
        name, at = m.get("name"), m.get("at")
        position = positions[name]
        positions[name] += 1
        if numeric(at) and position < len(marks[name]):
            offsets.append((marks[name][position] - origin) / 1000 - at)
    if offsets and max(map(abs, offsets)) > 0.5:
        raise ValueError("Navigation origin differs from performance marks by >0.5ms; refusing attribution")
    mapping = {
        "source": "main-frame navigationStart timestamp maps performance.timeOrigin; no silent offset correction",
        "traceOriginUs": origin, "pid": pid, "mainRendererTid": tid,
        "threadName": next((e.get("args", {}).get("name") for e in main if e.get("name") == "thread_name"), None),
        "stageMarkCrosscheckCount": len(offsets),
        "stageMarkOffsetMedianMs": round(statistics.median(offsets), 6) if offsets else None,
        "stageMarkMaxAbsoluteOffsetMs": round(max(map(abs, offsets)), 6) if offsets else None,
    }
    request_ids = {(data(e).get("frame"), data(e).get("id")) for e in main if e.get("name") == "RequestAnimationFrame"
                   and any(RENDERER.search(str(f.get("url", ""))) for f in data(e).get("stackTrace", []))}
    fires = sorted((e for e in complete if e["name"] == "FireAnimationFrame" and (data(e).get("frame"), data(e).get("id")) in request_ids), key=lambda e: e["ts"])
    windows, sources, warnings = {}, {}, []
    added, removed = run.get("added"), run.get("removed")
    if numeric(added) and added > 0 and numeric(removed) and removed > added:
        windows["active"] = (origin + added * 1000, origin + removed * 1000)
        sources["active"] = "DOM MutationObserver canvas insertion/removal, not exact starter timing"
    starts, ends = marks["weather:prepare:start"], marks["weather:prepare:end"]
    if starts and ends and ends[0] >= starts[0]:
        windows["preparation"] = (starts[0], ends[0])
        sources["preparation"] = "trace user timing marks; asynchronous waits included"
    elif "active" in windows:
        imports = [e["ts"] for e in main if e.get("name") == "ResourceSendRequest" and RENDERER.search(str(data(e).get("url", ""))) and e["ts"] <= windows["active"][0]]
        if imports:
            windows["preparation"] = (min(imports), windows["active"][0])
            sources["preparation"] = "conservative renderer import request through canvas insertion; includes network wait and unrelated page work"
        else:
            warnings.append("Preparation interval unavailable: no prepare marks or renderer import request.")
    draw = (marks["weather:draw:start"][0], marks["weather:draw:end"][0]) if marks["weather:draw:start"] and marks["weather:draw:end"] else None
    first = fires[0] if fires else None
    if first:
        windows["firstCallback"] = span(first)
        sources["firstCallback"] = "RAF callback id linked to RequestAnimationFrame weather renderer stack"
    elif draw:
        windows["firstCallback"] = draw
        sources["firstCallback"] = "draw trace marks only; callback wrapper overhead excluded"
        warnings.append("RAF id/stack link unavailable; first callback uses draw marks.")
    elif "active" in windows:
        warnings.append("First callback attribution unavailable: no RAF id/stack link or draw marks.")
    if draw:
        windows["firstDraw"] = draw
        sources["firstDraw"] = "exact draw user timing trace marks"
    first_tasks = [e for e in tasks if "firstCallback" in windows and overlap(span(e), windows["firstCallback"])]
    if first_tasks:
        windows["firstFullTask"] = span(max(first_tasks, key=lambda e: e["dur"]))
        sources["firstFullTask"] = "outer task containing linked callback; can also include non-weather work"
        after = draw[1] if draw else windows["firstCallback"][1]
        if after < windows["firstFullTask"][1]:
            windows["firstTaskAfterDraw"] = (after, windows["firstFullTask"][1])
            sources["firstTaskAfterDraw"] = "remainder of outer task after draw/callback; includes deferred canvas work"
    broad = {k: v for k, v in windows.items() if k in ("preparation", "active")}
    candidates, outside = [], []
    for e in tasks:
        names = [name for name, bounds in broad.items() if overlap(span(e), bounds)]
        record = brief(e, origin)
        record.pop("args", None)
        if names:
            record["overlaps"] = names
            record["linkedWeatherRAFCount"] = sum(overlap(span(e), span(f)) for f in fires)
            candidates.append(record)
        else:
            outside.append(record)
    boundary = min((v[0] for v in broad.values()), default=None)
    before = [t for t in outside if boundary is not None and origin + (t["atMs"] + t["durationMs"]) * 1000 <= boundary]
    stage_spans = []
    # Materialize keys because looking up missing end keys must not mutate iteration.
    for name, values in list(marks.items()):
        if name.endswith(":start"):
            for start, end in zip(values, marks.get(name[:-6] + ":end", [])):
                if end >= start:
                    stage_spans.append({"name": name[:-6], "atMs": round((start - origin) / 1000, 6), "elapsedMs": round((end - start) / 1000, 6)})
    other_threads = {}
    # Report other-thread decode/GPU activity separately, never add it to main CPU.
    for scope in ("preparation", "firstFullTask"):
        if scope not in windows:
            continue
        bounds = windows[scope]
        threads = collections.defaultdict(list)
        for e in events:
            if e.get("ph") == "X" and numeric(e.get("dur")) and (e.get("pid"), e.get("tid")) != (pid, tid) and overlap(span(e), bounds):
                threads[(e.get("pid"), e.get("tid"))].append(e)
        other_threads[scope] = {f"{p}:{t}": costs(es, bounds, origin) for (p, t), es in threads.items()}
    def page_summary(records):
        return {"count": len(records), "maxMs": max((t["durationMs"] for t in records), default=None), "atLeast50Ms": [t for t in records if t["durationMs"] >= 50]}
    return {
        "trace": str(path), "runIndex": index,
        "run": {k: run.get(k) for k in ("kind", "profile", "cpu", "scene", "mode", "added", "removed", "load", "worst", "p95", "frameP95")},
        "mapping": mapping, "traceEventLines": lines, "retainedTraceEvents": len(events), "warnings": warnings,
        "outerTaskEventName": task_name, "weatherRAFRequestIds": len(request_ids), "linkedWeatherCallbacks": len(fires),
        "stageSpans": stage_spans,
        "windows": {name: {"startMs": round((v[0] - origin) / 1000, 6), "endMs": round((v[1] - origin) / 1000, 6), "source": sources[name]} for name, v in windows.items()},
        "firstLinkedCallback": brief(first, origin) if first else None,
        "firstFullTasks": [brief(e, origin) for e in first_tasks], "candidateTasks": candidates,
        "candidateTasksAtLeast50Ms": [t for t in candidates if t["durationMs"] >= 50],
        "maxCandidateTaskMs": max((t["durationMs"] for t in candidates), default=None),
        "pageTasksBeforeCandidateWindows": page_summary(before), "pageTasksOutsideCandidateWindows": page_summary(outside),
        "mainThreadCategoryCosts": {name: costs(complete, bounds, origin) for name, bounds in windows.items()},
        "otherThreadCategoryCosts": other_threads,
        "browserObservedLongTasks": run.get("longTasks", []), "browserObservedLongAnimationFrames": run.get("longFrames", []),
        "inspectorIntervals": run.get("heap", {}),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("directories", nargs="+", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--limit", type=int, help="Maximum runs per directory for spot checks")
    args = parser.parse_args()
    output = {
        "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "method": "Streaming offline trace analysis; navigationStart/timeOrigin mapping; RAF request stack/id linkage; interval overlap is candidate attribution only.",
        "limitations": ["Preparation elapsed time includes asynchronous wait, not just CPU.", "Whole tasks may include non-weather work.", "Category costs overlap; do not add them.", "The original 190.5ms callback/194ms long task has no trace; passing traces do not explain its cause.", "No physical GPU execution or physical-device measurements are inferred."],
        "runs": [], "missingTraces": [], "errors": [],
    }
    for directory in args.directories:
        files = sorted(directory.glob("*-results.json"))
        if len(files) != 1:
            output["errors"].append({"directory": str(directory), "error": f"Expected one *-results.json, got {len(files)}"})
            continue
        document = json.loads(files[0].read_text())
        for index, run in enumerate(document.get("runs", [])):
            if args.limit is not None and index >= args.limit:
                break
            path = directory / f"{index}-{run.get('kind')}.trace.json"
            if not path.is_file():
                output["missingTraces"].append(str(path))
                continue
            print(f"Analyzing {path}", file=sys.stderr, flush=True)
            try:
                output["runs"].append(analyze(path, run, index))
            except Exception as error:
                output["errors"].append({"trace": str(path), "error": str(error)})
    runs = output["runs"]
    aggregate = {
        "analyzedRuns": len(runs), "missingTraceCount": len(output["missingTraces"]), "errorCount": len(output["errors"]),
        "maxCandidateTaskMs": max((r["maxCandidateTaskMs"] for r in runs if numeric(r["maxCandidateTaskMs"])), default=None),
        "maxFirstFullTaskMs": max((t["durationMs"] for r in runs for t in r["firstFullTasks"]), default=None),
        "allCandidateTasksAtLeast50Ms": [{"trace": r["trace"], "run": r["run"], "task": t} for r in runs for t in r["candidateTasksAtLeast50Ms"]],
        "maxCategoryCostsByWindow": {},
    }
    for window in sorted({name for r in runs for name in r["mainThreadCategoryCosts"]}):
        aggregate["maxCategoryCostsByWindow"][window] = {
            group: {metric: max((r["mainThreadCategoryCosts"].get(window, {}).get(group, {}).get(metric, 0) for r in runs), default=0)
                    for metric in ("unionWithinWindowMs", "maxWholeEventMs")}
            for group in GROUPS}
    aggregate["candidate50MsFlag"] = bool(aggregate["allCandidateTasksAtLeast50Ms"])
    output["aggregate"] = aggregate
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(output, indent=2) + "\n")
    print(json.dumps({k: v for k, v in aggregate.items() if k != "maxCategoryCostsByWindow"}, indent=2))
    return 2 if output["errors"] or output["missingTraces"] else 0


if __name__ == "__main__":
    raise SystemExit(main())

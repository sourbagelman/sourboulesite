# Temporary unavailable page — November 7, 2026

Restore point: backup/before-temporary-error-2026-11-07
Baseline commit: 1475e765e87760190d3e742b7456a04104ce4bda

All root public HTML pages were replaced with a static unavailable page. Assets and application subdomains are unchanged. This is a visual error page; GitHub Pages still returns HTTP 200 for existing paths.

To restore, revert the single commit titled "Temporarily show unavailable page with preserved restore point" on main and push. This restores all original pages and removes the added 404 page and this note without rewriting history. Check for later edits before reverting. The backup branch preserves the entire original source tree.

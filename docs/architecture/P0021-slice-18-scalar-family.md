# P0021 Slice 18 — selected scalar family (power, exp, ln, log10)

- Preserve already-selected `evaluatorId`; only explicitly allowed Python handlers are reachable.
- Add **no Python registry**, parser, task scope or DocumentRuntime mutation.
- `ln` and `log10` are distinct semantic operations, not automatically inferred from the name `log`.
- Reject non-empty options for these four non-angle operations. Trigonometric `deg`/`rad` remains mandatory.
- Python modules are added to the strict local-source whitelist.
- Browser smoke covers all earlier seven checks plus four new scalar operations; worker and its runtime import use a new version token to bypass stale caches.
- Browser smoke requires a running local HTTP server; Node mock tests do **not** verify real Pyodide behavior.
- Source file `src/js/evaluation/selected-pyodide-worker.js` should be installed alongside the runtime as a matching cache-busting pair.

Run `node --test tests/js/p0021-selected-scalar-family.test.mjs` then `node --test`.
Serve `python -m http.server 8000`, open `/tests/browser/p0021-scalar-family-worker-smoke.html` and run smoke.

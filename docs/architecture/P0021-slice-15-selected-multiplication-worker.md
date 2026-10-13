# P0021 Slice 15 — Explicit selected multiplication in Pyodide Worker

Extend the transport boundary to **two already implemented selected P0012 handlers**, addition and multiplication, reusing `evaluate_selected_gateway` and the existing P0011 adapter. Do not introduce source parsing, generic Python registry or task scope. Handler dispatch is a static allowlist at the Worker gateway; **OperationSpec selection takes place upstream in JS**. Each handler validates its own selected capability again.

The JavaScript nested-call evaluator (Slice 14) performs postorder evaluation. The browser smoke test exercises `2+3*4=14`, and `2+a*4=14` with a precisely identified provider.

**Still outstanding:** The generic parser-to-selected-IR lowering is not connected. The smoke constructs Semantic IR intentionally. Trigonometry also requires an explicit angle policy (`deg` or `rad`) in the P0010 `options`; Slice 9 currently emits `{}` and must not silently assume radians or degrees. A later slice should carry angle settings through the contract.

**Testing:** `node --test tests/js/p0021-selected-multiplication-runtime.test.mjs`; `node --test`; browser `http://localhost:8000/tests/browser/p0021-multiplication-worker-smoke.html` after `python -m http.server 8000`.

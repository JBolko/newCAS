# P0021 Slice 71 — P0004 new selected Worker migration

Status: selected Worker pin changed; **real-browser compatibility pending manual execution**.

## Scope

P0004 selected Pyodide 314.0.7 (Python 3.14.2, SymPy 1.14.0) for the new implementation. The selected Worker still loaded 0.26.1. This slice changes only its CDN pin. The legacy CASEngine remains unchanged and may keep 0.26.1 during migration.

The official Pyodide release documentation lists `https://cdn.jsdelivr.net/pyodide/v314.0.7/full/`; its ESM entry is `pyodide.mjs`. This is external deployment evidence, not proof of browser execution in this repo.

## Automated checks

`node --test tests/js/p0021-p0004-selected-worker-version.test.mjs` verifies that the new selected Worker uses the pinned URL consistently for the dynamic ESM import and `indexURL`, and that a separate real-browser probe checks loaded `py.version`, `sys.version_info` and `sympy.__version__` explicitly.

## Required manual browser checks

1. Serve repository root over HTTP (`python -m http.server 8000`).
2. Open `http://localhost:8000/tests/browser/p0021-p0004-version-probe.html`, press the button, require **PASS** with Pyodide 314.0.7, Python 3.14.2 and SymPy 1.14.0. Note browser console/network errors if any.
3. Open `http://localhost:8000/tests/browser/p0021-selected-worker-smoke.html`, press its button, require all three real Worker integration checks PASS.
4. Optionally run symbolic differentiation / function Worker smokes for the full selected evaluator family, as release/migration verification.

**Do not mark browser migration GREEN until these have been executed in a real browser.** Static tests alone do not assert that SymPy imports or operations succeed. Do not conflate this release pin with offline delivery or timeout/cancellation; those remain separate work items.

## Slice 71 follow-up: superseded Slice 70 characterization

Slice 70's inventory included a snapshot assertion that the selected Worker was
still pinned to 0.26.1. Once Slice 71 migrates that Worker to 314.0.7, that
assertion must be updated, not preserved as a RED requirement. The replacement
checks the selected Worker 314.0.7 pin, the legacy CASEngine 0.26.1 pin, and
P0004 baseline; the browser verification remains deliberately pending.

# P0021 Slice 72 — P0004 browser acceptance (manual real runtime)

## Aim
Single browser page for the selected P0004 Pyodide baseline and the real new Worker. No production source edits; legacy CASEngine not invoked.

## Run
From repository root: `python -m http.server 8000` and open
`http://localhost:8000/tests/browser/p0021-slice-72-p0004-worker-acceptance.html`.
Press **Kør browseraccept**. Requires internet for Pyodide/SymPy CDN, potentially significant download/startup time.

## Assertions
1. Independently load CDN `v314.0.7` and report **actual** `py.version`, `sys.version_info[:3]`, `sympy.__version__`. Require 314.0.7, 3.14.2, 1.14.0.
2. Instantiate `selected-pyodide-worker.js` as a module Worker and validate real semantic `2+3=5` and attested provider `a+3=7`, then reject a manipulated provider.
3. Report pass/fail in browser, clear timeouts, close client and terminate Worker.

## Limitations / exit criterion
The version probe is a **separate Pyodide instance**, not a direct version message from the Worker. The Worker smoke proves a real selected-runtime computation using the Worker CDN reference pinned in Slice 71, but does not introspect the Worker's actual `sys.version_info`. A later structured Worker diagnostic may close this gap. Timeouts here **only bound the browser test**, not cancel computation in the production Worker; runtime worker-cancellation remains outstanding.

Node tests validate the browser harness's structure only; they do **not** certify real Pyodide execution. Mark the migration browser-validated **only after a user actually runs the browser page and reports PASS**.

## Dependency
Slice 71 production CDN update plus its inventory-test hotfix. Earlier Slice 65-70 retained.

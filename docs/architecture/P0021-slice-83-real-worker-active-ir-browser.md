# P0021 Slice 83 — real selected Worker through active Semantic IR batch

Status: **NEEDS BROWSER**. Node contract tests are not evidence of Pyodide execution.

## Purpose

Replacement acceptance for the browser semantics of the last historical bound-function evaluator. Exercise *actual* DocumentRuntime + P0020-attested provider binding + Slice 76 active Semantic IR batch with real selected-pyodide-worker.js and Python/SymPy through the existing Worker protocol. There is no legacy bound-function adapter or JS arithmetic testdouble in this test.

## Checks

- A: `a:=2; f(t):=t^2+a; g(t):=3t; f(g(4))` produces 146; `answer:=f(g(4))+1` yields 147.
- B: same source names in another task with `a:=10`, yielding 154 and 155.
- Edit A capture to `a:=5`: A becomes 149/150 while B remains 154/155.
- Every operation is executed using the real existing selected Pyodide Worker client; not through legacy CASEngine.

Document source resolution, function substitution and captures occur in JS. The stateless Python backend evaluates selected arithmetic operations, possibly through several Worker calls. This is *not* a single Python call evaluating the whole function tree, and it does not test Worker cancellation, timeout recovery or full cross-task concurrent operations.

## Acceptance

1. Run `node --test` and `python -m unittest discover -s tests/python -p 'test_*.py' -v` in complete repo.
2. Run `python -m http.server 8000`, visit `/tests/browser/p0021-slice-83-active-ir-worker.html`, click **Kør real-Worker-accept**.
3. Require all browser PASS lines and zero failures; record outcome.

Do **not** delete the final historical adapter until real-Worker browser acceptance passes and its remaining relevant contracts are evaluated. This slice makes no production change and does not retire tests.

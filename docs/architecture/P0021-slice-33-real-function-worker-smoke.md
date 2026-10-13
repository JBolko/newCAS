# P0021 Slice 33 — real Pyodide/SymPy FunctionValue browser smoke

This is a **browser verification slice**: no production code or frozen contracts change.

The test constructs `f(x):=x^3+4x` through the real Peggy parser, Slice 26 compiler and Slice 27 materializer. Slice 32's `createBoundFunctionTaskEvaluator` and existing batch dispatcher attest a `FunctionValue` provider by exact ID. Slice 29 lowers the applied arithmetic expression to already selected operations, and Slice 11's actual Worker client dispatches these to real Pyodide/SymPy. No Python document/task namespace or implicit callable lookup is introduced.

Cases checked in the browser:
1. `x:=12` does not capture local `f` parameter `x`.
2. `f(x)` with document-supplied argument `12` computes exact integer `1776` using the real Worker.
3. The same immutable function yields `f(3)=39` through the Worker.
4. Attestation of the wrong provider fails before Worker dispatch, with no fallback.

Important scope: the smoke explicitly constructs the P0020 call-classification snapshot and supplies the already materialized argument. It does **not** prove automatic end-to-end DocumentRuntime binding or source-driven function-call lowering. The FunctionValue remains in JS; only selected arithmetic P0010 requests are sent into the Worker. Worker runtime cache is versioned by `slice33-real-function-worker-v1`; the existing worker entry itself is not modified.

To run: from repository root execute `python -m http.server 8000`, open `http://localhost:8000/tests/browser/p0021-function-worker-smoke.html`, press **Kør rigtig Worker-test**. Needs network access to Pyodide/SymPy CDN. Node tests cannot replace this test.

Node regression: `node --test tests/js/p0021-function-worker-browser-contract.test.mjs`, then `node --test`.

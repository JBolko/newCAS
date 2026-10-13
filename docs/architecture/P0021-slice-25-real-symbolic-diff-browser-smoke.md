# P0021 Slice 25 — Real Pyodide Worker symbolic differentiation browser smoke

Scope is **browser test only**. No production source or frozen architecture contract changed.

1. Uses canonical Peggy parser, selected source AST compiler and Slice 23 symbolic Value gateway.
2. Sends already-selected P0010 request through Slice 11 protocol and Slice 24 Worker allowlist to real Pyodide/SymPy.
3. Confirms that a prior document `x := 17` does not capture the symbolic differentiation target: `diff(x^2,x)` yields exact `2*x`, including its operation-local identity.
4. `diff(A,x)` with a materialized provider `A=17` yields 0.
5. Explicit Worker and browser-module URL versions avoid stale cached scripts. Runtime itself imports versioned `selected-pyodide-runtime.js` from Slice 24.

**Run Node static contracts:** `node --test tests/js/p0021-symbolic-diff-browser-contract.test.mjs` and `node --test`.

**Run real browser:** from checkout root `python -m http.server 8000`, open `http://localhost:8000/tests/browser/p0021-symbolic-diff-worker-smoke.html`, press **Kør rigtig Worker-test**. Requires network access for Pyodide + SymPy. Browser result must be user-verified: Node tests cannot prove actual browser/Pyodide behavior.

Limitations: this is a bounded browser fixture, not integrated DocumentRuntime scheduling, status commitment, function scoping, nor a generalized symbolic operator gateway. The fixture mimics the document binding (`x := 17`) by supplying a resolver that would bind x to its provider outside symbolic scope. All semantic identities are still produced on the JS side; Python receives no document scope.

# P0021 Slice 13 — Browser smoke of the selected Pyodide Worker

Scope: **manual real-browser integration probe**, plus five Node contract tests. No changes to application startup, DocumentRuntime, legacy `CASEngine`, Python, or the existing Worker protocol. The page constructs actual Semantic IR and compiles selected OperationSpec calls using the Slice 9 compiler; it sends them through the Slice 11 client and Slice 12 Worker/Pyodide bootstrap. No fake evaluator is substituted in the browser.

## Run (from repository root)

Install all preceding slices, including Slice 11 and Slice 12. Run `node --test tests/js/p0021-browser-worker-smoke-contract.test.mjs` then `node --test`.

Serve the repository over HTTP(S), for example `python -m http.server 8000` at the repository root; open `http://localhost:8000/tests/browser/p0021-selected-worker-smoke.html`. Click **Kør Worker-smoketest**. The page downloads Pyodide 0.26.1 + SymPy from jsDelivr and fetches Python source files from the same local server. Browser network access to jsDelivr is required. `file://` is unsupported. Initial download can be substantial.

Expected manual results: exact `2+3=5`, exact provider-bound `4+3=7`, and rejection of deliberately altered provider attestation. Errors appear in the page log and browser DevTools (Network, Console). The browser test has a 120-second guard for troubleshooting; this is not a production timeout/cancellation solution.

**Claim boundary:** Green Node tests validate fixture wiring only. They are *not* proof that Pyodide downloaded, initialized, or evaluated in a real browser. A green manual browser result is required for that claim. This probe does not make the app use the Worker by default, nor test full-document evaluations, symbolic/scoped arguments, offline caching, worker crashes, cancellation or UI performance.

**Potential runtime blockers:** CDN cross-origin module import; CORS/mime-type for Python files; Pyodide and SymPy loading; browser's module-worker policies. If browser fails, preserve exact Console error and failed Network request so the next slice can address the real defect, without weakening the contract.

# P0021 Slice 12 — selected Pyodide Worker bootstrap

**Scope:** New ES module Worker entry and injected Pyodide runtime, using the Slice 11 protocol unchanged. The implementation loads Pyodide 0.26.1 and SymPy inside a module Worker, mounts an explicit small Python package whitelist, and calls `evaluate_selected_gateway` with the actual P0012 selected addition handler `evaluate_scalar_request`. It never invokes legacy `run_in_task`, reparses the mathematical source, or creates a persistent Python task scope.

**Critical boundary:** Only selected `probe.scalar.add` is supported. This ID is explicitly a *test capability*, not the final public addition evaluator ID. Other operations fail explicitly. P0010/P0008/provider attestation are revalidated in Python. JavaScript knows only this whitelisted handler in this transitional slice; later capability binding must avoid a competing name-based registry.

**Tests:** Eight Node tests with an injected simulated Pyodide instance validate loading, invocation shape, non-use of legacy task scope, forwarding, cleanup, and retry. The tests are *not* evidence of Pyodide executing in a real browser. Python integration of the same handler was separately verified in Slice 8/10; this slice does not rerun the browser computation.

**Loading:** Production entry `src/js/evaluation/selected-pyodide-worker.js` imports the installed Slice 11 `worker-evaluation-protocol.js`, loads Pyodide 0.26.1 from its module CDN URL, and fetches selected Python source files from the application's own `src/python` directory. It assumes the application is served over HTTP(S), not opened as `file://`. Module-Worker browser compatibility, CDN/CORS, deployed path, and full SymPy initialization need browser testing. The Worker processes requests serially due to shared Pyodide globals; results from stale revisions are filtered by the Slice 11 main-thread client. No cancellation/timeout/crash recovery implemented.

**Important:** This slice does *not* change `src/js/cas-engine.js` or `main.js`, and therefore the current app still uses its legacy main-thread CAS engine. Do not claim that Pyodide is moved to a Worker until the main-thread integration and browser tests are complete.

**Install:** Extract ZIP at repository root after Slice 11. Test with `node --test tests/js/p0021-selected-pyodide-runtime.test.mjs`, then `node --test`. Worker entry is not used in tests yet.

# P0021 Slice 59 — asynchronous captures with real Pyodide Worker

## Scope

- Two distinct task scopes own independent `x` writers and `f(t):=t+x` captures.
- Node tests deterministically hold the old task A evaluation while A is edited and the new round commits.
- Browser smoke uses the actual selected Pyodide/SymPy Worker for arithmetic in `DocumentRuntime.evaluateAndCommitDirtySemanticTask`, not a fake backend.
- Worker replies are rehydrated at the shared P0005 boundary (Slice 38).
- Task B stays untouched; old A result returns `stale` even with a deliberately reused revision token because DocumentRuntime checks block source and generations.
- The gate is **after** the selected arithmetic has completed: browser deliberately delays delivery to the batch, ensuring reproducible reversed commit order. This is not proof of interrupting running Python.
- No automatic retries, external provider lookup, persistent Python scope, second runtime or architecture change.

## Run

`node --test tests/js/p0021-runtime-async-captures.test.mjs tests/js/p0021-runtime-async-captures-browser-contract.test.mjs`

`python -m http.server 8000` then open `http://localhost:8000/tests/browser/p0021-runtime-async-captures-worker-smoke.html`.

A successful Node run is **not** evidence of a successful browser Worker run; the browser needs to be checked separately.

# P0011 — Pyodide environment verification

**Status:** Verification harness only; not yet executed in user's browser.

Runs the five existing P0011 unittest test files against the *current checked-out adapter* in a fresh Pyodide 314.0.7 runtime with its packaged SymPy. Includes package initializer from source. Does not alter source files or test files.

From repository root, extract ZIP with `Expand-Archive -LiteralPath '.\P0011-pyodide-verification.zip' -DestinationPath '.' -Force`.

Then from repository root: `python -m http.server 8000` and open `http://localhost:8000/tools/probes/p0011_pyodide_check.html` in a browser; click **Kør P0011 i Pyodide**. Requires internet for Pyodide assets, unless locally hosted; the probe intentionally uses P0003's locked CDN layout. The web server is needed for fetching repository files; opening HTML with `file://` may fail.

Exit criteria: 29 tests run, 0 errors, 0 failures, Pyodide 314.0.7, confirm SymPy version is 1.14.0 per frozen baseline. Capture/copy full report if anything differs.

Limitations: this checks the adapter in a standalone Pyodide instance; does not validate the full newCAS frontend/DocumentRuntime integration or persistence. This harness does not attempt to execute JavaScript tests or Pyodide package-lock validation.

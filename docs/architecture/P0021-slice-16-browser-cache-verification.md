# P0021 Slice 16 — browser cache verification

The error `SemanticIR: value literal requires an immutable Value` came from the **old** browser smoke module. The corrected module from `P0021-slice-16-browser-value-fixture-fix.zip` imports `smokeIntegerValue`, which returns a frozen Value. The error's `lit` at line 8 is consistent with the original module; the corrected `lit` is on line 10.

This patch changes only the smoke HTML to visibly show `Browser smoke revision: slice16-immutable-value-v2` and import the corrected JS under a fresh, versioned module URL.

**Prerequisite:** install the earlier `P0021-slice-16-browser-value-fixture-fix.zip` (do not overwrite its `.mjs` files with older ZIPs afterward). Run a server from repository root, open `/tests/browser/p0021-angle-worker-smoke.html`, check the revision label, and rerun. To inspect actual bytes, open `/tests/browser/p0021-angle-worker-smoke.mjs` directly and confirm it contains `smokeIntegerValue` rather than `const integer=n=>({`.

This package does not alter runtime code or add tests; expected JS test count remains 553. Browser Pyodide execution is not verified locally.

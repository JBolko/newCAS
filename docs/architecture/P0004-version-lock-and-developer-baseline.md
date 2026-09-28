# P0004 --- Version lock and developer baseline

**Status:** COMPLETE / GREEN\
**Date:** 2026-09-28\
**Roadmap task:** P0004 --- Version lock and developer baseline\
**Scope:** Reproducible dependency/toolchain baseline for implementation
after the frozen architecture. No architecture migration or
legacy-runtime repair is part of P0004.

## 1. Purpose

P0004 converts the dependency inventory from P0002 and the backend
capability evidence from P0003 into a reproducible supported
implementation baseline.

The frozen documents in `docs/architecture/v1.0/` remain normative and
unchanged. This document records implementation evidence and version
policy after the freeze; it is not part of the frozen architecture
specification.

## 2. Selected backend baseline

P0003 qualified the modern backend candidate sufficiently for the new
implementation:

  Component             Selected version Role
  ------------------- ------------------ ---------------------------------------------
  Pyodide                        314.0.7 Browser Python runtime
  Python in Pyodide               3.14.2 Supplied by selected Pyodide
  SymPy                           1.14.0 CAS backend supplied/loaded through Pyodide
  KaTeX                           0.18.9 Selected rendering baseline
  Peggy                            5.1.0 Development-only parser generator

The P0003 capability probes, not the legacy application, are the
qualification evidence for the Pyodide/SymPy backend chain.

## 3. Legacy runtime boundary

The existing `index.html`, `src/js/cas-engine.js`, persistent Python
task scope and related application path are migration evidence from the
pre-freeze implementation.

P0004 does **not** require that this legacy application be upgraded to,
repaired for, or validated against Pyodide 314.0.7.

Consequently:

-   legacy references such as Pyodide 0.26.1 may remain until the
    corresponding legacy runtime is replaced or deliberately migrated;
-   such references do not define the baseline for the new architecture;
-   changing legacy runtime code merely to make P0004 green would mix
    architecture migration into a dependency/toolchain checkpoint;
-   future implementation work must use the selected P0004 baseline
    unless a later deliberate dependency decision changes it.

This distinction prevents execution-history-based legacy architecture
from becoming an accidental compatibility requirement for the frozen
architecture.

## 4. Developer baseline

P0004 distinguishes a compatible developer generation from
mathematically significant browser/backend versions.

Verified developer environment on 2026-09-28:

  Component       Supported baseline   Verified version
  --------------- -------------------- ------------------
  Node.js         `>=24 <25`           24.21.0
  npm             `>=11`               12.0.2
  Native Python   `>=3.12`             3.13.15

Native Python is developer/tooling infrastructure. It is not the
authoritative mathematical runtime; backend mathematical behaviour is
qualified in Pyodide.

Exact patch locking of Node, npm and native Python is intentionally
avoided unless later evidence shows that it is required for
reproducibility.

## 5. npm dependency lock

Peggy is an exact development dependency:

``` json
"devDependencies": {
  "peggy": "5.1.0"
}
```

The developer compatibility declaration is:

``` json
"engines": {
  "node": ">=24 <25",
  "npm": ">=11"
}
```

`package-lock.json` is committed and is the reproducible npm dependency
lock.

A clean checkout installs the locked dependency graph with:

``` powershell
npm ci
```

Do not hand-edit `package-lock.json`.

## 6. Dependency classification

### Selected for new implementation

-   Pyodide 314.0.7
-   Python 3.14.2 inside Pyodide
-   SymPy 1.14.0
-   KaTeX 0.18.9
-   Peggy 5.1.0

### Optional/transitive

NumPy remains optional/transitive. It must not become a direct newCAS
dependency merely because it is available in Pyodide.

### Expected later in Release 1

Plotly.js, or an explicitly selected replacement plotting backend,
remains expected for plotting. It is not adopted by P0004 and must pass
the appropriate dependency/capability gate when plotting implementation
begins.

## 7. Verified P0004 checks

The following completed successfully on 2026-09-28:

``` text
npm ci
    added 5 packages
    audited 6 packages
    0 vulnerabilities

npm list --depth=0
    peggy@5.1.0

npm run tools:doctor
    Python 3.13.15          OK
    Node v24.21.0           OK
    npm 12.0.2              OK
    project structure       OK
    generated artifacts     OK
    runtime consistency     OK
    parser/transformer      OK
    overall result          healthy
```

The earlier exact `engines` declaration for Node 24.11.0/npm 11.6.1
produced `EBADENGINE` warnings on the newer working environment. This
demonstrated that the originally observed versions should be treated as
observations, not exact compatibility boundaries. The baseline was
therefore corrected to the supported version ranges above.

## 8. Doctor policy

The current Doctor reports the installed Python, Node and npm versions
and validates the existing project/tooling health checks.

P0004 does not expand Doctor to enforce all dependency contracts. Per
the roadmap, that extension is deferred.

When Doctor gains version-contract enforcement, the version policy
should have one authoritative machine-readable source rather than
duplicate constants across scripts.

## 9. Backend upgrade gate

Future changes to Pyodide, SymPy or other mathematically significant
backend dependencies must be deliberate and must use the permanent
backend capability probe suite from P0003 as appropriate.

The distinction is:

-   backend capability probes ask what a candidate backend actually
    does;
-   later newCAS contract tests ask whether newCAS satisfies its public
    contracts.

Both are retained because they protect different boundaries.

## 10. Offline/cache constraint carried forward

The P0003 service-worker incident showed that development/probe files
must not be served indefinitely by a stale cache-first strategy.

Later offline/service-worker work should preserve the distinction:

-   immutable/versioned runtime assets may be cached aggressively;
-   application assets require an explicit update strategy;
-   `tools/probes/**` and equivalent development/test resources should
    be network-first, no-store where appropriate, or excluded from
    production cache-first handling.

This is a recorded implementation constraint, not additional P0004 work.

## 11. Reproducibility boundary after P0004

P0004 establishes:

1.  an exact npm dependency graph through `package.json` and committed
    `package-lock.json`;
2.  Peggy 5.1.0 as the parser-generation dependency;
3.  a verified Node/npm/native-Python developer generation;
4.  Pyodide 314.0.7 / Python 3.14.2 / SymPy 1.14.0 as the qualified
    backend baseline for new implementation;
5.  KaTeX 0.18.9 as the selected rendering baseline;
6.  P0003 capability probes as backend-upgrade evidence;
7.  an explicit boundary separating the selected new baseline from the
    legacy runtime.

Version changes remain possible under the P0002 dependency/version
policy. P0004 is a reproducible implementation baseline, not an
irreversible release freeze.

## 12. Exit

P0004 exit criterion is satisfied:

-   selected dependency versions are recorded;
-   npm dependencies are reproducibly locked;
-   developer baseline is verified;
-   `npm ci` succeeds;
-   Peggy resolves exactly to 5.1.0;
-   current Doctor is green;
-   backend capability evidence exists for the selected Pyodide/SymPy
    chain;
-   legacy runtime compatibility is explicitly excluded from the
    checkpoint.

**P0004: COMPLETE / GREEN.**

With P0001--P0004 complete, **Phase A --- Freeze and capability gate is
complete**.

The next roadmap task is **P0005 --- Value contract v1**.

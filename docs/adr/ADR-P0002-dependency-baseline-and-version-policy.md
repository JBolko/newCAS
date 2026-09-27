# ADR-P0002 --- Dependency baseline and version policy

**Status:** Accepted for P0002\
**Date:** 2026-09-27\
**Roadmap task:** P0002 --- Dependency/version inventory\
**Scope:** Inventory and candidate baseline only. No dependency upgrade
is performed by this ADR.

## Context

The frozen newCAS architecture requires a dependency/capability gate
before implementation/refactoring. P0002 separates the observed legacy
implementation from dependencies required now, expected for Release 1,
optional/transitive dependencies, and candidate versions for P0003.

A candidate version is not yet an approved production baseline.
Mathematical and runtime behaviour must be established by capability
probes before versions are locked.

## Observed development environment

  Component         Observed version Role
  --------------- ------------------ -----------------------------------
  Node.js                    24.11.0 developer/tooling runtime
  npm                         11.6.1 developer/tooling package manager
  Native Python               3.12.4 developer/test tooling

These describe the current developer machine and are not locked by
P0002.

## Observed legacy browser baseline

  --------------------------------------------------------------------------------
  Component               Observed state                   Classification
  ----------------------- -------------------------------- -----------------------
  Pyodide                 0.26.1, explicitly pinned in     required now
                          `index.html` and                 
                          `src/js/cas-engine.js`           

  Python in Pyodide       3.12.1, inherited from Pyodide   required now

  SymPy                   1.12, loaded through             required now
                          `pyodide.loadPackage("sympy")`   

  NumPy                   1.26.4 available in Pyodide; no  optional/transitive
                          direct imports found in current  
                          newCAS Python                    

  KaTeX                   0.16.9, explicitly pinned in     required now
                          `index.html`                     

  Peggy                   5.1.0, recorded by generated     required development
                          `src/js/parser.mjs`              dependency

  Plotly.js               not found in current runtime     expected for Release 1
  --------------------------------------------------------------------------------

The current `package.json` declares no dependencies or devDependencies.
Local Peggy-related modules are reported by npm as `extraneous`, and no
`package-lock.json` exists. This is migration evidence, not a
reproducible developer baseline.

## Dependency classification

### Required now

Pyodide, the Python runtime supplied by Pyodide, SymPy, KaTeX, and Peggy
as a development-only parser generator.

Peggy does not need to be a browser runtime dependency because the
grammar is pre-generated into `src/js/parser.mjs`.

### Expected for Release 1

Plotly.js, or an explicitly selected replacement plotting backend.

Release 1 is expected to support plotting. Plotly.js therefore remains
inside the dependency process even though plotting is not implemented
yet. The plotting dependency must pass review before adoption.

### Optional/transitive

NumPy.

No direct NumPy imports were found in current newCAS Python source.
NumPy must not become a direct dependency merely because it is available
in Pyodide. It may be promoted later if a concrete Release-1 feature
requires it.

## Candidate chain for P0003

### Reference A --- legacy behaviour

  Component           Version
  ----------------- ---------
  Pyodide              0.26.1
  Python               3.12.1
  SymPy                  1.12
  NumPy available      1.26.4
  KaTeX                0.16.9
  Peggy                 5.1.0

Reference A exists to establish current behaviour and migration
differences. It is not selected as the future baseline merely because
the prototype uses it.

### Candidate B --- modern backend candidate

  Component     Candidate P0003 status
  ----------- ----------- ---------------------------------------------------
  Pyodide         314.0.7 capability probe required
  Python           3.14.2 inherited from Pyodide
  SymPy            1.14.0 mathematical capability probe required
  NumPy             2.4.6 available; remains optional
  KaTeX            0.18.9 renderer compatibility review required
  Peggy             5.1.0 retain unless a concrete reason to change appears

Pyodide 314.x uses a new Python-version-based versioning scheme. Moving
from 0.26.1 to 314.0.7 is therefore treated as a platform-generation
change, not a routine patch upgrade.

## Plotting candidate

Plotly.js is not part of the current runtime. P0002 records Plotly.js
4.1.1 as the provisional current candidate for future plotting work.

No Plotly dependency is added yet. Final adoption and bundle choice are
deferred until immediately before plotting implementation and must
include rendering, interaction, browser, offline-distribution and
bundle-size checks.

The current developer Node.js 24.11.0 satisfies Plotly.js v4's
documented Node.js \>=22 requirement for workflows using Plotly under
Node. Pre-built browser bundles are unaffected by that Node runtime
requirement.

## Offline/distribution implications

The prototype currently loads Pyodide and KaTeX from CDNs. This is not
the final offline-distribution model.

Pyodide 314.0.7 supports downloaded/self-hosted distributions. Later
work must distinguish CDN-based development/probing, the minimal assets
actually required by newCAS, and the final offline/self-hosted package.

P0002 does not decide to vendor the full Pyodide distribution.

## Version policy

1.  Dependencies are reviewed deliberately and are not automatically
    upgraded to the latest version.
2.  An upgrade that can affect mathematical behaviour, public Values,
    transport, parsing or rendering must pass relevant
    capability/regression probes.
3.  P0003 establishes capability evidence for the backend candidate
    chain.
4.  P0004 locks a reproducible developer baseline after P0003 evidence
    is available.
5.  Dependencies may be reviewed periodically during development when
    backend limitations, browser changes, security issues or required
    features provide a concrete reason.
6.  Before beta release, the dependency chain is reviewed and frozen.
7.  After beta freeze, version changes are exceptional and require
    relevant regression/capability tests; necessary security and
    compatibility fixes remain valid reasons for change.
8.  Optional/transitive packages are not promoted to direct dependencies
    without a concrete product requirement.

## Decision

P0002 accepts the inventory and classification above.

The project proceeds to P0003 with:

-   legacy Reference A for comparison;
-   Pyodide 314.0.7 / Python 3.14.2 / SymPy 1.14.0 as Candidate B;
-   KaTeX 0.18.9 as renderer candidate;
-   Peggy 5.1.0 retained as parser-generator baseline candidate;
-   NumPy tracked but not adopted as a direct dependency;
-   Plotly.js 4.1.1 tracked as a provisional expected Release-1 plotting
    candidate, with adoption deferred until plotting implementation.

No production dependency is upgraded by P0002.

## Consequences

The current prototype and future candidate chain are explicitly
separated. P0003 can compare behaviour rather than mixing version
discovery with capability testing. Future upgrades can reuse the probe
suite. NumPy does not become an accidental dependency, while plotting
remains inside the dependency process before implementation.

Follow-up work remains: P0003 must test the Pyodide/Python/SymPy
generation change; P0004 must make developer/tooling dependencies
reproducible; offline packaging remains unresolved; Plotly requires a
focused adoption check before plot implementation.

## P0002 exit assessment

P0002 has established the observed dependency inventory, relevant
browser/offline constraints, dependency classifications, a modern
candidate backend chain for capability testing, and a
version-review/beta-freeze policy.

On acceptance of this ADR into the repository, P0002 may be marked
**GREEN / complete** and work may proceed to P0003.

## External evidence consulted

-   Pyodide 0.26.1 package catalogue:
    https://pyodide.org/en/0.26.1/usage/packages-in-pyodide.html
-   Pyodide 0.26.1 changelog:
    https://pyodide.org/en/0.26.1/project/changelog.html
-   Pyodide stable package catalogue:
    https://pyodide.org/en/stable/usage/packages-in-pyodide.html
-   Pyodide stable quickstart:
    https://pyodide.org/en/stable/usage/quickstart.html
-   Pyodide downloading/deployment:
    https://pyodide.org/en/stable/usage/downloading-and-deploying.html
-   Pyodide 314 release/versioning:
    https://blog.pyodide.org/posts/314-release/
-   KaTeX versions: https://katex.org/versions
-   Peggy documentation: https://peggyjs.org/documentation.html
-   Plotly.js getting started:
    https://plotly.com/javascript/getting-started/
-   Plotly.js v4 migration notes:
    https://plotly.com/javascript/guides/migrating-to-v4/

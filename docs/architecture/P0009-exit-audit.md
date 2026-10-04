# P0009 — Exit audit

**Status:** COMPLETE / GREEN

## Roadmap requirement

P0009 required:

> Structured codes/parameters for parse, resolution, unsupported, arity,
> type/dimension, backend and blocked states.

Exit criterion:

> Tests assert diagnostic codes rather than backend strings.

## Evidence

Pressure was performed incrementally through six slices.

### Slice 1 — transport envelope

Established the minimal immutable, backend-independent envelope:

```text
{ diagnosticVersion, code, parameters }
```

and transport-safe cloning/freezing.

### Slice 2 — taxonomy pressure

Representative parse, resolution, unsupported, arity, type, dimension,
backend, and blocked diagnostics fit the minimal envelope without requiring
category or severity.

### Slice 3 — blocked/cause pressure

Established that blocked state needs immediate provider identity. Root
diagnostics remain attached to the failing provider. No nested cause or
dependency-path contract was justified.

A Diagnostic-shaped nested plain object may be transported, but gains no
implicit cause semantics.

### Slice 4 — producer schema pressure

Separated open Diagnostic transport from strict producer contracts through
DiagnosticSpec. This avoided a global diagnostic registry while allowing
stable parameter validation.

### Slice 5 — breadth pressure

Generalized the schema vocabulary away from arity-specific descriptors.

Final generic descriptor vocabulary:

```text
string
string-list
non-negative-integer
non-negative-integer-list
transport
```

with orthogonal `required`.

### Slice 6 — boundary pressure

Confirmed without production changes:

- optional is not implicitly nullable;
- structured transport data is detached and frozen;
- nested transport shape gains no hidden semantics;
- caller mutation cannot alter DiagnosticSpec;
- open transport and strict producer contracts coexist.

Pressure suite reached **276/276 GREEN** before consolidation.

## Consolidation

The temporary Slice 2–6 pressure tests and pressure notes are removed at
closure.

Their durable contract coverage is consolidated into:

```text
tests/js/diagnostic-contract.test.mjs
```

The permanent normative implementation documentation is:

```text
docs/architecture/P0009-diagnostic-contract-v1.md
docs/architecture/P0009-exit-audit.md
```

## Architecture check

P0009 preserves the frozen v1.0 architecture:

- Diagnostics contain no document authority.
- Diagnostics contain no evaluator history.
- Diagnostics contain no dependency graph authority.
- Backend exceptions do not become public contracts.
- Localization remains outside mathematical semantics.
- OperationSpec remains separate from diagnostic construction.

## Exit decision

No pressure evidence justifies adding a global registry, category, severity,
cause chain, dependency path, diagnostic-specific schema descriptor taxonomy,
or presentation text.

P0009 is therefore ready to close as **COMPLETE / GREEN** once the consolidated
repository test suite passes.

Next roadmap item: **P0010 — evaluator transport boundary**.

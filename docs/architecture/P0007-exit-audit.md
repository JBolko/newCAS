# P0007 --- Semantic IR v1 --- Exit Audit

**Status:** COMPLETE / GREEN\
**Verified full JS suite:** 172/172\
**Production implementation:** `src/js/semantics/semantic-ir.js`\
**Permanent tests:** `tests/js/semantic-ir.test.mjs`

## Exit criterion

P0007 requires the smallest resolved IR needed by the frozen semantics,
with source-independent fixtures for normative cases.

## Audit result

**PASS.**

The implementation represents already-resolved semantic meaning using a
small canonical vocabulary: definitions, function definitions, provider
references, semantic-identity references, operation references, calls
and materialized Values.

The permanent fixtures demonstrate that nearest-predecessor choice,
read-before-write, lexical capture, free-symbol identity,
operation-local identity, materialized Values, substitution targets,
relations and container construction can be represented without source
text or runtime lookup.

## Boundary checks

-   PASS --- no parser AST or source text is required by resolved IR.
-   PASS --- provider selection is explicit; document order is not
    re-evaluated by IR.
-   PASS --- P0006 identities preserve binder/free/operation-local
    distinctions.
-   PASS --- materialized Values are not recursively re-resolved.
-   PASS --- OperationSpec argument-role and dispatch policy is not
    embedded in P0007.
-   PASS --- DocumentRuntime state, dependency graphs, dirty/generation
    state and execution history are absent.
-   PASS --- backend/Pyodide/SymPy objects and dispatch metadata are
    absent.
-   PASS --- IR is immutable, detached and JSON-transportable.

## Pressure-test result

Slice 1 introduced the production vocabulary and six fixtures.

Slice 2 added six materialized-Value/construction/substitution fixtures
with no production change.

Slice 3 added six source/runtime/evaluator-boundary exit fixtures with
no production change.

The only red result during these slices was a fixture expectation that
assumed `valueLiteral(...)` used node kind `value-literal`; the
established implementation uses node kind `value`. Correcting that test
assumption returned the suite to green without production or contract
change.

## Repository cleanup

The three development test slices are consolidated into
`tests/js/semantic-ir.test.mjs`.

Temporary slice architecture notes are absorbed into
`docs/architecture/P0007-semantic-ir-contract-v1.md`.

Development-only slice files are removed after applying the closure
package.

## Conclusion

P0007 is **COMPLETE / GREEN**.

The next contract layer is P0008 OperationSpec v1. P0008 may describe
operation argument roles, symbolic scopes, evaluator dispatch,
purity/volatility and diagnostic adaptation hooks without reopening
P0007 document-resolution semantics.

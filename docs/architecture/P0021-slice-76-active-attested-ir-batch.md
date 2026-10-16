# P0021 Slice 76 — Active attested Semantic IR batch migration

**Status:** local selected GREEN; full Node 24 suite and browser Worker remain user acceptance gates.

## Change

The production `createRuntimeFunctionBatchEvaluator` selects exactly two paths:

- FunctionDefinition: the existing P0020-attested FunctionValue writer with parameter identities and captures.
- Assignment, FunctionCall, Variable: `createAttestedIRTaskEvaluator` (Slice 75), which parses once, compiles through Slice 73 to explicitly provider-bound Semantic IR, and evaluates through Slice 74. `evaluateSelectedFunctionApplication` is injected as the existing stateless FunctionValue applicator. Operations still go through OperationSpec and the supplied backend.

There is no fallback to the old source-recursive expression adapter. The previously active source-recursive module is retained temporarily for its standalone tests and subsequent migration audit.

`DocumentRuntime` still owns task scopes, document order, provider selection, revision/generation protection, cached outcomes and commits; the batch still owns only current-invocation known outcomes. No Python document scopes, shadow binders or persisted evaluator registry.

## Validation

Five new tests cover active batch execution of composed calls in assignments, capture invalidation, long names versus whitespace multiplication, no forward fallback, and same-provider nesting. The Slice 69/70 audit tests are updated to expect the attested IR task bridge as the active expression route.

Local targeted test groups pass. Broad repo-level tests were not completely available in the reconstructed checkout; run the full suite on the authoritative Node24 repository before marking the slice globally GREEN. No new real-browser evaluation was performed in this slice.

## Known limitations / next slices

The selected integer-arithmetic subset remains: more operations, several parameters, richer Values, and symbolic evaluation are future extensions. The existing FunctionDefinition path remains separate for binders/captures; it is not automatically absorbed into the expression evaluator. The old source-recursive adapter is not removed until all its independent consumers are migrated. Worker timeout and P0004 in-Worker version introspection remain separate outstanding work.

# P0021 Slice 93e — symbolic occurrence binding (RED contract)

**Status:** RED contract; source code unchanged. This is a pressure slice,
not a change to the frozen architecture v1.0 or proof of Python computation.

## What we found

P0008 OperationSpec and P0019 `planOperationArguments` already declare the
`symbolic` target in `integrate`, `tangentline`, and related operations.
However, `derive-block-source-bindings.js` traverses source variables before
operation roles are consulted. It deduplicates references by **name** and
resolves that name against a preceding document writer. Therefore a document
containing `x:=17; integrate(x^2,x)` (two blocks) incorrectly attributes the
mathematically local `x` to the earlier document writer. In S93e RED tests,
this is observable in the semantic snapshot *before* evaluation or SymPy.

## Required boundary for the upcoming GREEN implementation

- Source binder identity must be determined from the already selected
  OperationSpec's role plan, **not** from string/name heuristics or the Python
  backend. Unselected / ambiguous calls must not introduce a binder.
- In a selected symbolic operation such as `integrate(x*y,x)`, the symbolic
  target `x` and its governed integrand occurrences must not become document
  reads; an independent `y` must still be resolved to its earlier writer.
- The input `integrate(x^2,x,0,x)` has *different* uses of the spelling `x`:
  in integrand and target it is local, but in the **upper bound** it means the
  positional document variable (when one exists). Therefore simply removing
  every reference named `x` would be a dangerous quick-fix.
- Preserve positional attestation and the distinction between syntax,
  occurrence-level source bindings, and resolved Values. No alternative
  evaluator, no generated Python code, and no default symbolic fallback.
- A malformed or ambiguous signature must fail closed. Diagnostics must not
  silently convert unsupported semantics into success.

This slice contains three explicitly RED tests (symbolic `integrate`,
`tangentline`, and independent `y`) and four mandatory GREEN controls
(OperationSpec role plan, ordinary document read, lexical function binder,
and unknown call fail-closed classification).

## Acceptance and limits

- The three RED tests are executed *explicitly* and must fail 3/3 at the
  S93e baseline. They are intentionally named `*.red.mjs` to stay outside
  the normal regression suite. They become ordinary GREEN regressions only
  after implementation, with no TODO demotion.
- Four control tests, full JS suite, parser sync and full Python suite must
  all be GREEN on the user's Node 24 machine.
- S93e does not fix F7. It prepares a precise, current-code RED baseline for
  S93f and avoids a name-based quick-fix that would corrupt bound integration.

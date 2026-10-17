# P0021 Slice 93h — shared selected symbolic IR → Value materialization

**Status:** GREEN candidate, user Node 24 acceptance pending.

## Reason

S93f fixed source dependency projection; S93g produced attested IR with
operation-local `SemanticIdentity` and distinct document `provider-reference`.
The remaining known IR boundary is that `evaluateAttestedDocumentIR` is
**value-only**, so it must continue to reject symbolic-reference nodes.

The earlier `compileSelectedSymbolicDiff` already had a bounded materializer
for exactly this IR-to-P0005 conversion. Keeping a second implementation for
integrals/tangents would violate our no-duplicate-semantics constraint.

## Change

- `materializeSelectedSymbolicArguments(envelope, ir, spec)` extracts the
  already-selected symbolic and value operands as immutable public
  `ExpressionValue`s; no source parsing, name resolution, backend execution,
  Worker invocation or new evaluator.
- It preserves operation-local identity in the integrand and symbolic target,
  and materializes separately attested document-bound values in bounds.
- It validates selected role/arity, provider identity uniqueness, Value shape,
  and exact provider consumption. It rejects unsupported nested operations,
  forged non-symbolic targets, and unselected providers.
- The historical selected `diff` request builder now reuses this same
  materialization primitive instead of maintaining its own traversal.

**Example:** for `x:=17` then `integrate(x^2,x,0,x)` the operands are:
`pow(symbolRef(local-x),2)`, `symbolRef(local-x)`, `0`, `17`.
The two `x` meanings remain distinct.

## Deliberate limits / contracts

- The consumer must use **already selected** P0008 OperationSpecs and IR from
  a trusted source-analysis/attestation pipeline. This materializer is **not
  an attestation authority** and does not prove that an arbitrary caller-supplied
  IR is document-owned.
- No top-level `integrate`/`tangentline` activation in DocumentRuntime or the
  Worker. Their selected OperationSpecs and backend support still need a
  separately reviewed **execution/transport** integration; notably the
  currently selected Python Worker capability list only includes `diff`.
- Source `diff` selection and compatibility of its existing request are
  covered by unchanged regression tests. The new module does not select new
  operations or add a source-level `diff` alias.
- No change to frozen v1.0 contracts, identity semantics, source grammar,
  task order, `DocumentRuntime`, security boundary or Python execution.
- No insertion of Python `exec`, `eval` or `sympify` through a string path.

## Acceptance

Node 24 mandatory focused tests; canonical parser check; full JS and Python
regressions. The previous S93g accepted checkpoint was 1054 JS PASS / 7 TODO /
1 skipped and 264 Python PASS. Check against the actual suite rather than
assuming the count stays fixed when new tests are introduced.

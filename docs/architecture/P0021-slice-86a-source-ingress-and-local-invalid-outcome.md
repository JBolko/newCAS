# P0021 Slice 86a — tolerant source ingress and local invalid outcome

## Scope

- F1/F2 only. DocumentRuntime accepts non-empty, empty, incomplete, and multi-statement formula source as **authoritative text**; these are not necessarily evaluable statements.
- A formula block is one semantic position. Until an explicit multi-statement positional model exists, a zero/multiple-statement block has no writer; its `parseError` is a local `Expected exactly one statement per formula block` diagnostic.
- No alternate parser, no Python scope, no alternate runtime. Existing semantic projection, ordering, results, stale/generation fences, and Value gates remain authoritative.
- An invalid formula contributes no semantic writer, no providers and no edges. Batch preparation emits `sourceDiagnostic` on its task. The result dispatcher manufactures the local failure `INVALID_SOURCE` **before** invoking evaluator. Independent blocks are evaluated as usual.
- Structural errors (duplicate block id, invalid position, wrong source data type) still throw. Syntax-invalid source text no longer counts as a structural error.

## Regression and normalization

- `tests/pilot/02-front-door-robustness.test.mjs`: the 13 former TODO tests for F1/F2 now count as ordinary pass/fail tests.
- `tests/pilot/s86a-invalid-writer-normative.test.mjs`: selected-IR tests with a JS BigInt leaf for frozen #14 and #41. This is **not** a real Worker/Pyodide E2E; registry marks both as `binding` and retains zero attested E2E claims.
- `tests/js/test-document-runtime.mjs`: two old tests expecting invalid-source rejection are updated for normative stress cases #14/#41.
- `tests/js/p0021-evaluation-batch.test.mjs`: replaces the old expectation of a batch-global throw with explicit local invalid task.
- `tests/js/p0021-slice-86a-document-source-boundary.test.mjs`: no legacy calls, invalid text never reaches evaluator, independent work continues, stale result invalidation, multi-statement no-writer, invalid source type atomic.

## Deferred

- No EditorSession/undo semantics (E1, §19). Committed invalid source is distinct from a transient editor buffer.
- Syntax diagnostic is currently a stable local result code plus parser message; richer P0009 code/offset localization belongs to a separate design review.
- F4 legacy Transformer code-injection is **still open**. Nothing in this slice passes user text to Python code generation; legacy engine must not be used in the active IR path. Do not claim legacy safety until a separate retirement/mitigation slice is accepted.
- Multi-statement evaluation unsupported by design. It is an invalid local block, not partial success or silent execution of the first statement.

## Acceptance gates

1. `node --test tests/js/p0021-slice-86a-document-source-boundary.test.mjs tests/pilot/02-front-door-robustness.test.mjs`
2. `node --test` (Node 24)
3. `python -m unittest discover -s tests/python -p 'test_*.py' -v`
4. No changes to `src/js/transformer.js`, `src/js/cas-engine.js`, or `src/python/`.

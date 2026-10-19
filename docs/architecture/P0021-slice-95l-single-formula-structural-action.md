# P0021 Slice 95l — one-operation structural editing action

**Status:** GREEN candidate; Node 24 regression required.
**Baseline:** S95k after S95i/S95j/S95k acceptance; S94 checkpoint `296fbbe`.

## Scope

The existing `DocumentRuntime` is authoritative for formula blocks, their document
order, task ownership, semantic bindings, dirty invalidation and calculation
slots. S95l adds `createFormulaStructuralAction` **inside the existing editing
boundary** as a prevalidated, synchronous, *single-operation* entrypoint for
an explicit user action:

- `insert`: caller-supplied opaque unique block ID, source, and absolute index;
- `move`: existing formula block identity plus absolute destination index;
- `remove`: existing formula block identity.

The adapter never parses mathematics, chooses an evaluator, creates a new
DocumentRuntime, derives a graph, or invents DOM-based block identifiers.
Existing `DocumentRuntime.insertBlock/moveBlock/removeBlock` remain the sole
authorities for graph reconstruction and invalidation. It works only with a
semantic-only DocumentRuntime, and rejects mutations of another task.

The caller owns revisions. Every effective structural change advances the
revision **before** the runtime operation; a same-position move is a no-op.
Malformed proposals, wrong-task operations, active EditingSession formula
drafts, and an invalid/no-op revision advance are rejected without initiating
a runtime structural operation. The revision callback must not mutate the
document; a post-advance identity/source/order guard detects violations.

## Explicit limitations

- **Not** P0027's general `DocumentTransaction`/Undo/Redo engine.
- **Not** an atomic batch of multiple structural changes.
- **Not** an EditingSession supporting multiple pending structural drafts.
- A runtime exception **after** a structural mutation begins (for example an
  unexpected notification listener exception) cannot be rolled back by this
  boundary. General transaction rollback/atomicity remains future work.
- Block IDs are opaque source identities, not filenames or CSS selectors;
  only a non-empty string is required here. The *test-fixture* importer has
  separately restricted fixture IDs; that restriction is not normative.
- `taskId` remains fixed for an operation. Moving a block across task
  membership is a separate P0028 capability, not silently implemented here.

## Acceptance

15 mandatory contract tests cover fail-closed behavior, source/identity
preservation, duplicate IDs, revision guard, active draft protection,
invalid mathematical text as source data, and delegation to DocumentRuntime.
The shared S95-focused regression contains **116 tests** in this slice.
Run the user's Node 24 verifier before declaring GREEN.

# P0021 Slice 95i — formula EditingSession (P0026 entry boundary)

**Status:** GREEN candidate pending Node 24 acceptance.
**Scope:** One formula draft, model-owned block/task identities, no live UI cutover.

## Context: prototype, not a product to preserve

`src/js/main.js` is a temporary legacy-driven prototype, not a contractual
student UI. The frozen architecture, not the prototype's DOM/event scheme,
determines the destination. S95h correctly blocked a *direct* switch of its
Enter handler to the new evaluator, because that code still derives identity
from the DOM and treats typing/evaluation as the same authority.

## Decision

Introduce the small **already-normative** EditingSession seam for an existing
FormulaBlock: `createFormulaEditingSession({runtime, taskId})`. This is part of
the frozen P0026 EditingSession responsibility, **not** a new document model,
controller, evaluator, or scheduler. `runtime` must be semantic-only.

- `begin(blockId)` reads source and identity **from DocumentRuntime**. It does
  not allocate an ID from a DOM count, label, source name, or input index.
- `replaceSource(text)` changes only the EditingSession buffer, preserving
  incomplete or malformed mathematical source verbatim. No dependency rebuild.
- `prepareCommit()` validates that the original block still exists as the
  **same object, task, source, and generation**; returns a frozen
  `{blockId, source}` proposal and freezes the active draft as pending.
- The existing **S95e** `createSemanticCalculateAction.calculate([proposal])`
  performs the *only* authoritative source commit, revision advance and
  invocation of the preexisting semantic evaluation session.
- `finishCommit()` closes the buffer **only if** the proposed source really is
  authoritative on the original block; a backend evaluation failure does not
  undo an already committed source. `retryDraft()` is available only while the
  original unmodified document generation is still current.
- `cancel()` discards only the buffer. It never rolls back authoritative
  document edits and cannot cancel an in-progress commit.

The separation deliberately keeps **Enter/key handling in UI**, **draft in
EditingSession**, **authoritative document in DocumentRuntime**, **revision
in the host**, **selected evaluation in existing S95e/S94e**, and **presentation
in existing renderer.js**. This slice does not wire Enter or mutate main.js.

Illustrative integration, not a PowerShell command:

```js
const editor = createFormulaEditingSession({runtime, taskId: 'exercise-1'});
editor.begin(modelOwnedBlockId);
editor.replaceSource(latestInputValue); // no document mutation
const proposal = editor.prepareCommit();
try {
  await calculateAction.calculate([proposal]);
} finally {
  // An evaluator error may occur AFTER authoritative source commit.
  if (runtime.getBlock(proposal.blockId)?.source === proposal.source) {
    editor.finishCommit();
  } else {
    editor.retryDraft(); // only valid if original base is still current
  }
}
```

This is a **limited P0026 foothold**, not full EditingSession completion.
The production UI must not adopt this example blindly; its real user-action
semantics and multi-task/structural transactions still need a separate design.

## What remains open

1. Enter behavior: explicit action per active editor, without accidentally
   committing other draft buffers, and without a new scheduler.
2. Stable ID allocation for **new** blocks, duplication and task creation;
   moving an existing block preserves identity. Structural transactions,
   Undo/Redo, and multi-editor sessions are separate P0027/P0028 concerns.
3. Browser integration and tests with two tasks, structural edits and an
   in-flight Worker result before replacing the temporary `main.js` route.
4. Robust UI feedback for `S95I_EDIT_CONFLICT` and other diagnostics through
   P0009/i18n, not user-facing hardcoded English codes.
5. Freeze architecture remains unchanged. Test fixture formats are not `.ncas`.

## Evidence / verification

- 16 focused new tests exercise draft-only edits, invalid/incomplete sources,
  stable identity and task isolation, ABA source changes, removal/reinsertion,
  moves, concurrent attempts, and a real DocumentRuntime/S95e source commit.
- S95h and selected S95a/e/f/g regression suites must remain green.
- The new EditingSession is not imported by the active prototype or browser
  pilot; a browser rerun is not an exit requirement for this slice.
- Node 24 full JS/Python and canonical Peggy checks are required on the
  developer machine. No claim that `main.js` has cut over.

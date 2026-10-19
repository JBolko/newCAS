# P0021 S95n — atomic FormulaBlock document transactions (P0027 foothold)

## Existing normative authority

`docs/architecture/v1.0/ARCHITECTURE_SPECIFICATION_FROZEN_v1.0.md` §18.1, §19 and §32 require that document mutations are authoritative, Undo does not rewind runtime epoch, and move/Undo-delete preserve block IDs. None of these frozen files is changed.

## Contract

`DocumentRuntime.createSemantic()` now exposes `prepareDocumentTransaction(operations)` and `applyDocumentTransaction(plan)`. The plan is scoped to one runtime, single-use and stale-checked against block references, source/order/task and generation. Invalid compound proposals change nothing. A validated plan is published with a single graph rebuild and task-scoped notification. Runtime owns dependency analysis and dirty invalidation, including downstream of source modifications and provider-binding changes.

Supported **FormulaBlock only** primitives: `{kind:'source',blockId,source}`, `{kind:'insert',blockId,index,taskId,source}`, `{kind:'remove',blockId}`, `{kind:'move',blockId,index}`. Indexes are post-removal positions for move. Prepared plans expose immutable `forward` and reverse-ordered `inverse` operations; they contain authoritative source/identity/order only, never Values/AST/Worker state. No-op plans leave generations untouched. Runtime does not allocate opaque block IDs.

`applyDocumentTransaction()` returns `{kind:'applied',affectedBlockIds,notificationErrors}` or `{kind:'unchanged',affectedBlockIds}`. Throwing observers cannot corrupt published authority; notificationErrors reports their count. This is a P0027 **selected subset**: text, settings, task-boundary moves and persistent/history serialization remain outside this slice. Existing one-operation APIs remain for backwards compatibility; they are not automatically history-recorded.

S95n adds 12 Node contract tests. No parser, legacy, `.ncas`, UI, or Worker changes. Node24 + parser + full JS/Python required for GREEN; real browser reserved for S95p.

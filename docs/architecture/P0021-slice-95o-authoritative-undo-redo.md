# P0021 S95o — session-owned authoritative Undo/Redo (P0027/P0028 subset)

## Contract

`createDocumentHistorySession({runtime,editingSession?,getCurrentRevision,advanceRevision})` contains a linear array of immutable **reversible operations** and cursor. No alternative document authority, raw backend snapshots, result cache or Python scope. Its actions `execute(ops)`, `undo()`, `redo()` invoke S95n's public two-phase API. A single compound transaction is one Undo entry. A new transaction after Undo truncates the redo branch. `snapshot()` returns only `{canUndo,canRedo,cursor,length}`.

Every effective edit/Undo/Redo advances the host revision **before** mutation. Undo never restores the old epoch. In-flight calculations from a previous revision cannot commit. Active EditingSession buffers block history actions, and an external authoritative edit since the last recorded history fingerprint causes fail-closed `S95O_HISTORY_DIVERGED` rather than silent overwrite. A no-op does not advance revision or truncate redo.

This deliberately does not make earlier S95e / S95l direct mutations historical: the **future** UI must route all edit commands through the one transactional authority, including Enter and whole-document changes. History is transient session state and is not part of `.ncas`. The current implementation stores a compact divergence fingerprint (IDs/types/task/sources), not an alternate document model. Undo/Redo is only guaranteed for supported FormulaBlock primitives.

S95o adds 12 Node tests. It changes no existing file besides the new session, tests, documentation and verifier. It requires S95n installed.

# P0021 Slice 46 — DocumentRuntime semantic invalidation

**Status:** GREEN locally (Node targeted tests); awaiting user's complete Node 24 suite.

## Boundary

The existing `DocumentRuntime` remains the authoritative owner of source/order and calculation state. After an edit it derives temporary P0020/P0021 semantic snapshots from its current blocks and compares those bindings with the preceding snapshot. The derived graph is **not** persisted as a second authoritative dependency graph. No new interpreter, provider registry, Python task scope, or architecture revision is introduced.

For a retained block, changed provider bindings (including an unresolved call after removal) invalidate that block and descendants of the old and new semantic graphs. `markBlockDirty` retains its established generation protection and clears stale results (Slice 44). Newly inserted blocks have no prior calculation and are not treated as changed retained blocks.

This supplements existing legacy invalidation while integration proceeds; it does **not** yet replace `calculateBlock` or perform semantic evaluation under DocumentRuntime ownership. Stale async completion remains protected by the existing generation guard.

## Checks

- First function writer removed: earlier call becomes unresolved, result cleared; later call still valid.
- Later writer removed: following call rebinds to earlier writer and becomes dirty; preceding call unchanged.
- Inserted writer: only following formerly bound call invalidated.
- Source edit changing writer name: downstream provider binding changed and result invalidated.
- Task boundaries remain isolated.
- Moving a writer across a call invalidates the changed call, not an unaffected later call.

**Next:** introduce execution of selected semantic tasks within the existing DocumentRuntime calculation lifecycle; do not add a parallel runtime.

# P0021 Slice 95e — explicit semantic UI calculation action

**Status:** GREEN candidate; developer Node 24 and real Pyodide browser acceptance required.
**Baseline:** `296fbbe` (S94 checkpoint) plus accepted, uncommitted S95a–S95d.
**Scope:** a small reusable UI calculation boundary, exercised by the isolated S95b/S95c pilot. **No change to `src/js/main.js` or production UI.**

## Motivation

The S95b pilot previously implemented three decisions directly in its browser code:
reading draft inputs, advancing the host revision, and committing changed sources
before invoking the supervised semantic task session. These rules belong at a
reusable UI action boundary, not in the Worker, evaluator, parser, or document
runtime.

## Contract

`src/js/ui/create-semantic-calculate-action.js` provides
`createSemanticCalculateAction({runtime,session,taskId,getCurrentRevision,advanceRevision})`
with one explicit `calculate([{blockId,source},...])` action.

- The host UI owns draft input fields and requests the action explicitly. There
  is **no write-through while typing** and no implicit calculation on fixture import.
- The action preflights **all** draft rows before **any** authoritative source
  write: correct types, unique block IDs, existing formula blocks, same task.
  Invalid later rows cannot cause partial source edits.
- Only changed rows are written to **the existing** `DocumentRuntime`, using its
  `setBlockSource` API. Incomplete source is preserved exactly as typed: no
  parser, sanitizer, or mathematical inference in the action.
- The host's revision changes synchronously once **before** changed source
  writes. An unchanged/invalid revision is rejected before any source write.
  Unchanged draft sources do not advance the revision.
- One invocation delegates to **one** existing supervised `session.run()`.
  Overlapping UI Calculate calls are rejected before changing any source.
- A failed evaluation propagates as-is, retaining any P0009 diagnostic; no
  hidden retry, Worker restart, document snapshot, result projection, Python
  scope, evaluator or OperationSpec registry is introduced here.
- After successful preflight, individual DocumentRuntime edits use its existing
  mutation contract. This is **not** a new multi-block transaction / Undo-Redo
  system (P0026–P0028 remain responsible for those contracts).

## Integration and limits

The S95b/S95c pilot now uses this one UI action for its existing Calculate
button; source input, fixture import, result rendering and Worker restart remain
in their existing owning components. Static graph checks guard against reaching
`CASEngine` or `Transformer` from the pilot. The production `src/js/main.js`
remains on the legacy engine **intentionally**; this slice does not change the
student entrypoint, release manifest, or active editor.

The Node tests exercise validation, source preservation, ordered commits,
revision behavior, concurrent calls, diagnostic propagation, and a real
DocumentRuntime + attested selected IR Node test backend (`f(3)=11`, then `14`).
The final acceptance must additionally rerun the **real Pyodide** S95b and
S95c browser buttons. That is justified because the pilot's calculation call
path was refactored.

## Next gates (not part of S95e)

- Full production UI cutover requires an explicit EditingSession / structural
  editing contract, task mapping, diagnostic presentation, and source ordering.
- The temporary three-block JSON fixture is not `.ncas` and is not a release
  format.
- Multi-statement atomic semantics remain deferred and must not be silently
  introduced by this UI action.
- Before a later commit or independent review: all Node/Python tests and the
  relevant real Pyodide browser path must be accepted on the developer machine.

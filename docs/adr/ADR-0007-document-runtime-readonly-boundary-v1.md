# ADR-0007 v1 — DocumentRuntime public read-only boundary

**Status:** Proposed for review — NOT accepted, NOT normative.
**Date:** 2026-10-20.
**Implementation context:** S97c contracts explicitly approved by the user;
this draft records their API implications for a later architectural review.
No existing accepted ADR or FROZEN v1.0 text is amended.

## Context

Public writable block/storage references bypassed DocumentRuntime mutation
chronology, source identity, atomic publication and history divergence guards.
S97a guards public mutation chronology; S97b routes selected editor commands
through one HistorySession. Those guarantees need a protected read boundary.

## Proposed decision

DocumentRuntime keeps sole writable ownership of blocks, dependency analyses and
listener storage in private fields. Internal mutation paths use private owned
access; public readers expose read-only views over that same authority.

- `blocks` is a frozen order snapshot of protected block views, never storage.
- `getBlocks()` returns a detached order array of the same block views. Its local
  array may be rearranged without affecting document order.
- `getBlock(id)` and `addBlock()` return a stable view per block incarnation.
  Read `view.calculation` after publication to see its current slot. A previously
  retained nested slot/graph view remains a protected projection of that object;
  it is not a subscription across replacement of nested objects or graph rebuild.
- Moves and source changes preserve incarnation view identity, including staged
  history source replacements. Source tokens still rotate independently.
- Delete/recreate/Undo-delete restores block ID as required but creates a fresh
  incarnation/view and source identity. A retained deleted view never follows
  another incarnation using that ID.
- Nested arrays, calculations, results, diagnostics, graph properties, Map/Set
  entries, iterators, callbacks and reflection descriptors cannot return writable
  aliases. Mutation, descriptor/prototype writes and freezing views are rejected.
- Genuine deeply immutable Value and Diagnostic contracts are returned unchanged,
  preserving prototype/identity and their existing frozen validation behavior.
  Existing evaluator-outcome serialization/copying BEFORE the runtime boundary
  is unchanged; identity is preserved from the accepted immutable outcome onward.
- Caller input is admitted as inert finite primitive/plain-object/array data,
  recursively isolated. Functions, symbols, accessors, hidden non-enumerable data,
  cycles and mutable exotic objects are rejected. Genuine immutable contract
  objects may be retained. Formula IDs/types/source/task remain validated.
- Prepared transaction candidates remain private and publish atomically. View
  retargeting occurs after rollback-capable rebuild/invalidation, before observer
  notification. Full rollback preserves current views, sources and tokens.
- Mutation stamp, source identity, host epoch and calculation generation remain
  separate. No new document model, evaluator, scheduler, replay or persistence.

## Compatibility consequences

Previously direct-writing consumers must call supported runtime/history APIs.
No production fixture writer or raw-storage escape hatch is introduced.
Read-only Proxy views cannot be passed directly to native `structuredClone`.
Serialization/test snapshots must explicitly project inert data (for example
JSON materialization for the established JSON-safe data); immutable Values retain
their existing encoding APIs. Source persistence is not changed in this slice.
`Object.isFrozen(view)` is not the read-only contract: internal data stays writable,
while view traps deny writes. Immutable Values/Diagnostics remain actually frozen.
Public storage readers cannot be reassigned or shadowed through defineProperty.

## Alternatives

Detached block snapshots break live result reads and identity guards. Freezing
owned objects breaks internal publication. Stable read-only views preserve the
existing owners while intentionally removing writable-reference compatibility.

## Limits and review gates

This is an API/ownership boundary in trusted application code, not a hostile-JS
security sandbox or protection against monkeypatching global primordials/methods.
Standalone DependencyGraph remains mutable for its owner; runtime-returned graphs
are protected. Fresh derived analyses/batches and new affected-ID collections are
detached products, not stored source aliases. Legacy engine task state belongs to
that explicitly retained engine boundary; semantic-only runtime rejects it.
Generic direct structural rollback, text/multi-task editor routing, legacy student
UI cutover, offline cold-start and full student release acceptance are separate.

Review S97_CLOSURE.md and permanent regression/browser evidence before changing
this ADR's status. Explicit architectural review is required for acceptance.

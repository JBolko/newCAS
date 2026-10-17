# P0021 Slice 90a — multi-statement positional projection (candidate)

**Status:** locally GREEN on the pure P0020 projection; **active DocumentRuntime remains YELLOW/RED under explicit strict gate**. Full Node 24/Python acceptance requires user log.

## User semantics (confirmed 2026-10-17)

`a := 1; b := a+2; a := 5; resultat := a b` is equivalent in *ordering and name binding* to four consecutive formula blocks in the same task. `b` binds to first `a` and `resultat` binds to second `a` and first `b`. Mathematically `b=3`, `resultat=15` **once the active IR evaluation path is integrated**; this slice verifies *provider selection*, not numerical calculation. Long identifier `ab` remains one name; `a b` is multiplication.

Use `;` as working statement separator. Peggy already supports it; its use *inside* argument lists, vectors and lists is handled by the complete PEG parse, NOT by splitting source strings. No `:`/`::` grammar alteration, no i18n reinterpretation, no parser duplication.

## Existing invariant and narrowly scoped extension

ADR-0006 (Accepted) defines **FormulaBlock v1 as one atomic instruction**, explicitly deferring multiple statements. The three frozen v1.0 files are unchanged. Accordingly, Slice 90a is an **opt-in pure analysis projection** and NOT a silent replacement for the v1 runtime contract.

- `DocumentRuntime` remains the only authority for block source/order, revisions, task scopes, invalidation and results. No new object stores program state.
- A canonical parser parses *the whole source* to an array of statements. A parse failure suppresses **all writers of that parent block**, avoiding partial/ghost success.
- Each parsed statement gets a derived position ordered by `(parent block index, statement index)`. The ID is injectively encoded as JSON `[parentBlockId,index]`, only within this **virtual-analysis** namespace. This ID is **not a stable persisted document identity** and must not be used as one.
- Each virtual statement passes through existing `establishSourceWriters`, `deriveBlockSourceBindings`, `resolvePositionalName`, `classifyBlockCallTargets` and `projectSemanticDependencyAnalysis` (unchanged). The only shared-core refactor is extraction of `snapshotFromSourceAnalysis` from `deriveSourceSemanticSnapshot`; v1 still calls it with the original single-statement analysis.
- A read in a statement uses the nearest *strictly previous* provider in its task, even within the same parent block. A read and write in one statement do not create a self-edge. No result-based fallback.
- No evaluation/compilation/Worker dispatch, caching, Python task scope, source code generation, UI or authoritative document mutation in Slice 90a.

## Explicit gaps before enabling this in the real document path

1. **Source-attested per-statement IR.** The active compiler currently attests *a single expression against its block source*. It must consume the original entire source + statement ordinal/AST with trustworthy provenance; never fabricate statement source by `split(';')` or introduce Python code-generation.
2. **Identity and invalidation.** Persist parent block ID/source; statement IDs are derived. Insertion/deletion inside a block can renumber positions, so revision/generation + provider capture must invalidate old results. Define parent-level commit semantics and the observable block result(s).
3. **Cross-statement failure.** An invalid syntax must yield no writers for the entire parent. A runtime failure in statement N must not allow downstream consumers of its value to fall back to earlier writers; unrelated instructions must follow existing dependency rules. Determine whether the parent reports first error or per-statement outcomes.
4. **Editing semantics.** Preserve original source, offsets and diagnostics; decide stable UI selection when statements move within a block. This is separate from E1 undo/editor sessions.
5. **E2E.** Prove execution via active DocumentRuntime → attested IR → real Pyodide Worker, including redefinitions, worker result commit, cross-task isolation, and stale overlapping generations. Do not claim `resultat=15` has been computed in this slice.

## Tests and gates

- Pure projection: `node --test tests/js/p0021-slice-90a-statement-order-projection.test.mjs` — 12 passing checks + 1 deliberate TODO.
- Opt-in **expected RED** on active runtime: `$env:NEWCAS_S90_REQUIRE_ACTIVE='1'` and same test (remove env afterwards). This must fail only the specifically pending integration requirement.
- Full `node --test` and Python suite must remain green in the user's Node 24 environment.
- Review separate test that parser honors `f(1;2)` and `[1;2]` without a naïve semicolon split.

## Review/commit checkpoint

Since S84–S89b have verified suites but appear uncommitted, a **checkpoint commit is due soon**, after S90a Node 24 acceptance and a deliberate review of Git status. Stage reviewed code/tests/docs/allowed release tools only; **not** `tools/reports`, ZIPs, `.venv`, repomix files, generated local logs, or untracked root captures. Then prepare CURRENT full source/test/document snapshots plus TODO ledger for an adversarial Claude follow-up. No claim of having contacted Claude.

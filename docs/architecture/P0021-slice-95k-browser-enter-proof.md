# P0021 Slice 95k — real-browser Enter / EditingSession integration proof

**Status:** GREEN candidate; Node 24 plus browser/Pyodide acceptance required.

## Scope

This slice wires the **existing** dynamic S95f TEST-ONLY browser page to
S95i EditingSession through the S95j Enter action. It creates no alternative
DocumentRuntime, document authority, evaluator or UI architecture.

The input events only edit a transient draft. A plain Enter causes the
single prepared draft to be submitted through the existing S95e calculation
action, DocumentRuntime's authoritative source and dependency graph, the
selected semantic task and supervised real Pyodide/SymPy Worker, and finally
S95g's existing renderer. Source edits are not interpreted by a DOM-generated
block number; the existing model-owned `blockId` and `taskId` are used.

The previous 95f full-document Calculate, variable-block fixture import,
structural reconciliation and standalone browser acceptance remain available.
When a fixture is replaced or a full-document Calculate begins, the inactive
per-field draft is discarded; no additional source write occurs.

## Acceptance page

`http://localhost:8000/tests/browser/p0021-slice-95f-dynamic-document.html`

1. Run existing **Kør S95f-browseraccept** (regression).
2. Run new **Kør S95k-Enter-browseraccept** (real Pyodide proof).
3. Expected S95k PASS: incomplete `a:=` typing remains a draft, Enter commits
   `a:=5`, dependencies recalculate `f(3)=14` and `f(4)=21`, both results pass
   through the existing renderer, and Ctrl+Enter does not commit.

## Ownership/limitations

Do **not** interpret the page as the redesigned student UI or as an `.ncas`
format implementation. Enter maps to an explicit *single-block* source commit
followed by task recomputation, not a per-cell evaluator or a second scheduler.
Structured transaction atomicity, Undo/Redo and multiple task UI remain
outside the scope; the frozen architecture and ADR-0006 are unchanged.

Seven new browser/static/semantic tests and the S95j tests are required. Local
Node 22 focused 101/101 and Python 264/264 green; real browser acceptance
remains decisive.

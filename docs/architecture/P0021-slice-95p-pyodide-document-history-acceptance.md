# P0021 S95p — real Pyodide Undo/Redo browser acceptance

## Boundary

Expands existing temporary `tests/browser/p0021-slice-95f-dynamic-document.html` with an explicit **Kør S95p-Undo/Redo-browseraccept** button. No `main.js` cutover, no student UI or `.ncas` change, no alternate evaluator/document model. S95f/S95k/S95m buttons stay unchanged.

S95p creates one temporary `createDocumentHistorySession` **inside the acceptance run**, after resetting and calculating a known four-block baseline. It executes Insert, Undo, Redo, Move, Undo, Redo, Remove, Undo, SetSource, Undo, and a new edit that truncates the redo branch, re-evaluating through **the original selected Pyodide/SymPy Worker** and the existing renderer. Expected values: 11/18 ↔ 14/21; source `a:=8` yields 17/24; new branch `a:=6` yields 15/22.

A history owner in the eventual editor must record **every** authoritative edit, not just this acceptance sequence. If another actor changes document source outside the history session, subsequent Undo fails closed. It must never be presented as complete UI-wide Undo/Redo without this integration.

Tests: five S95p Node tests including real selected Semantic IR evaluation and late-result-after-Undo rejection. In the real browser, after installing S95n+S95o+S95p, open `http://localhost:8000/tests/browser/p0021-slice-95f-dynamic-document.html` (server from repo root, **Ctrl+F5** after replacing module files) and click S95p-Undo/Redo browseraccept. S95f/S95k/S95m are unchanged regression checks. Do not claim browser GREEN until user confirms with actual Pyodide.

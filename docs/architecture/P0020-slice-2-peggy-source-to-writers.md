# P0020 Slice 2 — Peggy source → writer establishment → positional binding

**Status:** candidate pending repository test, NOT locally verified with Peggy.

Scope: pure derived analysis of a sequence of formula blocks; the supplied
Peggy `parse()` function parses each complete block. A parse failure does not
establish a writer. Structurally valid definitions establish a writer even
when RHS mathematical evaluation would fail. A reference binds to its
nearest earlier established writer, never to a later writer or a failed
writer's predecessor.

Files:
- `src/js/semantics/analyze-source-blocks.js` (new)
- `tests/js/p0020-peg-parser-writers.test.mjs` (9 new tests)

**Limitations:** Does not replace DocumentRuntime, source resolver, or evaluator.
No Python change, no change to Peggy source or frozen contracts. Single-statement
formula blocks only; multiple-statement ASTs establish no writer. Real P0020
writer-level structural validation and granular source locations remain later
work. Syntax errors are recorded here as local derived error strings, *not*
P0009 diagnostics; that adaptation remains an integration task.

From repository root:

```powershell
Expand-Archive -LiteralPath ".\P0020-slice-2-peggy-writer-bridge.zip" -DestinationPath "." -Force
node --test tests/js/p0020-peg-parser-writers.test.mjs
node --test
```

Expected 9 new JS tests (388 → 397), assuming all other tests unchanged.
Python stays at previously verified 191 P0012 + 16 P0011.

# P0019 Slice 2 — symbolic target selection boundary

**Status:** BOUNDED GREEN in an isolated reconstruction (7/7 Node tests). Full checkout not verified.

## Added files

- `src/js/semantics/resolve-selected-operation-call.js`
- `tests/js/p0019-selected-symbolic-resolution.test.mjs`

No existing production code is modified. No changes to P0005–P0010, grammar,
DocumentRuntime, evaluator registry, or Python handlers.

## Scope

Consumes an already selected P0008 OperationSpec with positional role plan.
Produces P0007 Semantic IR `operation-reference` + `call` for a parser
`FunctionCall`. A symbolic target is represented with a P0006
`operation-local` identity, supplied by the caller; it is **not** sent to
the ordinary value-resolution callback. Value arguments are delegated
to the caller's resolver. Arity errors do not trigger name resolution.

## Important unfinished semantics

This is **not** an end-to-end resolver. The identity of the symbolic
target must ultimately be associated correctly with occurrences of that
same symbol in the expression it governs. The current helper does **not**
rewrite / rebind those occurrences. In particular, the first operand
`x^2` in `tangentline(x^2,x,2)` is not shown to be semantically aligned
with the operation-local `x` merely by these tests. That problem is the
next contract-pressure point; it must follow P0006, P0007, P0008 and
the frozen source/materialization rules, without introducing name-based
re-resolution inside materialized Values.

The generic `scoped`/`scopeOver` role is deliberately **not yet supported**
by this bounded helper. Nor are FunctionValue calls or legacy DocumentRuntime.

## Verification

Locally 7/7 passing using JS sources extracted from the user's current
repomix snapshot plus installed P0008 catalog and P0019 slice 1.
Full user baseline before this change: 348 JS + 191 P0012 Python +
16 P0011 Python = 555. Expected JS after adding these tests: 355.

```powershell
Expand-Archive -LiteralPath ".\\P0019-slice-2-symbolic-boundary-GREEN.zip" -DestinationPath "." -Force
node --test tests/js/p0019-selected-symbolic-resolution.test.mjs
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

# P0018 Slice 1 — canonical notation and unit bracket guard

**Status:** candidate GREEN, full test verification pending in the user's checkout.

## Change
- `docs/Grammatik.pegjs`: canonical decimal is dot only.
- Comma and semicolon continue to separate function arguments.
- `Number Unit` syntax (`5[m]`, `3.5[m/s^2]`) stays intact.
- Bracket syntax for vector and indexing preserved.
- Existing rule for unit conversion `-> [cm]` preserved.
- No changes to Python, Values, OperationSpec, DocumentRuntime or frozen contracts.

## Not implemented
Localized user input **is not yet normalized**. The UI should preserve student source,
apply an explicit locale-aware lexical layer and pass canonical input to PEG.
E.g., Danish `1,5` -> canonical `1.5`, Danish `f(1,5;2,5)` ->
canonical `f(1.5,2.5)`. A blind global replacement is unsafe.
Function argument-list separator policy should be decided before UI integration.
Do not claim Danish comma input works in the application yet.

## Regression
Run from repository root after installation:

```powershell
node --test tools/probes/p0018_grammar_i18n_red.mjs
node --test tests/js/p0018-canonical-decimal-unit.test.mjs
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

If the UI consumes a compiled `src/js/parser.mjs`, regenerate from the changed source
using the project's established Peggy build command before browser smoke tests.
Do not hand-edit generated parser output.

## Important current-grammar distinction
The current PEG rule for a `Quantity` is **literal number followed by unit**
and does not assert that arbitrary expressions followed by `[unit]` work.
That is a separate grammar discussion.

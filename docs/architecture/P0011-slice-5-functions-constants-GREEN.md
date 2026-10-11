# P0011 Slice 5 — Constants and calls (GREEN)

This is an **extension** to the P0011 SymPy adapter, not a rewrite of the
existing frozen Value contract. Uses the existing P0005 node shapes:
`{op:"constant", name:"pi"}` and `{op:"call",name:"sin",args:[...]}`.

Supports **pi**, **E** and unary **sin**, **cos**, **exp**, **log** (public `log`
means natural logarithm) in both directions. This is a deliberate whitelist,
not free translation of arbitrary SymPy functions, and does not evaluate
function call nodes on input (`evaluate=False`). Function arguments preserve
P0006 semantic identity using the existing disposable adapter mapping.

Not provided: DEG/RAD, automatic angle conversion, evaluation of calls,
other constants/functions, multidimensional/variadic calls, arbitrary
SymPy symbols, differentiation or new public operation specifications.
These belong to later slices; do not infer full function support.

To install (repo root):

```powershell
Expand-Archive -LiteralPath ".\P0011-slice-5-functions-constants-GREEN.zip" -DestinationPath "." -Force
python -m unittest discover -s tests/python -p "test_p0011_functions_constants.py" -v
python -m unittest discover -s tests/python -p "test_p0012_*.py" -v
node --test
```

New pressure tests: 9 individual unittest methods. They can be run
independently. Preserve prior P0011 regression tests (29) and all P0012
(37) and JS (323) suites; user must confirm the full baseline.

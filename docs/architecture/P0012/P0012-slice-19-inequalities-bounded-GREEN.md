# P0012 Slice 19 — bounded real inequalities (GREEN)

**Scope:** Selected unary-variable real inequality solver. No new public Value shapes.

- Inputs: a P0005 RelationValue (`lt`, `le`, `gt`, `ge`) and a symbolic target, with `value` / `symbolic` roles.
- Output: bounded `SetValue(setKind="interval")` with public finite endpoint Values and `lowerClosed` / `upperClosed`, or `SetValue(setKind="empty")`.
- Excluded for now: unbounded intervals, unions of intervals, generic `ConditionSet` and non-interval solution sets. Return a structured `unsupported-operation` rather than a misleading result.
- Uses a disposable P0011 adapter with retained semantic identity; does not change P0011 or the frozen Value v1 contract.
- No document locale or Danish interval display formatting is persisted in the Value; Danish `]3; 48[`, `[4; 44[` are rendering choices for the UI and expression formatter.
- `tan(x)=x` is an *equality*, not an inequality; the current selected scalar solve handler was probed locally and returned `unsupported-operation` promptly. This is **not** a guaranteed timeout or resource limit for every expensive SymPy query; future execution safeguards should enforce resource budgets around user-initiated symbolic operations.

**Local tests:** 138/138 P0012 Python green (129 baseline + 9 new). No complete user repository or pinned Pyodide verification yet.

**Install and test:**

```powershell
Expand-Archive -LiteralPath ".\P0012-slice-19-inequalities-GREEN.zip" -DestinationPath "." -Force
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

**Next:** Design explicit public representation for infinite interval endpoints and finite unions of intervals (likely a bounded revision/addition to P0005, not a backdoor in the evaluator); test JSON roundtrip and canonical set semantics before broadening inequality solving.

# P0012 Slice 21 — explicit real/complex equation domain (GREEN)

**Scope:** selected single-equation `solve` handler; not a universal solve implementation.

## Contract decision

The evaluation request may provide `options: {"domain": "real"}` or
`options: {"domain": "complex"}`. For backward compatibility with the
existing P0012 solve tests, `{}` remains accepted as real. DocumentRuntime
must explicitly populate the selected domain when document option wiring
is implemented. The backend has **no persistent domain mode**.

- `solveset(lhs-rhs, variable, domain=...)` uses SymPy's real/complex domain.
- Finite solutions and EmptySet are emitted as public SetValues.
- Complex scalars use the existing P0011 exact constant `I` and arithmetic
  expression nodes, with semantic identities unchanged.
- An unsupported/infinite/conditional set still returns an explicit
  `unsupported-operation` failure; do not export backend internals.
- No complex inequalities are introduced.
- Unknown domain returns `unsupported-operation`; unknown options are treated
  as invalid internal request contracts (`ValueError`), consistent with the
  existing selected-handler restrictions. Error policy can be refined at a
  future input-adapter boundary.

## Local regression

The reconstructed P0012 suite passed **150/150** (previous 143 + seven
new tests). The 16 recent P0011 tests were run separately. Complete JS
suite and Windows checkout are not locally verified here.

## Run from repository root

```powershell
Expand-Archive -LiteralPath ".\P0012-slice-21-complex-solve-GREEN.zip" -DestinationPath "." -Force
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

Expected in current checkout: **331 JS, 150 P0012, 16 recent P0011**.

## Explicit deferred work

- Rich complex solution sets, domain restrictions of algebraic expressions,
  symbolic/parametric families, and execution timeout protection.
- The parser, UI and DocumentRuntime policy for default real domain.
- `solve` on multiple equations over complex domains.

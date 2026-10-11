# P0005 / P0012 Slice 20 — Unbounded intervals and set unions

**Status:** proposed compatible extension to Value v1, to be accepted after tests in the real repository. This note is an explicit contract addendum, **not a silent rewrite** of frozen architecture v1.0. Confirm the extension before marking it normative.

## Public transport shape

An interval remains `Value(kind="set",data={setKind:"interval",lower,upper,lowerClosed,upperClosed})`. Finite endpoints retain their existing `Value` representation. **Only inside interval endpoints**, infinity markers are `{ "bound": "negative-infinity" }` or `{ "bound": "positive-infinity" }`; these are boundary markers, **not numbers and not Values**. Negative infinity is permitted only as an open lower bound; positive infinity only as an open upper bound.

A union is `Value(kind="set",data={setKind:"union",sets:[SetValue,...]})`. The initial constructor requires at least two components and sorts them by encoded representation to ensure repeatable serialization, but does not mathematically normalize overlapping sets or deduplicate equal members. The evaluator uses the same public shape; neither raw SymPy objects nor strings are exported.

No special syntax is imposed by this change. Danish display may use `]-∞;-1] ∪ [1;∞[` and other locales may choose their own notation. UI formatting is not a property of SetValue.

## Solver scope

`scalar_inequalities.py` supports SymPy EmptySet, real intervals including unbounded intervals, S.Reals as an all-real interval, and finite unions of supported sets. Unsupported results still return a structured `unsupported-operation` failure. These representations do not imply support for ConditionSet, ImageSet, all symbolic/parametric inequalities, or general complex inequalities.

The existing `test_p0012_inequalities_red.py` has **two expectations deliberately updated**: cases previously required to fail (`x>3` and `x²≥4`) now require correct successful SetValues. This is behavioral progression, not weakening of an assertion. Five additional tests cover infinite bounds, unions and a monotonicity inequality.

## Verification

- Local reconstruction: P0012 **143/143** (138 prior + five additional; two former rejection tests updated).
- Local isolated Node set transport: **4/4**, including invalid infinity positions, serialization and order-independent union encoding.
- Full JS suite (previously 323) and original checkout P0011 must still be run by the user.

## Execute from repository root

```powershell
Expand-Archive -LiteralPath ".\P0012-slice-20-unbounded-sets-GREEN.zip" -DestinationPath "." -Force
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

Expected when no other test changes exist: **327 JS** (323 earlier + 4 new), **143 P0012**, **9 P0011 Slice 5**. The original consolidated P0011 29-test suite is separately available.

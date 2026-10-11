# P0012 Slice 15 — natural and base-10 logarithms (GREEN)

The **user-facing** spelling `ln(x)` denotes the natural logarithm;
`log(x)` and optionally `log10(x)` denote the base-ten logarithm.
This is a **language policy**, not a parser implementation in this slice.

The P0011 transport's existing `call(name="log", args=[...])` node **still means natural logarithm**; serialized Values are not reinterpreted.

Two preselected P0012 handlers are added in `scalar_logarithms.py`:
`evaluate_ln_request` (fixture evaluatorId `probe.scalar.ln`) and
`evaluate_log10_request` (fixture evaluatorId `probe.scalar.log10`).
They use the P0012 unary selected-spec contract, the P0011 adapter, and
explicitly reject unneeded angle settings.

For base ten, `sp.log(argument, 10)` is used (rather than independently dividing two SymPy logs), so exact results such as `log10(100)=2` and `log10(1000)=3` simplify as expected. A symbolic result may be represented in the current P0005 expression algebra as a quotient of natural logs; its semantics are exactly base-ten.

In this **real-scalar slice**, known real nonpositive arguments return
`undefined-result`. Fully symbolic arguments are not rejected merely because their eventual domain is unknown. Explicit nonreal numerical arguments are rejected with `type-mismatch`; full complex logarithms, branch conventions and general domain analysis are **deferred**. This is a narrow initial domain contract, not a universal error policy for all future operations.

**Local P0012 test:** 95/95 (80 prior + 15 new). No existing adapter or handler was changed. The 9 recent P0011 tests and JS tests should be rerun on the user's checkout.

Commands (JavaScript first, as requested):

```powershell
Expand-Archive -LiteralPath ".\P0012-slice-15-logarithms-GREEN.zip" -DestinationPath "." -Force
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

**Next architecture pressure:** `diff(expression, target_symbol)` with a `symbolic` target role. Unlike these unary value functions, it must not be shoehorned into the generic unary helper. Preserve P0006 semantic identities with same spelling across distinct scopes.

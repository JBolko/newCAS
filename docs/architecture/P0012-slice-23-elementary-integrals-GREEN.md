# P0012 Slice 23 — elementary function integrals (GREEN)

**Scope:** seven new integration regression tests, no production modifications.

Tests cover indefinite `sin(x)`, `cos(x)`, `exp(x)` and natural `log(x)`;
exact definite integrals of sine over `[0, pi]` and exp over `[0,1]`;
and non-conflation of two identically spelled but semantically distinct symbols.
The integration handler continues to produce **one representative primitive**,
not an explicit family with a newly generated arbitrary constant.

`log` in the internal P0011 call vocabulary denotes **natural log**; user-facing
`log` remains agreed to mean base 10, subject to separate parser mapping.

Locally verified: 18/18 Python tests (11 existing Slice 22 + 7 new) on the
isolated Slice-22 handler and current P0011 adapter. Full repository tests
have **not** been run here; user should run them after installation.

```powershell
Expand-Archive -LiteralPath ".\P0012-slice-23-elementary-integrals-GREEN.zip" -DestinationPath "." -Force
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

Expected unchanged baselines: 331 JS, **168 P0012**, 16 recent P0011.

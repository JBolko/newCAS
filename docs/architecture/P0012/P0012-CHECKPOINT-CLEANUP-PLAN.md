# P0012 checkpoint housekeeping — safe procedure

**Date:** 2026-10-11. **Status:** proposed housekeeping (P0012 remains IN PROGRESS).

The user has verified 331 Node, 161 P0012 Python, and 16 newer P0011 Python tests (508 tests in those runs). The older consolidated P0011 29-test suite is separate and should be re-run before the eventual commit. The run does not certify complete repository or Pyodide integration.

1. Use `tools/maintenance/p0012_checkpoint_cleanup.ps1` from the repository root. **Without `-Apply` it only previews.** With `-Apply` it moves root-level `P0005-`, `P0011-`, and `P0012-` delivery ZIPs outside the repository to sibling `newCAS-delivery-archives/`. It never overwrites a collision and does not touch tracked source, Python/JS tests or docs. A ZIP accidentally under `docs/architecture/` is only flagged for review.
2. Keep the architecture checkpoint `docs/architecture/P0012-ARCHITECTURE-CHECKPOINT-2026-10-11.md` and the P0005 accepted contract addendum. Keep other slice notes until a *separate, reviewed* documentation-consolidation pass; don't bulk-delete historical decisions.
3. Keep all regression tests, even those named `_red.py`: they are now positive regression tests. Rename/consolidate only with test-by-test assertion preservation and a before/after test-count check.
4. Run `node --test`, `python -m unittest discover -s tests/python -p 'test_p0012_*.py' -q`, `python -m unittest discover -s tests/python -p 'test_p0011_*.py' -q`, and independently run the prior consolidated P0011 suite (`test_sympy_value_adapter.py`) if present. Recheck the pinned Pyodide environment before release claims.
5. Review `git status --short` and `git diff --check` and verify the staged diff with `git diff --cached --stat` before committing. **Do not use `git add .` blindly**, and do not commit generated ZIPs/logs.

## Explicit P0017 requirement recorded for later

Include bounded multi-component nonlinear regression models such as a two-exponential radioactive-decay mixture with background `A1*exp(-lambda1*t)+A2*exp(-lambda2*t)+B`, and sums of Gaussian spectral peaks. Investigate SciPy (`least_squares`/`curve_fit`) and NumPy for numerical solvers, parameter bounds, initial guesses, fit uncertainty and Poisson-count weighting. SymPy remains the symbolic expression backend; numerical fitting backend choice depends on Pyodide/offline support and conditioning tests. No implementation is claimed here.

## Next mathematical work

Test non-polynomial indefinite and definite integrals; decide how to represent an unevaluated Integral, a primitive family with `+C`, and singular or improper definite integrals before treating integration as generally complete. Later `tangentline`, `arclength`, `surfacearea`, numerical roots and differential equations remain planned, not delivered by this checkpoint.

# P0021 Slice 18 — angle regression test maintenance

The prior Slice 16 test had a hard-coded count of 12 imported Python modules. Slice 18 legitimately adds `scalar_power.py`, `scalar_exponential.py`, and `scalar_logarithms.py` (15 total). Instead of changing `12` to `15`, assert the exact approved module-path set to catch unexpected additions and removals. No production changes. The test also continues to verify explicit angle settings and non-dispatch for missing angle settings.

Local isolated verification: `node --test tests/js/p0021-selected-angle-unit.test.mjs` — 8/8 against the Slice 18 runtime. Run the whole `node --test` suite in the actual checkout.

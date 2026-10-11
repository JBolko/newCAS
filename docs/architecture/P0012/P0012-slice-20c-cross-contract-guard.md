# P0012 Slice 20c — P0005 / P0011 cross-contract regression guard

**Scope:** Tests only. No production changes. Built against the *20b corrected* `src/js/values/value.js`.

Why: Slice 20 initially overwrote P0011's numeric validation when changing the central P0005 `SetValue` validator. Keep a permanent regression guard that checks both extensions together.

The four new tests cover: (1) union of unbounded intervals and an `approx` with `precisionBits` both roundtrip; (2) malformed decimal strings remain rejected; (3) infinity interval markers are not numeric approximations; (4) old approximate values without `precisionBits` stay valid.

**Local:** 4 new tests + prior 19 existing P0011 numeric / P0012 unbounded set tests = 23/23 GREEN in the reconstructed JS workspace. This is *not* a claim that the full repository has passed.

**Install:** extract into repository root; no overwrites of production files.

```powershell
Expand-Archive -LiteralPath ".\P0012-slice-20c-cross-contract-guard.zip" -DestinationPath "." -Force
node --test
python -m unittest discover -s tests/python -p "test_p0012_*.py" -q
python -m unittest discover -s tests/python -p "test_p0011_*.py" -q
```

Expected full JavaScript count: 331 (327 from Slice 20 plus 4 here), provided Slice 20b is installed and there are no other test additions. Expected Python counts remain 143 and 9 respectively.

Before adding complex scalar Values, review the full P0005 documents and additive decisions including the numeric transport amendment; do not overwrite the validator with an older snapshot.

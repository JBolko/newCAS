# P0012 Slice 20d: restore Value validator and check active file

This is a packaging/installation verification of Slice 20b, not a new contract.
The supplied `value.js` is byte-for-byte the same as Slice 20b; SHA256:
`2d541390c5dd0f9d1bdec81f53d45b6272fdd7277e4976b1544868d18b3b5b49`.

The user reported 7 JS failures indicating the Slice 20 `approx` validator
(still missing precisionBits and full finite numeric grammar) remained active.
This ZIP overwrites that file and supplies a PowerShell file-integrity and
regression verification script. All 23 relevant JS tests in the local
reproduction (P0011 precision, P0012 union and cross-contract) pass.

Run from repository root:

```powershell
Expand-Archive -LiteralPath '.\P0012-slice-20d-value-validation-restore.zip' -DestinationPath '.' -Force
& '.\tools/maintenance/verify_p0012_slice20d.ps1'
```

Do not treat the local 23-test subset as proof that the entire 331-test suite
passed on the user's checkout. No Python production code or test assertions are altered.

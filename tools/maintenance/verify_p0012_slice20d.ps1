# P0012 slice 20d - run from newCAS repository root
$ErrorActionPreference = 'Stop'
$target = Join-Path (Get-Location) 'src/js/values/value.js'
if (!(Test-Path -LiteralPath $target)) { throw "Cannot find $target; run from repository root." }
$actual = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
$expected = '2d541390c5dd0f9d1bdec81f53d45b6272fdd7277e4976b1544868d18b3b5b49'
if ($actual -ne $expected) {
  throw "value.js does not match the verified package. Expected $expected, found $actual"
}
Write-Host 'Value validation file: VERIFIED (P0011 precision + P0005 sets)'
Write-Host 'Running JavaScript tests first:'
node --test
if ($LASTEXITCODE -ne 0) { throw 'JavaScript tests failed' }
Write-Host 'Running P0012 Python tests:'
python -m unittest discover -s tests/python -p 'test_p0012_*.py' -q
if ($LASTEXITCODE -ne 0) { throw 'P0012 tests failed' }
Write-Host 'Running P0011 Slice tests:'
python -m unittest discover -s tests/python -p 'test_p0011_*.py' -q
if ($LASTEXITCODE -ne 0) { throw 'P0011 tests failed' }

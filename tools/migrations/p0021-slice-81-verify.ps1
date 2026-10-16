# Run from project root after the Slice 81 retirement script.
$ErrorActionPreference = 'Stop'
Write-Host 'JavaScript complete suite:'
node --test
if ($LASTEXITCODE -ne 0) { throw 'JavaScript tests failed' }
Write-Host 'Python complete unittest suite:'
if (-not (Test-Path -LiteralPath tests/python -PathType Container)) { throw 'Missing Python test directory tests/python' }
python -m unittest discover -s tests/python -p 'test_*.py' -v
if ($LASTEXITCODE -ne 0) { throw 'Python tests failed' }
Write-Host 'JavaScript and Python suites passed.'

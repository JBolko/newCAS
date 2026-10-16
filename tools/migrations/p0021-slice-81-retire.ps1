# P0021 Slice 81 — run from repository root AFTER extracting the archive.
# Retire only two unused historical adapters and their direct API tests.
$ErrorActionPreference = 'Stop'
$required = @(
  'src/js/semantics/create-runtime-function-batch-evaluator.js',
  'src/js/semantics/create-attested-ir-task-evaluator.js',
  'src/js/semantics/create-bound-function-task-evaluator.js',
  'tests/browser/p0021-function-worker-smoke.mjs',
  'tests/js/p0021-runtime-ir-batch-migration.test.mjs'
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { throw "Slice 81 prerequisite missing: $path" }
}
$batch = Get-Content -LiteralPath $required[0] -Raw
if ($batch -notmatch 'createAttestedIRTaskEvaluator' -or $batch -match 'createSource(?:Literal|Variable)FunctionTaskEvaluator') {
  throw 'Slice 81 requires the active IR batch without retired adapters'
}
$paths = @(
  'src/js/semantics/create-source-literal-function-task-evaluator.js',
  'src/js/semantics/create-source-variable-function-task-evaluator.js',
  'tests/js/p0021-positional-function-evaluation.test.mjs',
  'tests/js/p0021-source-variable-function-task.test.mjs'
)
# Refuse to retire if unknown source/test consumers still import the modules.
$remaining = Get-ChildItem -LiteralPath src,tests -File -Recurse -Include *.js,*.mjs,*.cjs |
  Where-Object { ($paths -notcontains ($_.FullName.Substring((Get-Location).Path.Length+1).Replace('\','/'))) }
foreach ($file in $remaining) {
  $body = Get-Content -LiteralPath $file.FullName -Raw
  if ($body -match '(?:import|export)\s[^;\r\n]*from\s*["''][^"'']*(?:create-source-literal-function-task-evaluator|create-source-variable-function-task-evaluator)\.js["'']') {
    throw "Unmigrated import in $($file.FullName)"
  }
}
foreach ($path in $paths) {
  if (Test-Path -LiteralPath $path -PathType Leaf) { Remove-Item -LiteralPath $path; Write-Host "Retired: $path" }
  else { Write-Host "Already retired: $path" }
}
Write-Host 'Slice 81 retirement complete; run JS and Python regression before commit.'

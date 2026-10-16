# P0021 Slice 80 — run from repository root after extracting slice archive.
# Intentionally explicit: ZIP extraction does not delete tracked old source files.
$ErrorActionPreference = 'Stop'
$files = @(
  'src/js/semantics/create-source-integer-assignment-task-evaluator.js',
  'src/js/semantics/create-source-expression-task-evaluator.js',
  'src/js/semantics/create-source-composed-expression-task-evaluator.js'
)
$required = @(
  'src/js/semantics/create-runtime-function-batch-evaluator.js',
  'src/js/semantics/create-attested-ir-task-evaluator.js',
  'src/js/semantics/evaluate-attested-document-ir.js'
)
foreach ($path in $required) {
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
    throw "Abort Slice 80: active IR prerequisite missing: $path"
  }
}
foreach ($path in $files) {
  if (Test-Path -LiteralPath $path -PathType Leaf) {
    Remove-Item -LiteralPath $path
    Write-Host "Retired: $path"
  } else {
    Write-Host "Already retired: $path"
  }
}

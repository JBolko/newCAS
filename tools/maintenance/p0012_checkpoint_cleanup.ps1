# Safe P0012 checkpoint: preview by default. -Apply moves delivery ZIPs only.
param([switch]$Apply)
$ErrorActionPreference = 'Stop'
$repo = (Get-Location).Path
if (-not (Test-Path (Join-Path $repo '.git'))) { throw 'Run from the newCAS repository root.' }
$archive = Join-Path (Split-Path $repo -Parent) 'newCAS-delivery-archives'
$packages = @(Get-ChildItem -LiteralPath $repo -File | Where-Object { $_.Name -match '^P00(05|11|12)-.*\.zip$' })
Write-Host "Repository: $repo"
Write-Host "Archive destination (outside repo): $archive"
Write-Host "ZIP packages in repo root: $($packages.Count)"
foreach ($file in $packages) { Write-Host "MOVE: $($file.Name)" }
$nested = @(Get-ChildItem -LiteralPath (Join-Path $repo 'docs/architecture') -File -Filter '*.zip' -ErrorAction SilentlyContinue)
foreach ($file in $nested) { Write-Warning "ZIP INSIDE docs/architecture; review manually: $($file.FullName)" }
if (-not $Apply) {
  Write-Host 'PREVIEW ONLY. Re-run with -Apply to move root-level ZIPs.'
  exit 0
}
New-Item -ItemType Directory -Path $archive -Force | Out-Null
foreach ($file in $packages) {
  $dest = Join-Path $archive $file.Name
  if (Test-Path -LiteralPath $dest) {
    Write-Warning "Skip collision (not overwritten): $dest"
    continue
  }
  Move-Item -LiteralPath $file.FullName -Destination $dest
}
Write-Host 'Done. No production code, tests, or Markdown documents were changed.'
Write-Host 'Check: git status --short'

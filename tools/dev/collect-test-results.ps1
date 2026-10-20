# Capture complete test output in tools/reports, package it as a ZIP, and print only a short status.
# Developer-only tool. No application sources or existing reports are modified.
param(
    [string]$Label = 'S96a-RED',
    [string]$Executable = 'node',
    [string[]]$Arguments = @('--test', '.\tests\js\p0021-slice-96a-mutation-atomicity-red.test.mjs')
)

$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'package.json'))) {
    throw 'Run from an installed newCAS repository: package.json not found two levels above this script.'
}
if ($Label -notmatch '^[A-Za-z0-9_-]+$') {
    throw 'Label must contain only letters, digits, underscore or hyphen.'
}
if ($Arguments.Count -eq 0) {
    throw 'At least one argument is required.'
}

$reports = Join-Path $repoRoot 'tools\reports'
if (-not (Test-Path -LiteralPath $reports)) {
    New-Item -ItemType Directory -Path $reports -Force | Out-Null
}
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
$runName = '{0}_{1}' -f $Label, $stamp
$runDir = Join-Path $reports $runName
$zipPath = Join-Path $reports ($runName + '.zip')
New-Item -ItemType Directory -Path $runDir -Force | Out-Null

$stdout = Join-Path $runDir 'test-stdout.txt'
$stderr = Join-Path $runDir 'test-stderr.txt'
$meta = Join-Path $runDir 'manifest.txt'

Push-Location $repoRoot
try {
    $nodeVersion = (& node --version 2>&1 | Out-String).Trim()
    $gitHead = (& git rev-parse --short HEAD 2>&1 | Out-String).Trim()
    $gitBranch = (& git branch --show-current 2>&1 | Out-String).Trim()
    $gitStatus = (& git status --short 2>&1 | Out-String).TrimEnd()

    $commandLine = $Executable + ' ' + ($Arguments -join ' ')
    Write-Host ('Running: ' + $commandLine)
    Write-Host 'Full output is redirected to report files.'

    # A RED suite is expected to exit non-zero. Keep collecting even on
    # Windows PowerShell stderr records or newer PowerShell native-command errors.
    $previousErrorAction = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $PSNativeCommandUseErrorActionPreference = $false
    try {
        & $Executable @Arguments 1> $stdout 2> $stderr
        $testExit = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorAction
    }
    if ($null -eq $testExit) { $testExit = -1 }

    $lines = @(
        ('Captured: ' + (Get-Date -Format 'o')),
        ('Label: ' + $Label),
        ('Command: ' + $commandLine),
        ('Exit code: ' + $testExit),
        ('Node version: ' + $nodeVersion),
        ('Git branch: ' + $gitBranch),
        ('Git HEAD: ' + $gitHead),
        'Git status --short:',
        $gitStatus
    )
    $lines | Out-File -LiteralPath $meta -Encoding utf8

    # Contents of runDir only, not the repository, go in the ZIP.
    Compress-Archive -Path (Join-Path $runDir '*') -DestinationPath $zipPath -CompressionLevel Optimal -Force
    Write-Host ('TEST EXIT CODE: ' + $testExit)
    if ($testExit -ne 0) {
        Write-Host 'Non-zero test exit code captured (normal for a RED contract test).'
    }
    Write-Host ('REPORT ZIP: ' + $zipPath)
    Write-Host ('Raw logs retained: ' + $runDir)
    Write-Host 'Send only the ZIP. Do not commit developer reports or ship them in the student release.'
}
finally {
    Pop-Location
}

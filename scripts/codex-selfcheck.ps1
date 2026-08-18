param(
    [string]$ScriptsPath = "scripts"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = (& git rev-parse --show-toplevel 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $repoRoot) {
    throw "Run this script inside the ERP Git repository."
}
$repoRoot = $repoRoot.Trim()
$fullScriptsPath = Join-Path $repoRoot $ScriptsPath
if (-not (Test-Path $fullScriptsPath)) {
    throw "Scripts directory not found: $fullScriptsPath"
}

Write-Host "PowerShell version: $($PSVersionTable.PSVersion)"
Write-Host "Repository:         $repoRoot"
Write-Host "Scripts:            $fullScriptsPath"
Write-Host ""

$failed = $false
$files = Get-ChildItem -Path $fullScriptsPath -Filter "*.ps1" -File | Sort-Object Name
foreach ($file in $files) {
    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile(
        $file.FullName,
        [ref]$tokens,
        [ref]$errors
    )

    if ($errors.Count -gt 0) {
        $failed = $true
        Write-Host "[FAIL] $($file.Name)" -ForegroundColor Red
        foreach ($errorItem in $errors) {
            Write-Host ("       line {0}, column {1}: {2}" -f `
                $errorItem.Extent.StartLineNumber,
                $errorItem.Extent.StartColumnNumber,
                $errorItem.Message) -ForegroundColor Red
        }
    }
    else {
        Write-Host "[ OK ] $($file.Name)" -ForegroundColor Green
    }
}

Write-Host ""
foreach ($commandName in @("git", "codex", "npm.cmd")) {
    if (Get-Command $commandName -ErrorAction SilentlyContinue) {
        Write-Host "[ OK ] command: $commandName" -ForegroundColor Green
    }
    else {
        $failed = $true
        Write-Host "[FAIL] command not found: $commandName" -ForegroundColor Red
    }
}

$catalog = Join-Path $repoRoot "docs/codex/tasks.json"
if (Test-Path $catalog) {
    try {
        $null = Get-Content -Raw -Encoding UTF8 $catalog | ConvertFrom-Json
        Write-Host "[ OK ] task catalog: docs/codex/tasks.json" -ForegroundColor Green
    }
    catch {
        $failed = $true
        Write-Host "[FAIL] invalid task catalog: $($_.Exception.Message)" -ForegroundColor Red
    }
}
else {
    $failed = $true
    Write-Host "[FAIL] task catalog not found: docs/codex/tasks.json" -ForegroundColor Red
}

Write-Host ""
if ($failed) {
    Write-Host "SELF-CHECK FAILED. Do not run the orchestrator yet." -ForegroundColor Red
    exit 1
}

Write-Host "SELF-CHECK PASSED." -ForegroundColor Green
exit 0

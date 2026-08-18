param(
    [switch]$SkipSelfCheck
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Get-RepoRoot {
    $root = (& git rev-parse --show-toplevel 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $root) {
        throw "Execute este patch dentro do repositorio do ERP."
    }
    return $root
}

function Replace-Exact {
    param(
        [string]$Path,
        [string]$Old,
        [string]$New,
        [string]$Label
    )

    $content = Get-Content -Raw -Encoding UTF8 $Path

    if ($content.Contains($New)) {
        Write-Host "[ OK ] $Label ja aplicado." -ForegroundColor DarkGreen
        return $false
    }

    if (-not $content.Contains($Old)) {
        throw "Nao encontrei o trecho esperado para '$Label' em $Path. Patch interrompido sem sobrescrever esse arquivo."
    }

    $updated = $content.Replace($Old, $New)
    Set-Content -Path $Path -Value $updated -Encoding UTF8
    Write-Host "[ OK ] $Label aplicado." -ForegroundColor Green
    return $true
}

$repoRoot = Get-RepoRoot
$commonPath = Join-Path $repoRoot "scripts\codex-common.ps1"
$workerPath = Join-Path $repoRoot "scripts\codex-worker.ps1"

if (-not (Test-Path $commonPath)) { throw "Arquivo nao encontrado: $commonPath" }
if (-not (Test-Path $workerPath)) { throw "Arquivo nao encontrado: $workerPath" }

$commonBackup = "$commonPath.v6.bak"
$workerBackup = "$workerPath.v6.bak"

if (-not (Test-Path $commonBackup)) { Copy-Item $commonPath $commonBackup }
if (-not (Test-Path $workerBackup)) { Copy-Item $workerPath $workerBackup }

Write-Host "Repo: $repoRoot" -ForegroundColor Cyan
Write-Host "Aplicando patch PowerShell 5.1 / npm / worktrees..." -ForegroundColor Cyan
Write-Host ""

# 1) Add dependency preparation helper after Get-NpmCommand.
$oldNpmHelper = @'
function Get-NpmCommand {
    if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { return "npm.cmd" }
    if (Get-Command npm -ErrorAction SilentlyContinue) { return "npm" }
    throw "npm nao encontrado no PATH."
}
'@

$newNpmHelper = @'
function Get-NpmCommand {
    if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { return "npm.cmd" }
    if (Get-Command npm -ErrorAction SilentlyContinue) { return "npm" }
    throw "npm nao encontrado no PATH."
}

function Ensure-NodeDependencies {
    param([string]$WorktreePath)

    $tscCmd = Join-Path $WorktreePath "node_modules\.bin\tsc.cmd"
    $tscUnix = Join-Path $WorktreePath "node_modules\.bin\tsc"

    if ((Test-Path $tscCmd) -or (Test-Path $tscUnix)) {
        return
    }

    $npm = Get-NpmCommand
    $npmPath = Get-NativeCommandPath -CommandName $npm

    Write-Host "Dependencias ausentes na worktree. Executando npm ci..." -ForegroundColor DarkCyan

    $result = Invoke-NativeConsoleProcess `
        -FileName $npmPath `
        -Arguments @("ci", "--prefer-offline", "--no-audit", "--no-fund") `
        -WorkingDirectory $WorktreePath

    if ($result -ne 0) {
        throw "npm ci falhou na worktree '$WorktreePath' com exit code $result."
    }

    if (-not ((Test-Path $tscCmd) -or (Test-Path $tscUnix))) {
        throw "npm ci terminou sem disponibilizar node_modules/.bin/tsc na worktree."
    }
}
'@

[void](Replace-Exact -Path $commonPath -Old $oldNpmHelper -New $newNpmHelper -Label "Ensure-NodeDependencies")

# 2) Run db:migrate through System.Diagnostics.Process instead of PowerShell native stderr piping.
$oldMigrate = @'
    Write-Host "Test DB: aplicando migrations..." -ForegroundColor DarkCyan
    $npm = Get-NpmCommand
    Push-Location $WorktreePath
    try {
        & $npm run db:migrate
        if ($LASTEXITCODE -ne 0) { throw "db:migrate falhou no banco de teste." }
    }
    finally { Pop-Location }
'@

$newMigrate = @'
    Write-Host "Test DB: aplicando migrations..." -ForegroundColor DarkCyan
    $npm = Get-NpmCommand
    $npmPath = Get-NativeCommandPath -CommandName $npm
    $migrateResult = Invoke-NativeCaptureProcess `
        -FileName $npmPath `
        -Arguments @("run", "db:migrate") `
        -WorkingDirectory $WorktreePath

    if ($migrateResult.StdOut) { Write-Host $migrateResult.StdOut }
    if ($migrateResult.StdErr) { Write-Host $migrateResult.StdErr }

    if ($migrateResult.ExitCode -ne 0) {
        throw "db:migrate falhou no banco de teste com exit code $($migrateResult.ExitCode)."
    }
'@

[void](Replace-Exact -Path $commonPath -Old $oldMigrate -New $newMigrate -Label "db:migrate via Process")

# 3) Resolve npm executable once inside Invoke-TaskGates.
$oldGateHeader = @'
    $npm = Get-NpmCommand
    $lines = New-Object System.Collections.Generic.List[string]
'@

$newGateHeader = @'
    $npm = Get-NpmCommand
    $npmPath = Get-NativeCommandPath -CommandName $npm
    $lines = New-Object System.Collections.Generic.List[string]
'@

[void](Replace-Exact -Path $commonPath -Old $oldGateHeader -New $newGateHeader -Label "npm nativo nos gates")

# 4) Replace npm gate invocation with Process capture.
$oldGateRun = @'
            $lines.Add("# npm run $gate")
            $out = (& $npm run $gate 2>&1 | Out-String)
            $lines.Add($out)
            if ($LASTEXITCODE -ne 0) { $ok = $false }
'@

$newGateRun = @'
            $lines.Add("# npm run $gate")
            $result = Invoke-NativeCaptureProcess `
                -FileName $npmPath `
                -Arguments @("run", $gate) `
                -WorkingDirectory $WorktreePath

            if ($result.StdOut) { $lines.Add($result.StdOut) }
            if ($result.StdErr) { $lines.Add($result.StdErr) }
            if ($result.ExitCode -ne 0) { $ok = $false }
'@

[void](Replace-Exact -Path $commonPath -Old $oldGateRun -New $newGateRun -Label "npm gates via Process")

# 5) Prepare dependencies after the worktree is created/reused and refreshed.
$oldWorkerRefreshEnd = @'
if (-not $resumeExisting) {
    $integrationIsAncestor = Test-GitAncestor -RepoRoot $repoRoot -Ancestor $IntegrationBranch -Descendant $branch
    if (-not $integrationIsAncestor) {
        Write-Host "[$Task] Branch limpa e nao iniciada esta desatualizada; reposicionando em $IntegrationBranch..." -ForegroundColor Yellow
        Push-Location $worktree
        try {
            & git reset --hard $IntegrationBranch
            if ($LASTEXITCODE -ne 0) { throw "Falha ao atualizar branch $branch para $IntegrationBranch." }
        }
        finally { Pop-Location }
    }
}

$runDir = Join-Path $repoRoot ".codex-orchestrator/workers/$($Task.ToLowerInvariant())"
'@

$newWorkerRefreshEnd = @'
if (-not $resumeExisting) {
    $integrationIsAncestor = Test-GitAncestor -RepoRoot $repoRoot -Ancestor $IntegrationBranch -Descendant $branch
    if (-not $integrationIsAncestor) {
        Write-Host "[$Task] Branch limpa e nao iniciada esta desatualizada; reposicionando em $IntegrationBranch..." -ForegroundColor Yellow
        Push-Location $worktree
        try {
            & git reset --hard $IntegrationBranch
            if ($LASTEXITCODE -ne 0) { throw "Falha ao atualizar branch $branch para $IntegrationBranch." }
        }
        finally { Pop-Location }
    }
}

Ensure-NodeDependencies -WorktreePath $worktree

$runDir = Join-Path $repoRoot ".codex-orchestrator/workers/$($Task.ToLowerInvariant())"
'@

[void](Replace-Exact -Path $workerPath -Old $oldWorkerRefreshEnd -New $newWorkerRefreshEnd -Label "npm ci automatico ao preparar worktree")

# 6) Defensive check before every gate attempt.
$oldGateLoop = @'
    for ($attempt = 0; $attempt -le $MaxAttempts; $attempt++) {
        Write-Host "[$Task] Gates (tentativa $($attempt + 1))..."
        $ok = Invoke-TaskGates -WorktreePath $worktree -Gates @($taskDef.gates) -LogPath $gateLog -BaseRef $IntegrationBranch
'@

$newGateLoop = @'
    for ($attempt = 0; $attempt -le $MaxAttempts; $attempt++) {
        Write-Host "[$Task] Gates (tentativa $($attempt + 1))..."
        Ensure-NodeDependencies -WorktreePath $worktree
        $ok = Invoke-TaskGates -WorktreePath $worktree -Gates @($taskDef.gates) -LogPath $gateLog -BaseRef $IntegrationBranch
'@

[void](Replace-Exact -Path $workerPath -Old $oldGateLoop -New $newGateLoop -Label "dependency check antes dos gates")

# Optional cleanup of the earlier remediation assertion bug, only if that script still contains it.
$remediationPath = Join-Path $repoRoot "scripts\codex-remediate-integration-review.ps1"
if (Test-Path $remediationPath) {
    $remediationContent = Get-Content -Raw -Encoding UTF8 $remediationPath
    $changedRemediation = $false

    if ($remediationContent.Contains('$migratorRole|f|t')) {
        $remediationContent = $remediationContent.Replace('$migratorRole|f|t', '$migratorRole|false|true')
        $changedRemediation = $true
    }
    if ($remediationContent.Contains('$appRole|f|f')) {
        $remediationContent = $remediationContent.Replace('$appRole|f|f', '$appRole|false|false')
        $changedRemediation = $true
    }

    if ($changedRemediation) {
        Set-Content -Path $remediationPath -Value $remediationContent -Encoding UTF8
        Write-Host "[ OK ] assertion false/true do script de remediacao corrigido." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Verificando padroes perigosos restantes..." -ForegroundColor Cyan

$remaining = Select-String `
    -Path $commonPath `
    -Pattern '& \$npm run|& npm\.cmd .*2>&1' `
    -ErrorAction SilentlyContinue

if ($remaining) {
    Write-Warning "Ainda existem chamadas npm nativas diretas em codex-common.ps1:"
    $remaining | ForEach-Object { Write-Host $_.Line }
}
else {
    Write-Host "[ OK ] Nenhuma chamada '& `$npm run' restante em codex-common.ps1." -ForegroundColor Green
}

Push-Location $repoRoot
try {
    & git diff --check
    if ($LASTEXITCODE -ne 0) {
        throw "git diff --check falhou depois do patch."
    }
}
finally {
    Pop-Location
}

if (-not $SkipSelfCheck) {
    $selfCheck = Join-Path $repoRoot "scripts\codex-selfcheck.ps1"
    if (Test-Path $selfCheck) {
        & $selfCheck
        if ($LASTEXITCODE -ne 0) {
            throw "codex-selfcheck.ps1 falhou apos o patch."
        }
    }
}

Write-Host ""
Write-Host "PATCH V6 APLICADO." -ForegroundColor Green
Write-Host ""
Write-Host "Arquivos alterados:"
Write-Host "  scripts\codex-common.ps1"
Write-Host "  scripts\codex-worker.ps1"
if (Test-Path $remediationPath) {
    Write-Host "  scripts\codex-remediate-integration-review.ps1 (somente se assertion antiga existia)"
}
Write-Host ""
Write-Host "Backups:"
Write-Host "  $commonBackup"
Write-Host "  $workerBackup"
Write-Host ""
Write-Host "Agora rode:"
Write-Host "  .\scripts\codex-orchestrator.ps1 -MaxTasks 1 -Push"

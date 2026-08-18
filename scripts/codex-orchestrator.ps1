param(
    [string]$IntegrationBranch = "feature/codex-integration",
    [string]$BaseBranch = "development",
    [string]$CatalogPath = "docs/codex/tasks.json",
    [string]$Model = "",
    [int]$MaxTasks = 0,
    [int]$MaxFixAttempts = 2,
    [switch]$Push,
    [switch]$ContinueOnFailure,
    [switch]$SkipAutomatedReview,
    [switch]$NoSyncDevelopment
)

$commonScript = Join-Path $PSScriptRoot "codex-common.ps1"
. $commonScript
$repoRoot = Get-ErpRepoRoot
Set-Location $repoRoot
Ensure-LocalExclude -RepoRoot $repoRoot
Assert-GitClean -Path $repoRoot

$catalog = Get-TaskCatalog -RepoRoot $repoRoot -CatalogPath $CatalogPath
if ($catalog.baseBranch) { $BaseBranch = [string]$catalog.baseBranch }
if ($catalog.integrationBranch -and $IntegrationBranch -eq "feature/codex-integration") { $IntegrationBranch = [string]$catalog.integrationBranch }

Write-Host "Base:        $BaseBranch"
Write-Host "Integracao:  $IntegrationBranch"
Write-Host "Catalogo:    $CatalogPath"
Write-Host ""

# Atualiza referencias antes de manipular branches.
& git fetch --prune origin
if ($LASTEXITCODE -ne 0) { throw "git fetch origin falhou." }

# Garante base local atualizada por fast-forward.
if (-not (Test-GitRef -RepoRoot $repoRoot -Ref "refs/heads/$BaseBranch")) {
    if (Test-GitRef -RepoRoot $repoRoot -Ref "refs/remotes/origin/$BaseBranch") {
        Invoke-GitChecked -Path $repoRoot checkout -b $BaseBranch --track "origin/$BaseBranch"
    } else { throw "Branch base '$BaseBranch' nao existe local nem em origin." }
} else {
    Invoke-GitChecked -Path $repoRoot checkout $BaseBranch
}
if (Test-GitRef -RepoRoot $repoRoot -Ref "refs/remotes/origin/$BaseBranch") {
    Invoke-GitChecked -Path $repoRoot pull --ff-only origin $BaseBranch
}
Assert-GitClean -Path $repoRoot

# Cria ou recupera a branch integradora. Nunca reseta se ja existir.
if (Test-GitRef -RepoRoot $repoRoot -Ref "refs/heads/$IntegrationBranch") {
    Invoke-GitChecked -Path $repoRoot checkout $IntegrationBranch
}
elseif (Test-GitRef -RepoRoot $repoRoot -Ref "refs/remotes/origin/$IntegrationBranch") {
    Invoke-GitChecked -Path $repoRoot checkout -b $IntegrationBranch --track "origin/$IntegrationBranch"
}
else {
    Invoke-GitChecked -Path $repoRoot checkout -b $IntegrationBranch $BaseBranch
    if ($Push) { Invoke-GitChecked -Path $repoRoot push -u origin $IntegrationBranch }
}

# Absorve mudancas novas da development sem nunca fazer o caminho inverso.
if (-not $NoSyncDevelopment) {
    if (-not (Test-GitAncestor -RepoRoot $repoRoot -Ancestor $BaseBranch -Descendant $IntegrationBranch)) {
        Write-Host "Integrando mudancas novas de $BaseBranch em $IntegrationBranch..." -ForegroundColor Yellow
        Push-Location $repoRoot
        try {
            & git merge --no-edit $BaseBranch
            if ($LASTEXITCODE -ne 0) {
                Write-Error "Conflito ao atualizar $IntegrationBranch com $BaseBranch. Resolva manualmente; nenhum merge em development foi feito."
                exit 31
            }
        }
        finally { Pop-Location }
    }
}
Assert-GitClean -Path $repoRoot

# Tasks ja aplicadas antes do orquestrador podem ter branches proprias; absorva-as se encontradas.
foreach ($seed in ($catalog.tasks | Where-Object { $_.seeded })) {
    $mergedCandidate = $false
    foreach ($candidate in @($seed.candidateBranches)) {
        $ref = $null
        if (Test-GitRef -RepoRoot $repoRoot -Ref "refs/heads/$candidate") { $ref = $candidate }
        elseif (Test-GitRef -RepoRoot $repoRoot -Ref "refs/remotes/origin/$candidate") { $ref = "origin/$candidate" }
        if (-not $ref) { continue }
        $mergedCandidate = $true
        if (-not (Test-GitAncestor -RepoRoot $repoRoot -Ancestor $ref -Descendant $IntegrationBranch)) {
            Write-Host "Absorvendo task seed $($seed.id) de $ref..." -ForegroundColor Yellow
            Push-Location $repoRoot
            try {
                & git merge --no-ff $ref -m "merge(codex): import $($seed.id)"
                if ($LASTEXITCODE -ne 0) {
                    Write-Error "Conflito ao importar $($seed.id) de $ref. Resolva manualmente e rode novamente."
                    exit 32
                }
            }
            finally { Pop-Location }
        }
        break
    }
    if (-not $mergedCandidate) {
        Write-Host "Seed $($seed.id): nenhuma candidate branch encontrada; assumindo que ja esta contida em $BaseBranch/$IntegrationBranch." -ForegroundColor DarkYellow
    }
}
Assert-GitClean -Path $repoRoot

function Get-TaskRef {
    param($TaskDef)
    $branch = [string]$TaskDef.branch
    if (Test-GitRef -RepoRoot $repoRoot -Ref "refs/heads/$branch") { return $branch }
    if (Test-GitRef -RepoRoot $repoRoot -Ref "refs/remotes/origin/$branch") { return "origin/$branch" }
    return $null
}

function Test-TaskIntegrated {
    param($TaskDef)
    if ($TaskDef.seeded) { return $true }
    return (Test-TaskIntegrationMarker -RepoRoot $repoRoot -IntegrationBranch $IntegrationBranch -TaskId ([string]$TaskDef.id))
}

function Test-DependenciesIntegrated {
    param($TaskDef)
    foreach ($depId in @($TaskDef.dependsOn)) {
        $dep = Get-TaskById -Catalog $catalog -TaskId $depId
        if (-not (Test-TaskIntegrated -TaskDef $dep)) { return $false }
    }
    return $true
}

$completedThisRun = New-Object System.Collections.Generic.List[string]
$failedThisRun = New-Object System.Collections.Generic.List[string]

while ($true) {
    if ($MaxTasks -gt 0 -and $completedThisRun.Count -ge $MaxTasks) { break }

    $next = $catalog.tasks |
        Where-Object { $_.automation -and -not (Test-TaskIntegrated -TaskDef $_) -and (Test-DependenciesIntegrated -TaskDef $_) } |
        Sort-Object {[int]$_.order} |
        Select-Object -First 1

    if (-not $next) { break }
    $taskId = [string]$next.id
    Write-Host ""; Write-Host "========== $taskId - $($next.title) ==========" -ForegroundColor Cyan

    $workerScript = Join-Path $PSScriptRoot "codex-worker.ps1"
    if (-not (Test-Path $workerScript)) { throw "Worker nao encontrado: $workerScript" }
    & $workerScript -Task $taskId -IntegrationBranch $IntegrationBranch -CatalogPath $CatalogPath -Model $Model -MaxFixAttempts $MaxFixAttempts -SkipAutomatedReview:$SkipAutomatedReview
    $workerExit = $LASTEXITCODE
    if ($workerExit -ne 0) {
        $failedThisRun.Add($taskId)
        Write-OrchestratorRunRecord -RepoRoot $repoRoot -TaskId $taskId -Data @{ status="worker_failed"; exitCode=$workerExit; integrationBranch=$IntegrationBranch } | Out-Null
        Write-Host "Orquestracao interrompida para preservar a cadeia de dependencias. Corrija/revise $taskId e rode novamente." -ForegroundColor Red
        break
    }

    Invoke-GitChecked -Path $repoRoot checkout $IntegrationBranch
    Assert-GitClean -Path $repoRoot
    $taskBranch = [string]$next.branch
    Write-Host "[$taskId] Merge automatico em $IntegrationBranch..." -ForegroundColor Green
    Push-Location $repoRoot
    try {
        & git merge --no-ff $taskBranch -m "merge(codex): integrate $taskId"
        if ($LASTEXITCODE -ne 0) {
            Write-Error "Conflito ao integrar $taskId. A branch $taskBranch foi preservada; development nao foi alterada."
            exit 40
        }
    }
    finally { Pop-Location }

    $integrationGateLog = Join-Path $repoRoot ".codex-orchestrator/integration-$($taskId.ToLowerInvariant())-gates.log"
    $integrationGates = @("typecheck","lint","test") + @($next.gates)
    $integrationGates = @($integrationGates | Select-Object -Unique)
    $integrationOk = Invoke-TaskGates -WorktreePath $repoRoot -Gates $integrationGates -LogPath $integrationGateLog
    if (-not $integrationOk) {
        Write-OrchestratorRunRecord -RepoRoot $repoRoot -TaskId $taskId -Data @{ status="integration_gates_failed"; branch=$taskBranch; integrationBranch=$IntegrationBranch; gateLog=$integrationGateLog } | Out-Null
        Write-Error "Gates falharam depois do merge em $IntegrationBranch. Pare e revise o merge; development continua intacta."
        exit 41
    }

    if ($Push) {
        Invoke-GitChecked -Path $repoRoot push -u origin $taskBranch
        Invoke-GitChecked -Path $repoRoot push -u origin $IntegrationBranch
    }

    $worktree = Get-WorktreePath -RepoRoot $repoRoot -TaskId $taskId
    if (Test-Path $worktree) {
        Assert-GitClean -Path $worktree
        Invoke-GitChecked -Path $repoRoot worktree remove $worktree
    }

    $completedThisRun.Add($taskId)
    Write-OrchestratorRunRecord -RepoRoot $repoRoot -TaskId $taskId -Data @{ status="integrated"; branch=$taskBranch; integrationBranch=$IntegrationBranch; pushed=[bool]$Push } | Out-Null
}

Write-Host ""; Write-Host "========== ORQUESTRACAO ENCERRADA ==========" -ForegroundColor Cyan
Write-Host "Branch candidata: $IntegrationBranch"
Write-Host "Tasks integradas nesta execucao: $($completedThisRun.Count)"
if ($completedThisRun.Count) { Write-Host ($completedThisRun -join ", ") }
if ($failedThisRun.Count) { Write-Host "Falhas: $($failedThisRun -join ', ')" -ForegroundColor Red }

$remainingAuto = $catalog.tasks | Where-Object { $_.automation -and -not (Test-TaskIntegrated -TaskDef $_) }
$manual = $catalog.tasks | Where-Object { -not $_.automation -and -not $_.seeded }
Write-Host "Automaticas restantes: $($remainingAuto.Count)"
Write-Host "Tasks manuais/infra nao executadas: $($manual.Count)"
Write-Host ""
Write-Host "Review unico sugerido:"
Write-Host ".\scripts\codex-integration-review.ps1 -IntegrationBranch `"$IntegrationBranch`" -BaseBranch `"$BaseBranch`""
Write-Host ""
Write-Host "NENHUM merge em $BaseBranch foi executado."

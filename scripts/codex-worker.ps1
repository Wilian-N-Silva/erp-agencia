param(
    [Parameter(Mandatory=$true)][string]$Task,
    [string]$IntegrationBranch = "feature/codex-integration",
    [string]$CatalogPath = "docs/codex/tasks.json",
    [string]$Model = "",
    [int]$MaxFixAttempts = 2,
    [switch]$SkipAutomatedReview
)

$commonScript = Join-Path $PSScriptRoot "codex-common.ps1"
. $commonScript
$repoRoot = Get-ErpRepoRoot
Ensure-LocalExclude -RepoRoot $repoRoot
$catalog = Get-TaskCatalog -RepoRoot $repoRoot -CatalogPath $CatalogPath
$taskDef = Get-TaskById -Catalog $catalog -TaskId $Task

if (-not $taskDef.automation) { throw "Task $Task esta marcada como manual no catalogo." }
if (-not (Test-GitRef -RepoRoot $repoRoot -Ref "refs/heads/$IntegrationBranch")) {
    throw "Branch de integracao local '$IntegrationBranch' nao existe. Rode codex-orchestrator.ps1 primeiro."
}

$branch = [string]$taskDef.branch
$worktree = Get-WorktreePath -RepoRoot $repoRoot -TaskId $Task
$worktreeRoot = Split-Path $worktree -Parent
New-Item -ItemType Directory -Force -Path $worktreeRoot | Out-Null

$branchExists = Test-GitRef -RepoRoot $repoRoot -Ref "refs/heads/$branch"
if (-not $branchExists) {
    Invoke-GitChecked -Path $repoRoot branch $branch $IntegrationBranch
}
if (-not (Test-Path $worktree)) {
    Invoke-GitChecked -Path $repoRoot worktree add $worktree $branch
}

$existingDirty = Test-WorktreeHasChanges -Path $worktree
$existingAhead = Get-CommitAheadCount -Path $worktree -BaseRef $IntegrationBranch
$resumeExisting = $existingDirty -or ($existingAhead -gt 0)

# A task branch can have been created by an earlier failed orchestration before
# dependencies were integrated. If it has no work of its own, safely refresh it
# to the current integration HEAD. Never reset branches with dirty files or
# commits ahead of integration.
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
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$codexOutput = Join-Path $runDir "$stamp-implement.md"
$gateLog = Join-Path $runDir "$stamp-gates.log"

function Test-ProducedWork {
    return (Test-WorktreeHasChanges -Path $worktree) -or ((Get-CommitAheadCount -Path $worktree -BaseRef $IntegrationBranch) -gt 0)
}

function Invoke-CodexTolerant {
    param([string]$Prompt, [string]$OutputFile, [string]$Phase)
    $exitCode = Invoke-CodexExec -WorkingDirectory $worktree -Prompt $Prompt -OutputFile $OutputFile -Sandbox "workspace-write" -Model $Model
    if ($exitCode -isnot [int]) { throw "Invoke-CodexExec retornou um valor invalido em vez de exit code inteiro." }
    if ($exitCode -eq 0) { return $true }
    if (Test-ProducedWork) {
        Write-Warning "[$Task] Codex retornou exit code $exitCode em '$Phase', mas produziu alteracoes. Continuando para os gates."
        Write-OrchestratorRunRecord -RepoRoot $repoRoot -TaskId $Task -Data @{ status="codex_nonzero_with_changes"; phase=$Phase; branch=$branch; worktree=$worktree; output=$OutputFile; exitCode=$exitCode } | Out-Null
        return $true
    }
    Write-OrchestratorRunRecord -RepoRoot $repoRoot -TaskId $Task -Data @{ status="codex_failed"; phase=$Phase; branch=$branch; worktree=$worktree; output=$OutputFile; exitCode=$exitCode } | Out-Null
    return $false
}

if (-not $resumeExisting) {
    $prompt = @"
Execute exatamente a task $Task seguindo AGENTS.md.
O wrapper ja criou/preparou a branch $branch a partir de $IntegrationBranch.
O wrapper e o dono do Git: NAO faca checkout, branch, commit, merge, rebase, reset, push ou qualquer escrita em .git.

Leia obrigatoriamente:
- docs/README.md
- docs/08-codex-execution-plan.md
- $($taskDef.doc)
- docs/06-security-and-rls.md
- docs/07-test-strategy.md
- docs/git-workflow.md
- docs/09-migration-rollout.md se tocar banco/schema/migration/backfill

Implemente somente $Task e os ajustes minimos indispensaveis para seus criterios de aceite.
Leia o codigo real antes de alterar.
Aplique Zod, autorizacao server-side, RBAC/DAL, RLS, protecao contra IDOR/mass assignment, rate limiting, audit log e transacoes quando forem aplicaveis a task.
Adicione ou ajuste os testes exigidos.
Nao antecipe tasks futuras.
Se encontrar bloqueio real de dependencia/requisito, pare e descreva-o; nao invente comportamento.
Voce pode executar testes locais nao destrutivos, mas o wrapper executara os gates finais.
"@
    Write-Host "[$Task] Codex implementando em $branch..." -ForegroundColor Cyan
    if (-not (Invoke-CodexTolerant -Prompt $prompt -OutputFile $codexOutput -Phase "implement")) {
        Write-Error "Codex falhou sem produzir trabalho. Worktree preservada: $worktree"
        exit 2
    }
}
else {
    Write-Host "[$Task] Retomando worktree existente sem chamar o Codex novamente: $worktree" -ForegroundColor Yellow
}

function Run-GatesWithRepair {
    param([int]$MaxAttempts)
    for ($attempt = 0; $attempt -le $MaxAttempts; $attempt++) {
        Write-Host "[$Task] Gates (tentativa $($attempt + 1))..."
        $ok = Invoke-TaskGates -WorktreePath $worktree -Gates @($taskDef.gates) -LogPath $gateLog -BaseRef $IntegrationBranch
        if ($ok) { return $true }
        if ($attempt -ge $MaxAttempts) { return $false }

        $failure = Get-Content -Raw -Encoding UTF8 $gateLog
        if ($failure.Length -gt 14000) { $failure = $failure.Substring($failure.Length - 14000) }
        $repairOutput = Join-Path $runDir "$stamp-gate-repair-$($attempt + 1).md"
        $repairPrompt = @"
A implementacao da task $Task falhou nos gates executados pelo wrapper.
Corrija SOMENTE problemas relacionados a task. Nao faca Git de escrita.
Nao remova/afrouxe testes para faze-los passar.

Saida dos gates:
---
$failure
---

Apos corrigir, pare. O wrapper executara os gates novamente.
"@
        if (-not (Invoke-CodexTolerant -Prompt $repairPrompt -OutputFile $repairOutput -Phase "gate-repair")) { return $false }
    }
    return $false
}

if (-not (Run-GatesWithRepair -MaxAttempts $MaxFixAttempts)) {
    Write-OrchestratorRunRecord -RepoRoot $repoRoot -TaskId $Task -Data @{ status="gates_failed"; branch=$branch; worktree=$worktree; gateLog=$gateLog } | Out-Null
    Write-Error "Gates falharam. Branch/worktree preservadas para diagnostico: $worktree"
    exit 10
}

Push-Location $worktree
try {
    $status = (& git status --porcelain)
    if (-not $status) {
        $aheadRaw = (& git rev-list --count "$IntegrationBranch..HEAD").Trim()
        $ahead = [int]$aheadRaw
        if ($ahead -le 0) { throw "Codex nao produziu mudancas para $Task." }
    }
    else {
        & git add -A
        if ($LASTEXITCODE -ne 0) { throw "git add falhou." }
        & git commit -m "feat($($Task.ToLowerInvariant())): implement task"
        if ($LASTEXITCODE -ne 0) { throw "git commit falhou." }
    }
}
finally { Pop-Location }

if (-not $SkipAutomatedReview) {
    $reviewScript = Join-Path $PSScriptRoot "codex-review.ps1"
    for ($reviewAttempt = 0; $reviewAttempt -le $MaxFixAttempts; $reviewAttempt++) {
        & $reviewScript -Task $Task -WorktreePath $worktree -BaseBranch $IntegrationBranch -CatalogPath $CatalogPath -Model $Model
        $reviewExit = $LASTEXITCODE
        if ($reviewExit -eq 0) { break }
        if ($reviewExit -ne 2 -or $reviewAttempt -ge $MaxFixAttempts) {
            Write-OrchestratorRunRecord -RepoRoot $repoRoot -TaskId $Task -Data @{ status="review_blocked"; branch=$branch; worktree=$worktree; reviewExit=$reviewExit } | Out-Null
            Write-Error "Review automatico bloqueou $Task. Worktree preservada: $worktree"
            exit 20
        }

        $reviewFile = Get-ChildItem (Join-Path $repoRoot ".codex-orchestrator/reviews") -Filter "*-$($Task.ToLowerInvariant())-review.md" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
        $reviewText = if ($reviewFile) { Get-Content -Raw -Encoding UTF8 $reviewFile.FullName } else { "Reviewer bloqueou sem relatorio legivel." }
        if ($reviewText.Length -gt 14000) { $reviewText = $reviewText.Substring($reviewText.Length - 14000) }
        $fixOutput = Join-Path $runDir "$stamp-review-fix-$($reviewAttempt + 1).md"
        $fixPrompt = @"
O reviewer automatico bloqueou a task $Task.
Corrija somente os problemas concretos abaixo. Nao faca operacoes Git de escrita e nao amplie o escopo da task.
Nao ignore nem apague testes para obter sucesso.

REVIEW:
---
$reviewText
---

Depois de corrigir, pare; o wrapper executara gates, commit e nova revisao.
"@
        if (-not (Invoke-CodexTolerant -Prompt $fixPrompt -OutputFile $fixOutput -Phase "review-fix")) { exit 22 }
        if (-not (Run-GatesWithRepair -MaxAttempts $MaxFixAttempts)) { exit 21 }
        Push-Location $worktree
        try {
            $fixStatus = (& git status --porcelain)
            if ($fixStatus) {
                & git add -A
                & git commit -m "fix($($Task.ToLowerInvariant())): address automated review"
                if ($LASTEXITCODE -ne 0) { throw "Falha ao commitar correcao de review." }
            }
        }
        finally { Pop-Location }
    }
}

Assert-GitClean -Path $worktree
$head = (& git -C $worktree rev-parse HEAD).Trim()
Write-OrchestratorRunRecord -RepoRoot $repoRoot -TaskId $Task -Data @{ status="ready_to_integrate"; branch=$branch; worktree=$worktree; head=$head; output=$codexOutput; gateLog=$gateLog } | Out-Null
Write-Host "[$Task] pronta para integracao: $branch @ $head" -ForegroundColor Green
exit 0

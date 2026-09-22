param(
    [Parameter(Mandatory=$true)]
    [string[]]$Tasks,
    [switch]$PullBeforeStart
)

$ErrorActionPreference = "Stop"

if (-not $Tasks -or $Tasks.Count -eq 0) {
    throw "Informe tasks explícitas. Ex.: -Tasks CORE-002,CORE-004"
}

$repoRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $repoRoot) { throw "Execute dentro do repositório Git." }
Set-Location $repoRoot

$initialStatus = git status --porcelain
if ($initialStatus) { throw "Worktree deve iniciar limpa." }

if ($PullBeforeStart) {
    git checkout development
    git pull --ff-only
    if ($LASTEXITCODE -ne 0) { throw "Falha ao atualizar development." }
}

foreach ($task in $Tasks) {
    Write-Host "==== $task ===="

    # Cada task nasce da mesma development; por isso o batch só pode conter tasks independentes.
    git checkout development
    if ($LASTEXITCODE -ne 0) { throw "Falha ao voltar para development antes de $task" }

    $status = git status --porcelain
    if ($status) { throw "Worktree suja antes de $task. Abortando batch." }

    & "$PSScriptRoot/codex-task.ps1" -Task $task
    if ($LASTEXITCODE -ne 0) { throw "Task $task falhou. Abortando batch." }

    $status = git status --porcelain
    if ($status) { throw "Task $task deixou worktree suja. Abortando batch." }
}

Write-Host "Batch concluído. Nenhuma branch foi mergeada automaticamente. Revise cada branch individualmente."

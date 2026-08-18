param(
    [Parameter(Mandatory=$true)]
    [string]$Task,
    [switch]$Pull
)

$ErrorActionPreference = "Stop"

$repoRoot = (git rev-parse --show-toplevel 2>$null)
if (-not $repoRoot) { throw "Execute dentro do repositório Git." }
Set-Location $repoRoot

$status = git status --porcelain
if ($status) {
    throw "Worktree não está limpa. Revise/commit/stash antes de iniciar: `n$status"
}

# O wrapper, e não o sandbox do Codex, controla .git.
git checkout development
if ($LASTEXITCODE -ne 0) { throw "Falha ao fazer checkout de development." }

if ($Pull) {
    git pull --ff-only
    if ($LASTEXITCODE -ne 0) { throw "Falha ao atualizar development." }
}

$status = git status --porcelain
if ($status) { throw "development está suja. Abortando." }

$safeTask = $Task.ToLowerInvariant()
$branch = "feature/task-$safeTask"

$existing = git branch --list $branch
if ($existing) {
    throw "A branch $branch já existe. Revise-a ou remova-a antes de repetir a task."
}

git checkout -b $branch
if ($LASTEXITCODE -ne 0) { throw "Falha ao criar $branch." }

New-Item -ItemType Directory -Force -Path ".codex-results" | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$out = ".codex-results/$Task-$stamp.md"

$prompt = @"
Execute exatamente a task $Task seguindo AGENTS.md.
A branch $branch já foi criada pelo wrapper a partir da development local.
NÃO execute checkout, branch, commit, merge, rebase, reset ou qualquer operação Git de escrita.

Leia docs/README.md, docs/08-codex-execution-plan.md, o PRD indicado pela task,
docs/06-security-and-rls.md, docs/07-test-strategy.md e docs/git-workflow.md.
Se houver migration/backfill, leia docs/09-migration-rollout.md.

Regras:
- confirme no código/documentos que as dependências da task estão integradas;
- implemente somente esta task;
- não antecipe tasks futuras;
- aplique Zod, RBAC/DAL, RLS, rate limit, audit e transactions quando aplicáveis;
- adicione/ajuste os testes obrigatórios;
- rode os testes focados e os gates que forem viáveis no sandbox;
- se estiver bloqueado por requisito/dependência, não invente solução: pare e descreva o bloqueio;
- ao terminar, deixe um resumo completo. O wrapper fará gates finais e commit.
"@

Write-Host "Executando Codex para $Task em $branch..."
# -a é top-level em versões atuais; workspace-write mantém o agente limitado ao repo.
& codex -a never --sandbox workspace-write exec -o $out $prompt
$codexExit = $LASTEXITCODE
if ($codexExit -ne 0) {
    Write-Warning "Codex retornou exit code $codexExit. Branch preservada para diagnóstico: $branch. Resultado: $out"
    exit $codexExit
}

Write-Host "Executando gates mínimos fora do sandbox..."
git diff --check
if ($LASTEXITCODE -ne 0) { throw "git diff --check falhou." }

npm run typecheck
if ($LASTEXITCODE -ne 0) { throw "typecheck falhou. Branch preservada sem commit automático." }

npm run lint
if ($LASTEXITCODE -ne 0) { throw "lint falhou. Branch preservada sem commit automático." }

npm run test
if ($LASTEXITCODE -ne 0) { throw "tests falharam. Branch preservada sem commit automático." }

$statusAfter = git status --porcelain
if (-not $statusAfter) {
    Write-Warning "Codex não produziu alterações. Nenhum commit criado. Veja $out"
    exit 0
}

git add -A
git commit -m "feat: implement $Task"
if ($LASTEXITCODE -ne 0) { throw "Falha ao commit. Branch preservada." }

$statusFinal = git status --porcelain
if ($statusFinal) { throw "Commit criado, mas worktree não terminou limpa: `n$statusFinal" }

Write-Host "Task $Task pronta para review."
Write-Host "Branch: $branch"
Write-Host "Resumo Codex: $out"
git log -1 --oneline

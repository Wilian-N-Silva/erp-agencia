param(
    [string]$IntegrationBranch = "feature/codex-integration",
    [string]$BaseBranch = "development",
    [string]$Model = ""
)

. "$PSScriptRoot/codex-common.ps1"
$repoRoot = Get-ErpRepoRoot
Assert-GitClean -Path $repoRoot
if (-not (Test-GitRef -RepoRoot $repoRoot -Ref "refs/heads/$IntegrationBranch")) { throw "Branch $IntegrationBranch nao existe localmente." }
Invoke-GitChecked -Path $repoRoot checkout $IntegrationBranch

$runDir = Join-Path $repoRoot ".codex-orchestrator/integration-reviews"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$report = Join-Path $runDir "$stamp-integration-review.md"

$prompt = @"
Faca um review de release candidate da branch atual $IntegrationBranch contra $BaseBranch.
NAO altere arquivos. NAO faca Git de escrita.

Leia AGENTS.md, docs/README.md, docs/08-codex-execution-plan.md, todos os PRDs afetados,
docs/06-security-and-rls.md, docs/07-test-strategy.md e docs/09-migration-rollout.md.

Revise o diff completo e a interacao entre as mudancas, nao apenas arquivos isolados.
Priorize blockers concretos:
- regressoes funcionais;
- requisitos dos PRDs quebrados/omitidos;
- RLS/RBAC/IDOR/tenant isolation;
- validacao, mass assignment e rate limiting;
- integridade financeira/transacoes/auditoria;
- migrations/backfills/rollback;
- concorrencia e consistencia de estado;
- testes faltantes ou falsos positivos.

Organize findings por severidade e cite arquivos/linhas quando possivel.
No final escreva exatamente:
VERDICT: PASS
ou
VERDICT: BLOCK
"@

$exit = Invoke-CodexExec -WorkingDirectory $repoRoot -Prompt $prompt -OutputFile $report -Sandbox "read-only" -Model $Model
if ($exit -isnot [int]) { throw "Invoke-CodexExec retornou um valor invalido em vez de exit code inteiro." }
if ($exit -ne 0) { exit $exit }
$content = Get-Content -Raw -Encoding UTF8 $report
Write-Host "Relatorio: $report"
if ($content -match "VERDICT:\s*PASS") { Write-Host "VERDICT: PASS" -ForegroundColor Green; exit 0 }
if ($content -match "VERDICT:\s*BLOCK") { Write-Host "VERDICT: BLOCK" -ForegroundColor Red; exit 2 }
Write-Error "Review terminou sem verdict valido."
exit 3

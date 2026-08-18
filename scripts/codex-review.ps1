param(
    [Parameter(Mandatory=$true)][string]$Task,
    [Parameter(Mandatory=$true)][string]$WorktreePath,
    [Parameter(Mandatory=$true)][string]$BaseBranch,
    [string]$CatalogPath = "docs/codex/tasks.json",
    [string]$Model = "",
    [switch]$IntegrationReview
)

. "$PSScriptRoot/codex-common.ps1"
$repoRoot = Get-ErpRepoRoot
$catalog = Get-TaskCatalog -RepoRoot $repoRoot -CatalogPath $CatalogPath
$taskDef = Get-TaskById -Catalog $catalog -TaskId $Task

$runDir = Join-Path $repoRoot ".codex-orchestrator/reviews"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$report = Join-Path $runDir "$stamp-$($Task.ToLowerInvariant())-review.md"

$scope = if ($IntegrationReview) {
    "Revise o conjunto completo de mudancas da branch atual contra $BaseBranch."
} else {
    "Revise exclusivamente a implementacao da task $Task na branch atual contra $BaseBranch."
}

$prompt = @"
Voce e o reviewer tecnico final de uma implementacao do ERP Formula Group.
$scope

Leia obrigatoriamente:
- AGENTS.md
- docs/README.md
- $($taskDef.doc)
- docs/06-security-and-rls.md
- docs/07-test-strategy.md
- docs/09-migration-rollout.md quando houver banco/migration

Use o Git somente para leitura. NAO altere arquivos e NAO execute operacoes Git de escrita.
Inspecione o diff real contra $BaseBranch e procure especialmente:
- requisito ou criterio de aceite nao implementado;
- regressao de comportamento;
- falha de autorizacao/RBAC/IDOR/RLS;
- input sem validacao server-side;
- mass assignment;
- ausencia de rate limiting quando exigido;
- multi-write nao transacional;
- audit log ausente/incorreto;
- migration perigosa ou nao compativel com rollout;
- teste critico ausente;
- vazamento de segredo ou dado sensivel.

Classifique somente problemas concretos e acionaveis.
No final, escreva EXATAMENTE uma das linhas:
VERDICT: PASS
ou
VERDICT: BLOCK

Use BLOCK apenas se houver algo que deve impedir o merge.
"@

$exit = Invoke-CodexExec -WorkingDirectory $WorktreePath -Prompt $prompt -OutputFile $report -Sandbox "read-only" -Model $Model
if ($exit -ne 0) {
    Write-Error "Codex reviewer falhou com exit code $exit. Relatorio: $report"
    exit $exit
}

$content = if (Test-Path $report) { Get-Content -Raw -Encoding UTF8 $report } else { "" }
Write-Host "Review: $report"
if ($content -match "VERDICT:\s*BLOCK") {
    Write-Host "VERDICT: BLOCK" -ForegroundColor Red
    exit 2
}
if ($content -match "VERDICT:\s*PASS") {
    Write-Host "VERDICT: PASS" -ForegroundColor Green
    exit 0
}

Write-Error "Reviewer nao retornou VERDICT valido. Veja $report"
exit 3

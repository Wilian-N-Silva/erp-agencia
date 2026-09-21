param(
    [switch]$NoMigrate
)

$commonScript = Join-Path $PSScriptRoot "codex-common.ps1"
. $commonScript
$repoRoot = Get-ErpRepoRoot

if ($NoMigrate) {
    throw "-NoMigrate nao e suportado nesta versao. O banco descartavel sempre recebe migrations."
}

[void](Initialize-CodexTestDatabase -WorktreePath $repoRoot)
Write-Host "TEST DB READY: separate migrator and runtime roles configured." -ForegroundColor Green

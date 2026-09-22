param(
    [string]$IntegrationBranch = "feature/codex-integration",
    [string]$CatalogPath = "docs/codex/tasks.json"
)
$commonScript = Join-Path $PSScriptRoot "codex-common.ps1"
. $commonScript
$repoRoot = Get-ErpRepoRoot
$catalog = Get-TaskCatalog -RepoRoot $repoRoot -CatalogPath $CatalogPath
if ($catalog.integrationBranch -and $IntegrationBranch -eq "feature/codex-integration") { $IntegrationBranch = [string]$catalog.integrationBranch }

function Get-Ref($task) {
    if (Test-GitRef -RepoRoot $repoRoot -Ref "refs/heads/$($task.branch)") { return [string]$task.branch }
    if (Test-GitRef -RepoRoot $repoRoot -Ref "refs/remotes/origin/$($task.branch)") { return "origin/$($task.branch)" }
    return $null
}
function Is-Done($task) {
    if ($task.seeded) { return $true }
    return (Test-TaskIntegrationMarker -RepoRoot $repoRoot -IntegrationBranch $IntegrationBranch -TaskId ([string]$task.id))
}
function Deps-Done($task) {
    foreach ($d in @($task.dependsOn)) {
        $dep = Get-TaskById -Catalog $catalog -TaskId $d
        if (-not (Is-Done $dep)) { return $false }
    }
    return $true
}

$rows = foreach ($t in ($catalog.tasks | Sort-Object {[int]$_.order})) {
    $status = if (Is-Done $t) { "integrated" } elseif (-not $t.automation) { "manual" } elseif (Deps-Done $t) { "ready" } else { "blocked" }
    [pscustomobject]@{ Order=$t.order; Task=$t.id; Status=$status; Branch=$t.branch; Depends=(@($t.dependsOn) -join ',') }
}
$rows | Format-Table -AutoSize

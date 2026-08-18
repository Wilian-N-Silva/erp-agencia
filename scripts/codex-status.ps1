param(
    [string]$IntegrationBranch = "feature/codex-integration",
    [string]$CatalogPath = "docs/codex/tasks.json"
)
. "$PSScriptRoot/codex-common.ps1"
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
    $r = Get-Ref $task
    if (-not $r) { return $false }
    if (-not (Test-GitRef -RepoRoot $repoRoot -Ref "refs/heads/$IntegrationBranch")) { return $false }
    return (Test-GitAncestor -RepoRoot $repoRoot -Ancestor $r -Descendant $IntegrationBranch)
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

param(
    [string]$IntegrationBranch = "feature/codex-integration",
    [string]$BaseBranch = "development",
    [string]$RemediationBranch = "fix/codex-review-remediation-001",
    [string]$Model = "",
    [switch]$Push,
    [switch]$NoMerge
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-GitChecked {
    param(
        [string]$Path,
        [Parameter(ValueFromRemainingArguments=$true)]
        [string[]]$GitArgs
    )

    Push-Location $Path
    try {
        & git @GitArgs
        if ($LASTEXITCODE -ne 0) {
            throw "git $($GitArgs -join ' ') failed with exit code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

function Get-RepoRoot {
    $root = (& git rev-parse --show-toplevel 2>$null | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or -not $root) {
        throw "Run this script from inside the ERP repository."
    }
    return $root
}

function Get-MeaningfulStatus {
    param([string]$RepoRoot)

    Push-Location $RepoRoot
    try {
        $lines = @(& git status --porcelain)
    }
    finally {
        Pop-Location
    }

    return @(
        $lines | Where-Object {
            $_ -and $_ -notmatch 'scripts[/\\]codex-remediate-integration-review\.ps1$'
        }
    )
}

function Assert-CleanExceptSelf {
    param([string]$RepoRoot)

    $dirty = @(Get-MeaningfulStatus -RepoRoot $RepoRoot)
    if ($dirty.Count -gt 0) {
        throw "Repository has unrelated changes. Commit/stash them first:`n$($dirty -join "`n")"
    }
}

function Test-LocalBranch {
    param([string]$RepoRoot, [string]$Branch)

    Push-Location $RepoRoot
    try {
        & git show-ref --verify --quiet "refs/heads/$Branch"
        return ($LASTEXITCODE -eq 0)
    }
    finally {
        Pop-Location
    }
}

function Assert-Contains {
    param(
        [string]$Path,
        [string]$Pattern,
        [string]$Message
    )

    $content = Get-Content -Raw -Encoding UTF8 $Path
    if ($content -notmatch $Pattern) {
        throw $Message
    }
}

function Assert-TaskDependencies {
    param(
        $Catalog,
        [string]$TaskId,
        [string[]]$Expected
    )

    $task = @($Catalog.tasks | Where-Object { $_.id -eq $TaskId })
    if ($task.Count -ne 1) {
        throw "Task $TaskId not found exactly once in tasks.json."
    }

    $actual = @($task[0].dependsOn | ForEach-Object { [string]$_ } | Sort-Object)
    $wanted = @($Expected | Sort-Object)

    if (($actual -join ",") -ne ($wanted -join ",")) {
        throw "Task $TaskId dependencies are wrong. Expected [$($wanted -join ', ')], got [$($actual -join ', ')]."
    }
}

function Assert-CatalogGraph {
    param($Catalog)

    $ids = @($Catalog.tasks | ForEach-Object { [string]$_.id })
    if (($ids | Sort-Object -Unique).Count -ne $ids.Count) {
        throw "tasks.json contains duplicate task IDs."
    }

    $idSet = @{}
    foreach ($id in $ids) { $idSet[$id] = $true }

    foreach ($task in $Catalog.tasks) {
        foreach ($dep in @($task.dependsOn)) {
            if (-not $idSet.ContainsKey([string]$dep)) {
                throw "Task $($task.id) depends on missing task $dep."
            }
        }
    }

    $inDegree = @{}
    $outgoing = @{}
    foreach ($id in $ids) {
        $inDegree[$id] = 0
        $outgoing[$id] = New-Object System.Collections.Generic.List[string]
    }

    foreach ($task in $Catalog.tasks) {
        $taskId = [string]$task.id
        foreach ($depRaw in @($task.dependsOn)) {
            $dep = [string]$depRaw
            $inDegree[$taskId] = [int]$inDegree[$taskId] + 1
            $outgoing[$dep].Add($taskId)
        }
    }

    $queue = New-Object System.Collections.Generic.Queue[string]
    foreach ($id in $ids) {
        if ([int]$inDegree[$id] -eq 0) { $queue.Enqueue($id) }
    }

    $visited = 0
    while ($queue.Count -gt 0) {
        $id = $queue.Dequeue()
        $visited++
        foreach ($child in $outgoing[$id]) {
            $inDegree[$child] = [int]$inDegree[$child] - 1
            if ([int]$inDegree[$child] -eq 0) { $queue.Enqueue($child) }
        }
    }

    if ($visited -ne $ids.Count) {
        throw "tasks.json contains a dependency cycle."
    }
}

function Invoke-SelfCheck {
    param([string]$RepoRoot)

    $path = Join-Path $RepoRoot "scripts\codex-selfcheck.ps1"
    if (-not (Test-Path $path)) { throw "codex-selfcheck.ps1 not found." }

    & $path
    if ($LASTEXITCODE -ne 0) {
        throw "codex-selfcheck.ps1 failed."
    }
}

function Invoke-RemediationGates {
    param(
        [string]$RepoRoot,
        [string]$BaseRef,
        [string]$LogName
    )

    $commonPath = Join-Path $RepoRoot "scripts\codex-common.ps1"
    . $commonPath

    $logDir = Join-Path $RepoRoot ".codex-orchestrator"
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    $logPath = Join-Path $logDir $LogName

    try {
        $ok = Invoke-TaskGates `
            -WorktreePath $RepoRoot `
            -Gates @("typecheck", "lint", "test", "test:db") `
            -LogPath $logPath `
            -BaseRef $BaseRef
    }
    catch {
        throw "Could not run remediation gates with BaseRef support. The remediation did not correctly update Invoke-TaskGates. $($_.Exception.Message)"
    }

    if (-not $ok) {
        throw "Remediation gates failed. See $logPath"
    }
}

function Invoke-FreshSeedSmoke {
    param([string]$RepoRoot)

    $commonPath = Join-Path $RepoRoot "scripts\codex-common.ps1"
    . $commonPath

    $oldDatabaseUrl = $env:DATABASE_URL
    $oldDatabaseDirectUrl = $env:DATABASE_DIRECT_URL
    $oldDatabaseTestUrl = $env:DATABASE_TEST_URL
    $oldDatabaseTestAdminUrl = $env:DATABASE_TEST_ADMIN_URL
    $oldSeedDemoData = $env:SEED_DEMO_DATA

    try {
        [void](Initialize-CodexTestDatabase -WorktreePath $RepoRoot)

        $migratorRole = if ($env:CODEX_TEST_MIGRATOR_ROLE) { $env:CODEX_TEST_MIGRATOR_ROLE } else { "codex_test_migrator" }
        $appRole = if ($env:CODEX_TEST_APP_ROLE) { $env:CODEX_TEST_APP_ROLE } else { "codex_test_app" }
        $container = if ($env:CODEX_TEST_DB_CONTAINER) { $env:CODEX_TEST_DB_CONTAINER } else { "erp-agencia-postgres" }
        $bootstrapUser = if ($env:CODEX_TEST_DB_USER) { $env:CODEX_TEST_DB_USER } else { "erp" }
        $dbName = if ($env:CODEX_TEST_DB_NAME) { $env:CODEX_TEST_DB_NAME } else { "erp_agencia_test" }

        $roleSql = "SELECT rolname || '|' || rolsuper || '|' || rolbypassrls FROM pg_roles WHERE rolname IN ('$migratorRole','$appRole') ORDER BY rolname;"
        $roleRows = (& docker exec $container psql -U $bootstrapUser -d postgres -At -c $roleSql | Out-String).Trim()
        if ($LASTEXITCODE -ne 0) { throw "Could not inspect PostgreSQL test roles." }

       if ($roleRows -notmatch [regex]::Escape("$migratorRole|false|true")) {
            throw "$migratorRole must be NOSUPERUSER + BYPASSRLS."
        }

        if ($roleRows -notmatch [regex]::Escape("$appRole|false|false")) {
            throw "$appRole must be NOSUPERUSER + NOBYPASSRLS."
        }

        $ownerSql = "SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname = '$dbName';"
        $owner = (& docker exec $container psql -U $bootstrapUser -d postgres -At -c $ownerSql | Out-String).Trim()
        if ($LASTEXITCODE -ne 0) { throw "Could not inspect test database owner." }
        if ($owner -ne $migratorRole) {
            throw "Test database owner must be $migratorRole, got '$owner'."
        }

        if (-not $env:DATABASE_TEST_ADMIN_URL) {
            throw "Initialize-CodexTestDatabase must expose DATABASE_TEST_ADMIN_URL."
        }
        if (-not $env:DATABASE_TEST_URL -or -not $env:DATABASE_URL -or -not $env:DATABASE_DIRECT_URL) {
            throw "Test DB environment variables were not configured."
        }
        if ($env:DATABASE_TEST_URL -eq $env:DATABASE_DIRECT_URL) {
            throw "Runtime and migrator URLs must be different."
        }

        $env:SEED_DEMO_DATA = "false"
        $npm = Get-NpmCommand
        Push-Location $RepoRoot
        try {
            & $npm run db:seed
            if ($LASTEXITCODE -ne 0) {
                throw "Fresh migrate + seed smoke test failed."
            }
        }
        finally {
            Pop-Location
        }
    }
    finally {
        $env:DATABASE_URL = $oldDatabaseUrl
        $env:DATABASE_DIRECT_URL = $oldDatabaseDirectUrl
        $env:DATABASE_TEST_URL = $oldDatabaseTestUrl
        $env:DATABASE_TEST_ADMIN_URL = $oldDatabaseTestAdminUrl
        $env:SEED_DEMO_DATA = $oldSeedDemoData
    }
}

function Assert-RemediationShape {
    param([string]$RepoRoot)

    $common = Join-Path $RepoRoot "scripts\codex-common.ps1"
    $orchestrator = Join-Path $RepoRoot "scripts\codex-orchestrator.ps1"
    $worker = Join-Path $RepoRoot "scripts\codex-worker.ps1"
    $runbook = Join-Path $RepoRoot "docs\runbooks\database-roles.md"
    $plan = Join-Path $RepoRoot "docs\08-codex-execution-plan.md"
    $catalogPath = Join-Path $RepoRoot "docs\codex\tasks.json"
    $orchestrationDoc = Join-Path $RepoRoot "docs\11-codex-orchestration.md"

    Assert-Contains $common 'codex_test_migrator' "Test DB setup does not create codex_test_migrator."
    Assert-Contains $common 'codex_test_app' "Test DB setup does not create codex_test_app."
    Assert-Contains $common 'DATABASE_TEST_ADMIN_URL' "DATABASE_TEST_ADMIN_URL is missing."
    Assert-Contains $common 'BYPASSRLS' "Migrator BYPASSRLS contract is missing from test DB setup."
    Assert-Contains $common 'NOBYPASSRLS' "Runtime NOBYPASSRLS contract is missing from test DB setup."
    Assert-Contains $common '\$BaseRef' "Invoke-TaskGates does not expose BaseRef."
    Assert-Contains $common 'diff --check' "git diff --check gate is missing."
    Assert-Contains $common '\.\.\.HEAD' "Committed diff whitespace gate is missing."

    Assert-Contains $worker 'BaseRef' "Worker does not pass the integration base to gates."
    Assert-Contains $orchestrator 'reset --hard' "Orchestrator does not rollback a failed post-merge gate."
    Assert-Contains $orchestrator 'BaseRef' "Orchestrator does not pass the base branch to integration gates."

    Assert-Contains $runbook 'BYPASSRLS' "database-roles.md does not document the administrative BYPASSRLS requirement."
    Assert-Contains $runbook 'NOBYPASSRLS' "database-roles.md does not document the runtime NOBYPASSRLS requirement."
    Assert-Contains $plan 'candidate_done' "08-codex-execution-plan.md does not distinguish candidate_done."

    $docLines = Get-Content -Encoding UTF8 $orchestrationDoc
    for ($i = 0; $i -lt $docLines.Count; $i++) {
        if ($docLines[$i] -match '[ \t]+$') {
            throw "Trailing whitespace remains in docs/11-codex-orchestration.md at line $($i + 1)."
        }
    }

    $catalog = Get-Content -Raw -Encoding UTF8 $catalogPath | ConvertFrom-Json

    Assert-TaskDependencies $catalog "VAC-003" @("VAC-002", "CORE-006")
    Assert-TaskDependencies $catalog "INV-001" @("FIN-004", "CORE-001")
    Assert-TaskDependencies $catalog "REI-002" @("FIN-004")
    Assert-TaskDependencies $catalog "FIN-008" @("DOC-002", "FIN-003")
    Assert-TaskDependencies $catalog "FIN-009" @("FIN-005", "FIN-007")
    Assert-TaskDependencies $catalog "FIN-010" @("FIN-005", "GRF-014", "INV-004", "REI-004")
    Assert-TaskDependencies $catalog "SAA-004" @("FIN-007", "SAA-001")
    Assert-TaskDependencies $catalog "DOC-004" @("DOC-001")

    $doc003 = @($catalog.tasks | Where-Object { $_.id -eq "DOC-003" })
    if ($doc003.Count -ne 1 -or [bool]$doc003[0].automation) {
        throw "DOC-003 must be manual while its business decision is open."
    }

    Assert-CatalogGraph $catalog

    $auditPath = Join-Path $RepoRoot "docs\codex\catalog-audit.md"
    if (-not (Test-Path $auditPath)) {
        throw "docs/codex/catalog-audit.md was not produced."
    }
}

$repoRoot = Get-RepoRoot
Write-Host "Repo:        $repoRoot" -ForegroundColor Cyan
Write-Host "Integration: $IntegrationBranch" -ForegroundColor Cyan
Write-Host "Remediation: $RemediationBranch" -ForegroundColor Cyan

Assert-CleanExceptSelf -RepoRoot $repoRoot

Push-Location $repoRoot
try {
    & git fetch --prune origin
    if ($LASTEXITCODE -ne 0) { throw "git fetch failed." }
}
finally {
    Pop-Location
}

Invoke-GitChecked -Path $repoRoot checkout $IntegrationBranch
Assert-CleanExceptSelf -RepoRoot $repoRoot

if (Test-LocalBranch -RepoRoot $repoRoot -Branch $RemediationBranch) {
    Invoke-GitChecked -Path $repoRoot checkout $RemediationBranch
    Assert-CleanExceptSelf -RepoRoot $repoRoot
}
else {
    Invoke-GitChecked -Path $repoRoot checkout -b $RemediationBranch $IntegrationBranch
}

$commonScript = Join-Path $repoRoot "scripts\codex-common.ps1"
if (-not (Test-Path $commonScript)) {
    throw "scripts/codex-common.ps1 not found."
}
. $commonScript

$runDir = Join-Path $repoRoot ".codex-orchestrator\remediation"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputFile = Join-Path $runDir "$stamp-integration-review-remediation.md"

$prompt = @"
You are remediating the BLOCK verdict from the integration review of feature/codex-integration.

Read before editing:
- AGENTS.md
- docs/06-security-and-rls.md
- docs/07-test-strategy.md
- docs/08-codex-execution-plan.md
- docs/09-migration-rollout.md
- docs/01-prd-core-erp.md
- docs/02-prd-financeiro.md
- docs/03-prd-grafica.md
- docs/04-prd-pessoas-e-portal.md
- docs/05-prd-governanca.md
- docs/11-codex-orchestration.md
- docs/codex/tasks.json
- scripts/codex-common.ps1
- scripts/codex-worker.ps1
- scripts/codex-orchestrator.ps1
- scripts/codex-test-db.ps1
- src/lib/db/seed.ts
- drizzle/0008_rls_baseline.sql
- docs/runbooks/database-roles.md
- docs/runbooks/production-setup.md

Do not perform Git writes. The wrapper owns Git.

Fix ALL infrastructure/findings below, but do NOT implement SEC-004's complete cross-tenant CRUD suite yet.

1. Real test database roles
- The disposable Docker DB must use separate roles.
- Bootstrap role may remain the Docker postgres bootstrap user.
- Create/update literal test roles:
  codex_test_migrator: LOGIN, NOSUPERUSER, BYPASSRLS.
  codex_test_app: LOGIN, NOSUPERUSER, NOBYPASSRLS, not table owner.
- The test database must be owned by codex_test_migrator.
- DATABASE_DIRECT_URL and DATABASE_TEST_ADMIN_URL must use codex_test_migrator.
- DATABASE_URL and DATABASE_TEST_URL must use codex_test_app.
- Grant runtime schema/table/sequence privileges required by the application.
- Do not print credential-bearing URLs in logs.
- Preserve env overrides for local customization.

2. Seed/admin contract
- Make the controlled administrative role contract explicit and safe.
- Production/staging runbooks must state the migration/seed credential requires BYPASSRLS (or SUPERUSER only if absolutely necessary; prefer BYPASSRLS).
- Runtime role must explicitly be NOBYPASSRLS and must never be table owner.
- Make seed fail early with a useful message if its direct/admin credential cannot safely perform the post-FORCE-RLS administrative seed, OR use explicit tenant context for protected writes if that is cleaner.
- Fresh migrate + seed using the documented admin credential must work.
- Do not weaken RLS for runtime.

3. Integration gate rollback
- scripts/codex-orchestrator.ps1 currently creates merge(codex): integrate TASK before post-merge gates.
- Capture the integration SHA before merge.
- If merge itself fails, abort it safely.
- If post-merge gates fail, reset the integration branch to the exact pre-merge SHA before exiting.
- A failed integration gate must never leave an integration marker that can unlock dependents.
- Never touch development or main.

4. Whitespace gate
- Extend Invoke-TaskGates with a BaseRef parameter.
- Always keep the worktree git diff --check.
- When BaseRef is supplied, also run git diff --check BaseRef...HEAD so committed whitespace failures are caught.
- Worker task gates must compare against feature/codex-integration.
- Integration gates must compare against development.
- Keep log output useful.

5. Machine catalog audit
- PRDs are canonical; tasks.json is executable representation only.
- Audit EVERY task in docs/codex/tasks.json against its PRD heading and dependency declaration, not just the examples below.
- Correct every mismatch that can be resolved from the PRDs.
- Expand explicit ranges such as XXX-001..004 to the concrete task IDs when needed.
- For FIN-010, represent the required completed GRF/INV/REI integrations using their final flow/release gates: FIN-005, GRF-014, INV-004, REI-004.
- DOC-003 depends on an unresolved business decision, so set automation=false.
- Known mismatches that MUST be corrected:
  VAC-003 => VAC-002, CORE-006
  INV-001 => FIN-004, CORE-001
  REI-002 => FIN-004
  FIN-008 => DOC-002, FIN-003
  FIN-009 => FIN-005, FIN-007
  FIN-010 => FIN-005, GRF-014, INV-004, REI-004
  SAA-004 => FIN-007, SAA-001
  DOC-004 => DOC-001
- Preserve unique IDs, valid dependency IDs, and acyclic graph.
- Create docs/codex/catalog-audit.md listing every task, PRD dependency text, resulting dependsOn, and any manual/unresolved dependency.

6. Human plan state
- Add candidate_done as a documented state in docs/08-codex-execution-plan.md.
- Mark DOCS-001, SEC-001, SEC-002, SEC-003 as candidate_done because they are in feature/codex-integration, while clearly stating this is NOT merged into development.
- SEC-004 should be ready after remediation.
- Do not make manual mode repeat completed candidate work.

7. Whitespace finding
- Remove trailing whitespace reported in docs/11-codex-orchestration.md.
- Do not use broad formatting that changes unrelated docs.

Acceptance:
- Windows PowerShell 5.1 compatible scripts; keep PowerShell scripts ASCII-only where the orchestrator already follows that rule.
- No secrets committed.
- Do not loosen tests or RLS.
- Do not merge to development/main.
- Stop after implementing the remediation. The wrapper will run all gates, fresh seed smoke, assertions, commit, and optional merge to feature/codex-integration.
"@

Write-Host ""
Write-Host "========== CODEX REVIEW REMEDIATION ==========" -ForegroundColor Cyan

$exitCode = Invoke-CodexExec `
    -WorkingDirectory $repoRoot `
    -Prompt $prompt `
    -OutputFile $outputFile `
    -Sandbox "workspace-write" `
    -Model $Model

$meaningful = @(Get-MeaningfulStatus -RepoRoot $repoRoot)
if ($exitCode -ne 0 -and $meaningful.Count -eq 0) {
    throw "Codex failed with exit code $exitCode and produced no remediation work. Report: $outputFile"
}
if ($exitCode -ne 0) {
    Write-Host "Codex returned exit code $exitCode but produced changes; validating them instead of discarding the work." -ForegroundColor Yellow
}

if ($meaningful.Count -eq 0) {
    throw "Codex produced no remediation changes."
}

Write-Host ""
Write-Host "========== STRUCTURAL ASSERTIONS ==========" -ForegroundColor Cyan
Assert-RemediationShape -RepoRoot $repoRoot
Write-Host "Structural assertions passed." -ForegroundColor Green

Write-Host ""
Write-Host "========== POWERSHELL SELF-CHECK ==========" -ForegroundColor Cyan
Invoke-SelfCheck -RepoRoot $repoRoot

Write-Host ""
Write-Host "========== REMEDIATION GATES ==========" -ForegroundColor Cyan
Invoke-RemediationGates `
    -RepoRoot $repoRoot `
    -BaseRef $IntegrationBranch `
    -LogName "review-remediation-gates.log"

Write-Host ""
Write-Host "========== FRESH MIGRATE + SEED SMOKE ==========" -ForegroundColor Cyan
Invoke-FreshSeedSmoke -RepoRoot $repoRoot
Write-Host "Fresh migrate + seed smoke passed." -ForegroundColor Green

Push-Location $repoRoot
try {
    & git diff --check
    if ($LASTEXITCODE -ne 0) { throw "Uncommitted git diff --check failed." }

    & git add -A
    if ($LASTEXITCODE -ne 0) { throw "git add failed." }

    & git commit -m "fix(codex): remediate integration review findings"
    if ($LASTEXITCODE -ne 0) { throw "git commit failed." }

    & git diff --check "$IntegrationBranch...HEAD"
    if ($LASTEXITCODE -ne 0) {
        throw "Committed diff whitespace check failed against $IntegrationBranch."
    }
}
finally {
    Pop-Location
}

if ($NoMerge) {
    Write-Host ""
    Write-Host "REMEDIATION READY ON: $RemediationBranch" -ForegroundColor Green
    Write-Host "No merge was performed because -NoMerge was supplied."
    Write-Host "Next: merge this branch into $IntegrationBranch, run gates, then run SEC-004."
    exit 0
}

Write-Host ""
Write-Host "========== MERGE REMEDIATION INTO INTEGRATION ==========" -ForegroundColor Cyan
Invoke-GitChecked -Path $repoRoot checkout $IntegrationBranch

Push-Location $repoRoot
try {
    $integrationBefore = (& git rev-parse HEAD | Out-String).Trim()
    if (-not $integrationBefore) { throw "Could not capture integration SHA." }

    & git merge --no-ff $RemediationBranch -m "fix(codex): remediate integration review"
    if ($LASTEXITCODE -ne 0) {
        & git merge --abort 2>$null
        throw "Could not merge remediation into $IntegrationBranch."
    }

    try {
        Invoke-SelfCheck -RepoRoot $repoRoot
        Invoke-RemediationGates `
            -RepoRoot $repoRoot `
            -BaseRef $BaseBranch `
            -LogName "review-remediation-post-merge-gates.log"

        & git diff --check "$BaseBranch...HEAD"
        if ($LASTEXITCODE -ne 0) {
            throw "Candidate whitespace gate failed against $BaseBranch."
        }
    }
    catch {
        Write-Host "Post-merge validation failed. Restoring $IntegrationBranch to $integrationBefore..." -ForegroundColor Red
        & git reset --hard $integrationBefore
        if ($LASTEXITCODE -ne 0) {
            throw "CRITICAL: validation failed and automatic rollback also failed. Original error: $($_.Exception.Message)"
        }
        throw
    }
}
finally {
    Pop-Location
}

if ($Push) {
    Invoke-GitChecked -Path $repoRoot push -u origin $RemediationBranch
    Invoke-GitChecked -Path $repoRoot push -u origin $IntegrationBranch
}

Write-Host ""
Write-Host "========== REMEDIATION COMPLETE ==========" -ForegroundColor Green
Write-Host "Integration branch: $IntegrationBranch"
Write-Host "development/main were not merged."
Write-Host ""
Write-Host "Now verify the DAG:"
Write-Host ".\scripts\codex-status.ps1"
Write-Host ""
Write-Host "Expected next security task: SEC-004."
Write-Host "Run it with:"
Write-Host ".\scripts\codex-orchestrator.ps1 -MaxTasks 1 -Push"
Write-Host ""
Write-Host "After SEC-004 passes, run the aggregate integration review again."

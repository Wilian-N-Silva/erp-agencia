Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-ErpRepoRoot {
    $root = (& git rev-parse --show-toplevel 2>$null)
    if ($LASTEXITCODE -ne 0 -or -not $root) {
        throw "Execute o script dentro do repositorio Git do ERP."
    }
    return $root.Trim()
}

function Assert-GitClean {
    param([string]$Path)
    Push-Location $Path
    try {
        $status = (& git status --porcelain)
        if ($LASTEXITCODE -ne 0) { throw "Falha ao ler git status." }
        if ($status) {
            throw "Worktree nao esta limpa em '$Path'. Commit/stash/reverta as alteracoes antes de orquestrar.`n$status"
        }
    }
    finally { Pop-Location }
}

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
            throw "git $($GitArgs -join ' ') falhou com exit code $LASTEXITCODE."
        }
    }
    finally { Pop-Location }
}

function Test-GitRef {
    param([string]$RepoRoot, [string]$Ref)
    Push-Location $RepoRoot
    try {
        & git show-ref --verify --quiet $Ref
        return ($LASTEXITCODE -eq 0)
    }
    finally { Pop-Location }
}

function Test-GitAncestor {
    param([string]$RepoRoot, [string]$Ancestor, [string]$Descendant)
    Push-Location $RepoRoot
    try {
        & git merge-base --is-ancestor $Ancestor $Descendant 2>$null
        return ($LASTEXITCODE -eq 0)
    }
    finally { Pop-Location }
}

function Get-TaskCatalog {
    param([string]$RepoRoot, [string]$CatalogPath = "docs/codex/tasks.json")
    $full = Join-Path $RepoRoot $CatalogPath
    if (-not (Test-Path $full)) { throw "Catalogo nao encontrado: $full" }
    return (Get-Content -Raw -Encoding UTF8 $full | ConvertFrom-Json)
}

function Get-TaskById {
    param($Catalog, [string]$TaskId)
    $task = $Catalog.tasks | Where-Object { $_.id -eq $TaskId } | Select-Object -First 1
    if (-not $task) { throw "Task '$TaskId' nao existe no catalogo." }
    return $task
}

function Get-WorktreeRoot {
    param([string]$RepoRoot)
    $parent = Split-Path $RepoRoot -Parent
    $name = Split-Path $RepoRoot -Leaf
    return (Join-Path $parent "$name-codex-worktrees")
}

function Get-WorktreePath {
    param([string]$RepoRoot, [string]$TaskId)
    $root = Get-WorktreeRoot -RepoRoot $RepoRoot
    return (Join-Path $root $TaskId.ToLowerInvariant())
}

function Ensure-LocalExclude {
    param([string]$RepoRoot)
    $exclude = Join-Path $RepoRoot ".git/info/exclude"
    $dir = Split-Path $exclude -Parent
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    if (-not (Test-Path $exclude)) { New-Item -ItemType File -Path $exclude | Out-Null }
    $current = Get-Content $exclude -ErrorAction SilentlyContinue
    foreach ($line in @(".codex-orchestrator/", ".codex-results/")) {
        if ($current -notcontains $line) { Add-Content -Encoding UTF8 -Path $exclude -Value $line }
    }
}

function Get-CodexBaseArgs {
    param([ValidateSet("workspace-write","read-only")][string]$Sandbox, [string]$Model)
    $topHelp = (& codex --help 2>&1 | Out-String)
    $execHelp = (& codex exec --help 2>&1 | Out-String)
    $args = @()
    if ($topHelp -match "--ask-for-approval" -or $topHelp -match "-a,") {
        $args += @("-a", "never")
    }
    if ($Model) { $args += @("-m", $Model) }
    $args += "exec"
    if ($execHelp -match "--sandbox") { $args += @("--sandbox", $Sandbox) }
    return ,$args
}

function Invoke-CodexExec {
    param(
        [string]$WorkingDirectory,
        [string]$Prompt,
        [string]$OutputFile,
        [ValidateSet("workspace-write","read-only")][string]$Sandbox = "workspace-write",
        [string]$Model = ""
    )
    if (-not (Get-Command codex -ErrorAction SilentlyContinue)) {
        throw "Comando 'codex' nao encontrado no PATH."
    }
    $args = Get-CodexBaseArgs -Sandbox $Sandbox -Model $Model
    $execHelp = (& codex exec --help 2>&1 | Out-String)
    if ($OutputFile) {
        New-Item -ItemType Directory -Force -Path (Split-Path $OutputFile -Parent) | Out-Null
        if ($execHelp -match "--output-last-message") {
            $args += @("--output-last-message", $OutputFile)
        }
        elseif ($execHelp -match "-o,") {
            $args += @("-o", $OutputFile)
        }
    }
    $args += $Prompt
    Push-Location $WorkingDirectory
    try {
        & codex @args
        return $LASTEXITCODE
    }
    finally { Pop-Location }
}

function Get-NpmCommand {
    if (Get-Command npm.cmd -ErrorAction SilentlyContinue) { return "npm.cmd" }
    if (Get-Command npm -ErrorAction SilentlyContinue) { return "npm" }
    throw "npm nao encontrado no PATH."
}

function Invoke-TaskGates {
    param(
        [string]$WorktreePath,
        [string[]]$Gates,
        [string]$LogPath
    )
    $npm = Get-NpmCommand
    $lines = New-Object System.Collections.Generic.List[string]
    $ok = $true
    Push-Location $WorktreePath
    try {
        $lines.Add("# git diff --check")
        $out = (& git diff --check 2>&1 | Out-String)
        $lines.Add($out)
        if ($LASTEXITCODE -ne 0) { $ok = $false }

        foreach ($gate in $Gates) {
            if (-not $ok) { break }
            $lines.Add("# npm run $gate")
            $out = (& $npm run $gate 2>&1 | Out-String)
            $lines.Add($out)
            if ($LASTEXITCODE -ne 0) { $ok = $false }
        }
    }
    finally { Pop-Location }
    New-Item -ItemType Directory -Force -Path (Split-Path $LogPath -Parent) | Out-Null
    Set-Content -Encoding UTF8 -Path $LogPath -Value ($lines -join "`n")
    return $ok
}

function Write-OrchestratorRunRecord {
    param([string]$RepoRoot, [string]$TaskId, [hashtable]$Data)
    $dir = Join-Path $RepoRoot ".codex-orchestrator/runs"
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $path = Join-Path $dir "$stamp-$($TaskId.ToLowerInvariant()).json"
    $payload = [ordered]@{
        task = $TaskId
        at = (Get-Date).ToString("o")
    }
    foreach ($k in $Data.Keys) { $payload[$k] = $Data[$k] }
    $payload | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 $path
    return $path
}

# Codex Orchestrator - PowerShell Quick Start

Use **PowerShell only** for this orchestrator. Do not run the scripts from Bash/Git Bash.

## 1. Validate the scripts

```powershell
.\scripts\codex-selfcheck.ps1
```

Do not continue unless it prints `SELF-CHECK PASSED`.

## 2. Check status

```powershell
.\scripts\codex-status.ps1
```

## 3. Run one task first

```powershell
.\scripts\codex-orchestrator.ps1 -MaxTasks 1 -Push
```

## 4. Check status again

```powershell
.\scripts\codex-status.ps1
```

## 5. Run a larger batch after the first cycle succeeds

```powershell
.\scripts\codex-orchestrator.ps1 -MaxTasks 3 -Push
```

## 6. Review the integration candidate

```powershell
.\scripts\codex-integration-review.ps1
```

The orchestrator creates/reuses `feature/codex-integration`, integrates task branches into it, and never merges it into `development`.

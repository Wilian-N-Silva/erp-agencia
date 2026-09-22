# Aplicar Codex Orchestrator v2

Aplique estes arquivos na branch que contem a infraestrutura de orquestracao, normalmente `feature/codex-integration`.

Nao apague os PRDs nem os runbooks existentes; mescle/substitua apenas os arquivos correspondentes deste pacote.

Depois:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
Get-ChildItem .\scripts\*.ps1 | Unblock-File
.\scripts\codex-selfcheck.ps1

git add AGENTS.md docs scripts README.md
git commit -m "fix(codex): harden orchestration and disposable test db"
```

Para recuperar a SEC-002 atual sem nova chamada de implementacao:

```powershell
.\scripts\codex-orchestrator.ps1 -MaxTasks 1 -Push
.\scripts\codex-status.ps1
```

O worker deve detectar a worktree `sec-002` existente, executar os gates, commitar, revisar e integrar.

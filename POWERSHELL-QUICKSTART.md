# PowerShell Quick Start - Codex Orchestrator v2

Use somente PowerShell neste projeto.

## 1. Preparar a sessao

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
Get-ChildItem .\scripts\*.ps1 | Unblock-File
.\scripts\codex-selfcheck.ps1
```

## 2. Ver status

```powershell
.\scripts\codex-status.ps1
```

## 3. Executar uma task

```powershell
.\scripts\codex-orchestrator.ps1 -MaxTasks 1 -Push
```

Tasks com gate `test:db` agora usam automaticamente o container `erp-agencia-postgres`, recriam `erp_agencia_test`, aplicam migrations e executam a suite.

## 4. Retomada automatica

Se uma execucao do Codex terminar com exit code diferente de zero, mas tiver produzido alteracoes, a worktree e preservada. Ao rodar o orquestrador novamente, o worker retoma as alteracoes existentes, roda os gates e nao chama o Codex de implementacao novamente.

## 5. Review agregado

```powershell
.\scripts\codex-integration-review.ps1
```

Nenhum script faz merge em `development`.

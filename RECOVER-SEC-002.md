# SEC-002 -> SEC-003

Com os testes manuais ja aprovados, falta apenas transformar a worktree em uma task integrada.

## Caminho recomendado depois de aplicar o patch

```powershell
.\scripts\codex-selfcheck.ps1
.\scripts\codex-orchestrator.ps1 -MaxTasks 1 -Push
.\scripts\codex-status.ps1
```

Nao rode o Codex manualmente para SEC-002 novamente.

## Resultado esperado

- SEC-002: `integrated`
- SEC-003: `ready`
- SEC-005: `ready`
- CORE-001: `ready`

A ordem do catalogo faz o proximo `-MaxTasks 1` escolher SEC-003 primeiro.

Para iniciar SEC-003 depois de confirmar o status:

```powershell
.\scripts\codex-orchestrator.ps1 -MaxTasks 1 -Push
```

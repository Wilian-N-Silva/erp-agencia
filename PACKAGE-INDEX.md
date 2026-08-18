# Codex Orchestrator v1 — arquivos

## Substituir

- `AGENTS.md`
- `docs/README.md`
- `docs/08-codex-execution-plan.md`

## Adicionar

- `docs/11-codex-orchestration.md`
- `docs/codex/tasks.json`
- `scripts/codex-common.ps1`
- `scripts/codex-worker.ps1`
- `scripts/codex-review.ps1`
- `scripts/codex-orchestrator.ps1`
- `scripts/codex-status.ps1`
- `scripts/codex-integration-review.ps1`

## Guia

- `APPLY-ORCHESTRATOR.md`

Primeiro teste recomendado:

```powershell
.\\scripts\\codex-status.ps1
.\\scripts\\codex-orchestrator.ps1 -MaxTasks 1 -Push
```

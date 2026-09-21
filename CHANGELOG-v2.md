# Orchestrator v2 - correcoes apos SEC-002

- PowerShell-only.
- Paths internos via `Join-Path`.
- Worker retoma worktree existente sem nova implementacao.
- Exit code nao-zero do Codex com alteracoes produzidas vira warning; gates decidem.
- Banco `erp_agencia_test` criado/resetado automaticamente no Docker para gates `test:db`.
- `db:migrate` executado automaticamente antes de `test:db`.
- Gates de integracao incluem gates especificos da task.
- `tasks.json` inclui `test:db` para RLS/fundacao DB e dominios financeiros/operacionais com persistencia critica.
- Self-check valida tambem `docker`.

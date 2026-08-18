# Aplicar o orquestrador

Copie para a raiz do repositório:

```text
AGENTS.md                              -> substituir
docs/README.md                         -> substituir/adicionar
scripts/codex-common.ps1              -> adicionar
scripts/codex-worker.ps1              -> adicionar
scripts/codex-review.ps1              -> adicionar
scripts/codex-orchestrator.ps1        -> adicionar
scripts/codex-status.ps1              -> adicionar
scripts/codex-integration-review.ps1  -> adicionar
docs/codex/tasks.json                 -> adicionar
docs/11-codex-orchestration.md        -> adicionar
```

Não apague os scripts antigos ainda; mantenha `codex-task.ps1`/`codex-night.ps1` até validar o novo fluxo.

Depois:

```powershell
git diff --check
npm run typecheck
npm run lint
npm run test
```

Commit sugerido:

```powershell
git add AGENTS.md scripts docs/codex docs/11-codex-orchestration.md
git commit -m "chore: add Codex task orchestrator"
```

Quando esse commit estiver na branch que você usa como base local, rode:

```powershell
.\\scripts\\codex-status.ps1
.\\scripts\\codex-orchestrator.ps1 -MaxTasks 1 -Push
```

Valide a primeira task antes de liberar um lote maior.

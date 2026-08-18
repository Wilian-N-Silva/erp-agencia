# Runbooks

Preserve os runbooks existentes do repositório:

- `backup-restore.md`;
- `database-roles.md`;
- `staging-setup.md`;
- `production-setup.md`.

Eles continuam operacionais, mas deverão ser atualizados pelas tasks que alterarem:

- credencial runtime vs migration;
- RLS;
- novo smoke test financeiro/gráfica;
- rate limiting;
- novas migrations/backfills;
- políticas de backup e restore de novos dados.

Não substitua os runbooks existentes por este README.

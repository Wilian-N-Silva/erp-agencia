# Runbooks

Para instalar o MVP, comece pelo [guia de ambiente](environment-setup.md).
Ele explica templates, roles, autenticação, storage e separação entre runtime,
bootstrap e testes. A Vercel foi suspensa pelo responsável em 22/09/2026 após
remoção do banco remoto.

Preserve os runbooks existentes do repositório:

- `backup-restore.md`;
- `database-roles.md`;
- `user-employee-link-rollout.md`;
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

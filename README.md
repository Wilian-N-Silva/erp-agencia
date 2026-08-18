# Sistema Interno FG

Base inicial para o sistema interno descrito em `docs/PRD-Sistema-Interno-FG-v1.md`.

## Stack

- Next.js App Router
- React
- shadcn/ui + Tailwind CSS
- PostgreSQL 17 (Neon em produção e Docker local)
- Drizzle ORM + node-postgres para o runtime transacional
- Better Auth
- Vitest

## Setup local

1. Copie `.env.example` para `.env`.
2. Preencha `DATABASE_URL`, `DATABASE_DIRECT_URL`, `BETTER_AUTH_SECRET`, credenciais Google e `INITIAL_ADMIN_EMAIL`.
3. Instale dependências com `npm.cmd install`.
4. Gere migrations com `npm.cmd run db:generate`.
5. Rode migrations com `npm.cmd run db:migrate`.
6. Rode o seed com `npm.cmd run db:seed`.
7. Inicie o app com `npm.cmd run dev`.

## Login local

Google OAuth funciona em localhost quando o OAuth client do Google tem a origem
`http://localhost:3000` e o callback `http://localhost:3000/api/auth/callback/google`
configurados.

Para testar sem OAuth externo, mantenha `ENABLE_EMAIL_PASSWORD_AUTH=true` no `.env`.
`ENABLE_EMAIL_PASSWORD_SIGN_UP=true` habilita criacao de acesso por email e senha fora de
producao. Em producao, email/senha e cadastro ficam desabilitados por padrao quando essas
variaveis nao forem definidas.

## Banco local com Docker

1. Copie os valores de `.env.docker.example` para `.env` se quiser usar o Postgres local.
2. Suba o banco com `docker compose up -d postgres`.
3. Rode `npm.cmd run db:migrate`.
4. Rode `npm.cmd run db:seed`.
5. Acesse `/login` e entre com `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` definidos no `.env`.

Para carregar usuarios e registros de demonstracao locais usados nos testes E2E,
defina `SEED_DEMO_DATA=true` antes de executar `npm.cmd run db:seed`. A senha
padrao desses usuarios e controlada por `DEMO_USER_PASSWORD`.

Para validar migrations localmente com Docker, use uma URL como:

```text
postgres://erp:erp@localhost:55432/erp_agencia
```

Para validar o isolamento transacional exigido pelo runtime, configure
`DATABASE_TEST_URL` com um banco descartável e execute:

```text
npm.cmd run test:db
```

Repita essa validação com uma URL pooled de um branch Neon de teste antes de
promover uma mudança de runtime. Nunca aponte `DATABASE_TEST_URL` para dados de
staging ou produção.

## Validacao

```text
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
npm.cmd run test:db
npm.cmd run build
```

## Prioridade de implementação

A fundação segue a ordem bloqueante do PRD:

1. Auth
2. RBAC
3. DAL
4. Audit logs
5. Banco e migrations
6. Layout privado
7. Módulos principais

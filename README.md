# Sistema Interno FG

Base inicial para o sistema interno descrito em `docs/PRD-Sistema-Interno-FG-v1.md`.

## Stack

- Next.js App Router
- React
- shadcn/ui + Tailwind CSS
- PostgreSQL Neon Serverless
- Drizzle ORM
- pg for local Drizzle migration validation
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

Para validar migrations localmente com Docker, use uma URL como:

```text
postgres://erp:erp@localhost:55432/erp_agencia
```

## Validacao

```text
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test
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

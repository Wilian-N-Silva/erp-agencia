# AGENTS.md — Sistema Interno FG

Este arquivo é o briefing canônico para qualquer agente de código que atue neste repositório. Mantenha-o curto, operacional e atualizado. Detalhes de produto ficam em `docs/`.

## 1. Fonte de verdade

Antes de alterar código:

1. Leia `docs/README.md`.
2. Identifique a task solicitada no `docs/08-codex-execution-plan.md`.
3. Leia o PRD do domínio indicado pela task.
4. Leia obrigatoriamente:
   - `docs/06-security-and-rls.md`;
   - `docs/07-test-strategy.md`;
   - `docs/git-workflow.md`.
5. Se houver mudança de schema, migration, backfill ou semântica de dados, leia também `docs/09-migration-rollout.md`.
6. Leia o código real antes de implementar. Documentação histórica não substitui o estado atual do código.

Quando a instrução do usuário for apenas **“continue”**, **“next”**, **“continue o projeto”** ou equivalente, consulte primeiro `docs/08-codex-execution-plan.md` e execute somente a próxima task marcada como `ready`.

Quando a instrução for **“night-run”**, siga `docs/10-codex-operations.md` e processe apenas a fila noturna explicitamente aprovada. Não invente tasks nem desbloqueie dependências por conta própria.

## 2. Regra de escopo

Uma execução deve implementar **uma task atômica**, salvo quando o execution plan disser explicitamente que um grupo deve ser feito na mesma branch.

Não antecipe tasks futuras para “aproveitar a viagem”. Alterações adicionais só são permitidas quando forem indispensáveis para concluir a task atual; nesse caso, documente o motivo no resumo final.

Nunca altere requisitos de negócio silenciosamente para acomodar o código existente.

## 3. Git obrigatório

O fluxo oficial está em `docs/git-workflow.md`:

- `main` = release;
- `development` = integração;
- toda feature/fix/chore nasce da `development` atualizada;
- nunca implementar diretamente em `main`;
- não implementar feature diretamente em `development`;
- merge de feature/fix/chore volta para `development`;
- `development` só é promovida para `main` em release.

Em sessão manual, confirme a branch/worktree antes de alterar arquivos.

Quando a execução vier de `scripts/codex-task.ps1` ou `scripts/codex-night.ps1`, **o wrapper é o dono das operações Git**. Nesse modo, não faça checkout, merge, commit, reset, rebase ou qualquer escrita em `.git`; apenas implemente a task na branch já preparada.

Quando a execução vier de `scripts/codex-orchestrator.ps1` / `scripts/codex-worker.ps1`, a branch-base operacional passa a ser `feature/codex-integration`. Cada task nasce dela, o wrapper executa gates/review/commit e depois absorve a task de volta em `feature/codex-integration`. **O agente nunca deve mergear ou escrever em `development`/`main`.** A branch de integração é apenas um release candidate para revisão humana posterior.

Em execução manual sem wrapper, siga o workflow normal e não faça merge em `development` ou `main` sem instrução explícita do integrador.

Antes de finalizar alterações, execute `git diff --check` quando o sandbox permitir leitura Git e reporte qualquer worktree inesperada.

## 4. Arquitetura e convenções

Stack atual:

- Next.js 15 App Router;
- React 19;
- TypeScript strict;
- PostgreSQL 17 / Neon em produção;
- Drizzle ORM + drizzle-kit;
- Better Auth;
- Zod 4;
- Vitest + Playwright;
- Cloudflare R2 para arquivos em produção;
- design system próprio em `src/components/fg`.

Convensões:

- Server Actions em `src/features/*/actions.ts`.
- DAL em `src/features/*/dal.ts`.
- Regras puras/invariantes em `src/features/*/rules.ts`.
- Toda entrada externa é validada no servidor com Zod.
- Toda mutação sensível verifica autorização no servidor.
- Toda query de negócio deve respeitar `organizationId` no DAL **e** RLS quando a tabela estiver na matriz RLS.
- UI pode esconder ações, mas nunca é fronteira de autorização.
- Operações multi-write críticas usam transação.
- Toda mutação crítica produz audit log com before/after quando aplicável.
- IDs recebidos do cliente sempre passam por validação de organização/escopo; nunca confiar em IDs ocultos em forms.
- Valores monetários são persistidos no formato já adotado pelo projeto; não introduzir float para dinheiro.
- Não remover soft-delete/histórico para “simplificar”.

## 5. Segurança obrigatória

Para toda task, avalie explicitamente:

- autenticação;
- autorização server-side;
- RBAC;
- escopo de organização;
- PostgreSQL RLS;
- IDOR;
- validação Zod;
- mass assignment / payload tampering;
- rate limiting;
- auditoria;
- transações;
- upload seguro;
- exposição de dados sensíveis;
- tratamento de erros sem vazamento de segredo/dado;
- sessão e revogação quando a task toca usuários/acesso.

**RLS não substitui RBAC/DAL. RBAC/DAL não substitui RLS.**

Não crie uma nova tabela de negócio com `organizationId` sem policy RLS correspondente e testes cross-tenant, salvo se a task documentar explicitamente uma exceção.

## 6. Banco e migrations

- Migrations são geradas por drizzle-kit e ficam em `drizzle/`.
- Não editar migration já aplicada para “corrigir histórico”. Criar migration nova.
- Manter sequência linear; se houver colisão com outra branch, regenerar antes do merge.
- Runtime deve usar credencial de aplicação restrita.
- `DATABASE_DIRECT_URL` é reservada para migration/admin conforme `docs/06-security-and-rls.md`.
- Toda alteração destrutiva segue expand → migrate/backfill → contract, quando possível.
- Migrations com backfill devem ser idempotentes ou possuir checkpoint claro.

## 7. Rate limiting

Não assumir que o rate limit de autenticação cobre o restante da aplicação.

Ações sensíveis devem usar o mecanismo definido em `docs/06-security-and-rls.md`, especialmente:

- uploads;
- exports;
- tentativas de aprovação/rejeição repetidas;
- conciliação financeira;
- convites/gestão de acesso;
- endpoints públicos ou pré-auth.

Não usar contador apenas em memória como proteção de produção em Vercel.

## 8. Testes obrigatórios

Toda mudança de comportamento adiciona ou ajusta teste.

Gates mínimos por task:

```powershell
npm run typecheck
npm run lint
npm run test
```

Quando aplicável:

```powershell
npm run build
npm run test:e2e
```

Tasks de banco/RLS devem também executar os testes de segurança e migration descritos em `docs/07-test-strategy.md`.

Não declarar sucesso com teste obrigatório falhando. Se um teste pré-existente falhar e não estiver relacionado, registrar evidência clara e não mascará-lo.

## 9. Critério de conclusão do agente

Ao finalizar uma task, responder com:

1. task executada;
2. branch atual, se disponível;
3. resumo do comportamento implementado;
4. arquivos alterados;
5. migrations/backfills criados;
6. testes criados/alterados;
7. comandos executados e resultados;
8. critérios de aceite atendidos;
9. riscos, débitos ou bloqueios encontrados;
10. se o wrapper estiver gerenciando Git, deixar claro que o commit será feito pelo wrapper.

Não marcar uma task como `done` no execution plan durante uma feature branch. No modo orquestrado, uma task é considerada integrada apenas quando sua branch está contida em `feature/codex-integration`; isso não significa release nem merge em `development`. A promoção para `development` continua sendo uma decisão humana posterior.

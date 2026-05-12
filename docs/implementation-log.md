# Implementation Log

Projeto: Sistema Interno FG  
Data inicial: 2026-05-12 13:00:04 -03:00  
Fonte principal: `docs/PRD-Sistema-Interno-FG-v1.md`  
Workflow Git: `docs/git-workflow.md`

## Regras de trabalho registradas

1. `main` deve ser usada como branch de release.
2. `development` deve ser usada como branch central de integração.
3. Features, fixes e chores devem sair de `development`.
4. Trabalho de produto não deve ser feito diretamente em `main`.
5. Trabalho de produto não deve ser feito diretamente em `development`, salvo manutenção explícita dessa branch.
6. Feature branches devem voltar para `development`.
7. `development` só deve ser promovida para `main` em releases.

## Estado inicial observado

1. O workspace continha apenas a pasta `docs`.
2. Arquivos existentes em `docs`:
   - `docs/PRD-Sistema-Interno-FG-v1.md`
   - `docs/git-workflow.md`
3. O diretório `C:\projects\erp-agencia` ainda não estava inicializado como repositório Git.
4. `git status --short` retornou erro porque não havia diretório `.git`.
5. Node.js disponível: `v24.13.0`.
6. `npm` via PowerShell estava bloqueado pela execution policy do Windows.
7. `npm.cmd` estava disponível e retornou versão `11.5.2`.

## Decisões tomadas

1. Usar o PRD como especificação base do sistema.
2. Começar pela fundação técnica antes de telas avançadas, seguindo a ordem obrigatória do PRD:
   - Auth
   - RBAC
   - DAL
   - Audit logs
   - Banco e migrations
   - Layout privado
   - Módulos principais
3. Tratar segurança, rastreabilidade e permissões como requisitos bloqueantes.
4. Escolher Drizzle ORM como ORM final, atendendo à decisão do usuário e mantendo compatibilidade com PostgreSQL/Neon, migrations versionadas e Auth.js adapter.
5. Escolher Better Auth como biblioteca de autenticação, por solicitação do usuário e por encaixar melhor com Drizzle, Next.js App Router e evolução futura de sessão, organizações e controles de acesso.
6. Usar `npm.cmd` para comandos npm neste ambiente Windows, evitando o bloqueio de `npm.ps1`.
7. Criar uma base de projeto Next.js manualmente, já que o workspace estava vazio.
8. Registrar a leitura posterior do workflow Git como correção de processo: antes de novas mudanças de produto, o repositório deve ser inicializado e a branch correta deve ser criada.

## Passos executados

1. Lido `docs/PRD-Sistema-Interno-FG-v1.md`.
2. Confirmado que o PRD tem 1937 linhas.
3. Confirmado que a acentuação do PRD está correta quando lida como UTF-8.
4. Inspecionado o workspace.
5. Confirmado que não existia repositório Git inicializado.
6. Confirmado que só havia documentação no workspace antes das primeiras edições.
7. Verificada a versão do Node.js.
8. Verificado bloqueio de `npm.ps1` por execution policy.
9. Verificada disponibilidade de `npm.cmd`.
10. Criados arquivos iniciais de fundação:
    - `package.json`
    - `tsconfig.json`
    - `next-env.d.ts`
    - `next.config.ts`
    - `postcss.config.mjs`
    - `tailwind.config.ts`
    - `eslint.config.mjs`
    - `vitest.config.ts`
    - `.gitignore`
    - `.env.example`
    - `components.json`
    - `README.md`
11. Lido `docs/git-workflow.md`.
12. Registrado que o workflow exige branch de trabalho criada a partir de `development`.
13. Inicializado repositório Git em `main`.
14. Criado commit inicial em `main` com documentação e workflow: `ae73c49 docs: add project requirements and workflow`.
15. Adicionado `.gitattributes` no commit inicial para manter arquivos de texto com LF.
16. Criada branch `development` a partir de `main`.
17. Criada branch `chore/project-foundation` a partir de `development`.
18. Ajustado `core.excludesfile` local para `.git/info/exclude`, evitando aviso de acesso negado ao ignore global do usuário.
19. Alterada decisão de ORM de Prisma para Drizzle ORM por solicitação do usuário.
20. Atualizados `package.json` e `README.md` para Drizzle ORM, `drizzle-kit`, Neon serverless driver e adapter Drizzle para autenticação.
21. Alterada decisão de autenticação de Auth.js para Better Auth por solicitação do usuário.
22. Consultada documentação oficial do Better Auth para integração com Drizzle, Next.js e schema core.
23. Atualizados `package.json`, `.env.example` e `README.md` para Better Auth.

## Exceção operacional

As primeiras edições de fundação foram feitas antes da leitura de `docs/git-workflow.md`. Como o diretório ainda não era um repositório Git, não havia branch `development` disponível para cumprir a regra de branching naquele momento.

Correção aplicada em 2026-05-12:

1. O repositório Git foi inicializado.
2. `main` foi criada com documentação e workflow.
3. `development` foi criada a partir de `main`.
4. `chore/project-foundation` foi criada a partir de `development`.
5. Os arquivos técnicos de scaffold permanecem não commitados na branch de trabalho até validação.

## Pendências abertas

1. Instalar dependências.
2. Criar schema Drizzle, seed e migrations.
3. Implementar RBAC, DAL e audit logger.
4. Criar layout privado e portal.
5. Configurar testes iniciais de autorização e regras críticas.
6. Decidir pendências do PRD:
   - nome final do sistema
   - domínio ou subdomínio interno
   - provedor de storage
   - domínio permitido para login
   - primeiro usuário admin
   - limite de upload
   - política de retenção de documentos
   - categorias financeiras finais
   - cargos e áreas iniciais
   - modelo padrão de descritivo de NF
   - escopo inicial do portal para CLT

## Atualizacao de planejamento em 2026-05-12

1. `npm.cmd install` foi executado para validar a fundacao.
2. A primeira tentativa falhou por permissao de escrita no cache npm do usuario.
3. A segunda tentativa foi executada com permissao aprovada.
4. Foi encontrado conflito de dependencias:
   - `better-auth@1.6.10` resolve `@better-auth/drizzle-adapter@1.6.10`.
   - `@better-auth/drizzle-adapter@1.6.10` exige `drizzle-orm@^0.45.2`.
   - `package.json` ainda usa `drizzle-orm@^0.38.4`.
5. Criado `docs/implementation-plan.md` com ondas de execucao, branches, dependencias, escopos de escrita, criterios de validacao e template de handoff para subagentes.

## Atualizacao de fundacao em 2026-05-12

1. Resolvido o conflito de dependencias atualizando `drizzle-orm` para `^0.45.2`.
2. Resolvido o conflito de Better Auth com Zod atualizando `zod` para `^4.0.0`.
3. Atualizado `drizzle-kit` para `^0.31.5`.
4. Adicionado `pg` como driver de migracao local para Drizzle Kit.
5. Gerado `package-lock.json` com `npm.cmd install`.
6. Corrigido lint para usar `eslint .` com compatibilidade de config do Next.
7. Criados `src/app/layout.tsx`, `src/app/page.tsx` e `src/app/globals.css`.
8. Criado scaffold de seed em `src/lib/db/seed.ts`.
9. Criado teste inicial de helpers de ambiente em `src/tests/env.test.ts`.
10. Gerada migration inicial em `drizzle/0000_lyrical_junta.sql`.
11. Validada migration em Docker com `postgres:17-alpine` na porta local `55432`.
12. Comandos validados com sucesso:
    - `npm.cmd run typecheck`
    - `npm.cmd run lint`
    - `npm.cmd run test`
    - `npm.cmd run db:generate`
    - `npm.cmd run db:migrate`
    - `npm.cmd run db:seed`
    - `npm.cmd run build`

## Atualizacao de autenticacao em 2026-05-12

1. Criada branch `feature/auth-better-auth` a partir de `development`.
2. Implementada configuracao Better Auth com Drizzle adapter em `src/lib/auth/index.ts`.
3. Criada rota catch-all de autenticacao em `src/app/api/auth/[...all]/route.ts`.
4. Criados helpers de configuracao de auth em `src/lib/auth/config.ts`.
5. Criado helper server-side de sessao em `src/lib/auth/session.ts`.
6. Criado client Better Auth em `src/lib/auth/client.ts`.
7. Criada pagina de login com botao Google em `src/app/login/page.tsx`.
8. Criado middleware para proteger `/app` e `/portal` por presenca de cookie de sessao.
9. Adicionado bloqueio de dominio de e-mail no hook de criacao de usuario quando `ALLOWED_EMAIL_DOMAIN` estiver configurado.
10. Adicionadas variaveis `BETTER_AUTH_TRUSTED_ORIGINS` e `NEXT_PUBLIC_BETTER_AUTH_URL` em `.env.example`.
11. Criado placeholder temporario de `/app` para callback pos-login ate a branch de app shell.
12. Tornado o cliente Drizzle lazy para evitar falha de build sem `DATABASE_URL` durante coleta de rotas.
13. Adicionados testes para helpers de configuracao de auth.
14. Comandos validados com sucesso:
    - `npm.cmd run typecheck`
    - `npm.cmd run lint`
    - `npm.cmd run test`
    - `npm.cmd run build`

## Atualizacao de RBAC e DAL em 2026-05-12

1. Criada branch `feature/rbac-dal` a partir de `development`.
2. Criados papeis canonicos em `src/lib/rbac/permissions.ts`.
3. Criadas permissoes canonicas e descricoes para o seed.
4. Criado mapa conservador de permissoes por papel em `src/lib/rbac/policy.ts`.
5. Confirmado que Admin Tecnico nao recebe acesso padrao a financeiro, remuneracao ou documentos sensiveis.
6. Criados guards `can`, `canAny`, `assertCan` e `assertCanAny`.
7. Criado erro generico `AccessDeniedError` sem vazamento de existencia de registro.
8. Criado `AccessContext` e resolver server-side em `src/lib/dal/context.ts`.
9. Criadas regras de escopo para colaborador proprio e lideranca de equipe direta.
10. Atualizado seed scaffold para expor contagens de papeis, permissoes e grants RBAC.
11. Adicionados testes de matriz RBAC, erro generico e escopo DAL.
12. Comandos validados com sucesso:
    - `npm.cmd run typecheck`
    - `npm.cmd run lint`
    - `npm.cmd run test`
    - `npm.cmd run build`
    - `npm.cmd run db:seed`

## Atualizacao de auditoria em 2026-05-12

1. Criada branch `feature/audit-logging` a partir de `development`.
2. Criados tipos de acoes e entidades auditaveis em `src/lib/audit/types.ts`.
3. Criado sanitizador de payloads com redacao de segredos, tokens, cookies e credenciais.
4. Criado extrator de metadados de request para IP e user agent.
5. Criado builder de payload de audit log exigindo `organizationId`.
6. Criado `writeAuditLog` para gravar em `audit_logs`.
7. Criado helper `auditSensitiveRead` para leituras sensiveis.
8. Criados guards `canReadAuditLogs` e `assertCanReadAuditLogs`.
9. Adicionados testes de sanitizacao, metadados, obrigatoriedade de organizacao e autorizacao de leitura.
10. Comandos validados com sucesso:
    - `npm.cmd run typecheck`
    - `npm.cmd run lint`
    - `npm.cmd run test`
    - `npm.cmd run build`

## Atualizacao de layout privado em 2026-05-12

1. Criada branch `feature/app-shell-navigation` a partir de `development`.
2. Removido placeholder temporario de `src/app/app/page.tsx`.
3. Criado route group privado em `src/app/(private)`.
4. Criado layout privado server-side com `getCurrentAccessContext`.
5. Criado shell visual em `src/components/layout/app-shell.tsx`.
6. Criada navegacao filtrada por permissoes em `src/components/layout/navigation-items.ts`.
7. Criadas paginas iniciais para `/app`, `/portal` e `/acesso-negado`.
8. Adicionados testes para navegacao filtrada por permissao.
9. Comandos validados com sucesso:
    - `npm.cmd run typecheck`
    - `npm.cmd run lint`
    - `npm.cmd run test`
    - `npm.cmd run build`

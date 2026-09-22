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

## Atualizacao de login local em 2026-05-12

1. Confirmado que o login anterior dependia somente de Google OAuth.
2. Mantido Google OAuth, mas a pagina agora exibe o botao apenas quando `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` existem.
3. Habilitado fallback de email e senha para desenvolvimento/local com `ENABLE_EMAIL_PASSWORD_AUTH`.
4. Habilitado cadastro local controlado por `ENABLE_EMAIL_PASSWORD_SIGN_UP`.
5. Em producao, email/senha e cadastro ficam desabilitados por padrao quando as variaveis nao forem definidas.
6. Atualizados `.env.example`, README e testes de configuracao de auth.
7. Comandos validados com sucesso:
   - `npm.cmd run typecheck`
   - `npm.cmd run test`
   - `npm.cmd run lint`
   - `npm.cmd run build`

## Atualizacao de financeiro e clientes em 2026-05-12

1. Continuada a branch `feature/finance-clients` a partir de `development`.
2. Criadas regras puras para status financeiro automatico, dinheiro em centavos, previsao de 30 dias e geracao de codigo de cliente.
3. Criado DAL de leitura para dashboard financeiro, entradas, saidas, provisoes e carteira de clientes com escopo por organizacao.
4. Criadas rotas privadas `/app/financeiro` e `/app/clientes` com renderizacao dinamica e autorizacao server-side.
5. Criadas server actions para criar clientes, alterar status de clientes, criar entradas, criar saidas, criar provisoes, marcar recebido/pago, cancelar e inativar.
6. Todas as mutacoes validam `FormData` com Zod, exigem RBAC server-side, filtram por `organizationId`, revalidam a rota e geram log de auditoria.
7. A visualizacao de fee mensal de clientes fica oculta para perfis sem `finance.read`.
8. Adicionados testes para status automatico, calculos financeiros, normalizacao de dinheiro, escopo de clientes e redacao de valores.
9. Comandos validados com sucesso:
   - `npm.cmd run typecheck`
   - `npm.cmd run test`
   - `npm.cmd run lint`
   - `npm.cmd run build`

## Atualizacao de banco local em 2026-05-12

1. Criado `docker-compose.yml` com Postgres 17 local na porta `55432`.
2. Criado `.env.docker.example` com variaveis locais para Docker, auth por email/senha e usuario admin de teste.
3. Atualizado `.env` local para usar `postgres://erp:erp@127.0.0.1:55432/erp_agencia`.
4. Ajustado runtime do banco para usar Neon HTTP em URLs remotas e `pg`/node-postgres em URLs locais.
5. Substituido seed scaffold por seed real com organizacao, papeis, permissoes, grants, admin local, colaborador vinculado, clientes e dados financeiros de exemplo.
6. Executado `docker compose up -d postgres` com sucesso.
7. Executado `npm.cmd run db:migrate` com sucesso.
8. Executado `npm.cmd run db:seed` com sucesso.
9. Validado que `/login` responde em `http://localhost:3000/login`.
10. Comandos validados com sucesso:
    - `npm.cmd run typecheck`
    - `npm.cmd run test`
    - `npm.cmd run lint`
11. `npm.cmd run build` compilou, mas falhou na coleta de paginas enquanto o dev server existente estava usando `.next`; nao foi reiniciado nem removido cache para nao interromper a sessao local em `3000`.
12. Corrigido adapter Better Auth/Drizzle para receber schema singular (`user`, `account`, `session`, `verification`) mapeado para as tabelas Drizzle exportadas em plural.
13. Validado POST `/api/auth/sign-in/email` com admin local retornando `200`.
14. Ajustado layout privado para usar toda a largura disponivel do conteudo, evitar overflow de inputs em formularios financeiros/clientes e exibir datas em formato brasileiro (`dd/mm/aaaa`).
15. Sidebar ajustada para exibir apenas features implementadas: Dashboard, Financeiro, Clientes e Portal.
16. Adicionados filtros server-side por query string em Financeiro e Clientes, com normalizacao testada, busca textual, filtro de competencia e status.
17. Adicionada exportacao CSV de Financeiro em `/app/financeiro/exportar`, restrita a `finance.export`, preservando filtros atuais e gerando log de auditoria.
18. Financeiro ajustado para abrir criacao de entradas, saidas e provisoes em dialogs, com edicao de entradas e saidas tambem em dialogs por linha.
19. Clientes ajustado para cadastro em `/app/clientes/novo` e detalhe/edicao em `/app/clientes/[id]`.
20. Detalhe de cliente passou a exibir dados ampliados, acoes de status e historico recente de auditoria quando o perfil pode ler logs.

## Atualizacao de central de cobranca de clientes em 2026-05-13

1. Refeito o detalhe de cliente em `/app/clientes/[id]` como central de cobranca recorrente com abas de resumo, pagamentos, cobranca, contratos/documentos, historico e observacoes internas.
2. Adicionadas regras puras para vencimento recorrente, elegibilidade de geracao de entrada prevista, status financeiro mensal do cliente, pagamento parcial e lembretes de cobranca.
3. Criado DAL expandido para perfil de cobranca, historico de pagamentos, resumo financeiro, lembretes e alertas de clientes sem enviar valores para perfis sem `finance.read`.
4. Criadas server actions para atualizar perfil de cobranca, gerar entrada prevista, marcar pagamento recebido pelo detalhe do cliente e editar observacoes internas.
5. A geracao de entrada prevista bloqueia clientes cancelados ou sem cobranca valida e evita duplicar a mesma competencia/descricao.
6. Lembretes internos cobrem cobranca proxima do vencimento, vencendo hoje, atrasada, pagamento parcial e multiplas cobrancas abertas.
7. Dashboard `/app` passou a exibir alertas de cobranca para usuarios com permissao financeira.
8. Listagem de clientes passou a separar clientes pausados da carteira ativa/cancelada.
9. Seed local passou a criar perfis de cobranca, metodos de pagamento e valores recebidos de exemplo.
10. Comandos validados com sucesso:
    - `npm.cmd run typecheck`
    - `npm.cmd run lint`
    - `npm.cmd run test`
    - `npm.cmd run db:migrate`
    - `npm.cmd run db:seed`
    - `npm.cmd run build`

## Atualizacao de colaboradores e remuneracao em 2026-05-13

1. Iniciada a proxima fatia da Wave 2 com modulo de colaboradores e remuneracao.
2. Criadas tabelas `compensation_history` e `employee_benefits` para historico de remuneracao e beneficios.
3. Gerada migration `drizzle/0002_youthful_squadron_sinister.sql`.
4. Criadas regras puras para matricula `FG-00001`, escopo de leitura, redacao de remuneracao, tempo de casa, diferenca de remuneracao e beneficios ativos.
5. Criado DAL de colaboradores com escopo por permissao: diretoria/RH/financeiro veem conforme perfil, lideranca ve equipe direta e colaborador ve apenas proprio registro.
6. DTOs de colaboradores ocultam remuneracao para perfis sem permissao de compensacao e ocultam dados pessoais sensiveis quando o perfil nao pode le-los.
7. Criadas server actions para cadastrar/editar colaborador, alterar remuneracao com historico auditado, criar beneficio e encerrar beneficio.
8. Criadas rotas privadas:
   - `/app/colaboradores`
   - `/app/colaboradores/novo`
   - `/app/colaboradores/[id]`
   - `/app/colaboradores/[id]/remuneracao`
9. Navegacao lateral passou a exibir Colaboradores para perfis com permissao de pessoas.
10. Seed local passou a criar colaborador PJ de exemplo, historico de remuneracao e beneficio recorrente.
11. Adicionados testes de regras de pessoas/remuneracao e atualizados testes de navegacao.
12. Comandos validados com sucesso:
    - `npm.cmd run typecheck`
    - `npm.cmd run lint`
    - `npm.cmd run test`
    - `npm.cmd run db:migrate`
    - `npm.cmd run db:seed`
    - `npm.cmd run build`

## Atualizacao de portal, NFs e reembolsos em 2026-05-13

1. Implementada a primeira fatia do fluxo de portal, notas fiscais PJ e reembolsos sobre as tabelas existentes.
2. Criadas regras puras para composicao de NF, soma de itens com descontos, divergencia de valor emitido, escopo de leitura de NF e transicoes de reembolso.
3. Criado DAL de portal com:
   - resumo do colaborador atual
   - NFs proprias ou administrativas conforme permissao
   - reembolsos proprios, de equipe direta ou globais conforme perfil
   - opcoes de colaboradores PJ para o financeiro publicar solicitacoes de NF
4. Criadas server actions para:
   - publicar solicitacao de NF para PJ
   - colaborador informar valor emitido da NF
   - financeiro aprovar, solicitar ajuste/recusar e marcar NF como paga
   - colaborador enviar reembolso
   - lideranca aprovar/recusar reembolso da equipe
   - financeiro aprovar/recusar e marcar reembolso como pago
5. Aprovacao de NF gera saida financeira prevista com log de auditoria.
6. Portal `/portal` passou a exibir card operacional de NF pendente para PJ, lista de NFs e lista/formulario de reembolsos.
7. Criadas rotas back-office:
   - `/app/nfs`
   - `/app/reembolsos`
8. Navegacao lateral passou a exibir NFs PJ e Reembolsos para perfis autorizados.
9. Seed local passou a criar uma solicitacao de NF PJ pendente e um reembolso enviado.
10. Adicionados testes de regras de portal, NFs e reembolsos.
11. Observacao: upload real de arquivo da NF/anexo ainda nao foi implementado; esta fatia registra o valor emitido e o fluxo de aprovacao manual.
12. Comandos validados com sucesso:
    - `npm.cmd run typecheck`
    - `npm.cmd run lint`
    - `npm.cmd run test`
    - `npm.cmd run db:migrate`
    - `npm.cmd run db:seed`
    - `npm.cmd run build`

## Atualizacao de ferias, pausas e documentos em 2026-05-13

1. Implementada a fatia de ferias/pausas e documentos sobre as tabelas existentes e a nova tabela de metadados documentais.
2. Criada tabela `documents` para vincular arquivos a colaboradores e outros donos logicos, com tipo, visibilidade, versao, status e soft delete.
3. Gerada migration `drizzle/0003_deep_steve_rogers.sql`.
4. Criadas regras puras para validacao de metadados de upload, extensao/MIME permitidos, limite de tamanho, sensibilidade, visibilidade e leitura propria.
5. Criado DAL de documentos para listagem administrativa, leitura propria no portal e opcoes de colaboradores para registro.
6. Criadas server actions para registrar metadados de documento e excluir documento por soft delete, com RBAC e audit log.
7. Criadas regras, DAL e server actions para solicitacao propria de ferias/pausa, calculo de dias uteis e aprovacao/recusa por RH ou lideranca direta.
8. Portal `/portal` passou a exibir documentos proprios e solicitacoes de ferias/pausas, alem do formulario de nova solicitacao.
9. Criadas rotas back-office:
   - `/app/ferias`
   - `/app/documentos`
10. Navegacao lateral passou a exibir Ferias/Pausas e Documentos para perfis autorizados.
11. Seed local passou a criar uma pausa programada pendente e um documento de contrato PJ visivel ao colaborador.
12. Adicionados testes de regras de documentos, validacao de metadados de upload, calculo de dias e aprovacao de ferias/pausas.
13. Observacao: upload/download binario real no storage ainda nao foi implementado; esta fatia registra metadados e chaves de storage para operar o fluxo com rastreabilidade.
14. Comandos validados com sucesso:
    - `npm.cmd run typecheck`
    - `npm.cmd run lint`
    - `npm.cmd run test`
    - `npm.cmd run db:generate`
    - `npm.cmd run db:migrate`
    - `npm.cmd run db:seed`
    - `npm.cmd run build`

## Atualizacao de governanca, equipamentos, acessos e SaaS em 2026-05-14

1. Criada branch `feature/governance-assets-access-saas` a partir do HEAD atual de `feature/finance-clients`, pois `development` ainda nao continha as fatias de Wave 2 ja commitadas.
2. Implementado modulo de equipamentos com regras puras de patrimonio `EQ-00001`, escopo proprio/equipe/total, status que exigem responsavel e alertas de devolucao.
3. Criado DAL e server actions de equipamentos para listar por escopo, cadastrar, atribuir, devolver, colocar em manutencao e descartar com audit log.
4. Implementado modulo de acessos com regras de criticidade, revisao vencida/proxima/ausente, acesso ativo de colaborador desligado e escopo por perfil.
5. Criado DAL e server actions de acessos para registrar, aprovar, revisar e remover acessos sem armazenar senhas, com audit log.
6. Implementado modulo de SaaS/assinaturas com escopo total ou vinculado, ocultacao de custo sem `finance.read`, janela de renovacao e vinculo de colaboradores.
7. Criado DAL e server actions de SaaS para cadastrar, atualizar, vincular/desvincular usuarios, renovar e cancelar assinaturas com audit log.
8. Criadas rotas privadas:
   - `/app/equipamentos`
   - `/app/acessos`
   - `/app/assinaturas`
9. Portal passou a exibir equipamentos, acessos e ferramentas vinculadas ao colaborador.
10. Dashboard passou a consolidar alertas de devolucao de equipamento, revisao de acesso critico e renovacao de assinatura.
11. Navegacao lateral passou a exibir Equipamentos, Acessos e Assinaturas para perfis autorizados.
12. Seed local passou a criar equipamentos, acessos e uma assinatura SaaS de demonstracao vinculada ao colaborador PJ.
13. Adicionados testes de regras de governanca e atualizados testes de navegacao.
14. Comandos validados com sucesso:
    - `npm.cmd run typecheck`
    - `npm.cmd run test`
    - `npm.cmd run lint`
    - `npm.cmd run build`
    - `npm.cmd run db:seed`

## Atualizacao de admissoes, desligamentos e checklists em 2026-05-14

1. Continuada a branch `feature/governance-assets-access-saas` com a primeira fatia da Wave 3, pois ela depende dos modulos de pessoas, documentos, equipamentos, acessos e SaaS.
2. Criadas tabelas `lifecycle_checklists` e `lifecycle_checklist_items` para checklists de admissao e desligamento com responsavel, prazo, status, obrigatoriedade e auditoria.
3. Gerada migration `drizzle/0004_noisy_human_robot.sql`.
4. Adicionadas permissoes `lifecycle.read` e `lifecycle.write` ao RBAC.
5. Criadas regras puras para itens padrao de admissao/desligamento, progresso, conclusao bloqueada por itens obrigatorios pendentes e estado atrasado.
6. Criado DAL de lifecycle para listar checklists com progresso, itens, responsaveis e pendencias de dashboard.
7. Criadas server actions para criar checklist, alterar status de item, concluir checklist e cancelar checklist com audit log.
8. A criacao de checklist de desligamento move o colaborador para `notice`; a conclusao do checklist move o colaborador para `terminated`.
9. Criadas rotas privadas:
   - `/app/admissoes`
   - `/app/desligamentos`
10. Dashboard passou a exibir checklists de lifecycle em aberto junto com pendencias operacionais.
11. Navegacao lateral passou a exibir Admissoes e Desligamentos para perfis autorizados.
12. Seed local passou a criar um checklist de desligamento de demonstracao.
13. Adicionados testes de regras de lifecycle e atualizados testes de navegacao.
14. Comandos validados com sucesso:
    - `npm.cmd run db:generate`
    - `npm.cmd run db:migrate`
    - `npm.cmd run db:seed`
    - `npm.cmd run test`
    - `npm.cmd run typecheck`
    - `npm.cmd run lint`
    - `npm.cmd run build`

## Atualizacao de central de alertas e dialogs em 2026-05-14

1. Adicionadas permissoes `alerts.read` e `alerts.write` ao RBAC.
2. Criadas regras puras de alertas para severidade, status, filtros, ordenacao e deduplicacao de candidatos.
3. Criado DAL de alertas para consolidar pendencias de clientes, financeiro, NFs, reembolsos, ferias, lifecycle, equipamentos, acessos e assinaturas.
4. Criadas server actions para gerar alertas persistidos, resolver e descartar alertas com RBAC server-side.
5. Criada rota privada `/app/alertas` com filtros, visao de candidatos e alertas persistidos.
6. Dashboard `/app` passou a consumir a central consolidada de alertas.
7. Navegacao lateral passou a exibir Alertas para perfis autorizados.
8. Seed local passou a publicar as permissoes atuais, totalizando 55 permissoes.
9. Adicionados testes de regras de alertas e atualizados testes de navegacao.
10. Rotas de admissoes e desligamentos foram movidas para dentro de Colaboradores:
    - `/app/colaboradores/admissoes`
    - `/app/colaboradores/desligamentos`
11. As rotas antigas `/app/admissoes` e `/app/desligamentos` foram mantidas como redirects para os novos caminhos.
12. Formularios compactos de cadastro/solicitacao com menos de 10 campos foram movidos para `ActionDialog` em acessos, equipamentos, assinaturas, lifecycle, documentos, portal, detalhe de cliente e remuneracao.
13. Admissoes foi integrado ao cadastro de colaboradores: a tela agora usa o formulario completo de novo colaborador e cria o checklist de admissao com itens padrao automaticamente.
14. Desligamentos e checklists passaram a exibir dados do colaborador vinculado, link para o cadastro e o modelo/lista de itens do checklist.
15. `ActionDialog` passou a aceitar estado `disabled` para preservar a disponibilidade de acoes condicionais.
16. Comandos validados com sucesso:
    - `npm.cmd run typecheck`
    - `npm.cmd run lint`
    - `npm.cmd run test`
    - `npm.cmd run build`
    - `npm.cmd run db:seed`

## Atualizacao de usuarios demo locais em 2026-05-14

1. Seed local passou a criar usuarios de teste por perfil com senha compartilhada configuravel por `DEMO_USER_PASSWORD`.
2. Criado usuario `pj.exemplo@formula.local` com perfil `employee` e vinculo ao colaborador PJ de demonstracao.
3. Criado usuario `todos.perfis@formula.local` com todos os perfis para validar a navegacao completa.
4. Criado colaborador de lideranca vinculado a `lideranca@formula.local`, usado como gestor do PJ demo para testar escopo de equipe.

## Atualizacao de auditoria administrativa em 2026-05-14

1. Criada feature `src/features/audit` com filtros, escopo por perfil, labels e exportacao CSV.
2. Criada rota privada `/app/auditoria` com filtros por busca, acao, entidade, ator, ID de entidade e periodo.
3. Criada rota privada `/app/auditoria/[id]` com detalhe do log; payloads, IP e user agent ficam restritos a `audit.read`.
4. Criada exportacao `/app/auditoria/exportar`, permitida apenas para `audit.read` e registrada com log de auditoria.
5. Navegacao lateral passou a exibir Auditoria para `audit.read` e `audit.read_limited`.
6. Usuarios com `audit.read_limited` veem apenas entidades relacionadas ao seu dominio e sem snapshots/payloads sensiveis.
7. Comandos validados com sucesso:
   - `npm.cmd run typecheck`
   - `npm.cmd run test -- src/tests/audit.test.ts src/tests/navigation.test.ts`

## Atualizacao de configuracoes administrativas em 2026-05-14

1. Criada tabela `app_settings` para parametros operacionais por organizacao.
2. Gerada migration `drizzle/0005_early_marvel_zombies.sql`.
3. Seed local passou a criar parametros de storage, limite de upload e dominio permitido.
4. Criada feature `src/features/settings` com regras, DAL e server actions para configuracoes.
5. Criada rota privada `/app/configuracoes` com usuarios, atribuicao de perfis, ativacao/desativacao, matriz de permissoes e parametros editaveis.
6. Criacao e alteracao de usuario/perfis/status/parametros geram logs de auditoria.
7. Navegacao lateral passou a exibir Configuracoes para `settings.read` e `settings.manage`.
8. Comandos validados com sucesso:
   - `npm.cmd run typecheck`
   - `npm.cmd run db:generate`
   - `npm.cmd run db:migrate`
   - `npm.cmd run db:seed`
   - `npm.cmd run test -- src/tests/settings.test.ts src/tests/audit.test.ts src/tests/navigation.test.ts`

## Atualizacao de storage e upload em 2026-05-14

1. Criado `src/lib/storage.ts` com fallback local e suporte a Cloudflare R2 via API S3 compativel.
2. A selecao de storage usa R2 quando bucket, endpoint/account id, access key e secret estao configurados; caso contrario usa pasta local.
3. `.gitignore` passou a ignorar `uploads` e `storage-local`.
4. `.env.example` passou a documentar `LOCAL_UPLOAD_DIR`, `STORAGE_ENDPOINT` e `STORAGE_ACCOUNT_ID`.
5. Cadastro de documentos passou a enviar arquivo binario real, calcular checksum SHA-256 e gravar provider/bucket/key no cadastro do arquivo.
6. Criada rota autenticada `/app/documentos/[id]/download` com autorizacao por documento e log de `sensitive_read`.
7. Back-office de documentos e portal do colaborador passaram a exibir acao de download.
8. Comandos validados com sucesso:
   - `npm.cmd run typecheck`
   - `npm.cmd run test -- src/tests/storage.test.ts src/tests/timeoff-documents.test.ts`

## Atualizacao de hardening e E2E em 2026-05-14

1. Adicionado script `npm.cmd run test:e2e` com Playwright.
2. Criada configuracao `playwright.config.ts` usando servidor local isolado na porta `3100`.
3. Criados fluxos E2E criticos para login de colaborador comum e usuario com todos os perfis.
4. Criados testes de seguranca para fronteiras de permissao, IDOR de documentos, auditoria limitada e restricoes de upload.
5. Playwright Chromium foi instalado no ambiente local para execucao dos testes.
6. Foi necessario limpar `.next` e rebuildar para remover referencia stale de vendor chunk antes do E2E.
7. Comandos validados com sucesso:
   - `npm.cmd run typecheck`
   - `npm.cmd run test`
   - `npm.cmd run lint`
   - `npm.cmd run build`
   - `npm.cmd run test:e2e`

## Atualizacao de upload no portal em 2026-05-14

1. Envio de NF pelo portal passou a exigir arquivo valido e gravar o binario via storage configurado.
2. Solicitacao de reembolso passou a aceitar comprovante opcional, vinculando `fileId` e documento quando enviado.
3. Uploads de NF e reembolso agora criam versoes em `documents`, checksum SHA-256 em `files` e log de auditoria de arquivo.
4. Comandos validados com sucesso:
   - `npm.cmd run typecheck`
   - `npm.cmd run test -- src/tests/portal-workflows.test.ts src/tests/storage.test.ts src/tests/security-critical-flows.test.ts`
   - `npm.cmd run lint`
   - `npm.cmd run test`
   - `npm.cmd run build`
   - `npm.cmd run test:e2e`

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
4. Escolher Prisma como ORM inicial, por encaixar bem com PostgreSQL/Neon, migrations versionadas e Auth.js adapter.
5. Escolher Auth.js como biblioteca inicial de autenticação, por estar alinhada ao PRD e ao ecossistema Next.js.
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

## Exceção operacional

As primeiras edições de fundação foram feitas antes da leitura de `docs/git-workflow.md`. Como o diretório ainda não era um repositório Git, não havia branch `development` disponível para cumprir a regra de branching naquele momento.

Antes de continuar com novas mudanças de produto, o processo correto é:

1. Inicializar o repositório Git, se ainda não existir.
2. Criar `main`.
3. Criar `development` a partir de `main`.
4. Criar uma branch de trabalho a partir de `development`, por exemplo `chore/project-foundation`.
5. Manter os próximos commits nessa branch.

## Pendências abertas

1. Inicializar o repositório Git e aplicar o workflow definido.
2. Instalar dependências.
3. Gerar o client Prisma.
4. Criar schema Prisma, seed e migrations.
5. Implementar RBAC, DAL e audit logger.
6. Criar layout privado e portal.
7. Configurar testes iniciais de autorização e regras críticas.
8. Decidir pendências do PRD:
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

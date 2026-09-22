# Configuração de ambiente do MVP

Em 22/09/2026, `development` foi publicada em `4dbc80e` e promovida para `main`
em `25d5e62`. O responsável suspendeu o uso da Vercel após remover o banco remoto.
Isso não afeta o PostgreSQL local no Docker. O código publicado não comprova uma
instalação pública operacional; a infraestrutura remota precisa ser reconstituída.

## Qual arquivo preencher

| Exemplo | Destino e consumidor | Finalidade |
|---|---|---|
| `.env.example` | `.env`: Next.js, seed e drizzle-kit | Instalação local com comentários em português |
| `.env.test.example` | `.env.test.local`: `npm run test:db` | Banco isolado e descartável |
| `.env.production.example` | Gerenciador de ambiente da hospedagem | Somente runtime público, sem credenciais administrativas |

Não sobrescreva arquivos já configurados. Next.js carrega variáveis conforme seu
modo; `.env.local` e arquivos específicos podem sobrepor `.env`. O seed usa
`@next/env`; drizzle-kit carrega `.env`. Variáveis exportadas no terminal prevalecem.
Evite valores conflitantes e nunca imprima URLs com senha ao diagnosticar.

`test:db` carrega `.env.test.local` antes de `.env`, preservando variáveis do terminal.
Playwright **não** carrega `.env.test.local` automaticamente: inicia um servidor
build/start em `127.0.0.1:3100` usando o ambiente desse processo. Os cenários E2E
criam fornecedores, trabalhos e movimentações. Use base de validação descartável
com seed demo e fixtures exigidas pelos testes. Apenas configurar
`DATABASE_TEST_URL` não altera o banco do servidor Next.js dos E2E.

## Instalação local

Pré-requisitos: Node.js com `process.loadEnvFile` (22 recomendado), npm e Docker
Compose. O Compose sobe **somente PostgreSQL 17**; a aplicação roda com Node no host.

1. Execute `npm ci` e `docker compose up -d postgres`.
2. Se não houver `.env`, copie `.env.example` para `.env`. Acesse PostgreSQL pelo
   host `127.0.0.1:55432`; internamente o container usa `5432`. O Compose atual não
   restringe o bind ao loopback; use-o apenas no ambiente local.
3. Provisione `erp_migrator` e `erp_app` conforme [database-roles.md](database-roles.md).
   O usuário `erp` do Compose é bootstrap administrativo local, não runtime.
   As duas roles adicionais não são criadas automaticamente pelo Docker.
4. Preencha `DATABASE_URL` com a role `erp_app` e `DATABASE_DIRECT_URL` com
   `erp_migrator`, ambas na base `erp_agencia`, com senhas diferentes.
   Caracteres reservados na senha de uma URL precisam de percent-encoding.
5. Gere separadamente `BETTER_AUTH_SECRET` e `RATE_LIMIT_HASH_SECRET` executando
   uma vez para cada segredo:

   ```powershell
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Salve cada resultado somente no ambiente privado. O primeiro protege sessões;
   o segundo protege identificadores persistidos do rate limit. Não reutilize entre ambientes.
6. Mantenha URLs em `http://localhost:3000`, login por senha habilitado e cadastro
   público desabilitado. Preencha email/nome/senha do primeiro admin. Para dados
   fictícios, use `SEED_DEMO_DATA=true`, escolha `DEMO_USER_PASSWORD` e deixe o
   filtro de domínio vazio para aceitar as contas demo `@formula.local`.
7. Execute `npm run db:migrate`, depois `npm run db:seed`, depois `npm run dev`.
   Confira os grants do runtime no runbook de roles, inclusive para tabelas já
   existentes. Abra `http://localhost:3000/login`.

Para uma build local, execute `npm run build` e `npm run start`. Reiniciar não
exige seed: repeti-lo pode atualizar usuários e redefinir senhas. Dados persistem
no volume Docker e arquivos em `uploads`. Apagar o volume não é um restart.
Antes de atualizar uma base existente, siga [backup-restore.md](backup-restore.md).

## Como e por que preencher

| Grupo | Origem dos valores | Motivo |
|---|---|---|
| Banco | Host/base do PostgreSQL e roles provisionadas | Runtime restrito aplica RLS; migrator administra schema e seed |
| URLs | Endereço real do navegador, HTTPS fora do local | Cookies, redirects, origens e links precisam ser coerentes |
| Google | Client ID/secret de cliente OAuth Web; callback `<BETTER_AUTH_URL>/api/auth/callback/google` | Ambos necessários para Google; com senha desligada, configure Google |
| Domínio | Domínio de email sem `@`, ou vazio no local | Restringe identidade; não concede convite, RBAC ou organização |
| Admin | Email/nome e senha forte no processo de seed | Primeiro acesso; email/senha ausentes fazem o seed pular o admin |
| Demo | `true` e senha própria apenas em base descartável | Clientes e contas fictícias para explorar o sistema |
| Uploads | Diretório persistente local ou bucket privado e credenciais R2 | OS/evidências precisam sobreviver a restart/deploy |
| Rate limit | Conservar padrões comentados no exemplo | Contadores persistem no banco; auth tem proteção adicional própria |

Limites e janelas devem ser inteiros positivos; janelas são em segundos.
`RATE_LIMIT_CLEANUP_PROBABILITY` aceita 0 a 1 e controla a chance de limpar registros
expirados por consumo; `RATE_LIMIT_CLEANUP_BATCH_SIZE` limita o lote.

`NEXT_PUBLIC_BETTER_AUTH_URL` é público e incorporado ao build. Nunca coloque
senhas/tokens em `NEXT_PUBLIC_*`. Reinicie após mudanças de ambiente do servidor;
faça novo build ao mudar variável pública. Não misture localhost e 127.0.0.1 no login.

### Armazenamento real

`src/lib/storage.ts` seleciona R2 quando bucket, endpoint (ou Account ID) e ambas
as chaves estão presentes. Endpoint explícito tem precedência sobre Account ID.
`STORAGE_PROVIDER=r2` sozinho não força R2. Configuração incompleta usa filesystem,
inclusive em production, o que é inadequado em hospedagem de disco efêmero.

No local, deixe campos R2 vazios e mantenha `LOCAL_UPLOAD_DIR=uploads`. Para R2,
obtenha Account ID e credenciais S3 de token limitado ao bucket privado; use região
`auto`. Não há backend S3 genérico validado no código atual.
`UPLOAD_MAX_BYTES=10485760` representa 10 MiB por arquivo.

## Hospedagem futura e bootstrap separado

Provisione PostgreSQL, roles, domínio HTTPS e storage persistente antes de publicar.
O template de produção contém apenas runtime. Execute migrations/seed em ambiente
administrativo separado com `DATABASE_DIRECT_URL`, `INITIAL_ADMIN_EMAIL`,
`INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_PASSWORD` e `SEED_DEMO_DATA=false`.
O seed exige BYPASSRLS ou SUPERUSER; prefira a role migrator controlada.
Não disponibilize essas credenciais no servidor web.

Depois configure runtime restrito, segredos exclusivos, URLs e pelo menos um método
de login. Valide login, criação de cliente/trabalho, upload/download e isolamento
de organização. Build verde não comprova banco disponível, migrations ou uploads.
O [runbook de produção](production-setup.md) registra a arquitetura anterior
Vercel/Neon; revalide a infraestrutura antes de reutilizá-lo.

## Diagnóstico

| Sintoma | Conferir |
|---|---|
| Conexão recusada/timeout | Docker saudável, host/porta/base; banco removido precisa ser recriado |
| Tabela inexistente | Migrations aplicadas na mesma base do runtime |
| Permission denied/RLS | Roles, grants e organização; não contornar usando superuser |
| Login ausente ou origem inválida | URLs coerentes, método habilitado e origem exata |
| Admin não criado | Email/senha preenchidos e seed executado na base correta |
| Upload desaparece | Configuração R2 completa ou disco persistente |
| E2E altera dados de uso local | Separar banco e ambiente do processo; test:db tem configuração própria |

Esta revisão não modifica `.env` privados nem recursos da hospedagem.

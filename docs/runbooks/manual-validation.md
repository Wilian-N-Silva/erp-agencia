# Validação manual local — 21/09/2026

Escopo operacional: preparar a validação humana prevista em OPS-003, integrando
o trabalho existente. Isso não declara concluídas as tasks futuras do plano nem
representa uma release em produção.

## Ambiente

- Aplicação: http://localhost:3000, Next.js em modo build/start no Windows.
- Banco: serviço `postgres` do `docker-compose.yml`, PostgreSQL 17 na porta 55432.
- Base de validação: `erp_agencia`; testes automatizados usam `erp_agencia_test`.
- Runtime: `erp_app`, sem superuser, BYPASSRLS ou propriedade de tabelas.
- Migration/seed: `erp_migrator`, NOSUPERUSER e BYPASSRLS.
- Login por email habilitado; cadastro público desabilitado; armazenamento local.
- Senhas ficam apenas no `.env` ignorado pelo Git e no handoff da sessão.

## Acessos e exemplos

- `todos.perfis@formula.local`: todos os perfis para explorar o backoffice.
- `admin@formula.local`: administração, diretoria e financeiro.
- `pj.exemplo@formula.local`: colaborador vinculado, para validar o portal.
- Existem também contas de diretoria, financeiro, RH, TI e liderança no seed.

Clientes: Cliente Exemplo Ativo (mensalidade), Cliente Exemplo Pausado,
Aurora Cafe - Projeto Avulso, Horizonte Eventos - Grafica e Jardim Studio - Sem
Mensalidade. Os três últimos não possuem perfil de cobrança. O seed também inclui
colaboradores, contas financeiras, solicitações e equipamentos de demonstração.
Algumas datas são históricas e aparecem vencidas intencionalmente no ambiente.

## Reiniciar

Na raiz do projeto, com o `.env` local já configurado:

```powershell
docker compose up -d
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

Não repetir o seed para reiniciar o servidor: ele restaura atributos de demonstração
e redefine as senhas a partir do `.env`. Para repor deliberadamente os exemplos:

```powershell
npm run db:migrate
npm run db:seed
```

O backup anterior à preparação está em
`storage-local/manual-validation/pre-manual-validation.dump` (ignorado pelo Git).

## Integração e correções necessárias

- Sprints de `feature/codex-integration`, normalização dos arquivos de ambiente e
  histórico de `main` reconciliados em `codex/manual-validation`, para merge em
  `development` solicitado pelo integrador.
- Conflitos de `main` mantêm as implementações mais recentes de convites,
  exportação no servidor, contexto tenant, portal e orquestrador. O fluxo antigo
  de criação direta de usuário/senha não substitui os convites atuais.
- Seed reutiliza o ID do colaborador antes do upsert, respeitando o trigger de
  vínculo único mesmo na segunda execução.
- Demonstração CLT usa FG-00004, distinta da liderança FG-00003.
- Nenhuma migration ou backfill novo; migrations existentes aplicadas ao banco
  local e validadas também desde zero no banco de testes.
- Worktree preexistente `erp-agencia-codex-worktrees/sec-002` preservada, limpa.

## Verificação

Gates: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run test:db`,
`npm run build`, `npm run test:e2e` e `git diff --check`.

Resultado desta preparação: typecheck, lint, build e diff-check aprovados;
328 testes unitários, 137 de integração e 3 E2E aprovados, além da regressão do
seed executado duas vezes. Login e lista/detalhe de clientes conferidos também
no navegador interativo. A suíte E2E é um smoke de acesso e clientes, não cobre
todos os fluxos futuros listados no plano de release.

Os testes E2E foram atualizados para os títulos e menus atuais, preservando a
verificação de escopo do colaborador. Um terceiro cenário cobre login pelo
formulário e navegação até o cliente sem cobrança. A primeira tentativa também
identificou a ausência do Chromium local, resolvida com `npx playwright install chromium`.

Segurança: credenciais locais separadas, RLS/RBAC e testes cross-tenant mantidos;
cadastro público desabilitado e usuários de demonstração explicitamente ativos.
Nenhuma alteração em autorização de Actions, uploads, rate limiting, sessão,
validação de payloads ou auditoria de negócio. Senhas e backup não versionados.

Regressão do seed, após preparar o banco isolado de testes:

```powershell
npx tsx tests/seed-demo.smoke.ts
```

Esse teste executa o seed duas vezes e verifica IDs/vínculos estáveis, quatro
colaboradores distintos, ausência de autogestão e cinco clientes, três sem cobrança.
Ele deixa os exemplos no banco de testes. Não aponta para a base de uso manual.

Validação humana sugerida: entrar no backoffice, abrir/editar um cliente fictício,
criar um cliente sem mensalidade, configurar cobrança quando necessária e entrar
com a conta PJ para conferir o escopo do portal.

O uso local de HTTP gera um aviso de URL no modo production do Next.js. Há também
um aviso de depreciação de queries concorrentes no driver pg; não bloqueou os
testes, mas deve ser tratado antes de atualizar para pg 9.

# Ambiente isolado de homologação

Este procedimento prepara uma instalação nova e fictícia. Não aponta para a
base local em uso nem para produção. O checkpoint atual ainda não é candidato
final; conferir SHA e gates em [progresso.md](progresso.md).

## Preparação

1. Criar checkout/worktree da branch `feature/homologacao-v1-grafica-financeiro`.
   Preservar as worktrees existentes e configurações privadas. Executar `npm ci`.
2. Provisionar PostgreSQL 17 separado, com volume próprio e porta ligada somente
   ao loopback. Neste acompanhamento foi usada `127.0.0.1:15433`; o banco local
   de uso em `15432` foi preservado. Não reutilizar/resetar o volume existente.
3. Criar bancos novos: `erp_hml_dbtests` para integração, `erp_hml_e2e` para
   navegador e, quando o candidato estiver pronto, `erp_hml_demo` para gestores.
   Suítes escrevem dados e schemas. Não compartilhar o banco dos gestores com elas.
4. Provisionar migrator e runtime conforme
   [database-roles.md](../runbooks/database-roles.md), trocando o nome da base.
   Runtime deve ser NOBYPASSRLS, NOSUPERUSER e não proprietário das tabelas.
   Migrator administra migrations/seeds. Validar grants atuais e default privileges.
5. Preencher `.env` privado na worktree usando [.env.example](../../.env.example)
   e [environment-setup.md](../runbooks/environment-setup.md). Para E2E, ambas
   URLs do banco apontam a `erp_hml_e2e` com roles diferentes. URLs da aplicação
   e trusted origin usam `http://127.0.0.1:3100`. Habilitar login por senha,
   desabilitar cadastro público e gerar segredos novos. Nunca versionar valores.
6. Usar `STORAGE_PROVIDER=local`, `LOCAL_UPLOAD_DIR=uploads-homologacao`, chaves
   R2 vazias e diretório persistente exclusivo dessa instalação. Incluir esse
   diretório no exclude local do Git. Backend local é selecionado pela ausência
   das credenciais R2 completas; o campo STORAGE_PROVIDER sozinho não o força.
7. Na base nova de E2E/demo, definir `SEED_DEMO_DATA=true`, senha demo própria e
   primeiro admin privado. Executar `npm run db:migrate` e `npm run db:seed`
   somente após confirmar a base. Depois, desabilitar seed demo no ambiente.
   Reiniciar não exige seed. A senha não é fixa nem deve aparecer em relatórios.

Os testes usam contas fictícias do seed, como `todos.perfis@formula.local`,
`financeiro@formula.local` e `pj.exemplo@formula.local`, todas com a senha privada
escolhida. A primeira não demonstra segregação de funções; os perfis restritos
precisam ser validados separadamente. O perfil específico da Gráfica segue no backlog.

## Gates

Executar e guardar log/exit code de cada comando no SHA em validação:

```powershell
npm run typecheck
npm run lint
npm run test
npm run test:db -- --fileParallelism=false
npm run build
npm run test:e2e -- --workers=1
```

Antes do gate DB, preencher `.env.test.local` com `DATABASE_TEST_URL` da role
runtime e `DATABASE_TEST_ADMIN_URL` do migrator, ambas em `erp_hml_dbtests`.
Variáveis exportadas no terminal prevalecem; confirmar também a configuração
runtime usada pelas integrações. Não usar o wrapper de reset contra uma base
existente. Aplicar migrations no banco de testes antes da suíte.

Para build/E2E, carregar o `.env` isolado no processo do Playwright e no servidor
filho. Playwright não carrega `.env.test.local` para o servidor. Usar Node 22+
com `--env-file=.env` ao executar o CLI ou um terminal com os mesmos valores.
O config inicia `next start` em 3100, sem reutilizar servidor existente.
Fixtures SQL recusam bancos não locais ou que não sejam `erp_hml_e2e` (ou
`erp_hml_e2e_<sufixo>`), e exigem URLs migrator/runtime para a mesma base.
Fixtures de download precisam do storage local; uploads reais são verificados
pelos cenários de portal/Gráfica.

Não paralelizar duas execuções de navegador na porta 3100. Respeitar os limites
reais de autenticação; não aumentar limites para deixar a suíte passar.

## Persistência e atualização

Após criar registros/arquivos, parar e iniciar somente a aplicação. Não remover
container, volume ou diretório de arquivos. Conferir IDs, valores, versões e
bytes dos downloads após restart. Esse aceite ainda precisa de evidência final.

Para uma base com histórico, seguir [backup-restore.md](../runbooks/backup-restore.md)
e [09-migration-rollout.md](../09-migration-rollout.md), testar a atualização em
cópia isolada e revisar reservas/inconsistências antes da janela de manutenção.
0054 bloqueia tabelas enquanto captura o legado; 0055 protege sua imutabilidade.
Não converter reservas em movimentos nem liberar saldo sem revisão auditável.
Não existe autorização para aplicar estas migrations em produção nesta execução.

0060 adiciona cancelamento documentado de cobranças SaaS e uma única ocorrência
ativa por assinatura/competência. O backfill observa APs já canceladas, mantendo
IDs/valores/reservas: a data registrada é a observação da migration, não a data
original, e o motivo indica autor original desconhecido. Não cria caixa nem
associa novos títulos. Foi aplicado somente nas bases isoladas de testes.

Antes de atualizar uma base existente, contabilizar cobranças com AP cancelada,
AP ausente/arquivada e assinatura já arquivada. Conferir os mesmos IDs/valores
após a migration na cópia isolada. AP ausente ou cadastro historicamente removido
precisa de revisão explícita, sem inventar vínculo ou restaurar por suposição.
Não remover colunas/guards ou voltar ao índice antigo depois de registrar uma
substituta: ele rejeitaria o histórico da mesma competência. Rollback operacional
usa backup validado/janela de manutenção ou correção expansiva, preservando fatos.

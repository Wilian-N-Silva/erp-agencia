# Retomada — ciclos de provisão (FIN-007)

Ponto de retomada solicitado pelo usuário em 02/10/2026 por limite de tokens.
Branch `codex/finance-provision-cycles`, baseada em `development`/`main` `2b464ae`.
Esta branch é trabalho em andamento; não promover para a release antes de concluir
os itens abaixo. O MVP validado permanece em `main` e `development`.

## Implementado nesta branch

- Tabela `provision_cycles`: uma ocorrência por provisão/competência, estimativa,
  vencimento, estado, AP vinculada e motivo de cancelamento.
- FKs compostas por organização, RLS ENABLE/FORCE, checks de estado e valor.
- DAL com RBAC financeiro, Zod estrito, transações, bloqueio de linha e auditoria.
- Planejamento repetido retorna o ciclo existente; provisão não recorrente admite
  uma ocorrência. Provisão inativa não aceita nova ocorrência.
- Realização cria uma AP única, com valor efetivo separado da estimativa, sem
  movimentar caixa. Reenvios/concorrência não duplicam AP. Falha de auditoria
  reverte AP e mudança de estado juntas.
- Cancelamento preserva histórico e exige motivo. Ciclo realizado não pode ser
  cancelado por este caminho; sua obrigação precisa de tratamento financeiro.
- Dois testes unitários e cinco testes de integração novos.

## Migrations e ambiente

`0048_common_microchip.sql` foi gerada pelo drizzle-kit e complementada com RLS;
o índice composto foi ordenado antes da FK que depende dele.
`0049_provision-policy-name.sql` padroniza o nome da policy para a matriz RLS.
Foi criada separadamente porque 0048 já havia sido aplicada no banco de testes.
Ambas foram aplicadas **somente no banco de testes**, sem backfill/limpeza de dados.
Não foram aplicadas na base de uso local. Não há segredo nos arquivos versionados.

## Retomar antes de integrar

1. Concluir FIN-007: ações autenticadas com rate limit, UI, recorrência/próxima
   ocorrência e leitura de previsto versus realizado sem dupla contagem no
   dashboard/exportações. O planejamento e a realização ainda não possuem tela.
   O dashboard já consulta os ciclos para calcular previsão sem dupla contagem.
2. Migrations 0048/0049 já cobertas em banco vazio e upgrade desde 0047, com
   preservação das provisões e AP legadas, sem inventar ciclos ou obrigações,
   e conferência da policy RLS final. Revalidar se o schema mudar novamente.
3. Revalidar build/E2E e atualizar manuais. Não anunciar realização de provisões
   disponível ao usuário antes da conexão da interface e dos relatórios.
4. Só então avançar para SAA-004 e cobranças efetivas, com cotação da cobrança e
   encargos separados. Estimativa de contrato não comprova valor cobrado.

O objetivo amplo continua incluindo férias/venda/NF, assinaturas, clientes e
entradas/saídas. Evidências concluídas e lacunas estão nos relatórios da entrega
e de `finance-multiple-receipts-validation.md`; não marcar o goal como concluído.

## Validação deste checkpoint

Typecheck, lint e 408 testes unitários passaram. Os cinco testes novos de banco
passaram na primeira execução. A suíte paralela apresentou quatro falhas: duas
pela convenção de nome da policy (corrigidas por 0049) e duas de contagem global
dos buckets de rate limit durante concorrência com outros arquivos. A repetição
serial usa `npm run test:db -- --fileParallelism=false`.
Resultado da repetição serial: **205 testes aprovados em 33 arquivos**, incluindo
matriz RLS, isolamento da tabela nova, concorrência e rollback. `git diff --check`
também passou.

Build e E2E não foram executados nesta branch em andamento. As worktrees de
validação e SEC-002 foram preservadas. O stash de protótipo/apresentação continua
local, fora desta branch, conforme escopo anterior do usuário.

Atualização de publicação: typecheck, lint, 408 testes unitários e **206 testes
de banco** passaram após acrescentar a cobertura de instalação/upgrade.
Comando de banco: `npm run test:db -- --fileParallelism=false`.

## Atualização de leitura financeira — 05/10/2026

O DAL financeiro agora carrega os ciclos com escopo de organização. A estimativa
explícita substitui a recorrência da mesma competência; realização/cancelamento
retiram aquela previsão. Meses seguintes mantêm a recorrência ativa. Uma ocorrência
explicitamente planejada permanece até ser realizada/cancelada, mesmo se a regra
de recorrência for desativada; desativar o cadastro interrompe previsões implícitas.

O fluxo de caixa considera o vencimento real do ciclo, inclusive quando estiver
fora da competência, e conta cada ocorrência do horizonte uma vez. Datas mensais
são ajustadas ao último dia do mês. AP realizada entra pelo saldo ainda em aberto.
CSV/XLSX usam a previsão da competência e a identificam na coluna correspondente,
sem exportar o valor padrão como previsão de uma ocorrência já realizada.

Testes: 412 unitários e 206 de banco aprovados; typecheck e lint aprovados.
`npm run build` aprovado no checkout principal. E2E não executado nesta etapa;
isso não conclui a homologação da funcionalidade.
Integração confere o dashboard antes/depois da realização e o CSV; testes puros
cobrem cancelamento, dois meses no horizonte, fevereiro, provisão não recorrente
e vencimento deslocado. Nenhuma nova migration/backfill neste ajuste.
As migrations 0048/0049 continuam obrigatórias antes deste runtime; ainda não
foram aplicadas na base de uso local. Esta branch continua fora da release.

Pendente: melhorar a gestão de ciclos na tabela principal e apresentar os estados
por ocorrência nela. A página dedicada de ciclos já oferece planejamento,
realização e cancelamento; o resumo mensal/anualizado da tabela principal ainda
descreve as regras cadastradas, não o total de ocorrências previstas.

## Ações de servidor — 05/10/2026

`src/features/provisions/actions.ts` conecta planejamento, realização e
cancelamento ao DAL. Exige sessão, organização e `finance.write` antes de consumir
o limite `common_mutation`; valida payload estrito e mantém autorização/validação
também no DAL. Revalida o layout financeiro somente após commit. Erros inesperados
não expõem detalhes internos e reenvios exibem o estado retornado do ciclo.

Doze testes de fronteira verificam os três endpoints: sessão ausente, permissão
somente leitura, organização ausente, limite excedido sem write, adulteração de
campos/IDs, erro interno sem vazamento e atualização após sucesso. Typecheck e
lint passaram; 424 testes unitários passaram. Os 206 testes de banco da etapa
anterior permanecem como evidência do DAL. Build de produção aprovado nesta etapa.
Os testes de banco da etapa
anterior cobrem o DAL inalterado, não foram repetidos para este ajuste de ações.
A página dedicada e o E2E completo agora estão conectados. O teste percorre cadastro,
planejamento idempotente, realização de uma AP e cancelamento de competência
seguinte. A branch ainda requer revisão de integração antes de promoção.

## Interface e E2E — 09/10/2026

`/app/financeiro/provisoes/ciclos` apresenta ocorrências por competência, vincula
fornecedores ativos na realização, abre a conta a pagar criada e exige motivo no
cancelamento. Os formulários usam Server Actions autenticadas, estado pendente,
mensagens de sucesso/erro e campos rotulados; não enviam valores de pagamento
automaticamente.

E2E `tests/e2e/provision-cycles.spec.ts`: **1 cenário aprovado em 6,6 segundos**.
O cenário criou dados `QA-provisao-*` no banco local e não removeu histórico. O
PostgreSQL foi iniciado para a validação. O navegador Playwright foi instalado
localmente por estar ausente; nenhum artefato de navegador é versionado.

## Validação de integração final — 09/10/2026

A branch foi reconstruída sem o artefato `.next` anterior. `npm run build` passou,
e a suíte de banco passou com **33 arquivos e 206 testes**. O E2E completo executou
17 cenários: **16 passaram** (incluindo o novo ciclo de provisões) e um cenário de
assinaturas falhou no login por rate limit após a sequência de testes. O mesmo
`tests/e2e/saas-currency-cycle.spec.ts` foi repetido isoladamente e passou (**1/1**),
confirmando limitação do ambiente de execução serial, não falha funcional. Typecheck,
lint, 424 testes unitários e `git diff --check` permanecem aprovados.

# Pagamento de reembolso incluído em NF — 01/10/2026

Correção complementar de INV-003 na branch `codex/reimbursement-invoice-payment`.
O PRD 04 exige que NF e reembolso usem o Financeiro como fonte de pagamento. A
remoção da baixa manual da NF havia deixado a listagem de reembolsos permanentemente
em “Incluído na NF”, mesmo depois da quitação do título vinculado.

## Comportamento e aceite

- Portal e gestão consultam a situação da mesma conta a pagar da NF.
- Conciliação parcial informa “NF parcialmente paga — aguardando quitação”. Não
  atribui parte do dinheiro a um item específico sem regra de distribuição.
- Quitação integral mostra o reembolso como pago e a data da última movimentação
  válida. Não grava um segundo estado financeiro no reembolso.
- Se uma movimentação estiver estornada, a leitura volta a aguardar a quitação.
- NF ou obrigação indisponível não é apresentada como pagamento comprovado.
- Histórico de NF sem vínculo financeiro permanece identificado para conferência;
  reembolsos diretos continuam com o comportamento existente.
- Baixa manual de reembolso vinculado é recusada no servidor, inclusive com status
  legado inconsistente. O botão também fica oculto para registros vinculados.
- Conciliação invalida as páginas de reembolsos da gestão e do portal.

## Segurança

A consulta compartilhada recebe somente pares NF/colaborador provenientes de
registros já filtrados pelo DAL. Exige organização, colaborador correspondente e
NF não excluída. O mapa usa ambos os IDs: uma referência inconsistente de outro
colaborador não reutiliza dados de uma NF autorizada na mesma consulta. RLS e
own/team scopes permanecem ativos. A gestão de reembolsos recebe apenas o resumo
da situação, sem remuneração, composição ou totais da NF de outros colaboradores.

A action de pagamento verifica permissão antes da consulta, mantém Zod e rate
limit existentes e recusa vínculos com NF. O helper de escrita bloqueia a linha
do reembolso na transação existente para serializar inclusão e pagamento direto.
Sem novo payload, upload, endpoint, política de sessão ou credencial. Sem nova
tabela, migration, backfill ou alteração destrutiva.

## Verificação

- `npm run typecheck`, `npm run lint` e `git diff --check`: aprovados.
- `npm run test`: 402 testes aprovados; dois novos testes de pagamento do reembolso.
- `npm run test:db`: 195 testes aprovados. O teste de integração de aprovação foi
  ampliado para parcial/integral, status documental preservado, leitura após
  estorno persistido, negação da baixa manual, own-scope/cross-tenant e referência
  a NF de outro colaborador. A versão final desse teste também passou isolada.
- `npm run build`: aprovado na worktree de validação.
- Playwright `pj-sale-workflow.spec.ts`: aprovado. Fixture de reembolso já aprovado
  de R$ 100; inclusão pela interface na NF com base R$ 3.900, ajuda R$ 300 e venda
  autorizada R$ 1.950. Total R$ 6.250, envio e download do PDF, aprovação, conciliações
  de R$ 2.000 e R$ 4.250, consulta do pagamento no portal e na gestão.

Revisão React: estado financeiro calculado no servidor, sem efeito ou estado
financeiro duplicado no cliente; mensagens escapadas como texto e só o resumo
necessário serializado. Teste validou as mensagens nas duas telas.

Arquivos alterados: DAL/actions/regras de pagamento do portal; action de
conciliação; páginas de reembolsos do portal/gestão; componente de lista/detalhe;
testes unitário, integração e E2E citados. Alterações alheias e worktrees
preexistentes de validação e `feature/codex-sec-002` foram preservadas.

## Limites restantes

Esta correção não conclui REI-002 (AP de reembolso direto), toda a atomicidade
REI-003 nem FIN-006 (comando de estorno). O teste de estorno usa um estado de
movimentação persistido por fixture; não prova uma operação de estorno na UI.
Cobranças SaaS, moedas/IOF e cancelamento/reabertura de férias continuam requerendo
trabalho e evidências próprios. O objetivo geral permanece aberto.

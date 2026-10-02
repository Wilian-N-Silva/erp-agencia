# Conciliação de vários títulos e recebimentos — 02/10/2026

Task atômica de validação FIN-004/FIN-005, complementar ao gate financeiro de
`07-test-strategy.md` e ao objetivo de testar clientes, entradas e saídas.
Branch `codex/finance-multiple-receipts-validation`, criada de `development`
no commit de entrega `c05f8b5`. A execução anterior consolidou e publicou o MVP;
esta execução acrescenta evidência funcional, sem alteração de runtime.

## Cenário verificado

`tests/e2e/finance-multiple-receipts.spec.ts` usa a interface real para:

1. Cadastrar um cliente fictício com fee de R$ 100.
2. Gerar duas contas a receber, em competências consecutivas.
3. Registrar recebimento de R$ 150 e conferir que sugestões não são confirmadas
   automaticamente: os campos de alocação começam vazios.
4. Conciliar R$ 100 no primeiro título e R$ 50 no segundo, na mesma confirmação.
5. Consultar o cliente: primeiro título Recebido, segundo Parcial com R$ 50.
6. Registrar outro recebimento de R$ 50. O título já quitado não aparece entre os
   candidatos. Conciliar o restante do segundo título.
7. Confirmar ambos com R$ 100 recebidos e preservar os dois vínculos do primeiro
   recebimento após recarregar. Nenhum título ou valor recebido foi duplicado.

Todos os writes passam pelas ações normais da aplicação. O cenário utiliza a
conta financeira demo `Conta Gráfica QA`, o usuário demo com permissão de liquidação
e dados identificados como `QA-multiplos-*`. Não executar contra uma base real.
Não limpa histórico financeiro depois do teste.

## Gates e segurança

- `npm run typecheck`: aprovado.
- `npm run lint`: aprovado.
- `npm run test`: 406 testes aprovados em 62 arquivos.
- `node --env-file=.env node_modules/@playwright/test/cli.js test tests/e2e/finance-multiple-receipts.spec.ts --workers=1`:
  1 E2E aprovado, 15,4 segundos incluindo inicialização do servidor.
- `git diff --check`: aprovado.

E2E executado na worktree de validação sobre a mesma build de produção já
verificada na entrega. Não houve mudança de runtime/schema, migration ou backfill;
build e testes de banco não foram repetidos nesta task. Os 15 E2Es da entrega são
evidência anterior; o cenário novo foi executado separadamente.

Não foram alterados autenticação, autorização server-side, RBAC, organização,
RLS, validação/IDOR, proteção contra mass assignment, rate limiting, auditoria,
transações, uploads ou sessões. O teste usa o login real com espera limitada por
`Retry-After`, sem desativar proteções ou registrar credenciais. As worktrees
preexistentes de validação e SEC-002 e o stash da apresentação foram preservados.

## Auditoria do objetivo restante

| Requisito solicitado | Evidência atual | Resultado |
| --- | --- | --- |
| Descanso PJ flexível e venda autorizada | `pj-sale-workflow.spec.ts`: 10 dias corridos, aprovação e venda de 15 dias | Verificado na suíte da entrega |
| Venda na NF, composição no portal e retorno de PDF | Mesmo E2E: composição, upload, download e conciliação parcial/integral | Verificado na suíte da entrega |
| Cadastro, remoção por erro e cancelamento de assinatura | E2Es `saas-currency-cycle`, `saas-removal`, `saas-current-costs` | Verificado; remoção auditada por soft-delete |
| Clientes, entradas e saídas | E2Es de cliente, Gráfica e NF, mais este cenário many-to-many | Cenários descritos verificados; não equivalem a todo o financeiro homologado |
| Cobranças efetivas das assinaturas | Código SaaS mantém contrato/estimativa; não há vínculo de cobrança com AP | Incompleto |
| Financeiro como um todo | Ainda faltam estorno pela UI, realização de provisões e AP de reembolso direto | Incompleto |

A próxima lacuna de cobrança depende do modelo de ciclos/realização FIN-007 e do
modelo SaaS SAA-001, conforme SAA-004 no PRD. Não tratar estimativa em BRL como
despesa efetivamente cobrada, nem materializar IOF presumido. O objetivo amplo
permanece aberto; esta evidência não o reduz aos casos que já passaram.

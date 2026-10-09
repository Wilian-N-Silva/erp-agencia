# Validação manual dos fluxos críticos — 09/10/2026

Esta validação foi executada no banco local Docker (`erp-agencia-postgres`), sem limpar
registros existentes. Os cenários Playwright criaram marcadores `QA-*` para preservar
a evidência e não reutilizar dados de produção.

## Resultado dos cenários

| Fluxo | Evidência | Resultado |
|---|---|---|
| Férias PJ e venda de dias | `tests/e2e/pj-sale-workflow.spec.ts` | 1/1 aprovado; solicitação, autorização pela Jaci, valor sugerido editável, competência seguinte, inclusão única na NF e aprovação financeira |
| Envio da NF pelo colaborador | `tests/e2e/pj-sale-workflow.spec.ts` | 1/1 aprovado; composição publicada aparece no portal e o PJ envia o PDF |
| Retorno/download do PDF | `tests/e2e/invoice-download.spec.ts` | 1/1 aprovado; Financeiro baixa o arquivo e rota de documento respeita escopo |
| Assinatura em euro/anual | `tests/e2e/saas-currency-cycle.spec.ts` | 1/1 aprovado isoladamente; preserva EUR 120 anual, converte pela cotação informada e atualiza estimativa |
| Remoção de cadastro incorreto | `tests/e2e/saas-removal.spec.ts` | 1/1 aprovado; soft-delete, desaparece da lista e URL retorna 404; assinatura com histórico é protegida |
| Cancelamento | `tests/e2e/saas-current-costs.spec.ts` | 1/1 aprovado; custo mensal/anualizado sai dos indicadores e o contrato permanece consultável |
| Cliente e entrada | `tests/e2e/client-finance-workflow.spec.ts` | 1/1 aprovado; cliente recorrente, conta a receber, recebimento e conciliação |
| Entrada parcelada/parcial | `tests/e2e/finance-multiple-receipts.spec.ts` | 1/1 aprovado; dois títulos e quitação parcial atualizam saldo corretamente |
| Saída e conciliação | `tests/e2e/graphics-os.spec.ts` | aprovado no fluxo completo; fornecedor, conta a pagar, pagamento e resultado da OS |

A suíte completa executou 17 cenários, com 16 aprovados. O único erro ocorreu no
login do teste de moeda depois de muitos logins sequenciais (rate limit compartilhado);
a repetição isolada passou. Execuções paralelas também podem colidir na porta local
3100, por isso os cenários devem rodar em sequência.

## Estado observado no banco local

- 19 clientes ativos;
- 110 entradas financeiras, 98 recebidas e 12 planejadas;
- 52 saídas financeiras, 24 pagas e 28 planejadas;
- 25 solicitações de NF, 22 com PDF;
- solicitações de férias com estados `requested`, `approved` e `rejected`;
- assinaturas ativas e canceladas preservadas por histórico.

## Pontos que ainda não devem ser anunciados como concluídos

A tela de assinaturas registra contrato, ciclo, moeda, cotação estimada e custos
indicativos. O valor efetivo da fatura, IOF e tarifa ainda precisam ser conferidos e
registrados manualmente; não há geração automática de cobrança/AP por ciclo. Essa
integração está prevista em `SAA-004` (`feature/saas-finance-integration`). A
estimativa não deve ser tratada como valor pago.

A regra informada para o cadastro de colaboradores é que todos são PJ. O banco demo
atual ainda contém os fixtures `Lideranca Demo` e `Colaborador CLT Exemplo` como CLT,
além de `Admin Local` como sócio. Isso não altera o fluxo PJ validado, mas precisa ser
corrigido no mockup/seed antes de apresentar a lista como exclusivamente PJ.

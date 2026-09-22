# 02 — PRD Financeiro v2

## 1. Objetivo

Transformar o módulo financeiro atual em uma fonte confiável para obrigações e caixa, sem perder dados existentes e sem criar um financeiro paralelo para a Gráfica.

## 2. Semântica oficial

- **Conta a Receber (AR):** obrigação/expectativa de recebimento.
- **Conta a Pagar (AP):** obrigação de pagamento.
- **Movimentação financeira:** dinheiro efetivamente recebido ou pago.
- **Alocação:** vínculo de uma movimentação a uma ou mais AR/AP.
- **Conciliação:** processo de explicar uma movimentação por títulos/entidades.
- **Provisão:** expectativa futura ainda não materializada como obrigação real.

Os registros atuais de `financial_entries` devem ser tratados como AR; `financial_expenses`, como AP.

## 3. Objetivos funcionais

- pagamentos/recebimentos parciais;
- uma movimentação pode liquidar vários títulos;
- um título pode ser liquidado por várias movimentações;
- movimentações não identificadas podem existir e gerar pendência;
- competência, vencimento e data de liquidação são conceitos distintos;
- estorno preserva histórico;
- nenhuma soma financeira depende de “status digitado” pelo cliente;
- Gráfica, NF PJ e reembolsos apontam para a mesma base financeira.

## 4. Modelo alvo

### 4.1 `financial_accounts`

Conta financeira real ou lógica:

- conta bancária;
- caixa;
- cartão/conta de passagem quando necessário.

Campos: organização, nome, tipo, status, identificação mascarada, saldo inicial opcional, timestamps.

Não armazenar credenciais bancárias.

### 4.2 `financial_categories`

Categoria gerencial administrável. Deve permitir marcar natureza/uso sem transformar a categoria em regra contábil.

### 4.3 `cost_centers`

Centro de custo transversal: Gráfica, Administrativo, Evento etc. Projeto/evento não é sinônimo de centro de custo.

### 4.4 `suppliers`

Fornecedor é entidade compartilhada e será usado pela Gráfica e Financeiro.

### 4.5 AR/AP

Manter tabelas existentes durante migração, evoluindo campos necessários:

- valor original;
- valor liquidado derivado ou cache consistente;
- vencimento;
- competência;
- status derivado (`open`, `partial`, `settled`, `cancelled`, `overdue`);
- origem (`manual`, `graphic_job`, `invoice`, `reimbursement`, `saas`, etc.);
- entidade origem opcional;
- cliente/fornecedor;
- categoria/centro de custo;
- notas.

### 4.6 `financial_transactions`

Campos mínimos:

- `organizationId`;
- `accountId`;
- `direction` (`in`, `out`);
- `amount` positivo;
- `occurredAt`;
- `method`/referência;
- `counterpartyName`/cliente/fornecedor quando conhecido;
- `status` (`pending_reconciliation`, `partially_reconciled`, `reconciled`, `reversed`);
- `reversedTransactionId` opcional;
- origem/import metadata;
- audit fields.

### 4.7 `financial_allocations`

Vínculo many-to-many:

- transaction;
- receivable ou payable alvo;
- amount;
- metadata/auditoria.

A soma das alocações não pode exceder a movimentação nem o saldo aberto do título, salvo fluxo explícito de crédito/adiante documentado futuramente.

## 5. Regras de liquidação

### Recebimento

1. Financeiro registra/importa movimentação `in`.
2. Sistema sugere títulos possíveis por cliente, valor, datas e referências.
3. Sugestão nunca confirma sozinha apenas por valor.
4. Usuário cria uma ou mais alocações.
5. Status da movimentação e dos títulos é recalculado.

### Pagamento

Mesmo fluxo em direção `out` para AP.

### Parcial

Título de R$ 10.000 com recebimento de R$ 3.000 fica `partial`, saldo R$ 7.000.

### Multi-OS

Recebimento R$ 4.317,52 pode ser alocado a duas ou mais AR/OS sem usar texto “859 e 856” em uma célula.

## 6. Conciliação e pendências

Movimentação sem vínculo fica `pending_reconciliation` e cria `work_item`.

Pode haver vínculo parcial. Pendência só resolve quando:

- movimentação está totalmente alocada; ou
- usuário autorizado registra resolução excepcional com motivo.

## 7. Estorno

Nunca apagar movimentação liquidada. Criar estorno com ligação ao original e desfazer/recalcular alocações de forma transacional.

## 8. Provisões

Provisão não deve duplicar obrigação real.

Modelo deve permitir:

- recorrência/configuração;
- próxima ocorrência;
- realização que cria AR/AP e marca aquele ciclo como realizado;
- cancelamento de ciclo;
- relatório separado entre previsto e realizado.

## 9. Integrações

### Gráfica

- fornecedor contratado → AP vinculada ao Trabalho;
- cliente aprovado/condição definida → AR vinculada ao Trabalho;
- movimentações/liquidações aparecem no resumo da OS.

### NF PJ

A aprovação da NF gera ou vincula AP. A ação “pago” da NF deixa de ser fonte de verdade separada; o estado financeiro deriva da AP/liquidação.

### Reembolso

Reembolso aprovado para pagamento gera/vincula AP, salvo quando estiver incluído em NF conforme regra do domínio.

### SaaS

Assinaturas podem futuramente materializar provisões/AP, sem dupla contagem.

## 10. Permissões

Sugestão de chaves:

- `finance.read`;
- `finance.write`;
- `finance.settle`;
- `finance.reconcile`;
- `finance.reverse`;
- `finance.export`;
- `finance.configure`.

Não conceder `settle/reverse` automaticamente a perfis departamentais.

## 11. Rate limiting

Aplicar limite explícito a:

- exports;
- criação repetida de movimentações via endpoint/import;
- tentativas de conciliação em lote;
- uploads de comprovantes;
- ações de estorno.

Valores ficam configuráveis conforme `06-security-and-rls.md`.

## 12. Tasks

### FIN-001 — Normalizar conceitos e status de AR/AP

**P0** — depende `CORE-001`, `SEC-003`
Branch: `feature/finance-ar-ap-semantics`

- renomear labels/UI sem migration destrutiva;
- centralizar cálculo de status;
- separar competência/vencimento/liquidação;
- remover dependência de status arbitrário de form;
- testes de overdue/partial/settled preparados para nova camada.

### FIN-002 — Master data financeiro e fornecedores

**P0** — depende `FIN-001`
Branch: `feature/finance-master-data`

- `financial_accounts`;
- `financial_categories`;
- `cost_centers`;
- `suppliers`;
- RLS e CRUD configurável;
- migração de texto livre deve preservar snapshot original.

### FIN-003 — Movimentações financeiras

**P0** — depende `FIN-002`
Branch: `feature/finance-transactions`

- `financial_transactions`;
- cadastro entrada/saída real;
- conta financeira obrigatória;
- status de conciliação;
- audit/RLS/rate limit.

### FIN-004 — Alocações many-to-many

**P0** — depende `FIN-003`
Branch: `feature/finance-allocations`

- `financial_allocations`;
- transação atômica;
- impedir over-allocation;
- recalcular saldo/status;
- cross-org impossível.

### FIN-005 — Liquidação parcial e conciliação

**P0** — depende `FIN-004`, `CORE-004`
Branch: `feature/finance-reconciliation`

- UI/DAL de conciliação;
- parcial;
- múltiplos títulos;
- pendência automática;
- sugestão sem auto-confirmação.

### FIN-006 — Estorno e correções

**P0** — depende `FIN-005`, `CORE-006`
Branch: `feature/finance-reversal`

- estorno imutável/histórico;
- rollback transacional de alocações;
- motivo obrigatório;
- permissão específica.

### FIN-007 — Provisões/recorrências v2

**P1** — depende `FIN-001`, `FIN-002`
Branch: `feature/finance-provisions-v2`

- ciclos;
- realização sem dupla contagem;
- cancelamento de ocorrência;
- previsão vs realizado.

### FIN-008 — Documentos/comprovantes financeiros

**P1** — depende `DOC-002`, `FIN-003`
Branch: `feature/finance-attachments`

- anexos em AR/AP/movimentação;
- upload seguro;
- permissão e audit de leitura sensível.

### FIN-009 — Relatórios competência/caixa/AR/AP

**P1** — depende `FIN-005`, `FIN-007`
Branch: `feature/finance-reporting-v2`

- resultado por competência;
- fluxo de caixa por `occurredAt`;
- aging AR/AP;
- sem somar provisão realizada duas vezes.

### FIN-010 — Compatibilidade e deprecação do fluxo antigo

**P1** — depende `FIN-005`, integrações GRF/INV/REI
Branch: `chore/finance-legacy-cutover`

- remover botões antigos de “marcar pago/recebido” que bypassam movimentação;
- manter leitura histórica;
- documentar cutoff.

## 13. Critérios globais de aceite

- [ ] nenhuma liquidação depende apenas de `receivedDate`/`paidDate` em título;
- [ ] parcial funciona;
- [ ] uma movimentação pode conciliar várias AR/AP;
- [ ] RLS bloqueia outro `organizationId` mesmo se DAL for chamado incorretamente;
- [ ] estorno preserva original;
- [ ] Gráfica/NF/Reembolso usam a mesma fonte financeira;
- [ ] relatórios separam caixa e competência;
- [ ] migrations funcionam em banco novo e upgrade do baseline.

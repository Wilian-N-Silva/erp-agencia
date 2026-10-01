# INV-002 — aprovação NF e conta a pagar

Branch `codex/invoice-approval-transaction`, pendente de integração em development.

A aprovação cria `financial_expenses` e grava `invoice_requests.financial_expense_id`
na transação tenant existente. O lock da NF serializa aprovações concorrentes;
uma tentativa posterior encontra estado não aprovável. As duas entidades recebem
auditoria e nenhuma movimentação de caixa é criada.

O título usa nome do PJ, competência, vencimento e valor integral da composição,
incluindo venda de dias já autorizada/incluída. A aprovação exige PDF ativo da
mesma organização e colaborador, valor emitido informado e igual ao esperado.
Divergências devem ser ajustadas antes de aprovar; não se escolhe silenciosamente
entre dois valores conflitantes. Um vínculo existente não é substituído.

## Validação em 30/09/2026

- 398 unitários e 194 testes de banco aprovados.
- Typecheck, lint, build e `git diff --check` aprovados.
- Três testes de integração novos: concorrência/exatamente uma obrigação,
  rollback após falha de auditoria, negação por divergência/PDF ausente/RBAC/tenant.
- E2E PJ completo atualizado e aprovado: venda de 15 dias a R$ 1.950, composição
  R$ 3.900 + R$ 300 + R$ 1.950 = R$ 6.150, publicação, PDF, download do Financeiro,
  aprovação e obrigação vinculada de R$ 6.150 com zero pago. Também valida descanso
  flexível e rejeição de solicitação. Usa cadastros QA locais, sem reset.
- Build/E2E na worktree de validação para preservar o servidor dev da porta 3000.

## Segurança e arquivos

Autenticação e `invoices.approve` no servidor, ID validado por Zod, lookup tenant
com lock, RLS existente, rate limit de mutação e auditoria transacional. O cliente
não fornece valor, beneficiário ou ID da obrigação. Sem novos uploads/endpoints,
schema, migrations ou backfills; utiliza a migration 0046 da INV-001.

Arquivos alterados: `src/features/portal/actions.ts`,
`tests/integration/invoice-approval.test.ts`, `tests/e2e/pj-sale-workflow.spec.ts`
e este runbook. Alterações anteriores e worktrees preservadas.

## Limites

INV-003 ainda deve substituir “Marcar pago” por pagamento derivado da conciliação,
e INV-004 cobrir pagamento parcial, integral e estorno. NFs aprovadas antes da
0046 não recebem vínculos por inferência. A homologação financeira global ainda
não está concluída. Esta task não verifica disponibilidade física do objeto no
storage ao aprovar; valida o metadata do PDF e o download possui tratamento de
indisponibilidade próprio.

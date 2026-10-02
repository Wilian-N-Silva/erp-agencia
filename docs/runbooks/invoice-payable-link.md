# INV-001 — relação NF e conta a pagar

Branch: `codex/invoice-payable-link`. Etapa de expansão; não integrada em development.

## Contrato

`invoice_requests.financial_expense_id` referencia uma obrigação em
`financial_expenses`. É nullable para preservar registros legados, único inclusive
para NFs arquivadas, e possui FK composta com `organization_id`. A mesma conta
não pode ser compartilhada por duas NFs nem pertencer a outra organização.
A FK impede excluir fisicamente uma obrigação vinculada.

Migration gerada por drizzle-kit: `0046_salty_sphinx.sql`. Aplicada no PostgreSQL
local e de testes em 30/09/2026. Não houve backfill, alteração de valores/status,
criação de caixa nem associação inferida por descrição. Rollback de código pode
manter a coluna nullable; não executar rollback destrutivo do schema.

## Segurança

As duas tabelas já possuem RLS forçada. Nenhuma tabela nova, permissão, endpoint,
upload ou mutação de produto foi criado. Autenticação, RBAC, DAL, rate limiting,
auditoria e transações existentes permanecem. A FK acrescenta defesa contra
vínculo cross-tenant mesmo se houver erro no DAL. A coluna ainda não é aceita
em payloads externos nem exposta no portal.

## Verificação

- `tests/integration/invoice-payable-link.test.ts`: vínculo permitido, duplicidade
  inclusive após arquivamento, proteção contra exclusão, ID inexistente,
  referência de outra organização e update cross-tenant via runtime/RLS.
- `tests/integration/graphics-os-upgrade.test.ts`: fresh schema até 0046 e upgrade
  0045 → 0046 preservando NF legada paga e seu valor, com vínculo nulo.
- Suíte de banco: 191 testes aprovados; unitários: 398 aprovados.
- Gates de TypeScript, lint e diff verificados antes do commit.

## Próximas tasks obrigatórias

INV-002 deve criar a obrigação e gravar este vínculo na mesma transação da
aprovação, com teste de rollback e concorrência. INV-003 deve substituir o estado
de pagamento paralelo por leitura da obrigação/conciliacão, respeitando legado.
INV-004 deve validar NF → AP → pagamento parcial/integral e estorno.
Esta migration isolada não declara esses comportamentos implementados.

Arquivos: schema, migration e snapshot/journal; dois arquivos de testes de banco;
este runbook. Outras alterações de documentação/protótipo e worktrees `sec-002`
e `invoice-download-validation` foram preservadas.

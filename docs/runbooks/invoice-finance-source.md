# INV-003 — pagamento da NF derivado do Financeiro

Branch: `codex/invoice-finance-source`, pendente de integração.

Para NFs vinculadas, o DAL soma alocações de saída válidas da obrigação e ignora
movimentações estornadas. Exibe aberto/parcial/liquidado, valor conciliado e saldo
no backoffice e no portal. A NF documental permanece aprovada no banco; a leitura
fica paga somente quando a obrigação está integralmente conciliada. Um estorno
faz a leitura voltar a aprovada, sem atualizar um segundo estado financeiro.

NFs antigas sem vínculo preservam seu status/data históricos com aviso de
conferência necessária. Não há backfill inferido. Obrigações ausentes, excluídas
ou canceladas não são apresentadas como liquidadas.

O botão de pagamento manual foi retirado. A action antiga ainda autentica,
autoriza, valida o ID e aplica rate limit, mas rejeita a operação sem escrever
na NF ou em reembolsos, inclusive se chamada por cliente antigo.

## Segurança

A consulta financeira só recebe IDs de NFs já filtradas pelo escopo do usuário.
Cada join inclui organização, e as tabelas permanecem sob RLS. O portal recebe
apenas totais e situação da própria NF, sem detalhes bancários nem informações
de outros títulos. A conciliação continua exigindo `finance.settle`, transação,
limites, invariantes e auditoria existentes. Cache das telas de NF é invalidado
após conciliação. Sem schema, migration, backfill ou novo endpoint.

## Testes e limites

Regras puras cobrem parcial, integral, estorno, legado e obrigação indisponível.
Integração usa a operação real de alocação, verifica leitura own-scope/cross-tenant
e bloqueio da action antiga. A leitura após estorno é testada com status de
movimentação persistido pelo fixture; não prova uma UI de estorno (FIN-006).
O E2E PJ foi ampliado para duas saídas e conciliações de R$ 2.000 e R$ 4.150.

Reembolsos incluídos em NF ainda precisam da integração REI-003 para refletir
essa mesma liquidação em sua própria listagem. Não há declaração de homologação
financeira global. Assinaturas e demais pendências continuam no objetivo ativo.

Arquivos: DAL/actions do portal; regras novas `invoice-payment-rules.ts`; telas de
NF do backoffice/portal; invalidação após conciliação; testes unitários, integração
e E2E. Outras alterações e worktrees existentes foram preservadas.

## Validação concluída em 01/10/2026

- `npm run test`: 400 testes passaram.
- Suite de banco: 195 testes passaram, incluindo isolamento e migrations.
- Typecheck, lint e build passaram.
- Playwright `pj-sale-workflow.spec.ts`: passou; aprovação, PDF, duas saídas e
  conciliações refletem R$ 2.000 / saldo R$ 4.150 e R$ 6.150 / saldo zero no portal.
- Sem novas migrations ou backfills nesta task.

## Ambiente local

O Windows reservou a faixa que contém a porta 55432. O PostgreSQL foi reiniciado
na porta 15432, mantendo o volume `erp-agencia_erp_agencia_postgres_data` e seus
dados. Os arquivos locais `.env` e `.env.test.local` foram ajustados; o Compose
versionado continua usando a porta padrão. Para reproduzir a configuração local
atual, a cópia ignorada do Compose fica em:

```powershell
docker compose -p erp-agencia -f storage-local/manual-validation/postgres-port.yml up -d postgres
```

Build e E2E foram executados na worktree de validação isolada
`C:/Users/Wilian/.codex/worktrees/invoice-download-validation/erp-agencia`.
A worktree preexistente `erp-agencia-codex-worktrees/sec-002` foi preservada.

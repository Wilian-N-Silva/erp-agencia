# Documentação oficial — Sistema Interno FG

Esta pasta é a fonte de verdade atual para evolução do ERP da agência.

## Produto

- `01-prd-core-erp.md` — core, clientes, pendências, estados e timeline.
- `02-prd-financeiro.md` — AR/AP, caixa, conciliação, fornecedores e relatórios.
- `03-prd-grafica.md` — fluxo completo da Gráfica e integração financeira.
- `04-prd-pessoas-e-portal.md` — acesso, colaboradores, férias, NF, reembolso e portal.
- `05-prd-governanca.md` — equipamentos, acessos externos, SaaS e documentos.

## Regras transversais

- `06-security-and-rls.md` — segurança, RLS, RBAC, validação e rate limiting.
- `07-test-strategy.md` — estratégia e gates de testes.
- `08-codex-execution-plan.md` — ordem/dependências para implementação.
- `09-migration-rollout.md` — migrations, backfills, rollback e rollout.
- `10-codex-operations.md` — operação manual/legada do Codex.
- `11-codex-orchestration.md` — orquestração automatizada em branch candidata.
- `git-workflow.md` — workflow Git oficial.

## Orquestrador

- `codex/tasks.json` — representação machine-readable das tasks e dependências.
- `../AGENTS.md` — briefing canônico para agentes.

No modo orquestrado, `feature/codex-integration` é apenas uma candidata temporária. `development` continua sendo a branch oficial de integração e nunca é alterada automaticamente pelo orquestrador.

## Histórico e operação

- `archive/` — documentação antiga preservada, quando existente.
- `runbooks/` — backup/restore, staging e produção. Não substituir por versões resumidas.

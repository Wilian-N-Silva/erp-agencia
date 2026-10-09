# Documentação oficial — Sistema Interno FG

Manuais por público: [Gestão, Gráfica e Portal](manuais/README.md), acompanhados
da [validação e limitações dos fluxos](runbooks/user-workflows-validation.md).
[validação manual dos fluxos críticos](runbooks/manual-flow-validation-2026-10-09.md).

Esta pasta é a fonte de verdade atual para evolução do ERP da agência.

Entrega consolidada: [MVP de outubro — instalação, escopo e limites](runbooks/mvp-october-delivery.md).

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
## Acompanhamento da homologação V1

O escopo controlado de Gráfica e Financeiro, a matriz de prontidão e as evidências
atuais estão em [docs/homologacao](homologacao/README.md). Esse acompanhamento
distingue validação técnica de aceite humano e não conclui o restante do ERP.

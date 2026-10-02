# Validação de clientes, assinaturas e conciliação — 01/10/2026

Branch: `codex/client-finance-validation`, baseada em development com as correções
anteriores até `409a348`. Task atômica de validação do fluxo solicitado, relacionada
ao gate financeiro de `docs/07-test-strategy.md` e à conciliação FIN-005. Não marca
tasks integradas nem altera regras de negócio.

## Evidências atuais

O relatório de 30/09 `pj-finance-subscriptions-validation.md` é histórico: suas
pendências de venda PJ, acesso ao PDF, remoção e custos de assinaturas já receberam
correções. Não deve ser usado isoladamente como diagnóstico da branch atual.

O teste de cliente citado naquele relatório existia no commit `3e12a50`, mas não
estava presente nesta cadeia de branches. Foi recuperado como
`tests/e2e/client-finance-workflow.spec.ts`, limitado ao cliente/recebimento para
evitar duplicar os testes atuais de assinaturas. A competência acompanha o mês
da execução; a asserção final verifica o histórico financeiro do cliente.

| Fluxo | Resultado verificado nesta execução |
| --- | --- |
| Cadastro de cliente com fee | Cliente fictício criado pela interface, fee R$ 321,45 e vencimento dia 15 |
| Geração da obrigação | Conta a receber da competência exibida no histórico do cliente |
| Recebimento e conciliação | Entrada de R$ 321,45 vinculada ao título, saldo zero após recarga |
| Consulta posterior do cliente | Uma linha na competência, previsto e recebido R$ 321,45, status Recebido e sem ação de recebimento manual |
| Cadastro/cancelamento SaaS | R$ 87,65 acrescentados ao mensal e multiplicados por 12 no anualizado; cancelamento retira ambos, preservando contrato/valor histórico |
| Remoção de cadastro errado | Registro fictício desaparece da lista após recarga e URL retorna 404; assinatura com histórico de colaboradores recusa remoção |
| Gráfica e Financeiro | Cotação/OS/produção/encerramento, recebimento R$ 1.950 em alocações de R$ 500 e R$ 1.450, recusa de valor acima do título, saída de R$ 1.200 e conciliação passaram |

E2Es executados na worktree de validação, usando a build já aprovada de INV-003:

```powershell
node --env-file=.env node_modules/@playwright/test/cli.js test tests/e2e/saas-current-costs.spec.ts tests/e2e/saas-removal.spec.ts tests/e2e/graphics-os.spec.ts --workers=1
node --env-file=.env node_modules/@playwright/test/cli.js test tests/e2e/client-finance-workflow.spec.ts --workers=1
```

Resultado: 3 + 1 cenários passaram. Logs locais ignorados:
`storage-local/manual-validation/goal-finance-audit.log` e
`storage-local/manual-validation/client-finance-e2e.log` na worktree
`C:/Users/Wilian/.codex/worktrees/invoice-download-validation/erp-agencia`.

Gates desta task: `npm run typecheck`, `npm run lint`, `npm run test` (400 testes)
e `git diff --check` passaram. Não houve alteração de runtime que exigisse repetir
build ou migrations; os 195 testes de banco da revisão INV-003 são evidência
anterior, não uma nova execução desta task.

## Limites e sequência restante

- Remoção usa soft-delete e auditoria, conforme regras do repositório; não apaga
  fisicamente histórico financeiro. Cancelamento interno não cancela o fornecedor.
- Código atual de SaaS registra `monthlyCost` e `renewalDate`, mas não cria AP,
  provisão ou movimentação. O anualizado é estimativa de 12 mensalidades, não
  cobrança anual comprovada. SAA-004 depende de FIN-007 e SAA-001; não antecipada
  nesta task de validação. USD/EUR, cotação efetiva e IOF continuam pendentes.
- NF → AP → pagamento parcial/integral está verificado em
  [invoice-finance-source.md](invoice-finance-source.md). REI-003 ainda precisa
  refletir essa liquidação na listagem de reembolsos incluídos em NF.
- Estorno efetivo pela aplicação, cancelamento/reabertura de férias e integração
  das cobranças SaaS precisam de evidência própria antes de homologação global.
- A afirmação de que todos os colaboradores reais são PJ não autoriza converter
  fixtures legados ou alterar contratos reais sem identificação dos registros.

## Segurança e alterações

Somente teste e documentação alterados; sem schema, migration, backfill ou mudança
de autenticação, sessão, RBAC, RLS, DAL, validação, rate limit, upload, auditoria ou
transações. O teste usa o acesso demo já autorizado com permissão de conciliação e
cria dados fictícios identificados por `QA-cliente-financeiro-`. Não utiliza SQL
para simular operações da interface. Demais alterações locais foram preservadas.
As worktrees de validação e `feature/codex-sec-002` preexistentes foram preservadas.

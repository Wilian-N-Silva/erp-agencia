# Validação de férias PJ e venda na NF — 30/09/2026

Branch de trabalho: `codex/pj-sale-estimate`. Alterações ainda não integradas
em development. Requisito complementar à Wave 5, especialmente VAC-004/005;
não representa conclusão dos cards de cancelamento ou integração NF/AP.

## Fluxo verificado

Fixture local com vínculo desde 2020, remuneração de R$ 3.900 e ajuda de custo
de R$ 300. Usuários fictícios separados para colaborador e responsável:

1. Configurar a responsável de aprovação em `/app/ferias`.
2. Colaborador solicita venda de 15 dias no portal, consulta a explicação
   `3.900 ÷ 30 × 15 = 1.950` e informa o combinado.
3. Responsável autoriza R$ 1.950.
4. Criar composição de NF com base de R$ 3.900 e ajuda de R$ 300.
5. Conferir item de venda e total de R$ 6.150 no portal.
6. Colaborador envia PDF com esse valor; vínculo com a venda permanece único.
7. Solicitar e aprovar descanso de 10 dias corridos.
8. Recusar outra venda e conferir liberação da reserva.

Coberto por `tests/e2e/pj-sale-workflow.spec.ts`, aprovado no build local.
As fixtures alteram temporariamente a responsável da organização de demonstração
e restauram a configuração anterior ao terminar. Não executar contra produção.

## Banco e transações

Migration aditiva `0045_worried_wallow.sql`, gerada por Drizzle, aplicada no banco
local e no banco isolado de teste. Sem backfill de valores de vendas antigas.
Testes de fresh database e upgrade 0044 → 0045 aprovados.

A suíte de banco passou com 186 testes, incluindo oito casos específicos PJ:
remuneração vigente, vínculo único, NF enviada preservada, dias flexíveis,
concorrência, escopo/autorização, rollback e recusa após base se tornar inválida.
O teste de formulário injeta falha de auditoria e verifica que a composição não
é persistida parcialmente nem expõe a mensagem interna.

Typecheck, lint, build e 391 testes unitários passaram. A primeira regressão E2E
completa não carregou a senha de demonstração e falhou na autenticação. Executar
com o ambiente carregado e uma worker:

```powershell
node --env-file=.env node_modules/@playwright/test/cli.js test --workers=1
```

Resultado consolidado: seis cenários passaram antes da interrupção para preparar
a apresentação (três de acesso/clientes, importação Gráfica, fluxo Gráfica e
referências PJ). Os três restantes foram executados separadamente com o mesmo
build e passaram: venda PJ/NF, custo após cancelamento SaaS e remoção de cadastro
SaaS incorreto. Nove cenários cobertos em duas execuções; não houve uma execução
completa ininterrupta verde. Logs locais em `storage-local/manual-validation/`:
`pj-policy-all-e2e.log` e `pj-policy-remaining-e2e.log`.

O sistema e o mockup seguem em `http://localhost:3000`. A solicitação posterior
de apresentação mantém os nomes fictícios; cargos/departamentos aguardam lista
confirmada. Nenhuma limpeza da base foi executada e o Admin foi preservado.

## Pendências e limites

- A conferência visual do colaborador PJ de demonstração encontrou 0 dias
  adquiridos, 8 reservados e 10 aprovados: registros anteriores à nova política
  produzem saldo de -18. Preservados para reconciliação; não inventar crédito
  inicial nem apagar histórico. Novos pedidos não podem aumentar esse déficit.
- Configurar a conta real da Jaci antes de operação real; não inferir identidade
  pelo nome de exibição nem manter a fixture como responsável.
- Cancelamento/reabertura de descanso e venda ainda precisam de fluxo próprio.
- Aprovação NF → AP, baixa financeira e download por perfil financeiro seguem
  pendentes de correção/validação específica.
- Assinaturas em moeda estrangeira, cobrança anual, IOF e parcelamentos estão
  documentados em decisões separadas e ainda não implementados.
- A worktree `erp-agencia-codex-worktrees/sec-002` permanece preservada, fora
  desta execução.

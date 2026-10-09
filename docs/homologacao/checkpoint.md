# Checkpoint para a fase de homologação

Data: 09/10/2026. Branch: `feature/homologacao-v1-grafica-financeiro`.
Código e testes do checkpoint: `d9d28f5f9bcd8c1e752b2771f52fa1986f51f182`.
O commit posterior de encerramento acrescenta somente este registro/documentação;
não muda código, testes ou migrations do runtime validado.

O integrador solicitou encerrar a implementação, commitar o que está pronto e
adiar o restante para depois da homologação. A execução deve parar após a entrega
deste registro. O escopo original mais amplo não foi declarado concluído e o
aceite empresarial continua sendo uma decisão humana posterior.

## Últimas tarefas entregues

- `94d00c8`: correção da venda gráfica e parcelas nas mesmas ARs, com revisões
  imutáveis, snapshots antes/depois, motivo, autor, auditoria, revisão esperada,
  RBAC/RLS e bloqueio de recebimento/reserva. OS, venda original, cliente e
  documentos preservados. Gráfica, Cliente e Financeiro usam a obrigação vigente.
- `25cd0ad`: sugestão de conciliação gráfica consulta o ledger, sem depender do
  cache legado. Sugestão continua pendente, sem criar caixa ou reservar saldo;
  aceitação pelo Financeiro confere a capacidade novamente.
- `a173785` e `d9d28f5`: testes SaaS/Clientes localizam suas fixtures por busca,
  sem presumir primeira página. Mantidos os asserts e os dados existentes.
  Backlog da próxima versão e instrução de encerramento registrados.

Arquivos principais: `graphics/sale-correction*.ts[x]`, `sale.ts`,
`finance-summary.ts`, `reconciliation.ts`, página do trabalho, schema/matriz RLS,
testes unitários de action/validação, integração Gráfica/upgrade e E2E integrado.
Migration nova: **0061**, gerada por drizzle-kit e aplicada somente nos bancos
isolados de teste. Sem backfill, alteração de migration aplicada ou criação de
caixa/títulos duplicados. Migrations anteriores desta branch estão descritas no
[progresso](progresso.md) e no [ambiente](ambiente.md).

## Verificação do fechamento

| Comando | Resultado | Evidência local |
|---|---|---|
| `npm run typecheck` | Aprovado, exit 0 | `storage-local/homologacao/hml-close-typecheck.log` |
| `npm run lint` | Aprovado, exit 0 | `storage-local/homologacao/hml-close-lint.log` |
| `npm run test` | 478 testes / 81 arquivos, exit 0 | `storage-local/homologacao/hml-close-unit.log` |
| `npm run test:db -- --fileParallelism=false` | 265 testes / 41 arquivos, exit 0 | `storage-local/homologacao/hml-close-db.log` |
| `npm run build` | Aprovado, exit 0 | worktree de validação: `build-hml-close.log` |
| `npm run test:e2e -- --workers=1` | 23/23 aprovados, exit 0 | worktree de validação: `hml-close-e2e-full.log` |

Worktree de validação: `C:/Users/Wilian/projects/erp-agencia-hml-validation`.
Logs e ambientes privados não são commitados. Dois testes negativos comprovaram
o problema do cache antes da correção; as duas execuções E2E anteriores terminaram
22/23 por suposições de paginação. Suas causas e correções estão no progresso;
esses resultados não foram apresentados como gates aprovados.

## Recorte e entrega

Para preparar uma base dedicada, seguir [ambiente](ambiente.md). Usar dados
fictícios e [roteiro dos gestores](roteiro-gestores.md), respeitando as
[limitações e pendências pós-homologação](pos-homologacao.md). Não semear, limpar
ou atualizar uma base real por suposição. A base/aplicação de uso na porta 3000
foi preservada; esta execução não a promoveu para o novo checkpoint.

Sem merge em main/development, deployment ou alteração de produção. Worktrees
anteriores e stash preservados; nenhuma worktree inesperada encontrada.
`git diff --check` aprovado antes dos commits. Commits manuais nesta branch,
sem wrapper responsável pelo Git. A promoção/release exige uma decisão posterior.

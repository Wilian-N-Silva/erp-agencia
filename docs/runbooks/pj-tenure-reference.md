# Tempo de vínculo e referência anual PJ

Solicitação confirmada por Jaci, repassada pelo responsável: referência anual
a cada 12 meses desde o início do vínculo, sem obrigatoriedade de descanso
naquela data. Regra registrada em `docs/decisions/pj-timeoff-policy.md`.

Em Férias e ausências, o painel mostra cada PJ, início do vínculo, tempo em
anos/meses/dias, última referência completada e próxima referência anual.
No portal, o mesmo painel mostra somente o próprio colaborador. Não depende
de já existir uma solicitação de férias, portanto inclui PJs sem histórico.

As datas são recalculadas ao abrir/recarregar a página usando o dia de São Paulo.
A referência de quem iniciou em 29/02 é 28/02 em anos não bissextos e volta
a 29/02 nos anos bissextos. Vínculos futuros não geram tempo negativo. Para
vínculos encerrados, o tempo para na data de término e não há próxima referência;
se a data de término estiver ausente, a tela pede o preenchimento em vez de
mostrar uma duração incorreta.

As referências não comprovam saldo, dias usados/vendidos ou férias vencidas.
O histórico de solicitações e períodos aprovados continua separado. Nenhuma
solicitação, aprovação, pagamento ou adicional de férias é criado automaticamente.

## Segurança e testes

A consulta exige autenticação via página e permissões de férias no DAL, aplica
organização e RLS transacional, filtra PJs não excluídos e restringe a liderança
a si própria/equipe direta. O portal força escopo próprio mesmo quando o usuário
possui permissões globais. A projeção não carrega remuneração nem dados pessoais
sensíveis. Não há mutação, upload, novos IDs externos, mudança de sessão ou
necessidade de rate limit de escrita/auditoria de mutação. Sem migration/backfill.

- `src/tests/pj-reference.test.ts`: aniversário, primeiro ciclo, início futuro,
  mês incompleto, ano bissexto, encerramento e fuso horário.
- `tests/integration/pj-reference.test.ts`: organização, permissões, escopo
  global/equipe/próprio, CLT e exclusão, ausência de remuneração na projeção.
- `tests/e2e/pj-reference.spec.ts`: painel da gestão e portal próprio após login
  e recarga, com explicação sobre descanso em outra data.

Esta entrega não conclui as tasks VAC/INV: solicitação/venda de dias, aprovação
de valor pela Jaci e inclusão idempotente na próxima NF continuam pendentes.

## Resultado em 30/09/2026

Branch `codex/pj-tenure-reference`: typecheck, lint, 386 testes unitários,
177 testes de banco, build e 8 E2E aprovados. `git diff --check` sem erros.
Verificação visual com o perfil RH: PJ iniciado em 01/05/2026 aparece com
4 meses e 29 dias e primeira referência em 01/05/2027. Portal próprio também
verificado no E2E. Captura local `storage-local/manual-validation/pj-reference.png`.
Console sem erros; avisos preexistentes de HTTP local e depreciação do driver
PostgreSQL permanecem. Worktree adicional `feature/codex-sec-002` preservada.

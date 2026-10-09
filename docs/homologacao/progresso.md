# Progresso e evidências

## 09/10/2026 — HML-01 em andamento

Baseline `f3762ec`; árvore limpa; main/development sincronizadas. Migrations
0000..0050. Últimos commits: arte final, cobrança efetiva SaaS, fixtures PJ e ciclos.
Worktrees preexistentes SEC-002 e invoice-download-validation e stash de mockup
preservados. Banco local existente e servidor localhost:3000 não serão usados para
testes destrutivos. Nenhum deployment ou alteração de dados nesta auditoria.

Lidos AGENTS, índice, PRDs Core/Financeiro/Gráfica, execução, segurança, testes,
migrations, workflow e runbooks de entrega/ambiente/validação financeira.
Runbooks históricos contêm lacunas já corrigidas por commits mais recentes;
matriz distingue essas evidências de itens realmente ausentes.

Achados confirmados: baixa direta em três ações ainda ativas; leituras financeiras
aceitam cache/status histórico; estorno não implementado; alocações protegidas por
trigger imutável (0023). Relatório de atrasados soma valor original em vez do saldo.
Reconhecimento continua em comprovantes, projetos, permissões e todas as origens.
Próximo: ambiente descartável independente e gates baseline antes do cutover.

## HML-01 — baseline isolado / HML-02 — primeira proteção

Criado container PostgreSQL exclusivo da homologação em loopback:15433, diferente
de `erp-agencia-postgres`. Banco novo `erp_hml_dbtests`, migrator BYPASSRLS e app
NOBYPASSRLS/não owner. Nenhum banco preexistente removido; migrations 0000..0050
aplicadas com sucesso. Credenciais ficam somente em arquivo `.env.*` ignorado.
Baseline: lint verde, 430 unitários, 211 integração/segurança/migration em 34 arquivos
com `npm run test:db -- --fileParallelism=false` (55,33 s).

Baixas diretas de AR/AP/Clientes rejeitam chamadas no servidor após autenticação,
permissão, rate limit e validação, sem ler/escrever títulos. Botões agora abrem
movimentações/conciliação. Três regressões testam rejeição inclusive com autorização
e limite disponível. Nenhum dado histórico modificado. 433 unitários e lint verdes.
Logs locais: `storage-local/homologacao/baseline-*` e `cutover-*`.

Esta proteção não conclui FIN-010: ainda faltam fontes de leitura legadas explícitas,
guards de edição/cancelamento e demais origens. Build/E2E desta candidata ainda
pendentes; testes históricos não serão apresentados como aprovação desta V1.

## HML-03 — estorno em validação

Registro de estorno por movimentação, motivo obrigatório, permissão `finance.reverse`,
histórico imutável e recálculo transacional dos títulos. Reenvio concorrente devolve
o mesmo estorno. Alocações originais permanecem; somente movimentações ativas
participam das somas. UI no detalhe da movimentação e audit de motivo/antes/depois.
Correção de dinheiro lançado por engano: estornar e cadastrar movimento correto;
nenhuma transferência bancária automática.

0051 foi gerada por drizzle-kit para tabela/RLS/grant/trigger imutável e guard de
títulos. Teste revelou que o trigger de capacidade antigo contava alocações
estornadas. Como 0051 já estava aplicada no banco isolado, gerada migration custom
0052 para corrigir o guard sem editar histórico. Ambas aplicadas somente em testes.

215 testes de banco em 35 arquivos passaram (69,08 s), incluindo concorrência,
AR/AP, nova conciliação após estorno, isolamento/RLS, payload, permissão e rollback.
Unitários, lint e typecheck passaram antes do último E2E adicionado; próxima etapa
revalida os gates e build/E2E no checkout separado `erp-agencia-hml-validation`.
Esse checkout tem banco E2E novo `erp_hml_e2e`, seed apenas fictício e uploads próprios.
Não é o ambiente local em uso nem a candidata empresarial aprovada.

### Evidência do checkpoint `abce9c0`

436 unitários (67 arquivos), 215 de banco (35 arquivos), typecheck e lint verdes.
Build aprovado na worktree isolada, migrations 0051/0052 e seed somente em
`erp_hml_e2e`. `finance-reversal.spec.ts`: 1/1 aprovado, processo exit 0, registra
cliente/AR, concilia R$100, estorna com motivo, preserva vínculos e confere AR
reaberta com recebido R$0 no Cliente após reload. Logs: `build-reversal.log` e
`reversal-e2e.log` na worktree; demais logs em storage-local/homologacao.

Pendente: gate E2E completo preparado sem dependências de QA histórico; cobertura
Gráfica→Financeiro→Cliente, relatórios de caixa com estorno por data, legado explícito,
guards de edição/cancelamento, documentos financeiros, projeto/perfis e restart.
O SHA acima é um checkpoint de desenvolvimento, não o candidato final homologável.

## HML-02 — proteção de correções e cancelamentos

Edição e cancelamento agora bloqueiam o título com `FOR UPDATE` dentro da
transação tenant existente. Justificativa obrigatória é validada com Zod estrito
e gravada junto do before/after na auditoria. Não se permite reduzir o valor
abaixo da liquidação, trocar contraparte liquidada, alterar título cancelado ou
cancelar uma obrigação com baixa parcial/integral, inclusive histórica.

Origens explícitas (parcela gráfica, contratação, NF, cobrança SaaS e ciclo de
provisão) protegem valor, contraparte, competência, recorrência e cancelamento.
Informações documentais e vencimento continuam corrigíveis. Não são inferidos
vínculos por descrição. A interface pede motivo e apresenta os conflitos seguros
sem expor erros internos. Correções revalidam também Cliente, Gráfica e Portal.

444 unitários/68 arquivos e 220 testes de banco/36 arquivos aprovados. Typecheck
e lint aprovados (warning de import removido). Novos testes verificam proteção
histórica, origens, justificativa, payload, permissão, auditoria e rollback.
Logs em `storage-local/homologacao/title-*.log`, somente banco isolado.
Sem migration/backfill neste incremento. Build/E2E da interface em validação.

Pendente antes de considerar esta proteção completa para V1: revisão controlada
das origens integradas quando for necessário desfazer uma contratação/venda,
explicitação do legado nas leituras e tratamento da baixa direta de reembolso
avulso identificada em `portal/actions.ts`. Não declarar candidato pronto.

### Validação da interface de correção

Build do código `09f05e5` aprovado na worktree isolada. Em `8d83860`, dois E2E
passaram no mesmo build: correção/cancelamento com justificativa e
recebimento/conciliação/estorno/consulta no Cliente. Logs:
`build-title-corrections.log`, `title-and-reversal-e2e.log` nessa worktree.
As primeiras execuções do novo E2E falharam por seletor relativo do MoneyInput e
por esperar mensagem em um formulário removido após cancelar. Corrigidos os
testes, sem relaxar proteção ou modificar a regra de negócio.

## HML-04 — saldo vencido parcial

O dashboard de competência somava o valor original apenas quando o estado
derivado era `overdue`; uma obrigação parcial já vencida ficava fora do total.
Agora o indicador usa a data de vencimento e soma somente o saldo em aberto,
excluindo cancelados e liquidados. Vencimento no próprio dia ainda não é atraso.
Dois testes cobrem AR/AP parcial, estados, competência e reabertura após estorno.
446 unitários/69 arquivos aprovados; sem migration, backfill ou alteração de caixa.
Caixa por eventos/datadas, legado explícito e relatórios completos continuam pendentes.

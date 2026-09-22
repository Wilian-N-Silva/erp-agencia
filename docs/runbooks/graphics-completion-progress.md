# Conclusão do módulo Gráfica — GRF-005 a GRF-014

Escopo solicitado: concluir todas as etapas e verificar o fluxo por interface, incluindo caminhos guiados para iniciantes e tarefas recorrentes para usuários experientes.

Branch de trabalho: `codex/graphics-completion`, criada de `development` e acrescida da GRF-005 validada. O pedido explícito abrange várias tasks; os commits e evidências serão separados por etapa. Não representa release nem promoção automática de status no execution plan.

## Acompanhamento

- GRF-005: implementada no commit 267b563, incorporada nesta branch.
- GRF-006: implementada e validada nesta branch; decisão vinculada à versão atual, histórico imutável, evidência privada e permissão específica.
- GRF-007: implementada e validada nesta branch — produção, bloqueios, responsável, entrega e encerramento.
- GRF-008: implementada e validada nesta branch — contratação explícita e AP idempotente/transacional.
- GRF-009: implementada e validada nesta branch — condição comercial, sinal/parcelas e AR sem caixa automático.
- GRF-010: implementada e validada nesta branch — resumo financeiro derivado de obrigações e alocações.
- GRF-011: implementada e validada nesta branch — sugestões de conciliação, confirmação pelo Financeiro.
- GRF-012: pendente — dashboard operacional/financeiro com filtros.
- GRF-013: pendente — importação com staging, dry-run, proveniência, pendências e relatório.
- GRF-014: pendente — E2E completo e revisão de usabilidade.

Dependências: UI/DAL de conciliação FIN-005 implementada e validada nesta branch; contrato compartilhado de anexos DOC-001/002 ainda a completar/verificar. Reutilizar Financeiro existente e manter autorização de liquidação separada da Gráfica.

## Gate final

Migrations fresh/upgrade, isolamento cross-tenant, RBAC e payload tampering; concorrência e rollback financeiro; repetição de contratação/venda/importação; upload/download; typecheck, lint, unitários, banco, build e E2E.

Usabilidade: próxima ação explícita; cadastro acessível de fornecedor compartilhado; preservação de campos após erro; motivo de bloqueios visível; alteração de OS invalida decisões obsoletas; valores de caixa separados de compromissos; nenhum vínculo histórico inferido silenciosamente. Testes automatizados e inspeção manual não substituem futura validação com usuários reais.

## Evidência GRF-006 — 21/09/2026

- Migrações 0029/0030 geradas pelo drizzle-kit e aplicadas localmente e na base de testes. A ordem de criação do índice composto foi corrigida antes da primeira aplicação bem-sucedida (o gerador emitia a FK antes do índice referenciado). Nenhuma migration aplicada foi alterada.
- Typecheck, lint, build e `git diff --check` aprovados.
- 343 testes unitários; 149 testes de banco; 4 E2E sequenciais aprovados. Inclui fresh/upgrade, concorrência, rollback, RBAC, RLS, evidência cross-org, revisão da OS e aprovação posterior vinculada à nova versão.
- Primeiro E2E falhou no seletor de um select com label implícito; corrigido para localizar o papel acessível `combobox`. Reexecução completa aprovada.
- Campos de texto preservados após erro; orientação explícita para selecionar novamente o arquivo. Recusa pode ser retomada por uma solicitação de alteração. Aprovação não gera AR/AP nem caixa.
- Novas permissões concedidas via migration aos perfis Diretoria e Admin Técnico, seguindo o padrão das aprovações internas; demais concessões continuam pelo RBAC persistido.

## Evidência GRF-007 — 21/09/2026

- Migrações 0031/0032: eventos de produção imutáveis, RLS forçada, FKs por organização e permissão de produção.
- Typecheck, lint, build e diff-check aprovados; 345 testes unitários, 151 de banco e 4 E2E sequenciais passaram.
- Testado: aprovação atual obrigatória; rejeição de salto de etapas; espera com motivo/responsável/work item; retomada somente à etapa bloqueada; resolução da pendência; pronto/entregue/encerrado; concorrência; rollback; RLS e FKs cross-tenant; upgrade preservando OS existente.
- O próximo incremento vinculará a liberação à contratação financeira, conforme GRF-008. Encerramento operacional é separado de liquidação financeira.

## Evidência GRF-008 — 21/09/2026

- Migrações 0033/0034 aplicadas: compromisso imutável, unicidade por cotação/AP, RLS e FKs tenant.
- Contratação explícita com data, vencimento, competência, categoria e centro de custo opcional. Valor/fornecedor são obtidos da cotação aprovada no servidor. A AP mantém os snapshots usados pelo Financeiro existente e a origem é ligada pelo compromisso e auditoria.
- Produção exige compromisso com AP ativa. Aprovação de cotação/cliente continua sem criar AP ou caixa automaticamente.
- Typecheck, lint, build e diff-check aprovados; 346 testes unitários, 152 de banco e 4 E2E passaram. Cobertos concorrência idempotente, rollback financeiro, autorização, mass assignment, RLS e upgrade.
- O primeiro E2E encontrou a ausência de categoria de despesa nos dados demo; o cenário agora prepara uma categoria de teste pelo cadastro financeiro antes de contratar. O estado vazio orienta a solicitar categoria ao Financeiro.

## Evidência GRF-009 — 21/09/2026

- Venda vinculada à versão aprovada da OS, parcelas com soma exata em centavos, criação transacional e idempotente de AR, sem movimentação automática.
- Migrações 0035/0036 aplicadas nos bancos local e de testes; tabelas imutáveis, RLS forçada e FKs por organização.
- Typecheck, lint, build e diff-check aprovados; 348 testes unitários, 153 testes de banco e 4 E2E aprovados. Cobertura inclui concorrência, rollback, acesso cross-tenant, upgrade e preservação do formulário após soma inválida.

## Evidência FIN-005 — dependência da GRF-010 — 21/09/2026

- Tela de conciliação acessível pelas movimentações, busca por descrição/código/contraparte, títulos sugeridos por contraparte sem confirmação automática, valores parciais e múltiplos títulos. Até 200 candidatos por busca; lote limitado a 100 alocações.
- Reutiliza a transação e os limites de alocação existentes. Confirmação exige finance.settle, sessão, validação estrita, limite persistente de conciliação e saldo esperado. Envios concorrentes ou repetidos com saldo antigo são rejeitados.
- Nova movimentação cria pendência na mesma transação; conciliação parcial preserva a pendência; integral resolve com auditoria. Movimentações antigas continuam acessíveis e sua pendência é sincronizada quando recebem alocações; nenhum histórico foi reinterpretado por backfill.
- Não amplia automaticamente concessões de finance.settle: administração de acesso mantém a concessão explícita. Nenhuma permissão de liquidação é concedida à Gráfica.
- Typecheck, lint, build e diff-check aprovados; 350 testes unitários, 154 de banco e 4 E2E aprovados. E2E testa valor acima do título, preservação dos campos, sinal/saldo e persistência após recarga. Correções de seletores cobrem indicador de campo obrigatório e anúncio de rota do Next.js.
- Sem migration ou backfill nesta dependência. Worktree sec-002 preexistente preservada; Git gerenciado manualmente nesta branch.

## Evidência GRF-010 — 21/09/2026

- Resumo financeiro no detalhe: venda contratada, AR/AP em aberto, recebimentos/pagamentos conciliados, custos ativos, status e quantidade de movimentações parcialmente vinculadas. Entradas monetárias são lidas em um único snapshot SQL, com organização explícita e RLS.
- Margem contratada é distinta de resultado de caixa. Ausência de venda/custos, títulos inativos, divergência entre venda e AR, liquidações históricas sem alocações e pendências de conciliação impedem exibir margem como confiável. Valores são calculados em centavos.
- Migração 0037 adiciona graphics.finance_read ao catálogo e aos perfis Admin Técnico/Diretoria; finance.read também autoriza consulta. Demais usuários da Gráfica não recebem dados de liquidação. Nenhuma tabela ou backfill criado.
- Typecheck, lint, build e diff-check aprovados; 355 testes unitários, 156 de banco e 4 E2E passaram. Inclui upgrade, RBAC/IDOR, caixa dividido entre parcelas sem dupla contagem, margem indisponível durante conciliação parcial e resultado real após recebimento pela UI.
- Movimentações totalmente sem vínculo não são atribuídas por aproximação ao trabalho; devem ser identificadas no Financeiro. O dashboard e a atualização da listagem são tratados na GRF-012. A margem considera somente custos cadastrados, conforme orientação visível na tela.

## Implementação GRF-011 — 21/09/2026

- Sugestão explícita por trabalho/parcela/recebimento/valor/justificativa. Permissão graphics.reconcile_suggest separada de finance.settle; nenhum valor é liquidado ao sugerir ou rejeitar.
- Financeiro revisa pela tela da movimentação. Aceitar cria alocação com as mesmas proteções financeiras e registra a revisão em uma transação. Reenvio da mesma decisão não cria nova baixa. Sugestões antigas ficam preservadas; rejeição exige justificativa.
- Migrações 0038/0039: tabela tenant com RLS forçada, FKs compostas, vínculo obrigatório de parcela ao trabalho, unicidade de sugestão pendente e proteção do histórico por trigger. Pendência de revisão e auditoria acompanham criação/decisão. Resumo financeiro sinaliza sugestões pendentes.
- O seletor exibe até 200 recebimentos recentes do mesmo cliente ou ainda não identificado, com data/referência/saldo. Não expõe conta bancária ou contraparte livre à Gráfica. Outros recebimentos devem ser localizados pelo Financeiro na conciliação.
- Testes cobrem validação, RBAC, ausência de baixa automática, rejeição, repetição de confirmação, rollback de auditoria, histórico imutável, RLS sem contexto/cross-tenant e upgrade. E2E percorre sugestão pela Gráfica e confirmação pelo Financeiro com atualização dos saldos.
- Gates finais aprovados: typecheck, lint, build, diff-check, 357 testes unitários, 157 testes de banco e 4 E2E. Migrações aplicadas nas bases local e de testes. Worktree sec-002 preservada.

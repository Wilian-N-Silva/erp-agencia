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
- GRF-012: implementada e validada nesta branch — dashboard operacional/financeiro com filtros.
- GRF-013: parser, staging, revisão/confirmação, interface e relatório implementados; E2E de venda/entrada/linha inválida aprovado. Revisão final de pendências e demais blocos ainda necessária.
- GRF-014: em andamento — E2E com duas cotações/rejeição e fluxo até encerramento aprovado; multi-OS, pagamentos e revisão final de usabilidade ainda pendentes.

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

## Evidência GRF-012 — 22/09/2026

- Listagem integra visão operacional por etapa, aprovação interna/cliente, produção, espera, entrega atrasada e pendências abertas vinculadas aos trabalhos filtrados. Filtros de busca, etapa, cliente, responsável e projeto têm rótulos acessíveis e opção de limpar; links por etapa preservam os demais filtros.
- Visão financeira usa leitura em lote com organização/RLS e exibe contratado, AR/AP aberto, recebido/pago conciliado, custos e margem/caixa apenas quando todos os trabalhos têm vínculos confiáveis. Usuários somente operacionais não recebem resumos monetários. Encerramento operacional com saldo pendente indica a próxima ação financeira.
- Sem migration/backfill. Testes de filtros e autorização no DAL; E2E confere totais de um trabalho e resultado vazio ao trocar etapa. O teste unitário antigo da página foi ajustado ao novo carregamento do dashboard, preservando a cobertura do perfil apenas aprovador.
- Typecheck, lint, build e diff-check aprovados; 359 testes unitários, 158 de banco e 4 E2E passaram. A leitura consolidada reutiliza as mesmas regras financeiras do detalhe para evitar divergência de totais.

## Progresso GRF-013 — parser — 22/09/2026

- Parser XLSX com ExcelJS existente, mapeamento explícito de até três blocos (vendas/OS, saídas, entradas), aba/intervalo/colunas e até 10.000 linhas. Blocos não podem compartilhar células de origem.
- Preserva checksum SHA-256, aba, número da linha, valores originais e campos normalizados, incluindo projeto. OS ausente/múltipla/duplicada gera classificação ambígua; datas inválidas, fórmulas e valores inválidos exigem revisão. Não infere vínculo de caixa com vendas pelo texto da OS.
- Validação prévia do ZIP limita arquivo a 10 MB, expansão real a 40 MB e 500 entradas; rejeita criptografia, macros, links externos e estruturas inconsistentes. Não executa fórmulas ou usa seu resultado em cache como valor confirmado.
- Esta etapa ainda não disponibiliza importação na interface nem escreve registros financeiros. Próximos passos obrigatórios: staging persistente, dry-run, resolução de referências, confirmação idempotente, work items, relatório e E2E.

## Progresso GRF-013 — staging — 22/09/2026

- Migrações 0040/0041 aplicadas nos bancos local e de testes: lotes/linhas com RLS forçada, FKs tenant, unicidade por checksum e origem, e triggers que preservam arquivo/mapeamento/valores originais. Permissão graphics.import adicionada ao catálogo e seed Admin Técnico/Diretoria.
- DAL prepara a prévia em transação, com auditoria e inserts em lotes de 200 linhas. Reenvio do mesmo arquivo/mapeamento reutiliza a prévia, inclusive sob concorrência; mudança de mapeamento do mesmo arquivo é recusada para evitar duplicação. Nenhum trabalho, título ou movimentação é criado nesta fase.
- Testes de banco provam rollback em falha de auditoria, concorrência idempotente, ausência de writes financeiros, RBAC, isolamento por organização e sem contexto, proteção dos valores originais, mesma planilha independente em outra organização e upgrade preservando registros antigos.
- Interface, revisão de referências, confirmação dos dados finais, pendências/relatório e E2E da importação permanecem obrigatórios; GRF-013 não está concluída.

## Progresso GRF-013 — revisão e confirmação no DAL — 22/09/2026

- Revisão explícita com controle de versão por linha e validação de referências tenant. Vendas exigem cliente, responsável, vencimento, competência e situação operacional escolhidos pelo usuário. Caixa exige também finance.write e conta ativa; contraparte é opcional, sem vínculo inferido por OS.
- Migração 0042 permite origem histórica explícita em graphic_sales por FK para a linha de importação. Uma venda deve ter exatamente uma origem: versão de OS ou linha histórica. Fluxo novo continua exigindo OS aprovada; histórico não fabrica documento, aprovação ou recebimento.
- Confirmação transacional processa até 100 linhas revisadas por chamada. Vendas criam trabalho, venda e AR vinculada; entradas/saídas criam movimentações com proveniência e pendência de conciliação. Reenvio não recria registros. Linhas não revisadas geram work item; ignorar exige motivo e preserva os dados brutos.
- Testes focados aprovados: rollback de auditoria, reenvio idempotente, saldo de AR sem caixa automático, histórico sem OS fictícia, caixa sem alocações inventadas, permissão financeira adicional, pendências/resolução e upgrade até 0042. Interface, relatório e E2E ainda necessários para concluir a task.

## Progresso GRF-013 — interface de revisão — 22/09/2026

- Telas de envio/mapeamento, lotes recentes e revisão paginada em 50 linhas. Campos acessíveis para vínculos explícitos, correções e justificativas; nenhum cliente é escolhido por aproximação textual. Caixa exige finance.write também na interface e no DAL.
- Confirmação explícita processa até 100 linhas revisadas; linhas pendentes e ignoradas permanecem visíveis. Links levam ao trabalho ou à conciliação criada. Relatório JSON autenticado, limitado e auditado preserva origem, decisões e IDs gerados; resposta sem cache.
- Limite graphics_import aplicado à preparação de arquivos; revisão/ignorar/confirmação usam common_mutation, permitindo processar arquivos grandes em partes sem consumir a cota de novos arquivos.
- Typecheck, lint, build, 366 testes unitários e 162 testes de banco aprovados. Novos testes de formulário verificam ausência de inferência por nome e separação das referências de entrada/saída. Ajuste final de seleção de rate limiter feito após o build; precisa entrar no próximo build para E2E.
- Ainda falta validar a importação no navegador/E2E e revisar relatório/usabilidade com esse fluxo. GRF-013 permanece em andamento, GRF-014 e a auditoria final do módulo continuam pendentes. Nenhuma migration/backfill adicional. Worktree sec-002 preservada.


## Evidência de interface GRF-013 / avanço GRF-014 — 22/09/2026

- Novo E2E envia XLSX com venda, entrada e linha inválida, verifica ausência de cliente pré-selecionado por texto, revisa referências, ignora com motivo e confirma lote. Relatório comprova duas linhas importadas/uma ignorada e entrada sem jobId/entryId inferidos. Navegação abre o trabalho sem PDF fictício e caixa sem vínculo confirmado; recarga preserva lote concluído.
- E2E operacional ampliado: primeira cotação de fornecedor A rejeitada com motivo preservado, segunda cotação de B aprovada; segue OS/versionamento, decisões do cliente, contratação/AP, venda/AR, sugestão e conciliação, produção/espera/entrega/encerramento.
- Build atualizado, typecheck e lint aprovados. Suíte completa: 5 E2E aprovados em 23 segundos. Falhas iniciais eram seletores de select e URL capturada antes da navegação terminar, corrigidas no teste; os registros da tentativa intermediária ficaram preservados como dados QA.
- Screenshot de lote concluído inspecionado: storage-local/manual-validation/grf013-import-complete.png. Ainda falta revisão de usabilidade para demais estados, saída histórica, acesso às pendências, cadastro de fornecedores e recebimento multi-trabalho. Nenhuma migration/backfill ou merge nesta etapa.

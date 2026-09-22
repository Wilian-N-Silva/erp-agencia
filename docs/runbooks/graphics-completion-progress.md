# Conclusão do módulo Gráfica — GRF-005 a GRF-014

Escopo solicitado: concluir todas as etapas e verificar o fluxo por interface, incluindo caminhos guiados para iniciantes e tarefas recorrentes para usuários experientes.

Branch de trabalho: `codex/graphics-completion`, criada de `development` e acrescida da GRF-005 validada. O pedido explícito abrange várias tasks; os commits e evidências serão separados por etapa. Não representa release nem promoção automática de status no execution plan.

## Acompanhamento

- GRF-005: implementada no commit 267b563, incorporada nesta branch.
- GRF-006: implementada e validada nesta branch; decisão vinculada à versão atual, histórico imutável, evidência privada e permissão específica.
- GRF-007: implementada e validada nesta branch — produção, bloqueios, responsável, entrega e encerramento.
- GRF-008: implementada e validada nesta branch — contratação explícita e AP idempotente/transacional.
- GRF-009: implementada e validada nesta branch — condição comercial, sinal/parcelas e AR sem caixa automático.
- GRF-010: pendente — resumo financeiro derivado de obrigações e alocações.
- GRF-011: pendente — sugestões de conciliação, confirmação pelo Financeiro.
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

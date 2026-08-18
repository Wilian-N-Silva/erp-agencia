# 03 — PRD Módulo Gráfica

## 1. Objetivo

Criar um módulo exclusivo para o departamento de Gráfica, conforme exigência operacional da agência, sem replicar a estrutura confusa da planilha e sem substituir o software externo usado para gerar orçamento/“OS”.

O ERP registra, acompanha e relaciona o processo. Não calcula orçamento gráfico nem gera o PDF comercial.

## 2. Processo real

A funcionária:

1. recebe/entende a demanda;
2. procura fornecedores e coleta cotações;
3. envia opções para aprovação de Saulo/Jaci;
4. se fornecedor for recusado, procura outro;
5. após aprovação interna do fornecedor, gera o documento no software externo;
6. internamente esse documento é chamado de **OS**, embora o PDF diga “Orçamento”;
7. cliente aprova, recusa ou pede alteração;
8. trabalho segue para produção;
9. custos/pagamentos a fornecedores precisam ser acompanhados;
10. recebimentos do cliente muitas vezes chegam sem OS identificada e precisam ser conciliados.

## 3. Entidade central

`graphic_jobs` / Trabalho da Gráfica.

O trabalho nasce **antes da OS**.

Campos mínimos:

- `id`;
- `organizationId`;
- `internalCode`;
- `clientId`;
- `title`;
- `description`;
- `responsibleEmployeeId`;
- `projectId` opcional;
- `requestedAt`;
- `desiredDeliveryAt` opcional;
- `operationalStatus`;
- `financialStatus` derivado/resumo;
- observações;
- timestamps/soft delete.

## 4. Estados operacionais

Estados iniciais:

- `supplier_sourcing` — buscando fornecedor;
- `supplier_approval_pending` — cotação aguardando Saulo/Jaci;
- `os_pending` — fornecedor aprovado, falta registrar OS;
- `client_approval_pending`;
- `client_revision`;
- `client_rejected`;
- `approved`;
- `in_production`;
- `waiting`;
- `ready`;
- `delivered`;
- `closed`;
- `cancelled`.

Reprovar cotação não leva Trabalho a `cancelled`; retorna a `supplier_sourcing` quando não houver outra cotação aprovada.

`waiting` exige:

- motivo (`client`, `art`, `internal`, `supplier`, `material`, `payment`, `other`);
- responsável/“com quem está a bola”;
- observação opcional;
- work item correspondente.

## 5. Fornecedores e cotações

Fornecedor vem do cadastro compartilhado `suppliers`.

`graphic_supplier_quotes`:

- job;
- supplier;
- descrição;
- valor cotado;
- data;
- prazo estimado;
- condições;
- anexos;
- status `pending|approved|rejected|cancelled`;
- reviewer;
- reviewedAt;
- rejectionReason.

Uma cotação aprovada não significa dívida. O compromisso financeiro nasce quando houver contratação/liberação conforme regra abaixo.

## 6. Aprovação interna

O objeto aprovado é **cotação + fornecedor + condições**.

Quem pode aprovar inicialmente: perfis associados a Saulo/Jaci via permissão, nunca hardcode de nome/email.

Permissão sugerida: `graphics.supplier_quote_approve`.

Rejeição exige motivo e preserva histórico.

## 7. OS externa

O ERP não gera a OS.

Registrar:

- número externo;
- data;
- valor apresentado ao cliente;
- documento PDF;
- revisão/versão quando houver alteração;
- responsável.

Na UI usar “OS”. No código pode usar `externalOsNumber`/`osDocumentId`.

Duplicidade de número deve inicialmente gerar **warning**, não bloqueio absoluto, até a operação confirmar a regra de unicidade do software externo. O ID interno do Trabalho é a chave estável.

## 8. Aprovação do cliente

Campos:

- status `pending|approved|rejected|revision_requested`;
- contato;
- data;
- canal (`whatsapp`, `email`, `signed`, `phone`, `in_person`, `other`);
- observação;
- evidência/anexo opcional.

Cliente aprovado libera a próxima ação operacional. Mudança posterior deve ficar na timeline/audit.

## 9. Produção

Após aprovação do cliente, registrar liberação/contratação do fornecedor e etapas simples.

Não implementar MRP. Apenas status, responsável, prazo e bloqueios.

## 10. Custos e AP

A cotação aprovada pode aparecer como **custo aprovado**, mas não como `A pagar` até existir compromisso real.

Ao contratar/liberar fornecedor:

- registrar compromisso;
- criar/vincular AP no Financeiro em transação;
- guardar `graphicJobId`/origem;
- custo pode existir sem OS histórica na importação, mas novos fluxos devem preferir vínculo.

## 11. Receita e AR

Após aprovação do cliente e definição comercial:

- registrar valor contratado;
- criar uma ou várias AR conforme condição;
- não criar movimentação de caixa automaticamente.

Ex.: sinal + saldo.

## 12. Recebimentos e conciliação

A Gráfica não confirma dinheiro bancário.

Financeiro registra movimentação. Gráfica pode visualizar e, conforme permissão, sugerir vinculação operacional.

Uma movimentação pode atender várias OS/Trabalhos. Recebimento não identificado cria pendência.

## 13. Projetos/Eventos

`projects`/`graphic_projects` conforme decisão de arquitetura compartilhada.

Cafu Camp é projeto/evento e pode agrupar Trabalhos, custos, receitas e pendências sem coluna especial.

## 14. Próxima ação

A tela do Trabalho deve destacar próxima ação derivada do estado:

- buscar fornecedor;
- aprovar cotação;
- registrar OS;
- obter aprovação do cliente;
- liberar produção;
- resolver bloqueio;
- entregar;
- resolver pendência financeira.

Responsável deve ser visível.

## 15. Dashboard da Gráfica

Mostrar:

- Trabalhos por estágio;
- aguardando aprovação interna;
- aguardando cliente;
- em produção/atrasados;
- pendências;
- valor contratado;
- AR aberto/recebido;
- custos contratados/AP aberto/pago;
- margem/resultado apenas quando vínculos forem confiáveis.

## 16. Importação da planilha

A planilha histórica contém três blocos sem relacionamento confiável: OS/vendas, Saídas e Entradas. Há OS ausentes, múltiplas OS na mesma célula, números potencialmente duplicados, datas inconsistentes e projeto especial em coluna separada.

Importação deve preservar `sourceSheet`, `sourceRow`, valor original e conteúdo bruto relevante.

Não adivinhar vínculos. Dados incertos viram pendências de reconciliação.

Estratégia:

1. staging/import tables ou DTO de importação;
2. parse determinístico;
3. validações;
4. import de registros claros;
5. fila de inconsistências;
6. reconciliação manual;
7. relatório final.

## 17. Permissões sugeridas

- `graphics.read`;
- `graphics.write`;
- `graphics.supplier_quote_write`;
- `graphics.supplier_quote_approve`;
- `graphics.client_approval_write`;
- `graphics.production_write`;
- `graphics.finance_read`;
- `graphics.reconcile_suggest`;
- `graphics.import`;
- `graphics.configure`.

Gráfica não recebe `finance.settle` por padrão.

## 18. Tasks

### GRF-001 — Schema base de Trabalhos e Projetos

**P0** — depende `SEC-003`, `CORE-001`, `FIN-002`
Branch: `feature/graphics-jobs-foundation`

- `graphic_jobs`;
- projeto/evento;
- código interno;
- state machine inicial;
- RLS/audit/testes.

### GRF-002 — Tela/listagem/detalhe de Trabalho

**P0** — depende `GRF-001`
Branch: `feature/graphics-jobs-ui`

- CRUD seguro;
- filtros;
- próxima ação;
- sem OS obrigatória na criação.

### GRF-003 — Cotações de fornecedores

**P0** — depende `GRF-001`, `FIN-002`
Branch: `feature/graphics-supplier-quotes`

- múltiplas cotações;
- anexos opcionais;
- prazo/valor/condições;
- histórico.

### GRF-004 — Aprovação interna de cotação

**P0** — depende `GRF-003`, `ACC-004`
Branch: `feature/graphics-supplier-approval`

- approve/reject;
- motivo na rejeição;
- permissão específica;
- transição correta do Trabalho;
- work item.

### GRF-005 — Registro de OS e documento

**P0** — depende `GRF-004`, `DOC-002`
Branch: `feature/graphics-os-registration`

- número/data/valor/documento;
- warning de duplicidade;
- versões/alterações auditadas.

### GRF-006 — Aprovação do cliente

**P0** — depende `GRF-005`
Branch: `feature/graphics-client-approval`

- status/canal/contato/data/evidência;
- revision/reject/approve;
- state machine/testes.

### GRF-007 — Produção, bloqueio e entrega

**P0** — depende `GRF-006`, `CORE-004`
Branch: `feature/graphics-production-flow`

- produção;
- waiting com motivo/owner;
- ready/delivered/closed;
- pendências.

### GRF-008 — Compromisso fornecedor → AP

**P0** — depende `GRF-006`, `FIN-004`
Branch: `feature/graphics-payables-integration`

- contratação explícita;
- criação/vínculo AP transacional;
- custo aprovado ≠ AP até contratação.

### GRF-009 — Venda aprovada → AR

**P0** — depende `GRF-006`, `FIN-004`
Branch: `feature/graphics-receivables-integration`

- valor contratado;
- parcelas/sinal;
- AR vinculada ao Trabalho;
- sem criar caixa.

### GRF-010 — Resumo financeiro do Trabalho

**P0** — depende `GRF-008`, `GRF-009`, `FIN-005`
Branch: `feature/graphics-finance-summary`

- contratado/AR/recebido;
- custos/AP/pago;
- pendências de conciliação;
- sem margem enganosa.

### GRF-011 — Sugestão de conciliação por Gráfica

**P1** — depende `GRF-010`, `FIN-005`
Branch: `feature/graphics-reconciliation-suggestions`

- Gráfica sugere OS/valores;
- Financeiro confirma;
- audit trail.

### GRF-012 — Dashboard da Gráfica

**P1** — depende `GRF-007`, `GRF-010`
Branch: `feature/graphics-dashboard`

### GRF-013 — Importador histórico

**P1** — depende `GRF-010`, `09-migration-rollout`
Branch: `feature/graphics-spreadsheet-import`

- parser;
- staging;
- inconsistências;
- dry-run;
- relatório.

### GRF-014 — E2E do fluxo completo

**P0 release gate** — depende `GRF-001..013` relevantes
Branch: `test/graphics-critical-flow`

Fluxo E2E: demanda → duas cotações → rejeição → nova aprovação → OS → aprovação cliente → contratação/AP → produção → AR → movimentação → conciliação → entrega/encerramento.

## 19. Critérios globais de aceite

- [ ] Trabalho existe sem OS;
- [ ] fornecedor recusado preserva histórico e retorna sourcing;
- [ ] somente perfil autorizado aprova cotação;
- [ ] OS externa não é gerada pelo ERP;
- [ ] aprovação cliente é separada da interna;
- [ ] AP só nasce quando compromisso for explícito;
- [ ] AR não vira caixa automaticamente;
- [ ] multi-OS/recebimento funciona via Financeiro;
- [ ] RLS cross-org e IDOR cobertos;
- [ ] importação nunca inventa relacionamento.

# 01 — PRD Core ERP

## 1. Objetivo

Corrigir fundamentos transversais do Sistema Interno FG para que todos os módulos usem as mesmas regras de dados, transações, estados, pendências, clientes e dashboard.

Este PRD não substitui os PRDs de Financeiro, Gráfica, Pessoas ou Governança. Ele define contratos compartilhados.

## 2. Problemas atuais a resolver

- módulos realizam sequências multi-write sem transação em alguns fluxos;
- semântica de editar/cancelar/excluir/estornar/reabrir varia entre módulos;
- cliente está excessivamente acoplado à cobrança recorrente;
- alertas atuais misturam candidatos calculados e registros persistidos, sem representar claramente trabalho pendente;
- dashboard é informativo, mas precisa priorizar “o que exige ação”;
- cadastros mestres ainda aparecem como texto livre em vários domínios;
- audit log técnico existe, mas falta timeline humana para alguns fluxos;
- documentação histórica contém comportamentos que não devem ser assumidos como implementados.

## 3. Princípios

1. Não reescrever módulos funcionais sem necessidade.
2. Cada mudança possui migration compatível e teste.
3. Estado de negócio é explícito e validado no servidor.
4. Fatos históricos não são apagados para corrigir estado.
5. `organizationId` é obrigatório em dados de negócio e protegido por DAL + RLS.
6. Toda operação multi-write crítica é atômica.
7. Todos os inputs externos são Zod-validated no servidor.
8. Tasks devem ser pequenas o suficiente para uma branch revisável.

## 4. Clientes

### 4.1 Modelo alvo

Cliente pode existir sem contrato mensal.

Dados mínimos:

- nome/razão social;
- nome fantasia;
- documento quando aplicável;
- status;
- contatos;
- observações;
- billing profile opcional;
- soft delete.

### 4.2 Contatos

Criar `client_contacts` ou estrutura equivalente para permitir múltiplos contatos e papéis:

- financeiro;
- comercial;
- aprovação;
- operacional;
- outro.

### 4.3 Billing profile

Cobrança recorrente fica opcional e não deve impedir criação do cliente.

Perfil pode conter periodicidade, dia, valor padrão e observação, mas não deve criar movimentação de caixa diretamente.

## 5. Pendências

Substituir gradualmente o conceito de alerta genérico por um modelo de trabalho acionável.

Entidade sugerida: `work_items`.

Campos mínimos:

- `id`;
- `organizationId`;
- `kind`;
- `sourceType`;
- `sourceId`;
- `title`;
- `description`;
- `assignedUserId`/`assignedEmployeeId` opcional;
- `dueAt` opcional;
- `priority`;
- `status` (`open`, `in_progress`, `resolved`, `dismissed`);
- `resolution`;
- timestamps.

Regras:

- uma pendência resolvida não pode impedir a geração de uma nova ocorrência futura do mesmo tipo;
- chaves de deduplicação devem considerar ocorrência/ciclo, não apenas entidade+tipo eternamente;
- nenhuma pendência deve ser resolvida apenas porque saiu da tela;
- resolver exige motivo quando a fonte continua inconsistente.

## 6. Dashboard

O dashboard deve ter duas camadas:

1. **Atenção agora**: pendências críticas, vencidos, aprovações, recebimentos não conciliados, acessos a revogar.
2. **Indicadores**: recebíveis, pagáveis, caixa, trabalhos da Gráfica, pessoas e renovações.

Não calcular “lucro” da Gráfica enquanto custos/receitas não estiverem suficientemente conciliados.

## 7. State machines

Toda entidade com fluxo deve possuir lista documentada de transições válidas.

Padrão:

```text
status atual + ação + contexto → novo status
```

A action deve validar transição no servidor, não aceitar `status` arbitrário do form.

Exemplos de ações semânticas:

- `approve...`;
- `reject...`;
- `cancel...`;
- `reopen...`;
- `reverse...`;
- `restore...`.

## 8. Correção e exclusão

- Draft/configuração pode ser editável.
- Fato financeiro liquidado não é apagado: estornar.
- Entidade referenciada pode ser desativada/soft-deleted, não destruída.
- Reabertura registra auditoria e motivo.
- Restore deve revalidar unicidade e dependências.

## 9. Transações

Criar uma convenção única para operações multi-write. Exemplos obrigatórios:

- cliente + billing profile;
- aprovação de NF + criação/vínculo de AP;
- inclusão/exclusão de reembolso em NF;
- substituição de roles;
- liquidação financeira + alocações;
- aprovação/contratação de fornecedor quando gerar AP;
- encerramento de lifecycle com revogação de acesso.

Se qualquer write falhar, o estado anterior deve permanecer íntegro.

## 10. Master data

Cadastros compartilhados a normalizar progressivamente:

- fornecedores;
- categorias financeiras;
- centros de custo;
- contas financeiras;
- métodos de pagamento;
- projetos/eventos;
- ferramentas/plataformas externas;
- categorias SaaS;
- tipos de equipamento;
- áreas/cargos já existentes;
- tipos de serviço/OS quando necessário.

Evitar enums rígidos para catálogos que a operação precisa administrar, exceto estados de domínio.

## 11. Timeline humana

Audit log continua sendo registro técnico. Para domínios com fluxo longo, criar timeline derivada de eventos relevantes:

- criação;
- aprovação/rejeição;
- mudança de etapa;
- anexo importante;
- liquidação/estorno;
- entrega/encerramento.

Comentários/@menções são P2 e não bloqueiam v2.

## 12. Permissões

Core adiciona permissões somente quando necessário. Novas permissões devem seguir `<domain>.<action>` e serem persistidas no modelo de RBAC definido em Pessoas/Segurança.

## 13. Tasks

### CORE-001 — Contrato transacional compartilhado

**Prioridade:** P0
**Dependências:** SEC-001
**Branch:** `feature/core-transaction-contract`

**Objetivo:** criar helper/padrão de transação compatível com o runtime DB escolhido em SEC-001 e documentar uso no código.

**Escopo:**

- helper transacional;
- propagação do contexto RLS dentro da transação;
- testes de commit/rollback;
- nenhuma refatoração em massa ainda.

**Aceite:**

- [ ] uma operação de teste multi-write rollbacka integralmente;
- [ ] contexto de organização permanece ativo durante toda transação;
- [ ] helper é tipado e não permite DAL sem contexto em dados tenant;
- [ ] unit/integration tests verdes.

### CORE-002 — Cliente independente de fee

**Prioridade:** P0
**Dependências:** CORE-001, SEC-003
**Branch:** `feature/clients-optional-billing`

- tornar billing profile opcional;
- manter compatibilidade com clientes existentes;
- garantir criação/edição em transação;
- testes com cliente sem billing e com billing.

### CORE-003 — Contatos de cliente

**Prioridade:** P1
**Dependências:** CORE-002
**Branch:** `feature/client-contacts`

- `client_contacts`;
- CRUD com RLS;
- papéis de contato;
- histórico/auditoria.

### CORE-004 — Pendências v2

**Prioridade:** P0
**Dependências:** CORE-001, SEC-003
**Branch:** `feature/work-items`

- criar `work_items`;
- deduplicação por ocorrência;
- owner, prazo, prioridade e resolução;
- API/DAL para domínios gerarem/resolverem pendências;
- migrar apenas um gerador piloto para provar contrato.

### CORE-005 — Dashboard orientado a ação

**Prioridade:** P1
**Dependências:** CORE-004, FIN-005, GRF-009
**Branch:** `feature/dashboard-action-first`

- seção “Atenção agora”;
- KPIs sem dupla contagem;
- links diretos para entidade fonte.

### CORE-006 — Padrão de estados/correções

**Prioridade:** P1
**Dependências:** CORE-001
**Branch:** `chore/state-transition-contract`

- helpers/regras para validar transitions;
- motivo obrigatório em cancel/reopen/reverse sensíveis;
- aplicar inicialmente em Financeiro e Gráfica, sem refatoração global indiscriminada.

### CORE-007 — Timeline humana compartilhada

**Prioridade:** P2
**Dependências:** CORE-004
**Branch:** `feature/entity-timeline`

- contrato de eventos/timeline;
- começar por Gráfica e Financeiro;
- audit log permanece separado.

## 14. Testes específicos

- criação de cliente sem billing;
- rollback de cliente+profile em falha;
- cross-org em clientes/contatos/work_items;
- payload com `status` injetado não altera state machine;
- work item resolvido permite nova ocorrência futura;
- dashboard não soma provisão e obrigação realizada em duplicidade.

## 15. Fora do escopo

- CRM de oportunidades;
- funil comercial geral da agência;
- chat;
- workflow builder genérico;
- contabilidade completa.

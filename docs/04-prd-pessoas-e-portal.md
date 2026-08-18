# 04 — PRD Pessoas, Acesso e Portal

## 1. Objetivo

Corrigir inconsistências de autorização e lifecycle, tornar férias confiáveis e integrar NF PJ/reembolsos ao Financeiro geral sem duplicidade de estado.

## 2. Acesso ao ERP

### 2.1 Princípio

Autenticação Google valida identidade, não autorização.

### 2.2 Fluxo alvo

```text
Admin pré-autoriza/invita
→ usuário autentica com Google
→ sistema valida convite/domínio
→ vincula organização
→ vincula Employee quando aplicável
→ atribui roles explícitas
→ status active
→ acesso liberado conforme permissões
```

Usuário sem autorização fica `pending`/acesso negado, não recebe role implícita.

### 2.3 Status de acesso

- `pending`;
- `active`;
- `suspended`;
- `revoked`.

`users.isActive` ou substituto precisa participar efetivamente do AccessContext/session gate.

### 2.4 Role source of truth

Eliminar dupla verdade entre policy hardcoded e `role_permissions` da DB.

Defaults podem existir apenas como seed/bootstrap, mas runtime deve resolver permissões persistidas.

### 2.5 Proteções

- sem fallback silencioso `employee`;
- last-admin protection;
- troca de roles em transação;
- audit before/after;
- organização nunca escolhida por “primeira linha alfabeticamente”;
- convite e vínculo devem ser explícitos;
- suspensão/revogação revoga sessões.

## 3. User ↔ Employee

Vínculo explícito quando usuário representa colaborador.

Portal que requer dados de colaborador deve bloquear com estado claro se vínculo estiver ausente; não retornar dados/defaults falsos.

## 4. Lifecycle

Admissão/desligamento precisa coordenar:

- Employee;
- acesso ao ERP;
- equipamentos;
- acessos externos;
- SaaS;
- documentos/pendências.

Desligamento concluído deve revogar acesso/sessões e gerar/verificar pendências de recursos restantes em transação ou workflow consistente.

Não permitir que alteração manual de status do Employee bypass o processo sem permissão/motivo.

## 5. Férias

### 5.1 Problema

Aprovação de solicitação não pode ser apenas status; deve impactar saldo corretamente.

### 5.2 Modelo conceitual

Por período aquisitivo:

- `acquiredDays`;
- `reservedDays`;
- `takenDays`;
- `soldDays`;
- `availableDays` derivado.

Reserva ocorre quando pedido chega a estado que deve bloquear disponibilidade. Aprovação e conclusão movem quantidades conforme regra definida; cancelamento desfaz apenas o que aquele pedido reservou/consumiu.

### 5.3 Regras

- link request ↔ acquisition period;
- sem saldo negativo;
- sem overlap incompatível;
- venda de dias validada contra saldo real;
- cancel/reopen auditados;
- concorrência protegida em transação/locking apropriado.

## 6. NF PJ

NF é workflow documental/approval, não ledger financeiro.

Ao aprovar NF:

- validar divergências;
- gerar/vincular AP em transação;
- guardar relação explícita `invoiceRequest ↔ payable`;
- pagamento deriva do Financeiro;
- NF exibe resumo financeiro, mas não possui fonte paralela de “pago”.

## 7. Reembolsos

Adicionar classificação por:

- cliente;
- Trabalho/OS da Gráfica quando aplicável;
- projeto/evento;
- centro de custo;
- categoria.

Reembolso aprovado para pagamento direto gera AP. Reembolso incluído em NF segue regras claras para não gerar AP duplicada.

Inclusão/exclusão em NF é transacional.

## 8. Portal

Portal mostra somente dados próprios e ações permitidas.

Gate deve validar:

- usuário ativo;
- organização válida;
- Employee vinculado quando rota exigir;
- tipo de vínculo quando funcionalidade for específica;
- RLS/DAL own-scope.

## 9. Tasks — Acesso

### ACC-001 — Pré-autorização/invites

**P0** — depende `SEC-003`, `SEC-005`
Branch: `feature/access-invitations`

- entidade/fluxo de convite;
- domínio permitido;
- expiry/use;
- rate limit;
- audit.

### ACC-002 — Status de usuário e gate real

**P0** — depende `ACC-001`
Branch: `fix/access-user-status-enforcement`

- pending/active/suspended/revoked;
- AccessContext/session respeita status;
- testes de acesso após suspensão.

### ACC-003 — Vínculo User ↔ Employee

**P0** — depende `ACC-002`
Branch: `feature/user-employee-link`

- vínculo explícito;
- portal bloqueia ausência;
- admin resolve vínculo.

### ACC-004 — RBAC DB como fonte de verdade

**P0** — depende `ACC-002`, `CORE-001`
Branch: `fix/rbac-single-source`

- remover fallback role;
- runtime lê `role_permissions` persistidas;
- defaults só seed;
- role replacement transacional;
- last-admin protection;
- audit before/after.

### ACC-005 — Revogação de sessão

**P0** — depende `ACC-002`
Branch: `feature/access-session-revocation`

- suspender/revogar invalida sessões;
- logout/stale cookie tests;
- offboarding chama mesma primitiva.

### ACC-006 — Escopos próprios/equipe

**P1** — depende `ACC-003`, `ACC-004`
Branch: `feature/rbac-scopes-v2`

- próprio/equipe/departamento/assigned/all conforme domínios;
- não duplicar RLS tenant.

## 10. Tasks — Férias

### VAC-001 — Modelo de saldo por período

**P0** — depende `CORE-001`, `SEC-003`
Branch: `fix/vacation-balance-model`

### VAC-002 — Reserva e concorrência

**P0** — depende `VAC-001`
Branch: `fix/vacation-reservation`

### VAC-003 — Aprovação/rejeição/cancelamento

**P0** — depende `VAC-002`, `CORE-006`
Branch: `fix/vacation-transitions`

### VAC-004 — Overlap/venda de dias

**P0** — depende `VAC-002`
Branch: `fix/vacation-validation`

### VAC-005 — Portal e E2E férias

**P0 release gate** — depende `VAC-001..004`
Branch: `test/vacation-critical-flow`

## 11. Tasks — NF

### INV-001 — Relação NF ↔ AP

**P0** — depende `FIN-004`, `CORE-001`
Branch: `feature/invoice-payable-link`

### INV-002 — Aprovação transacional

**P0** — depende `INV-001`
Branch: `fix/invoice-approval-transaction`

### INV-003 — Remover estado financeiro duplicado

**P1** — depende `INV-002`, `FIN-005`
Branch: `chore/invoice-finance-source-of-truth`

### INV-004 — E2E NF→AP→pagamento

**P0 release gate** — depende `INV-001..003`
Branch: `test/invoice-finance-flow`

## 12. Tasks — Reembolso

### REI-001 — Classificação gerencial

**P1** — depende `FIN-002`, `GRF-001` quando vínculo de OS for usado
Branch: `feature/reimbursement-classification`

### REI-002 — Reembolso direto → AP

**P0** — depende `FIN-004`
Branch: `feature/reimbursement-payable`

### REI-003 — Inclusão/exclusão em NF transacional

**P0** — depende `CORE-001`, `INV-001`
Branch: `fix/reimbursement-invoice-atomicity`

### REI-004 — E2E e anti-duplicidade

**P0 release gate** — depende `REI-002..003`
Branch: `test/reimbursement-finance-flow`

## 13. Tasks — Lifecycle/Portal

### LIF-001 — Responsáveis e estados de checklist

**P1** — depende `ACC-003`, `CORE-004`
Branch: `feature/lifecycle-owners`

### LIF-002 — Offboarding integrado a acesso

**P0** — depende `ACC-005`
Branch: `fix/offboarding-access-revocation`

### LIF-003 — Offboarding integrado a recursos

**P1** — depende `EQP-001`, `EXT-002`, `SAA-002`
Branch: `feature/offboarding-resource-checks`

### LIF-004 — Bloquear bypass de termination

**P0** — depende `LIF-002`
Branch: `fix/employee-termination-invariant`

### PORT-001 — Gate sem Employee vinculado

**P0** — depende `ACC-003`
Branch: `fix/portal-employee-gate`

### PORT-002 — Own-scope security suite

**P0** — depende `ACC-006` ou contratos atuais estabilizados
Branch: `test/portal-own-scope`

### PORT-003 — Atualização do manual do portal

**P2** — após fluxos estabilizados.

## 14. Critérios globais

- [ ] login de domínio permitido não concede acesso sem autorização;
- [ ] usuário suspenso não usa sessão antiga;
- [ ] nenhum fallback role silencioso;
- [ ] portal sem vínculo não inventa dados;
- [ ] férias nunca ficam com saldo incoerente;
- [ ] NF/reembolso usam Financeiro como fonte de pagamento;
- [ ] offboarding revoga acesso real;
- [ ] RLS e own/team scopes têm testes negativos.

# 08 — Codex Execution Plan

## 1. Papel deste arquivo

Este é o **roteador humano de implementação**. PRDs dizem o que o produto deve fazer; este arquivo define ordem e dependências.

Para execução automatizada, `docs/codex/tasks.json` é a representação machine-readable deste plano. No modo orquestrado, `feature/codex-integration` funciona como branch-base temporária e recebe as branches de task. Isso **não altera** o workflow de release: `development` continua sendo a branch oficial de integração e só recebe a candidata após review humano.

Agentes em feature branches não devem marcar a própria task como `done`.

## 2. Estados

- `blocked`
- `ready`
- `in_review`
- `done`
- `deferred`
- `cancelled`

## 3. Regras de seleção

Uma task está `ready` somente quando:

1. todas dependências estão disponíveis na branch-base da execução: `development` em sessões manuais ou `feature/codex-integration` no modo orquestrado;
2. nenhuma branch paralela possui conflito de write scope conhecido;
3. requisitos não possuem decisão aberta bloqueante;
4. baseline de testes está verde ou falha preexistente está documentada.

## 4. Wave 0 — adoção da documentação

| ID | Task | Status | Branch |
|---|---|---|---|
| DOCS-001 | Aplicar pacote v2, arquivar docs antigas e atualizar AGENTS | `ready` | `chore/docs-v2` |

### DOCS-001 — Adotar documentação v2

**Escopo:** seguir `APPLY-DOCS.md`, substituir `AGENTS.md`, adicionar documentos novos, mover os arquivos legados indicados para `docs/archive/`, preservar `git-workflow.md`, `implementation-log.md` e runbooks.

**Validação:** `git diff --check`, `npm run typecheck`, `npm run lint`, `npm run test`.

**Aceite:** documentação v2 está em `development`, links internos resolvem, nenhum documento histórico foi apagado e `AGENTS.md` aponta para a nova fonte de verdade.

Após merge de DOCS-001 em `development`, iniciar código.

## 5. Wave 1 — fundação de segurança e acesso

Ordem majoritariamente serial.

| Ordem | ID | Documento | Dependências | Branch | Status inicial |
|---:|---|---|---|---|---|
| 1 | SEC-001 | 06 | DOCS-001 | `feature/security-db-runtime` | blocked |
| 2 | SEC-002 | 06 | SEC-001 | `feature/security-tenant-db-context` | blocked |
| 3 | SEC-003 | 06 | SEC-002 | `feature/security-rls-baseline` | blocked |
| 4 | SEC-004 | 06 | SEC-003 | `test/security-rls-cross-tenant` | blocked |
| 5 | SEC-005 | 06 | SEC-002 | `feature/security-rate-limit` | blocked |
| 6 | SEC-006 | 06 | SEC-005 | `feature/security-rate-limit-critical-actions` | blocked |
| 7 | CORE-001 | 01 | SEC-001/SEC-002 | `feature/core-transaction-contract` | blocked |
| 8 | ACC-001 | 04 | SEC-003/SEC-005 | `feature/access-invitations` | blocked |
| 9 | ACC-002 | 04 | ACC-001 | `fix/access-user-status-enforcement` | blocked |
| 10 | ACC-003 | 04 | ACC-002 | `feature/user-employee-link` | blocked |
| 11 | ACC-004 | 04 | ACC-002/CORE-001 | `fix/rbac-single-source` | blocked |
| 12 | ACC-005 | 04 | ACC-002 | `feature/access-session-revocation` | blocked |
| 13 | SEC-007 | 06 | ACC-004 | `fix/security-input-validation-audit` | blocked |

**Gate Wave 1:** RLS cross-tenant verde, acesso sem invite bloqueado, sessão revogada testada, RBAC fonte única.

## 6. Wave 2 — Core e Financeiro base

| Ordem | ID | Dependências |
|---:|---|---|
| 1 | CORE-002 | CORE-001, SEC-003 |
| 2 | CORE-004 | CORE-001, SEC-003 |
| 3 | FIN-001 | CORE-001, SEC-003 |
| 4 | FIN-002 | FIN-001 |
| 5 | FIN-003 | FIN-002 |
| 6 | FIN-004 | FIN-003 |
| 7 | FIN-005 | FIN-004, CORE-004 |
| 8 | CORE-006 | CORE-001 |
| 9 | FIN-006 | FIN-005, CORE-006 |

CORE-002 e CORE-004 podem ser paralelos se write scopes não se cruzarem. FIN-001..006 são predominantemente seriais.

**Gate Wave 2:** AR/AP semanticamente corretos, caixa separado, parcial/many-to-many, conciliação e estorno funcionando.

## 7. Wave 3 — Gráfica operacional

| Ordem | ID | Dependências |
|---:|---|---|
| 1 | GRF-001 | SEC-003, CORE-001, FIN-002 |
| 2 | GRF-002 | GRF-001 |
| 3 | GRF-003 | GRF-001, FIN-002 |
| 4 | GRF-004 | GRF-003, ACC-004 |
| 5 | DOC-001 | SEC-003 |
| 6 | DOC-002 | DOC-001, CORE-001 |
| 7 | GRF-005 | GRF-004, DOC-002 |
| 8 | GRF-006 | GRF-005 |
| 9 | GRF-007 | GRF-006, CORE-004 |
| 10 | GRF-008 | GRF-006, FIN-004 |
| 11 | GRF-009 | GRF-006, FIN-004 |
| 12 | GRF-010 | GRF-008, GRF-009, FIN-005 |

Paralelismo seguro típico após GRF-006: GRF-007, GRF-008 e GRF-009 podem rodar em branches distintas se contratos estiverem congelados.

**Gate Wave 3:** fluxo real fornecedor→aprovação→OS→cliente→produção + AR/AP integrado.

## 8. Wave 4 — Gráfica/Financeiro acabamento e importação

- GRF-011 — sugestões de conciliação;
- GRF-012 — dashboard;
- GRF-013 — importador histórico;
- GRF-014 — E2E;
- FIN-007 — provisões v2;
- FIN-008 — anexos;
- FIN-009 — relatórios;
- FIN-010 — cutover legado;
- CORE-005 — dashboard geral quando métricas novas estiverem estáveis.

## 9. Wave 5 — Pessoas crítica

Ordem recomendada:

1. VAC-001
2. VAC-002
3. VAC-003 e VAC-004 (paralelo após VAC-002, se scopes distintos)
4. VAC-005
5. INV-001
6. INV-002
7. REI-002
8. REI-003
9. INV-003
10. INV-004 / REI-004
11. LIF-001
12. LIF-002
13. LIF-004
14. PORT-001
15. ACC-006 / PORT-002
16. REI-001 quando vínculos gerenciais estiverem prontos.

## 10. Wave 6 — Governança

- EQP-001
- EXT-001
- SAA-001
- EQP-003
- EXT-002
- SAA-002
- SAA-003
- LIF-003
- EXT-003
- DOC-004
- itens P2 depois dos gates principais.

## 11. Wave 7 — UX e histórico

- CORE-003 contatos de cliente;
- CORE-007 timeline;
- dashboards/relatórios P1;
- manual do usuário v2;
- ajustes de copy/navegação.

## 12. Wave 8 — hardening e release

Tasks operacionais:

### OPS-001 — Migration from zero + upgrade drill

Branch: `test/migration-drill-v2`

### OPS-002 — Backup/restore drill real

Branch: `chore/backup-restore-drill-v2`

### OPS-003 — Staging E2E por não-dev

Pode ser registro operacional; code branch só se correção necessária.

### OPS-004 — Release candidate

Branch: `chore/release-v2-hardening`

Executar:

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
npm run test:e2e
```

Além de RLS audit, migration audit, restore drill e smoke staging.

## 13. Ordem inicial recomendada, sem atalhos

```text
DOCS-001
SEC-001
SEC-002
SEC-003
SEC-004
SEC-005
SEC-006
CORE-001
ACC-001
ACC-002
ACC-003
ACC-004
ACC-005
SEC-007
CORE-002
CORE-004
FIN-001
FIN-002
FIN-003
FIN-004
FIN-005
CORE-006
FIN-006
GRF-001...
```

## 14. Night Queue

O integrador preenche esta seção antes de iniciar automação noturna.

**Regra manual:** somente tasks cujas dependências já estejam integradas na branch-base escolhida. No modo orquestrado, use `docs/codex/tasks.json` e `scripts/codex-orchestrator.ps1` em vez desta fila textual.

```text
# Exemplo — NÃO executar automaticamente
# SEC-004
# SEC-005
```

O modo legado `codex-night.ps1` não faz merge. O novo orquestrador é diferente: cada task nasce da candidata atual e, depois de gates + review automático, é mergeada **somente** em `feature/codex-integration`. Nunca há merge automático em `development` ou `main`.

## 15. Handoff padrão ao Codex

Prompt mínimo recomendado:

```text
Execute a task <ID> seguindo AGENTS.md.
Leia docs/08-codex-execution-plan.md, o PRD indicado pela task,
docs/06-security-and-rls.md, docs/07-test-strategy.md e docs/git-workflow.md.
Não implemente tasks futuras. Em sessão manual, use a branch indicada a partir de development.
Quando chamado pelo orquestrador, a branch já foi criada a partir de `feature/codex-integration`; o agente não deve executar Git de escrita.
Implemente, teste e pare. O wrapper executará gates finais, commit, review e integração na candidata. Nunca faça merge em development/main.
```

## 16. Atualização de status

No fluxo manual tradicional:

- branch concluída antes do merge → `in_review`;
- merge + testes verdes em `development` → `done`.

No fluxo orquestrado:

- o estado real é inferido por `docs/codex/tasks.json` + histórico Git;
- branch de task contida em `feature/codex-integration` satisfaz dependências para a próxima task da mesma candidata;
- isso não significa `done` de release;
- somente após review humano e eventual merge da candidata em `development` o lote é aceito oficialmente.

Nunca usar uma branch de task não integrada na branch-base ativa para desbloquear dependentes.

# 09 — Migrations, backfill, rollout e rollback

## 1. Objetivo

Evoluir o schema existente sem reescrita, sem apagar histórico e com caminho de rollback operacional.

## 2. Princípio expand → migrate → contract

Sempre que possível:

1. **Expand:** adicionar tabelas/colunas/constraints permissivas.
2. **Migrate:** backfill e dual-read/dual-write temporário quando necessário.
3. **Validate:** invariantes, contagens e comportamento.
4. **Contract:** remover caminho legado somente em task posterior.

Evitar rename/drop destrutivo na mesma release que introduz o substituto.

## 3. Drizzle

- schema em `src/lib/db/schema.ts`;
- `npm run db:generate` gera migration;
- `npm run db:migrate` aplica;
- drizzle config usa `DATABASE_DIRECT_URL` quando disponível;
- migrations existentes não devem ser reescritas.

## 4. Sequência linear

Branches paralelas podem gerar migration com mesmo número. Antes do merge:

1. rebase/merge latest `development`;
2. verificar `drizzle/`;
3. regenerar migration se houver colisão;
4. rodar fresh DB migration.

## 5. RLS rollout

RLS deve entrar em fases:

### Fase A

- runtime transaction/session-capable;
- app DB role;
- `withTenantDb`;
- testes do contexto.

### Fase B

- policies em lote controlado;
- FORCE RLS;
- testes cross-org;
- logs/observabilidade de failures.

### Fase C

- proibir imports diretos do DB irrestrito em features tenant;
- meta-test de cobertura de policies.

Não ativar RLS em todas as tabelas de uma vez sem primeiro provar o runtime context.

## 6. Financeiro migration

### AR/AP

Preservar IDs existentes quando possível. Novos campos/status devem ser derivados/backfilled.

### Transactions

Não inventar movimentações históricas a partir de `receivedDate/paidDate` sem decisão clara. Se for necessário materializar histórico:

- marcar origem `legacy_backfill`;
- manter referência ao registro original;
- gerar relatório de contagem/valores;
- permitir comparação antes de considerar cutover.

### Master data

Campos texto existentes podem permanecer como snapshot enquanto novos FKs são adicionados. Backfill pode sugerir matches, mas valores ambíguos ficam sem FK até revisão.

## 7. Gráfica import

Nunca importar diretamente da planilha para tabelas finais sem dry-run.

Etapas:

1. checksum/identificação do arquivo;
2. parse por aba/linha;
3. staging rows com raw data;
4. validação;
5. classificação `clear|ambiguous|invalid`;
6. commit dos claros;
7. work items para ambíguos;
8. relatório final com totais.

Campos de proveniência:

- arquivo;
- sheet;
- row;
- importedAt;
- importBatchId.

## 8. Constraints

Adicionar constraints fortes somente após backfill estar limpo quando tabelas já possuem legado.

Exemplo: FK nullable primeiro → backfill → validação → NOT NULL em release posterior se regra for realmente obrigatória.

## 9. Rollback

Rollback de código deve funcionar enquanto schema expandido existir.

Evitar down migration automática destrutiva em produção. Em incidente:

- reverter deploy;
- manter colunas/tabelas novas;
- interromper novos writes se necessário;
- restaurar backup somente quando integridade exigir.

## 10. Backups

Antes de migration de alto risco:

- backup DB;
- checksum;
- confirmar restore procedure;
- considerar branch/snapshot Neon;
- arquivos R2 tratados separadamente.

Seguir `docs/runbooks/backup-restore.md`.

## 11. Validation report

Toda migration relevante deve registrar:

- row counts antes/depois;
- null counts de campos críticos;
- somatório financeiro antes/depois quando aplicável;
- órfãos;
- policies RLS criadas;
- duração;
- resultado de smoke test.

## 12. Cutover

Feature antiga só é removida quando:

- nova leitura está estável;
- nova escrita está estável;
- backfill validado;
- E2E passa;
- usuário operacional consegue executar fluxo;
- rollback foi pensado.

## 13. Testes de rollout

- fresh DB;
- upgrade baseline;
- migration idempotence onde houver script separado;
- aplicação antiga contra schema expandido quando necessário;
- aplicação nova antes/depois do backfill;
- RLS app role;
- backup/restore.

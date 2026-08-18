# 06 — Segurança, RLS, validação e rate limiting

## 1. Status

A aplicação atual já possui RBAC/DAL, Zod, audit log, Better Auth, proteção de uploads e testes de segurança. Entretanto, o baseline auditado não possui policies PostgreSQL RLS nas migrations. A v2 torna RLS obrigatório para dados de negócio multi-tenant.

## 2. Modelo de defesa em profundidade

Cada acesso a dado de negócio passa por camadas independentes:

```text
Identidade (Better Auth)
→ status de acesso do usuário
→ AccessContext
→ RBAC/scope
→ validação Zod
→ DAL com organizationId
→ transaction tenant-aware
→ PostgreSQL RLS
→ audit log
```

Nenhuma camada deve ser removida por existir outra.

## 3. Autenticação e autorização

- OAuth autentica identidade.
- Domínio permitido é requisito de identidade, não role.
- Acesso de negócio exige autorização/invite e status `active`.
- Sessões de usuário suspenso/revogado precisam ser invalidadas.
- Portal own-scope depende de `User ↔ Employee` explícito.

## 4. Fonte de verdade RBAC

Runtime deve resolver roles/permissões da DB. `defaultRolePermissions` pode permanecer como seed/bootstrap, mas não como mapa paralelo que diverge do que a UI administra.

Role replacement deve ocorrer em transação e registrar before/after.

## 5. RLS — arquitetura

### 5.1 Objetivo

Se um bug omitir `organizationId` em um DAL, Postgres ainda deve impedir leitura/escrita de outra organização.

### 5.2 Credenciais separadas

Produção deve usar:

- `DATABASE_URL`: credencial **runtime/app**, explicitamente `NOBYPASSRLS`, sem superuser e nunca proprietária das tabelas;
- `DATABASE_DIRECT_URL`: credencial controlada de migration/admin, com `BYPASSRLS` para migrations e seed após `FORCE ROW LEVEL SECURITY`; `SUPERUSER` só é aceitável quando o provedor não permite uma role dedicada.

`DATABASE_DIRECT_URL` nunca deve ser usada no runtime web.

### 5.3 Runtime transacional

O baseline usa `drizzle-orm/neon-http` em produção e `node-postgres` localmente. O contexto RLS proposto usa configuração local por transação; portanto SEC-001 deve padronizar um runtime que garanta conexão/transação consistente para `SET LOCAL`/`set_config(..., true)`.

Recomendação para este projeto: usar `node-postgres`/Pool também contra a URL pooled do Neon no runtime, ou outro driver Drizzle com transações interativas/session semantics comprovadas. Não ligar RLS antes de testes provarem o comportamento nos dois ambientes.

### 5.4 Contexto tenant

Dentro de **cada transação de negócio**:

```sql
select set_config('app.organization_id', '<uuid>', true);
select set_config('app.user_id', '<uuid>', true);
```

O terceiro argumento `true` torna o valor local à transação.

Policy tenant exemplo conceitual:

```sql
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients FORCE ROW LEVEL SECURITY;

CREATE POLICY clients_tenant_policy ON clients
FOR ALL
USING (
  organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
)
WITH CHECK (
  organization_id = nullif(current_setting('app.organization_id', true), '')::uuid
);
```

Se contexto estiver ausente, a policy deve resultar em deny, nunca “ver tudo”.

### 5.5 Tabelas cobertas

O baseline da SEC-003 classifica todas as tabelas existentes. A fonte de verdade
executável da matriz é **src/lib/db/rls-policy-matrix.ts**:

- policy tenant direta: access_records, alerts, app_settings, areas, audit_logs,
  client_billing_profiles, client_payment_reminders, clients, compensation_history,
  documents, employee_benefits, employees, equipment, files, financial_entries,
  financial_expenses, invoice_requests, lifecycle_checklists, positions, provisions,
  reimbursement_requests, saas_subscriptions, time_off_requests e vacation_balances;
- policy tenant herdada do pai: invoice_request_items via invoice_requests,
  lifecycle_checklist_items via lifecycle_checklists e saas_subscription_users via
  saas_subscriptions;
- exceções explícitas: user, account, session e verification são bootstrap do Better
  Auth; organizations é consultada durante o bootstrap da organização; roles,
  permissions, role_permissions e user_roles formam o catálogo e o bootstrap RBAC
  usados para construir o AccessContext.

Todas as tabelas de negócio da matriz usam **ENABLE ROW LEVEL SECURITY**, **FORCE ROW
LEVEL SECURITY** e policy **FOR ALL** com **USING** e **WITH CHECK**. Uma tabela pública
nova deve ser adicionada à matriz como protegida ou como exceção justificada; o teste
de integração falha quando existe uma tabela sem classificação.

Regra: toda tabela de negócio com `organizationId` entra na matriz RLS, incluindo novas tabelas de Financeiro, Gráfica, Pessoas/Governança, documentos, audit e work items.

### 5.6 Tabelas de bootstrap/auth

Não aplicar policy tenant genérica às tabelas que Better Auth precisa consultar antes de haver AccessContext sem primeiro desenhar o fluxo. Classificar explicitamente:

- auth/bootstrap: `user`, `account`, `session`, `verification` e equivalentes;
- catálogos globais realmente globais, se houver;
- business tenant tables.

`organizations` e RBAC exigem policy específica/administrativa, não copiar policy de tabela comum cegamente.

### 5.7 Owner e FORCE RLS

Postgres normalmente permite ao table owner ignorar RLS. Por isso:

- runtime app role não deve ser owner;
- usar `FORCE ROW LEVEL SECURITY` nas business tables quando compatível;
- testes devem verificar o usuário runtime real, não apenas usuário admin local.

### 5.8 Seed e migrations

Migrations/seed administrativo usam a credencial direta controlada com `BYPASSRLS`
(preferencial) ou `SUPERUSER` apenas quando inevitável. O seed valida esse contrato antes
de escrever, porque `FORCE ROW LEVEL SECURITY` nega writes administrativos sem bypass.
A role runtime é `NOBYPASSRLS`, não é table owner e nunca substitui essa credencial.
Seed de dados de demo nunca deve rodar em prod.

### 5.9 Teste de bypass

Para cada grupo de tabelas:

1. criar org A e org B;
2. definir contexto A;
3. tentar buscar ID conhecido de B diretamente no DB/DAL;
4. esperar zero rows/erro;
5. tentar insert/update com `organizationId=B` enquanto contexto=A;
6. esperar rejeição de `WITH CHECK`;
7. executar sem contexto;
8. esperar deny.

## 6. DAL tenant-aware

Criar primitiva `withTenantDb(context, callback)` ou equivalente.

Features de negócio não devem importar um `db` irrestrito para queries tenant após rollout. Exceções (auth/migrations/health checks) ficam em módulo explicitamente nomeado e revisado.

## 7. Validação de input

### Regras

- Zod no servidor para toda Action/API.
- `.strict()` ou transformação explícita quando mass assignment for risco.
- IDs UUID/CUID conforme formato real.
- dinheiro: parse seguro e bounds.
- datas: ISO/Date coerente, limites plausíveis quando apropriado.
- strings: trim, min/max.
- enums: whitelist.
- uploads: MIME + extensão + assinatura/checksum + size.
- arrays: tamanho máximo.
- filtros/export: limites de range e paginação.

Nunca usar `formData` diretamente em `.values()`.

Status, `organizationId`, `employeeId`, `approvedBy`, valores derivados e owner não vêm confiavelmente do cliente.

## 8. Rate limiting

### 8.1 Princípio

Rate limit precisa funcionar em múltiplas instâncias serverless; contador em memória não é proteção de produção.

### 8.2 Implementação inicial recomendada

Para evitar nova dependência paga, criar limitador persistente no Postgres com operação atômica.

Tabela interna sugerida:

```text
rate_limit_buckets
- key_hash
- action
- window_start
- count
- expires_at
```

Chave deve ser hash de composição adequada, sem guardar IP puro desnecessariamente:

- user + org + action para autenticados;
- IP hash + action para pré-auth, quando necessário.

Usar UPSERT atômico. Limpeza pode ser lazy + job periódico.

Se volume crescer, substituir backend por Redis/edge sem mudar contrato da aplicação.

### 8.3 Limites iniciais configuráveis

Não hardcode espalhado. Centralizar config/env. Defaults sugeridos para começar, sujeitos a ajuste em staging:

| Ação | Default |
|---|---:|
| convite/reenvio | 10 / 10 min / admin |
| upload | 20 / 10 min / usuário |
| export | 5 / 5 min / usuário |
| conciliação/estorno | 30 / 5 min / usuário |
| mutação comum | 120 / min / usuário |
| importação Gráfica | 3 / hora / usuário |

Login continua usando proteção do Better Auth e pode receber proteção edge adicional.

### 8.4 Resposta

- retornar erro consistente;
- não revelar detalhes sensíveis;
- registrar evento de segurança agregado quando limite for atingido repetidamente;
- não transformar rate limit em audit spam por request.

## 9. IDOR e scope

Todo `id` recebido deve ser buscado junto com contexto org/scope. Nunca:

```text
findById(id) → depois checar organizationId
```

Preferir query já filtrada/policy. Para own/team, RBAC/DAL aplica predicado adicional.

## 10. CSRF, SQLi e XSS

- manter Server Actions/route protections do framework;
- Drizzle parametrizado; raw SQL somente com bindings;
- React escaping padrão; evitar `dangerouslySetInnerHTML` com conteúdo de usuário;
- URLs/redirects passam por allowlist quando externos;
- qualquer raw HTML futuro exige sanitização específica.

## 11. Uploads

- bucket privado;
- storage key gerado pelo servidor;
- nunca confiar em filename como path;
- limite de tamanho;
- MIME/extensão;
- checksum;
- autorização no download;
- RLS no metadata document/file quando aplicável;
- signed URL curta se adotada;
- orphan cleanup seguro.

## 12. Auditoria

Audit obrigatório em:

- mudanças financeiras;
- aprovação/rejeição;
- roles/permissões;
- convite/suspensão/revogação;
- download de documento sensível;
- estorno;
- import/backfill administrativo;
- lifecycle crítico.

Não registrar segredo, token, senha, cookie ou conteúdo sensível integral desnecessário.

## 13. Secrets e headers

- nenhum segredo versionado;
- prod/staging com secrets separados;
- cookies Secure/HttpOnly/SameSite conforme auth;
- HTTPS obrigatório em produção;
- logs não imprimem URLs com credenciais;
- `DATABASE_DIRECT_URL` nunca exposta ao client bundle.

## 14. Tasks de segurança

### SEC-001 — Runtime DB transacional para RLS

**P0 — PRIMEIRA TASK DE CÓDIGO**
Branch: `feature/security-db-runtime`

- auditar driver atual;
- padronizar conexão runtime com suporte comprovado a transaction-local context;
- manter `DATABASE_DIRECT_URL` para drizzle-kit;
- adicionar integration test de `set_config(..., true)` isolado por transaction;
- sem habilitar policies ainda.

### SEC-002 — App DB role e tenant context helper

**P0** — depende `SEC-001`
Branch: `feature/security-tenant-db-context`

- contrato de runtime role;
- `withTenantDb`;
- deny sem AccessContext;
- docs/env/runbooks atualizados.

### SEC-003 — Policies RLS baseline

**P0** — depende `SEC-002`
Branch: `feature/security-rls-baseline`

- inventário de tabelas;
- migrations ENABLE/FORCE/POLICY;
- exceções auth explicitadas;
- nenhuma policy parcial silenciosa.

### SEC-004 — RLS security suite

**P0** — depende `SEC-003`
Branch: `test/security-rls-cross-tenant`

- select/insert/update/delete cross-org;
- sem contexto;
- app role real;
- owner/bypass validation;
- documentos/finance/pessoas como amostra crítica.

### SEC-005 — Rate limit foundation

**P0** — depende `SEC-002`
Branch: `feature/security-rate-limit`

- backend Postgres atômico;
- config central;
- helper para Actions/routes;
- testes de janela/concorrência;
- limpeza.

### SEC-006 — Aplicar limites aos fluxos críticos

**P0** — depende `SEC-005`
Branch: `feature/security-rate-limit-critical-actions`

- convites;
- upload;
- export;
- conciliação/estorno;
- importação;
- testes 429/erro equivalente.

### SEC-007 — Audit de validação/mass-assignment

**P0** — depende contratos estabilizados
Branch: `fix/security-input-validation-audit`

- varrer Actions/APIs;
- garantir Zod + fields server-owned;
- testes de payload tampering;
- sem refactor cosmético fora do escopo.

## 15. Gate de segurança para release

- [ ] runtime usa app DB role sem BYPASSRLS;
- [ ] RLS ativa/forçada nas tabelas listadas;
- [ ] `pg_policies` inventariado em teste;
- [ ] queries cross-org falham mesmo com ID conhecido;
- [ ] ausência de tenant context é deny;
- [ ] roles/permissões runtime têm fonte única;
- [ ] rate limiting distribuído nos fluxos críticos;
- [ ] uploads/exports testados;
- [ ] security suite verde;
- [ ] staging usa credenciais distintas de migration/runtime.

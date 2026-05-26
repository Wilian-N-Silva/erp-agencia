# AGENTS.md — Sistema Interno FG

Canonical agent briefing for this repo. `CLAUDE.md`, `codex.md` and `.cursorrules` are duplicates ignored by git — keep this file as the source of truth.

## 1. Product

Internal operations system for an agency. Replaces scattered spreadsheets / WhatsApp / Drive with one secure central tool for:

- Daily financial control (entradas, saídas, provisões, recorrências)
- Clientes e cobranças recorrentes
- Colaboradores (CLT, PJ, freelancer, sócio) com vínculos, histórico, compensação
- Portal do PJ para composição mensal + upload de NF
- Reembolsos (request → manager → finance approval → optional NF inclusion)
- Férias e ausências (com saldo CLT por colaborador)
- Documentos sensíveis com upload seguro
- Equipamentos / patrimônio
- Acessos a plataformas e contas de clientes
- Assinaturas SaaS / licenças / renovações
- Alertas operacionais (vencimentos, aniversários, renovações, acessos críticos)
- Auditoria completa de toda mutação

Authoritative spec: `docs/PRD-Sistema-Interno-FG-v1.md`. Launch state: `docs/launch-checklist-v1.md` (v1.0 status against PRD §14 — read this first when picking up work).

Non-goals for v1.0 are listed in PRD §3 (folha de pagamento, emissão automática de NF, integrações Asaas / contabilidade / Workspace, etc.).

## 2. Stack

- **Framework:** Next.js 15 (App Router, `force-dynamic` on private layouts)
- **Language:** TypeScript strict
- **UI:** React 19 + Tailwind + custom design system in `src/components/fg/*` + `src/styles/design-system.css` (ported from `public/design-prototype/`)
- **Auth:** Better Auth + `@better-auth/drizzle-adapter` (Google OAuth + optional email/password)
- **DB:** PostgreSQL 17 (Neon Serverless in prod, Docker Postgres locally)
- **ORM / migrations:** Drizzle ORM + drizzle-kit (`drizzle/*.sql`)
- **Storage:** Cloudflare R2 in prod (S3-compatible); local FS fallback
- **Validation:** Zod 4
- **Forms:** react-hook-form + `@hookform/resolvers`
- **Tests:** Vitest (unit/integration) + Playwright (E2E)
- **Excel export:** exceljs
- **Deploy target:** Vercel (`https://app.formulagroup.com.br`)

Key versions in `package.json` — update them there, not here.

## 3. Directory layout

```
src/
  app/
    (private)/             # Authenticated back-office + portal
      app/                 # Back-office (admin, finance, RH, TI)
        acessos/ admissoes/ alertas/ assinaturas/ auditoria/
        clientes/ colaboradores/ configuracoes/ desligamentos/
        documentos/ equipamentos/ ferias/ financeiro/ nfs/ reembolsos/
      portal/              # PJ/CLT self-service portal
      layout.tsx           # gates back-office via canAccessBackoffice()
    (portal)/              # Portal route group
    login/ acesso-negado/ api/
    layout.tsx page.tsx globals.css
  components/
    fg/                    # Custom design-system primitives (atoms, dropdown,
                           # command palette, shell-chrome, toast, etc.)
    layout/                # AppShell, PortalShell
    auth/                  # Google + email/password sign-in
    ui/                    # action-dialog, generic UI
  features/                # Business logic per domain
    accesses/ alerts/ audit/ clients/ documents/ equipment/
    finance/ lifecycle/ people/ portal/ saas/ settings/ timeoff/
      ↳ each has: actions.ts (server actions) + dal.ts (queries)
                  + rules.ts (RBAC + invariants) + sometimes export.ts
  lib/
    audit/                 # writeAuditLog, sanitize, request metadata
    auth/                  # config, session, client, server adapter
    dal/                   # access-context (org scope + permissions)
    db/                    # drizzle client + schema + seed
    rbac/                  # permissions, roles, policy, guards, errors
    storage.ts env.ts utils.ts
  middleware.ts            # auth gate for /app + /portal
  styles/design-system.css
  tests/                   # Vitest specs (140 tests across 17 files)
drizzle/                   # Migrations 0000 → 0007 (linear, verified clean)
docs/                      # PRD, runbooks, launch checklist, status
  runbooks/
    backup-restore.md
    staging-setup.md
    production-setup.md
scripts/                   # backup.{ps1,sh}, restore.{ps1,sh}
public/design-prototype/   # Source of truth for visual design
.codesight/                # Auto-generated AI context map (regenerate with
                           #   `npx codesight --wiki`); ignored in git
```

## 4. RBAC model

Role and permission keys live in `src/lib/rbac/permissions.ts` and `policy.ts`.

- **Roles** are stored in DB (`roles`) and mapped to permission sets via `role_permissions`. Defaults in `defaultRolePermissions` (policy.ts).
- **Permissions** follow `<domain>.<action>` (e.g. `people.read`, `finance.write`, `documents.read_own`).
- **Access context** (`src/lib/dal/context.ts`) bundles `userId`, `organizationId`, `permissions`, `employeeId` (if linked). Built once per request via `getCurrentAccessContext`.
- **Server-side enforcement only.** Every mutation goes through `assertCan(...)` / `assertCanAny(...)` in `src/lib/rbac/guards.ts`. Every DAL function takes the context and scopes queries by `organizationId`. The UI never decides authorization.
- **Portal-only users** are routed away from back-office by `canAccessBackoffice(permissions)` in `policy.ts` — see `src/app/(private)/layout.tsx`.
- **Audit:** every server action calls `writeAuditLog` with before/after snapshots; sensitivity-aware redaction via `src/lib/audit/sanitize.ts`.

## 5. Database

35 models across 8 logical groups: identity (organizations, user, account, session, verification), RBAC (roles, permissions, role_permissions, user_roles), audit (audit_logs), org structure (areas, positions, employees, compensation_history, employee_benefits), commercial (clients, client_billing_profiles, financial_entries, client_payment_reminders), financial (financial_expenses, provisions), files (files, documents, invoice_requests, invoice_request_items, reimbursement_requests), operational (time_off_requests, equipment, access_records, saas_subscriptions, saas_subscription_users, lifecycle_checklists, lifecycle_checklist_items, alerts, app_settings).

Full schema with fields and FKs: `.codesight/schema.md`.

**Multi-tenancy:** every business model carries `organizationId`. Single-tenant in v1.0 but the column and scoping are non-negotiable.

**Migrations:** linear, generated by drizzle-kit, applied with `npm run db:migrate`. Verified clean on a fresh Postgres 17 DB up to `0007`.

**Docker local gotcha:** in a clean Postgres container, migrations can fail silently if the `public` schema is missing. Create it before running migrations. (See memory `docker_postgres_public_schema.md`.)

## 6. Environment variables

Source of truth: `.env.example` (local) and `.env.production.example` (prod template, all values blank, committed for ops to copy into Vercel).

**Required (no defaults):**
`DATABASE_URL`, `DATABASE_DIRECT_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `ALLOWED_EMAIL_DOMAIN`, `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_PASSWORD`, `STORAGE_PROVIDER`, `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_ACCOUNT_ID`, `STORAGE_ENDPOINT`.

**Optional / with defaults:** `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, `NEXT_PUBLIC_BETTER_AUTH_URL`, `APP_URL`, `ENABLE_EMAIL_PASSWORD_AUTH`, `ENABLE_EMAIL_PASSWORD_SIGN_UP`, `LOCAL_UPLOAD_DIR`, `UPLOAD_MAX_BYTES`, `SEED_DEMO_DATA`, `DEMO_USER_PASSWORD`, `NODE_ENV`.

**Test-only:** `TEST_REQUIRED_ENV`, `TEST_OPTIONAL_ENV`, `E2E_BASE_URL`.

In production, `src/lib/auth/config.ts` warns if `BETTER_AUTH_URL` is not HTTPS or points at localhost. Demo seeding requires `SEED_DEMO_DATA=true` AND `DEMO_USER_PASSWORD` — there is no fallback.

## 7. Commands

```bash
npm run dev          # next dev (port 3000)
npm run build        # next build
npm run start        # next start (prod)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint .
npm run test         # vitest run (140 tests)
npm run test:watch
npm run test:e2e     # playwright

npm run db:generate  # drizzle-kit generate
npm run db:migrate   # apply migrations
npm run db:studio    # drizzle-kit studio
npm run db:seed      # roles + permissions + admin (+ demo if gated)
```

Backup / restore scripts: `scripts/backup.{ps1,sh}` and `scripts/restore.{ps1,sh}`. Runbook: `docs/runbooks/backup-restore.md`.

## 8. High-impact files (change carefully)

These are the most-imported files in the graph. Edits propagate.

- `src/lib/audit/types.ts` (4 importers)
- `src/lib/rbac/permissions.ts` (3 importers)
- `src/lib/audit/sanitize.ts` (2 importers)
- `src/lib/rbac/errors.ts` (2 importers)
- `src/lib/rbac/policy.ts` (2 importers) — `defaultRolePermissions`, `canAccessBackoffice`
- `src/lib/audit/{guards,logger,request}.ts`
- `src/lib/dal/context.ts`
- `src/lib/db/schema.ts`

## 9. Conventions

- **Server actions** in `src/features/*/actions.ts`. Each action: parse with Zod → assert permission → call DAL → `writeAuditLog` → `revalidatePath`. Never trust client-provided IDs without re-validating ownership/scope.
- **DAL** in `src/features/*/dal.ts`. Every function takes `context: AccessContext` and filters by `context.organizationId`. Apply scope helpers from the same feature's `rules.ts`.
- **Rules** in `src/features/*/rules.ts`. Pure functions: permission checks, scope derivations, business invariants (e.g. `calculateBusinessDays`, `hasInvoiceDivergence`).
- **Design system:** primitives in `src/components/fg/`. Visual source of truth is `public/design-prototype/`. Match it before inventing.
- **No client-side authorization.** UI may hide things, but always re-check on the server.
- **Comments:** prefer none. Explain *why* only when non-obvious.
- **Tests live in `src/tests/`** as `*.test.ts` / `*.test.tsx` (vitest config in `vitest.config.ts` — needs `esbuild.jsx: "automatic"` for the .tsx ones).

## 10. Git workflow

- `main` = released. `development` = integration. Feature branches: `feature/<slug>`.
- Migrations must be linear with `main` — regenerate if a parallel branch took a number.
- Don't push to `main`; merge `development` → `main` only at release tags.
- See memory `git_workflow_pragmatic.md` for pragmatic deviations the user has accepted.

## 11. Deploy readiness (v1.0)

State authoritative: `docs/launch-checklist-v1.md`. PRD §14 has 20 criteria; 19 done.

- **Remaining:** §14.13 backup drill execution (scripts + runbook ready, just needs an actual restore drill), §14.14 staging (runbook landed at `docs/runbooks/staging-setup.md`, depends on infra access).
- **Production provisioning runbook:** `docs/runbooks/production-setup.md`. DNS / OAuth / Neon / R2 / Vercel steps. Mirrors staging-setup.
- **Production env template:** `.env.production.example` (all values blank, fill in Vercel dashboard).
- **PRD §22 open product decisions** block configuration, not features. Lock them before tagging.

## 12. Where to find things fast

- "Where do permission checks live?" → `src/lib/rbac/` + each feature's `rules.ts`
- "Where is the audit trail written?" → `writeAuditLog` from `src/lib/audit/logger.ts`, called inside every action
- "How is the user's org scope derived?" → `getCurrentAccessContext` in `src/lib/dal/context.ts`
- "Where do routes live?" → `src/app/(private)/app/<domain>/`; portal under `src/app/(private)/portal/`
- "Schema reference" → `.codesight/schema.md` (auto-generated) or `src/lib/db/schema.ts` (source)
- "Full AI context map" → `.codesight/CODESIGHT.md` (regenerate with `npx codesight --wiki`)
- "Project status / next steps" → `docs/launch-checklist-v1.md` and `docs/project-status.md`
- "User-facing manual" → `docs/user-manual.md`

Always read the actual source file before implementing. `.codesight/*` is navigation, not specification.

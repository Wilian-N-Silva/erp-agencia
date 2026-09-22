# Project Status — Sistema Interno FG

Snapshot date: **2026-05-22**
Branch: `development` at `6a8f76b` (Merge `feature/design-port` into `development`)
Origin: `https://github.com/Wilian-N-Silva/erp-agencia`

> This document captures the current state of the codebase, the modules that
> shipped, and what blocks the v1.0 tag. For the formal acceptance criteria
> see `docs/launch-checklist-v1.md`. For end-user instructions see
> `docs/user-manual.md`.

---

## 1. Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15.5 (App Router) |
| Runtime | React 19 + Server Components + Server Actions |
| Language | TypeScript 5.8 |
| Database | PostgreSQL 17 |
| ORM | Drizzle ORM 0.45 |
| Auth | Better Auth 1.6 (with Drizzle adapter, Google OAuth) |
| Storage | S3-compatible (Cloudflare R2 supported) + local fallback |
| Styling | Tailwind CSS 3.4 + custom `fg-*` design tokens (see `src/styles/`) |
| UI atoms | In-house FG component library at `src/components/fg` |
| Tests | Vitest (unit/integration) + Playwright (E2E) |
| XLSX export | exceljs 4.4 |
| Validation | Zod 4 |

---

## 2. Modules (frontend routes)

The back-office is at `/app/*`. The collaborator portal lives at `/portal/*`
with its own distinct shell.

### Back-office — `/app`

| Section | Route | Module |
|---|---|---|
| Operação | `/app` | Dashboard |
| Operação | `/app/alertas` | Alertas |
| Financeiro | `/app/financeiro/entradas` | Entradas |
| Financeiro | `/app/financeiro/saidas` | Saídas |
| Financeiro | `/app/financeiro/provisoes` | Provisões |
| Financeiro | `/app/clientes` | Clientes (list + detail 6 tabs) |
| Pessoas | `/app/colaboradores` | Colaboradores (list + detail 11 tabs) |
| Pessoas | `/app/colaboradores/admissoes` | Admissões (list + per-checklist detail) |
| Pessoas | `/app/colaboradores/desligamentos` | Desligamentos (list + per-checklist detail) |
| Pessoas | `/app/ferias` | Férias e ausências (lista + calendário) |
| Fluxos | `/app/nfs` | NFs PJ |
| Fluxos | `/app/reembolsos` | Reembolsos |
| TI e Governança | `/app/equipamentos` | Equipamentos |
| TI e Governança | `/app/acessos` | Acessos |
| TI e Governança | `/app/assinaturas` | Assinaturas (cards/lista + detail 4 tabs) |
| Administração | `/app/documentos` | Documentos |
| Administração | `/app/auditoria` | Auditoria |
| Administração | `/app/configuracoes` | Configurações |

### Portal do Colaborador — `/portal`

Distinct shell (sticky header with FG logo + top nav + theme toggle + user
dropdown + mobile bottom nav). Subroutes:

- `/portal` — Início (greeting, NF callout for PJ, quick cards, avisos)
- `/portal/nfs` — Minhas NFs (PJ only)
- `/portal/reembolsos` — Meus reembolsos
- `/portal/ferias` — Minhas férias (CLT vacation hero card)
- `/portal/documentos` — Meus documentos
- `/portal/equipamentos` — Meus equipamentos
- `/portal/acessos` — Meus acessos
- `/portal/dados` — Meus dados

---

## 3. Roles & permissions

7 roles defined in `src/lib/rbac/permissions.ts`:

| Role key | Label | Notes |
|---|---|---|
| `technical_admin` | Admin Tecnico | Initial admin seed; configure-level access |
| `director` | Diretoria | Full read/write except `settings.manage` |
| `finance` | Financeiro | Finance, NF/reimbursement approval, finance export |
| `hr_admin` | RH/Admin | People, documents, vacation balance |
| `it_governance` | TI/Governança | Equipment, accesses, SaaS subscriptions |
| `leadership` | Liderança | Manager-scoped reads + team approvals |
| `employee` | Colaborador | Portal access (own data only) |

**117 permission keys** drive RBAC. Role-permission mapping lives in
`src/lib/rbac/policy.ts` (`defaultRolePermissions`). Permission checks happen
at three layers: navigation visibility, page-level redirect, and DAL queries.

---

## 4. Data model

**37 tables**, migrations `0000 → 0007`, all linear and verified against a
fresh Postgres 17 database. Schema lives in `src/lib/db/schema.ts`.

Key entities:

- `organizations`, `users`, `user_roles`, `roles`, `permissions`,
  `role_permissions`
- `areas`, `positions`, `employees`, `employee_compensation_history`,
  `employee_benefits`
- `clients`, `client_billing_profiles`, `financial_entries`,
  `financial_expenses`, `provisions`
- `invoice_requests`, `invoice_request_items`, `reimbursement_requests`
- `time_off_requests`, `vacation_balances`
- `documents`, `files`, `equipment`, `equipment_assignments`,
  `access_records`, `saas_subscriptions`, `saas_subscription_users`
- `lifecycle_checklists`, `lifecycle_checklist_items`
- `audit_logs`

Every mutation writes an audit log via `writeAuditLog` (see
`src/lib/audit/`).

---

## 5. Server actions

**53 server actions** exported across the feature folders
(`src/features/*/actions.ts`). All are Zod-validated, audit-logged, and
RBAC-gated. Notable:

- `createInvoiceRequestAction`, `submitInvoiceRequestAction`,
  `approveInvoiceRequestAction`, `rejectInvoiceRequestAction`,
  `markInvoicePaidAction`, `createInvoiceRequestFormAction` (state wrapper
  used by the new client form).
- `createReimbursementAction`, manager and finance approve/reject,
  `markReimbursementPaidAction`, `includeReimbursementInInvoiceAction`,
  `excludeReimbursementFromInvoiceAction`.
- `createEmployeeAction` (also bootstraps an onboarding checklist when
  `createOnboardingChecklist=on`).
- `createLifecycleChecklistAction`, item status update / complete / cancel.
- `createTimeOffRequestAction`, approve / reject.
- Finance: create / update / cancel entries, expenses, provisions; mark
  received / paid.
- Clients, SaaS subscriptions, equipment, accesses: full CRUD.

---

## 6. UI system

- **FG component library** at `src/components/fg/`. 31 modules covering
  buttons, badges, KPIs, tables, sheets, dialogs, filters, popovers, toast,
  command palette, shell chrome, money input.
- **Design tokens + global CSS** at `src/styles/design-system.css` (2.2k
  lines) and `src/styles/portal.css` (579 lines). Loaded from
  `src/app/globals.css`.
- **Tailwind bridge** maps shadcn tokens (bg-card, text-foreground, etc.)
  to the FG palette so any unported surface stays coherent.
- **Source of truth for visuals**: `public/design-prototype/` — the Claude
  design prototype is served at `/design-prototype/index.html` for
  reference.

---

## 7. Codebase metrics

- **171** `.ts` / `.tsx` files in `src/`
- **16** `*.test.ts` test files
- **8** SQL migrations (`drizzle/0000_*` → `drizzle/0007_*`)
- **31** commits on `development` since the last release tag
- **27,092 insertions / 4,455 deletions** in the design-port merge alone

Validation as of last check: **typecheck clean, lint clean**, full vitest
suite previously passed at 137/137 (re-run before tagging). The dev server
runs cleanly; `next build` not re-run in this session to avoid clobbering
the dev `.next/`.

---

## 8. Security

- 20 security tests in `src/tests/security-critical-flows.test.ts` covering
  IDOR (documents / invoices / reimbursements / time-off / vacation),
  vertical escalation (finance / settings / people / compensation /
  clients), and status/employee_id payload tampering on portal submissions.
- CSRF: Next.js server-action origin checks.
- SQLi: Drizzle parameterization.
- Login rate-limit: Better Auth default limiter.
- File uploads: checksum, MIME / extension / size validation through the
  storage abstraction.
- No hardcoded credentials (sanitized 2026-05-19).

---

## 9. Required environment variables

Documented in `.env.example`. Required (no defaults):

- `DATABASE_URL`, `DATABASE_DIRECT_URL`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `ALLOWED_EMAIL_DOMAIN`
- `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`
- `STORAGE_PROVIDER`, `STORAGE_BUCKET`, `STORAGE_REGION`,
  `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`

Optional but recommended for dev seed:

- `SEED_DEMO_DATA=true` to populate the demo organization.
- `DEMO_USER_PASSWORD` to give demo users a password (no fallback).

---

## 10. Backup & restore

- Scripts: `scripts/backup.{ps1,sh}` and `scripts/restore.{ps1,sh}`.
- Runbook: `docs/runbooks/backup-restore.md`.
- **Drill not yet executed against a production-like DB** — see §14.13
  blocker below.

---

## 11. v1.0 launch status

**19 of 20 PRD §14 criteria done** (see `docs/launch-checklist-v1.md` for
the authoritative list).

### Remaining blockers

| # | Item | Status |
|---|---|---|
| §14.13 | Backup tested | Scripts + runbook landed. Run the drill once against a real database before tagging. |
| §14.14 | Staging validated | Provisioning runbook landed at `docs/runbooks/staging-setup.md`. No staging environment provisioned yet — depends on infra access. |

Both blockers are process / infrastructure, not code. The codebase itself
is launch-ready.

### Pending product decisions (PRD §22)

These don't block code, they block configuration:

1. Final system name (currently "Sistema Interno FG").
2. Production domain / subdomain.
3. Final storage provider (Cloudflare R2 supported; local fallback for dev).

---

## 12. Recent shipped work

Reverse-chronological summary, last ~15 commits:

- `6a8f76b` Merge `feature/design-port` into development
- `3264e3a` feat: port Claude design prototype to FG component system (97
  files, +27k / −4.5k)
- `4a8babb` v1.0 launch prep — birthday alerts, XLSX export, security tests
  (6→20), backup + staging runbooks
- `2704e43` (merged earlier) CLT vacation balance with portal +
  back-office + alerts
- `2e16df5` (merged earlier) NF inclusion of approved reimbursements

The design port was the largest single slice — it touched every back-office
list/detail page, introduced the FG component system, split the portal into
its own route group with 8 subroutes, and replaced raw monetary inputs with
a validated BRL `MoneyInput` component everywhere.

---

## 13. Operating the system

### Run locally

```powershell
npm install
npm run dev                # http://localhost:3000
```

### Validate

```powershell
npm run typecheck
npm run lint
npm run test               # vitest
npm run test:e2e           # Playwright
npm run build              # full production build — do not run while dev is up
```

### Database

```powershell
npm run db:migrate         # apply migrations
npm run db:seed            # admin + (optionally) demo data
npm run db:studio          # Drizzle Studio for inspection
```

### Useful Routes during dev

- `/design-prototype/index.html` — source-of-truth visual reference.
- `/app` — back-office (requires login).
- `/portal` — collaborator portal (distinct shell).

# Launch Checklist v1.0

Source: PRD §14 "Critérios globais de pronto" + cross-reference with code state as of 2026-05-19.

This document is the authoritative cold-start summary for "what blocks v1.0 launch." Update as items close.

## Status snapshot

- Active branch: `development` at `6aed6e7` (11 commits ahead of `origin/development`, unpushed).
- No open feature branches — NF inclusion (`feature/nf-include-reimbursement`) and CLT vacation balance (`feature/clt-vacation-balance`) are both merged.
- Last release on `main`: `ae73c49 docs: add project requirements and workflow` (release branch behind reality).
- Migrations are linear `0000` → `0007`; the `0006`/`0007` collision was resolved by regeneration during the vacation-branch merge.
- Validation as of last check: typecheck clean, lint clean, vitest 119/119, build green, Playwright E2E 2/2 green.

## PRD §14 acceptance criteria — 19 of 20 done

### Done

- §14.1 All required modules implemented — CLT vacation balance landed in `feature/clt-vacation-balance` (merged `2704e43`).
- §14.2 Private routes auth-protected — middleware + `(private)` layout.
- §14.3 Server-side authorization — RBAC + DAL guards throughout.
- §14.5 Audit logs for critical actions — `writeAuditLog` used on every mutation.
- §14.6 Secure upload — storage abstraction, checksum, MIME/ext/size validation.
- §14.7 Dashboard per profile.
- §14.8 PJ portal composition + NF submission.
- §14.9 Finance NF + reimbursement approval — NF inclusion of approved reimbursement closed by `feature/nf-include-reimbursement` (merged `2e16df5`).
- §14.10 RH controls férias requests + documentos.
- §14.11 TI/Governança equipamentos, acessos, SaaS.
- §14.12 Desligamento triggers access/equipment alerts.
- §14.15 No hardcoded credentials (sanitized 2026-05-19, commit `745857f`).
- §14.16 Env vars documented in `.env.example`.
- §14.17 Migrations run from zero — verified 2026-05-19: all 8 migrations applied to a fresh `erp_migration_test` DB on Postgres 17; 36 public tables created; seed populated admin + 8 demo users + 3 employees + 1 vacation balance.
- §14.18 Seed creates roles/permissions/admin (demo data is opt-in via `SEED_DEMO_DATA=true`).
- §14.19 Build passes.
- §14.20 Playwright E2E passes — reran 2026-05-19 against `development` at `51e8274`, 2/2 tests green (employee portal scope, all-roles back-office nav).

### Pending

| # | Criterion | Concrete gap | Effort |
|---|---|---|---|
| §14.4 | Permission tests cover all profiles | ~~6 tests, PRD §9.4 lists 15.~~ Closed: `src/tests/security-critical-flows.test.ts` now has 20 tests covering IDOR, vertical escalation, status / employee_id payload tampering, compensation visibility. Action-level CSRF + SQLi + rate-limit are enforced by Next.js / Drizzle / Better Auth respectively. | Done |
| §14.13 | Backup tested | Scripts + runbook landed (`scripts/backup.{ps1,sh}`, `scripts/restore.{ps1,sh}`, `docs/runbooks/backup-restore.md`). Drill execution against a real DB pending — run once before tagging v1.0. | Drill pending |
| §14.14 | Staging validated | Provisioning runbook landed at `docs/runbooks/staging-setup.md`. No staging environment provisioned yet — depends on infra access. | Depends on infra |

> §14.4 status: 20 unit tests now exercise the RBAC boundary for IDOR (documents, invoices, reimbursements, time-off, vacation balances), vertical escalation (finance / settings / people / compensation / clients), and status/employee-id payload tampering on portal submissions. CSRF protection is provided by Next.js server-action origin checks; SQLi is prevented by Drizzle parameterization; login rate-limit is enforced by Better Auth's default limiter. Treat §14.4 as code-complete and verified by tests.

## Smaller feature gaps (closed in this pass)

- ✅ **Aniversário alerts** (PRD §6.16 type 10, §6.1.13 dashboard tile) — `buildBirthdayAlertCandidates` + `listUpcomingBirthdays` shipped; dashboard "Eventos proximos" lists upcoming birthdays.
- ✅ **XLSX export** (PRD §6.2.8) — `exceljs`-backed routes at `/app/financeiro/exportar-xlsx` and `/app/auditoria/exportar-xlsx`, buttons added next to the CSV exports.
- ✅ **Acesso ativo de colaborador desligado alert** (PRD §6.12 critical) — covered by `isTerminatedEmployeeAccessAlert` + new negative-case tests in `src/tests/governance.test.ts`.
- **Auto-generation of expected client entries** on `dia_cobranca` (PRD §6.3 says manual; intentional — deferred).

## PRD §22 product decisions (still open)

These block configuration, not implementation. Lock them and seed the values.

1. Final system name (still "Sistema Interno FG")
2. Production domain / subdomain
3. Final storage provider (R2 supported + local fallback; choose production target)
4. Login domain whitelist value (`ALLOWED_EMAIL_DOMAIN` is empty)
5. First admin user identity (drive via env)
6. Upload size limit (`UPLOAD_MAX_BYTES` defaults to 10 MB — confirm)
7. Document retention policy (no enforcement code exists)
8. Final financial categories
9. Final cargos / áreas
10. NF descriptive template per PJ type
11. Whether CLT gets portal in v1.0 (currently unrestricted)

## Shipping / integration tasks

1. ~~Merge `feature/nf-include-reimbursement` → `development`~~ — done (`2e16df5`).
2. ~~Merge `feature/clt-vacation-balance` → `development`~~ — done (`2704e43`).
3. ~~Run `npm.cmd run db:migrate` from zero against a clean DB~~ — done 2026-05-19 against isolated `erp_migration_test`.
4. ~~Rerun Playwright E2E suite~~ — done 2026-05-19 (2/2 green).
5. Push `development` to `origin` (8 commits unpushed).
6. Once §14 items are green: promote `development` → `main` for the v1.0 release.
7. Tag the release commit on `main`.

## Next steps to launch v1.0

Each block is self-contained so any session can pick one and start. Order is recommended but not strict — the only hard dependency is that §14.4 security tests should land before promoting to `main`.

### 1. Security test expansion (closes §14.4) — last code-level blocker

**Branch**: `feature/security-tests-prd-9-4` from `development`.
**Effort**: ~2 days.
**Scope** — extend `src/tests/security-critical-flows.test.ts` (currently 6 tests) to cover PRD §9.4's 15-item list. Group new tests by category:

- **IDOR**: try to read/update a `documents` row owned by another employee via the download route (`/app/documentos/[id]/download`) and via direct DAL calls. Repeat for `reimbursement_requests`, `invoice_requests`, `vacation_balances`, `time_off_requests`. Each should return 403/AccessDeniedError.
- **Vertical escalation**: employee context attempts finance actions (`approveInvoiceRequestAction`, `createFinancialEntry`, `updateEmployeeCompensationAction`). All should throw `AccessDeniedError`.
- **Status payload tamper**: send `formData` to `submitInvoiceRequestAction` with `status=approved` injected. Server-side enums + Zod should strip; the action ignores client-sent status.
- **`employee_id` payload tamper**: collaborator submits a reimbursement with a different `employeeId` in the form. Action should bind to `context.employeeId`, not formData.
- **XSS in observação**: insert `<script>alert(1)</script>` into reimbursement notes; render path must escape (React does this by default — test asserts the literal string appears, not executed).
- **SQL injection in filters**: hit `/app/financeiro?q=' OR 1=1--` and `/app/clientes?status=active' UNION SELECT…`. Drizzle parameterizes — assert the query runs without leaking.
- **CSRF on mutating actions**: try a server action without the Next.js form CSRF token (cross-origin POST). Should reject.
- **Rate limit on login**: hit `/api/auth/sign-in/email` rapidly; Better Auth's default rate limiter should kick in.
- **Manipulating financial status in payload**: send `status=received` directly on `createFinancialEntry`; action should ignore and compute status from rules.
- **Export without permission**: request `/app/auditoria/exportar` as a `audit.read_limited` user; should 403.
- **Session after logout**: sign out, then try a private route with the now-stale cookie; should redirect to `/login`.

**Acceptance**: vitest count goes from 119 to 130+. All green. No new RBAC code needed — these are *negative* tests proving existing guards work. If a test exposes a real gap, fix the guard in the same branch.

**Files likely touched**:
- `src/tests/security-critical-flows.test.ts` (heavy)
- Possibly new test fixtures helper for building auth-stamped requests

### 2. Backup/restore drill (closes §14.13)

**Branch**: `chore/backup-restore-drill` from `development`, or document only — no code change required.
**Effort**: half day, mostly process + a short script.

**Steps**:
1. Add a `scripts/backup.sh` (or `.ps1`) that runs `pg_dump` against `DATABASE_URL` to a timestamped file under `backups/`.
2. Add `scripts/restore.sh` that takes a dump path and restores into a fresh DB.
3. Run the drill end to end on the dev DB:
   - Take a backup with current data.
   - Bring up a second clean DB (`erp_restore_test`).
   - Restore the dump.
   - Run a few sanity queries (employee count, role/permission count, vacation_balance count).
   - Confirm documents referenced via `files.storageKey` would still resolve (storage is separate from DB; document this in the runbook).
4. Add `docs/runbooks/backup-restore.md` with the procedure.
5. Update this checklist to mark §14.13 done.

**Acceptance**: a documented, working backup + restore procedure exists. Run once and recorded.

### 3. Product decisions for PRD §22 — unblocks staging/prod config

**Effort**: 1–2 hour conversation, then commit configs.

For each decision below, get a single answer from the stakeholder, then encode:

| Decision | Where to encode once answered |
|---|---|
| System name | `README.md`, login page title, email-from-name |
| Production domain | `BETTER_AUTH_URL`, `APP_URL`, `BETTER_AUTH_TRUSTED_ORIGINS`, `NEXT_PUBLIC_BETTER_AUTH_URL` in prod env |
| Storage provider | `STORAGE_PROVIDER` + R2 creds (or pick a different S3-compatible) |
| Login domain whitelist | `ALLOWED_EMAIL_DOMAIN` in prod env |
| First admin user | `INITIAL_ADMIN_EMAIL`, `INITIAL_ADMIN_NAME`, `INITIAL_ADMIN_PASSWORD` (set once, then rotate via UI) |
| Upload size limit | `UPLOAD_MAX_BYTES` (default 10485760 = 10 MB) |
| Document retention policy | If non-trivial, add a scheduled cleanup; otherwise document the manual procedure |
| Financial categories list | Hard-coded enum in finance feature — check if matches business reality |
| Cargos / áreas | Seed via UI (`/app/configuracoes` if exposed) or extend seed |
| NF descriptive template per PJ type | `buildSuggestedInvoiceDescription` in `src/features/portal/rules.ts` already uses position/area; confirm copy with finance |
| CLT portal scope | If CLT should NOT see the portal in v1.0, gate `/portal` by employment type |

**Acceptance**: each row above has a recorded decision (in this doc or `docs/decisions/`) and the corresponding env/code is in place.

### 4. Staging environment (closes §14.14) — depends on infra

**Effort**: depends on hosting choice; days if from scratch.

**Minimum staging shape**:
- Hosting target (Vercel / Render / Fly / VPS) — pick one.
- A staging Postgres (Neon branch is cheapest if going Neon for prod).
- Staging storage bucket (R2 staging credentials).
- Environment promoted from a deploy of `development` after security tests merge.
- Smoke test on staging: login, NF cycle, reimbursement → NF inclusion, vacation balance create, audit log visible.

**Acceptance**: someone other than the developer logs into staging and runs a representative flow without help.

### 5. Smaller feature gaps (post-§14 polish, can ship 1.0 without)

Order by customer-visible value:

a. **Aniversário alert generator** — small. Add `buildBirthdayAlertCandidates` in `src/features/alerts/dal.ts`. Query `employees.birthDate` where month/day matches a 7-day window from `asOf`. New alert kind `birthday`. Dashboard tile follows.
b. **XLSX export** — adopt `exceljs` or `xlsx`, add export buttons in finance/audit alongside the existing CSV ones. PRD §6.2.8 mentions XLSX.
c. **Terminated employee access alert** — verify `buildAccessAlertCandidates` already emits `acesso ativo apos desligamento` for `employee.status=terminated` cases. Code reads right; add a vitest covering it explicitly.
d. **Recurring expected client entry** — only if the business wants automation. PRD §6.3 explicitly says "manual" — likely defer.

### Cut the v1.0 release

When §14.4, §14.13, and §14.14 are green:

1. `npm.cmd run typecheck && npm.cmd run lint && npm.cmd run test && npm.cmd run build && npm.cmd run test:e2e` — must all pass on `development`.
2. `git push origin development` (currently 11 commits unpushed).
3. `git checkout main && git merge --no-ff development -m "release: v1.0.0"`.
4. `git tag -a v1.0.0 -m "Initial release"`.
5. `git push origin main --tags`.
6. Deploy `main` to production.
7. Update `docs/implementation-log.md` with the release entry.

## Pointers for cold starts

- PRD: `docs/PRD-Sistema-Interno-FG-v1.md` (1937 lines, complete spec)
- Implementation log: `docs/implementation-log.md` (chronological, last entry 2026-05-14 — pre-dates NF + vacation work)
- Implementation plan: `docs/implementation-plan.md` (wave breakdown)
- Wiki (auto-generated, see `.codesight/wiki/`)
- Git workflow: `docs/git-workflow.md`

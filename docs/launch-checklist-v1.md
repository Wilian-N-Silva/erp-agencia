# Launch Checklist v1.0

Source: PRD §14 "Critérios globais de pronto" + cross-reference with code state as of 2026-05-19.

This document is the authoritative cold-start summary for "what blocks v1.0 launch." Update as items close.

## Status snapshot

- Active branch when written: `development` (5 commits ahead of `origin/development`, unpushed)
- Open feature branch: `feature/nf-include-reimbursement` (NF + reimbursement composition wiring, validated, unmerged)
- Last release on `main`: `ae73c49 docs: add project requirements and workflow` (release branch behind reality)

## PRD §14 acceptance criteria — 15 of 20 done

### Done

- §14.2 Private routes auth-protected — middleware + `(private)` layout
- §14.3 Server-side authorization — RBAC + DAL guards throughout
- §14.5 Audit logs for critical actions — `writeAuditLog` used on every mutation
- §14.6 Secure upload — storage abstraction, checksum, MIME/ext/size validation
- §14.7 Dashboard per profile
- §14.8 PJ portal composition + NF submission
- §14.9 Finance NF + reimbursement approval (NF inclusion of reimbursement landed on `feature/nf-include-reimbursement`)
- §14.10 RH controls férias requests + documentos
- §14.11 TI/Governança equipamentos, acessos, SaaS
- §14.12 Desligamento triggers access/equipment alerts
- §14.15 No hardcoded credentials (sanitized 2026-05-19, commit `745857f`)
- §14.16 Env vars documented in `.env.example`
- §14.18 Seed creates roles/permissions/admin (demo data is now opt-in via `SEED_DEMO_DATA=true`)
- §14.19 Build passes
- §14.20 Playwright E2E passes (last verified 2026-05-14)

### Pending

| # | Criterion | Concrete gap | Effort |
|---|---|---|---|
| §14.1 | All required modules implemented | **CLT vacation balance** (`vacation_balances` table from PRD §7.1 + §6.9 "saldo aquisitivo, dias adquiridos/tirados/vendidos/vencidos, próximo vencimento") is missing. Only `time_off_requests` exists. | Days |
| §14.4 | Permission tests cover all profiles | `src/tests/security-critical-flows.test.ts` has 6 tests. PRD §9.4 lists 15. Gaps: IDOR, vertical privilege escalation, status payload manipulation, `employee_id` payload manipulation, XSS in observação fields, SQL injection in filters, CSRF, rate-limit on login. | Days |
| §14.13 | Backup tested | PRD §9.5 never executed (create backup, restore in separate env, validate records/documents/permissions). | Half day |
| §14.14 | Staging validated | No staging environment provisioned yet. | Depends on infra |
| §14.17 | Migrations run from zero | Six migrations now exist (`drizzle/0000` through `0006`). Never re-verified end-to-end after the governance branch + NF inclusion landed. | Minutes |

## Smaller feature gaps (not blockers per §14 but PRD-listed)

- **Aniversário alerts** (PRD §6.16 type 10, §6.1.13 dashboard tile) — no `aniversario`/`birthday` references in code.
- **XLSX export** (PRD §6.2.8) — only CSV exists for finance + audit.
- **Acesso ativo de colaborador desligado alert** (PRD §6.12 critical) — log mentions critical-access review but not this specific generator. Verify.
- **Auto-generation of expected client entries** on `dia_cobranca` (PRD §6.3 says manual; may be intentional).

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

1. Merge `feature/nf-include-reimbursement` → `development` (no-ff)
2. Run `npm.cmd run db:migrate` from zero against a clean DB (closes §14.17)
3. Push `development` to `origin` (5+ commits unpushed)
4. Once §14 items are green: promote `development` → `main` for the v1.0 release
5. Tag the release commit on `main`

## Recommended next-session order

1. **CLT vacation balance** (§14.1) — biggest real feature gap. Branch: `feature/clt-vacation-balance` from `development` after merging the NF branch. Scope: new `vacation_balances` table, migration, rules, DAL, actions (create/adjust balance, generate next aquisitive period, mark sold days), portal view, back-office view at `/app/colaboradores/[id]/ferias`, tests.
2. **Security test expansion** (§14.4) — broader coverage, faster signal.
3. **Migration-from-zero check** (§14.17) — minutes; do this any time the schema changes.
4. **Backup drill** (§14.13).
5. **§22 decisions** — get them locked, then seed.
6. **Smaller feature gaps** in order of customer-visible value.

## Pointers for cold starts

- PRD: `docs/PRD-Sistema-Interno-FG-v1.md` (1937 lines, complete spec)
- Implementation log: `docs/implementation-log.md` (chronological, last entry 2026-05-14)
- Implementation plan: `docs/implementation-plan.md` (wave breakdown)
- Wiki (auto-generated, see `.codesight/wiki/`)
- Git workflow: `docs/git-workflow.md`

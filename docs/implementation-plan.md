# Implementation Plan

Source: `docs/PRD-Sistema-Interno-FG-v1.md`  
Git workflow: `docs/git-workflow.md`  
Created: 2026-05-12

This plan breaks the PRD into branch-sized work packages that can be assigned to subagents. Each branch must be created from `development` and merged back into `development` after review and validation. `main` remains release-only.

## Current State

- Active branch: `chore/project-foundation`.
- Initial docs commit exists on `main`: `ae73c49 docs: add project requirements and workflow`.
- `development` was created from `main`.
- The app scaffold is currently validated but uncommitted on `chore/project-foundation`.
- The Better Auth / Drizzle / Zod dependency conflicts were resolved.
- `package-lock.json` was generated with a clean install.
- Initial Drizzle migration was generated in `drizzle/`.
- The migration was applied successfully to a disposable Docker Postgres 17 container.
- `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test`, and `npm.cmd run build` pass.

## Branch Rules For Subagents

1. One subagent owns one branch and one bounded task.
2. Every branch starts from the latest `development`.
3. Subagents must not revert edits made by others.
4. Each task has an explicit write scope. Avoid editing outside that scope unless the integrator approves it.
5. Branches that touch shared contracts must merge before dependent module branches start.
6. Every branch must update tests or add focused tests for changed behavior.
7. Every branch must update docs only when behavior, setup, or workflow changes.

## Execution Waves

### Wave 0 | Foundation

This wave is mostly serial. Finish it before spawning domain-module subagents.

| Branch | Subagent | Dependencies | Primary Write Scope | Deliverables | Validation |
| --- | --- | --- | --- | --- | --- |
| `chore/project-foundation` | Foundation worker | None | `package.json`, `package-lock.json`, config files, `src/lib/env.ts`, `src/lib/db/**`, docs | Resolve dependency conflict, install deps, complete base Next.js/TypeScript/Tailwind/Vitest/Drizzle setup, ensure schema compiles, add seed scaffold, generate initial migration if feasible | `npm.cmd install`, `npm.cmd run typecheck`, `npm.cmd run lint`, `npm.cmd run test` |

Exit criteria:

- Dependencies install without peer conflicts.
- TypeScript compiles.
- Base schema is usable by Drizzle.
- `development` receives the foundation merge before any feature branch starts.

### Wave 1 | Security And App Shell

These branches can be parallelized after foundation is merged, but the integrator should merge them in the listed order because later work depends on shared security contracts.

| Branch | Subagent | Dependencies | Primary Write Scope | Deliverables | Validation |
| --- | --- | --- | --- | --- | --- |
| `feature/auth-better-auth` | Auth worker | Foundation | `src/lib/auth/**`, `src/app/api/auth/**`, `src/middleware.ts`, auth routes, env docs | Better Auth config, Google OAuth/OIDC, domain allowlist, session helper, protected-route middleware, login/logout flow | Typecheck, auth unit tests, protected-route tests |
| `feature/rbac-dal` | RBAC/DAL worker | Foundation, auth session contract | `src/lib/rbac/**`, `src/lib/dal/**`, authorization tests | Permission constants, role resolution, server-side guards, DAL patterns for scoped reads/writes, forbidden-access errors | Unit tests for role permissions, DAL scope tests |
| `feature/audit-logging` | Audit worker | Foundation, RBAC contract | `src/lib/audit/**`, audit DAL/actions, audit tests | Audit logger for create/update/delete/export/sensitive-read events, request metadata capture, audit query helpers | Unit tests for audit payloads and required audit events |
| `feature/app-shell-navigation` | Shell worker | Auth, RBAC contract | `src/app/(private)/**`, `src/app/acesso-negado/**`, `src/components/layout/**`, `src/components/ui/**` | Private layout, navigation by permission, executive dashboard shell, access-denied page, loading/empty states | Typecheck, route rendering tests, permission-hidden nav tests |

Merge order:

1. `feature/auth-better-auth`
2. `feature/rbac-dal`
3. `feature/audit-logging`
4. `feature/app-shell-navigation`

### Wave 2 | Core Business Modules

Start these after Wave 1 is merged. `finance-clients` and `people-compensation` can run in parallel. The other branches depend on people records.

| Branch | Subagent | Dependencies | Primary Write Scope | Deliverables | Validation |
| --- | --- | --- | --- | --- | --- |
| `feature/finance-clients` | Finance/Clients worker | Wave 1 | `src/features/finance/**`, `src/features/clients/**`, finance/client routes | Clients CRUD, entries, expenses, provisions, automatic overdue status, finance dashboard data, audit events | Unit tests for status rules, DAL authorization tests, page smoke tests |
| `feature/people-compensation` | People worker | Wave 1 | `src/features/people/**`, collaborator routes, compensation routes | Areas, positions, collaborators, employment status, compensation history, benefits, sensitive-field guards | Unit tests for status and compensation rules, authorization tests |
| `feature/portal-invoices-reimbursements` | Portal/NF/Reimbursement worker | People branch, Wave 1 | `src/features/portal/**`, `src/features/invoices/**`, `src/features/reimbursements/**`, portal routes | Collaborator portal, PJ invoice composition, NF upload metadata flow, reimbursement request/approval/payment flow | Tests for own-data access, NF composition, reimbursement approvals |
| `feature/timeoff-documents-storage` | Timeoff/Documents worker | People branch, Wave 1 | `src/features/timeoff/**`, `src/features/documents/**`, storage abstraction, related routes | CLT vacation rules, PJ/freelancer absence requests, document metadata, upload validation, sensitive document access logs | Tests for vacation rules, upload validation, document authorization |
| `feature/governance-assets-access-saas` | Governance worker | People branch, Wave 1 | `src/features/equipment/**`, `src/features/accesses/**`, `src/features/saas/**`, related routes | Equipment inventory, access records, SaaS subscriptions/licenses, critical review flags, audit events | Tests for asset/access/SaaS business rules and authorization |

Suggested merge batches:

1. Merge `feature/finance-clients`.
2. Merge `feature/people-compensation`.
3. Rebase and merge portal/timeoff/governance branches after people is in `development`.

### Wave 3 | Workflows And Alerts

These branches depend on most domain modules. Run them after Wave 2 contracts are stable.

| Branch | Subagent | Dependencies | Primary Write Scope | Deliverables | Validation |
| --- | --- | --- | --- | --- | --- |
| `feature/onboarding-offboarding` | Lifecycle worker | People, documents, equipment, accesses, SaaS | `src/features/lifecycle/**`, admission/offboarding routes | Admission checklist, offboarding checklist, required handoff items, links to equipment/access/SaaS/documents | Integration tests for checklist completion and blocked states |
| `feature/alerts-engine-center` | Alerts worker | Finance, people, invoices, reimbursements, timeoff, governance | `src/features/alerts/**`, alert routes, alert tests | Alert generators for overdue finance, pending NF/reimbursement, vacation, equipment return, active access after termination, SaaS renewal | Unit tests for each alert generator and resolution rule |
| `feature/audit-admin-reporting` | Audit UI worker | Audit logging, app shell | `src/features/audit/**`, audit routes | Audit log list/detail filters, actor/entity filters, secure export if allowed by PRD | Authorization tests, audit query tests |

Suggested merge order:

1. `feature/onboarding-offboarding`
2. `feature/alerts-engine-center`
3. `feature/audit-admin-reporting`

### Wave 4 | Hardening And Release Prep

Use one or more verification subagents after features are merged into `development`.

| Branch | Subagent | Dependencies | Primary Write Scope | Deliverables | Validation |
| --- | --- | --- | --- | --- | --- |
| `test/security-critical-flows` | Security test worker | Waves 1-3 | `tests/**`, focused fixes only with integrator approval | Tests for forbidden finance access, forbidden document access, collaborator own-data access, payload manipulation, RBAC bypass attempts | `npm.cmd run test`, targeted integration tests |
| `test/e2e-critical-flows` | E2E worker | Waves 1-3 | `tests/e2e/**`, Playwright config if needed | E2E for login, finance, collaborator, PJ NF upload, reimbursement approval, vacation, equipment, access removal | Playwright run and screenshots for key flows |
| `chore/release-hardening` | Integrator | All branches | Cross-cutting fixes, docs, env examples | Full validation, docs update, migration check, final development release candidate | `npm.cmd run lint`, `npm.cmd run typecheck`, `npm.cmd run test`, build, E2E |

## Subagent Handoff Template

Use this structure when assigning a task:

```text
Branch: <branch-name>
Base branch: development
Task: <specific objective>
Owned paths: <paths the subagent may edit>
Do not edit: <paths owned by parallel branches>
Dependencies: <branches/contracts that must already exist>
Requirements: <PRD sections and acceptance criteria>
Validation: <commands/tests required before final response>

You are not alone in the codebase. Do not revert edits made by others. Keep changes within the owned paths unless a blocker requires a small shared-contract edit; if that happens, call it out clearly in the final response.
```

## Integration Checklist Per Branch

Before merging a branch into `development`:

1. Confirm it is based on current `development`.
2. Review changed files against the declared write scope.
3. Run required validation commands.
4. Confirm RBAC checks are server-side.
5. Confirm sensitive reads/writes use the DAL.
6. Confirm critical writes produce audit logs.
7. Confirm docs or env examples are updated when setup changes.
8. Merge into `development`.
9. Rebase dependent branches before continuing them.

## Immediate Next Steps

1. Review and commit `chore/project-foundation`.
2. Merge `chore/project-foundation` into `development`.
3. Start Wave 1 with separate subagents for auth, RBAC/DAL, audit logging, and app shell.

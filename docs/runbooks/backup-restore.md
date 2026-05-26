# Runbook: database backup & restore

Authoritative procedure for PRD §9.5 / §14.13. Run a drill before every production cutover and at least once per quarter thereafter.

## Components

The production state of the system lives in two stores:

1. **Postgres database** — all relational data (employees, clients, finance, audit, alerts, RBAC, etc.).
2. **Object storage** — uploaded files referenced by `files.storageKey`. These live in the storage provider (e.g., Cloudflare R2) and are **not** included in the Postgres dump.

A complete recovery requires both. This runbook covers the database. Storage backup is handled by the provider (R2 has versioning + lifecycle policies) and is documented separately under `docs/runbooks/storage-recovery.md` once §14.14 lands.

## Scripts

| Action  | Windows                          | Linux/macOS                       |
|---------|----------------------------------|-----------------------------------|
| Backup  | `.\scripts\backup.ps1`           | `./scripts/backup.sh`             |
| Restore | `.\scripts\restore.ps1`          | `./scripts/restore.sh`            |

Both scripts:
- read `DATABASE_URL` from the environment,
- produce a custom-format `pg_dump` (compresses + restore-friendly),
- write a `.sha256` sidecar for integrity verification,
- write into `./backups/erp-agencia-<UTC-timestamp>.dump` by default.

The restore script will **refuse to run** if the checksum sidecar exists and does not match. It targets only the URL you pass explicitly (it deliberately ignores `DATABASE_URL` to prevent clobbering production).

## Drill procedure

Run quarterly or before each release.

1. **Take a backup** of the source database:
   ```powershell
   $env:DATABASE_URL = "postgres://user:pass@host:5432/erp_production"
   .\scripts\backup.ps1
   ```
   Confirm the file under `./backups/` and capture the SHA-256.

2. **Provision a clean target** database (do NOT reuse production):
   ```sql
   CREATE DATABASE erp_restore_test;
   ```

3. **Restore** the dump into the new database:
   ```powershell
   .\scripts\restore.ps1 -DumpPath .\backups\erp-agencia-<timestamp>.dump `
                         -DatabaseUrl postgres://user:pass@host:5432/erp_restore_test
   ```

4. **Validate** the restored database. Run each query and record counts in the drill log:
   ```sql
   SELECT count(*) FROM employees;
   SELECT count(*) FROM users;
   SELECT count(*) FROM roles;
   SELECT count(*) FROM permissions;
   SELECT count(*) FROM role_permissions;
   SELECT count(*) FROM clients;
   SELECT count(*) FROM financial_entries;
   SELECT count(*) FROM documents;
   SELECT count(*) FROM files;
   SELECT count(*) FROM vacation_balances;
   SELECT count(*) FROM audit_logs;
   ```
   Counts must match the source database (allow drift for any rows created after the backup snapshot).

5. **Spot-check** one document download path. The `files.storage_key` column should match an object that still exists in the storage bucket — confirm via the storage provider's UI/CLI. If the bucket has been swapped, document references will dangle.

6. **Smoke test** the application against the restored DB:
   - Point a staging deploy of the app at the restore URL.
   - Log in as the admin user.
   - Open `/app/auditoria` and confirm logs render.
   - Open `/app/configuracoes` and confirm roles/permissions are intact.

7. **Drop** `erp_restore_test` after the drill.

8. **Record** the drill in `docs/implementation-log.md` with: date, dump path, SHA-256, restore URL, validation counts, smoke-test outcome.

## Automated production backups (to be configured in §14.14)

The drill above is a manual exercise. Production additionally requires:

- **Daily automated backups** with off-site retention (≥ 30 days). On Neon: enable point-in-time recovery and the long-term backup add-on. On a managed Postgres (RDS / DigitalOcean / Render): enable native automated backups + cross-region replication.
- **Monitoring**: alert if no backup ran in the last 25 hours.
- **Quarterly restore-from-snapshot** drill (this runbook) to prove backups are not silently corrupt.

When staging is provisioned (§14.14), add a scheduled GitHub Action / cron that runs `scripts/backup.sh` daily into a private bucket and posts the SHA-256 to a monitoring channel.

## Worked-example output

A successful drill looks like:

```
> .\scripts\backup.ps1
Writing backup to .\backups\erp-agencia-20260521-091233.dump
Backup complete: .\backups\erp-agencia-20260521-091233.dump
SHA-256: 9a35...

> .\scripts\restore.ps1 -DumpPath .\backups\erp-agencia-20260521-091233.dump -DatabaseUrl postgres://localhost/erp_restore_test
Checksum OK (9a35...)
Restoring ...
Restore complete.
```

If you see `pg_restore: error: could not execute query: ERROR:  permission denied`, you targeted a database your user does not own. Create the target DB yourself first, or pass `-CleanFirst`.

## Acceptance for §14.13

- [x] Backup script exists and produces a dump + checksum.
- [x] Restore script exists and verifies the checksum.
- [ ] Drill executed once end-to-end against a non-production target. Record the result in `docs/implementation-log.md` when it runs.

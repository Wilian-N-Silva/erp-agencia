# Runbook: database roles

This runbook defines the credential boundary required before tenant RLS is enabled.
Provision the roles separately in local, staging, and production environments.

## Contract

| Credential            | Purpose                                              | Required properties                                                                                                                                  |
| --------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`        | Next.js runtime                                      | Dedicated login role; `NOSUPERUSER`, `NOCREATEDB`, `NOCREATEROLE`, `NOINHERIT`, `NOREPLICATION`, `NOBYPASSRLS`; owns no application tables; DML only |
| `DATABASE_DIRECT_URL` | drizzle-kit, seed, backup, controlled administration | Migration/admin role on a direct connection; never exposed to the runtime deployment                                                                 |

The runtime role name is encoded in `DATABASE_URL`; there is no separate role-name
environment variable. Do not use the Neon owner URL, a superuser, or the migration
role in `DATABASE_URL`. Pooling does not change the role requirements.

## Provision a runtime role

Connect with `DATABASE_DIRECT_URL` as the migration/admin role. Replace the database,
role, migration-role, and password placeholders before running these statements. Create
the login once; rotate its password with `ALTER ROLE` instead of recreating it.

```sql
CREATE ROLE erp_app
  LOGIN
  PASSWORD '<generated-runtime-password>'
  NOSUPERUSER
  NOCREATEDB
  NOCREATEROLE
  NOINHERIT
  NOREPLICATION
  NOBYPASSRLS;

GRANT CONNECT ON DATABASE erp_agencia TO erp_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO erp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO erp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO erp_app;

ALTER DEFAULT PRIVILEGES FOR ROLE erp_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO erp_app;
ALTER DEFAULT PRIVILEGES FOR ROLE erp_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO erp_app;
```

`erp_migrator` must be the role that creates objects through drizzle-kit. On Neon,
use the actual role from the direct owner URL. Re-run the two `GRANT ... ON ALL ...`
statements after provisioning against an existing database; default privileges affect
only objects created later.

Create the pooled connection string for `erp_app` and store it as `DATABASE_URL`.
Keep the direct owner/admin connection string as `DATABASE_DIRECT_URL` only in CI or
operator environments that run migrations, seed, or backups.

## Runtime tenant context

Business database work must run through `withTenantDb` from `src/lib/db`. Pass the
authenticated `AccessContext` and use only the transaction handle supplied to the
callback. The helper rejects a missing context, a missing/invalid organization UUID,
or an empty user ID before opening a transaction. It then sets
`app.organization_id` and `app.user_id` with parameterized
`set_config(..., true)` calls, so both values are local to that transaction.

The helper establishes database tenant identity; it does not replace server-side
RBAC, DAL organization predicates, Zod validation of external payloads, or audit.
Do not copy IDs from request payloads into the database context.

## Verify before deployment

Connect using `DATABASE_URL` and run:

```sql
SELECT
  current_user,
  rolsuper,
  rolcreatedb,
  rolcreaterole,
  rolreplication,
  rolbypassrls,
  has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_in_public
FROM pg_roles
WHERE rolname = current_user;

SELECT count(*) AS owned_application_relations
FROM pg_class AS relation
JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE relation.relowner = (SELECT oid FROM pg_roles WHERE rolname = current_user)
  AND namespace.nspname = 'public'
  AND relation.relkind IN ('r', 'p', 'S', 'v', 'm');
```

Acceptance is: all privilege flags and `can_create_in_public` are `false` and
`owned_application_relations = 0`. Confirm that a normal application query works.
After SEC-003 enables policies, also confirm that a query without tenant context is
denied; the full cross-tenant/app-role matrix belongs to SEC-004.

## Rotation and incident response

1. Generate a new runtime password in the provider.
2. Update `DATABASE_URL` in the target deployment and redeploy.
3. Confirm new connections use `erp_app`, then revoke the old credential.
4. If the runtime role ever gains ownership, superuser, or `BYPASSRLS`, remove the
   privilege immediately, stop the deployment until verification passes, and record
   the event without logging connection strings.

Never copy either URL into source control, logs, tickets, or client-visible variables.

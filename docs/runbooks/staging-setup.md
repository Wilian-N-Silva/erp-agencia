# Runbook: staging environment provisioning (§14.14)

PRD §14.14 requires a staging environment validated end-to-end before promoting `development` to `main`. This document lists the concrete dependencies, decisions, and steps so anyone with cloud access can stand staging up.

## What "staging validated" means

A non-developer logs into staging at `https://<staging-host>` and runs this representative flow without help:

1. Sign in with Google (or email/password if enabled).
2. Open `/app/colaboradores`, create one employee.
3. Open `/portal`, submit an NF request as that employee.
4. Approve the NF as finance.
5. Submit a reimbursement, approve it, include it in the next NF.
6. Create a vacation balance, request and approve a vacation.
7. Open `/app/auditoria` and confirm the actions above are logged.
8. Download a file uploaded during the flow.

If every step succeeds against a freshly provisioned environment, §14.14 is closed.

## Decisions you must make first

| Decision | Why it matters | Recommended default |
|---|---|---|
| Hosting target | Drives all other choices | Vercel (Next.js native) |
| Postgres provider | Drives DATABASE_URL, backup story, branching | Neon (cheap branches, native PITR) |
| Object storage | Drives STORAGE_* vars | Cloudflare R2 (already supported in code) |
| Staging domain | Drives BETTER_AUTH_URL and CORS | `staging.<prod-domain>` |
| Google OAuth client | Separate from prod to avoid sharing credentials | New OAuth client with staging redirect URI |
| Email-domain allowlist | Who can log in | Same as prod, OR `@example.com` test domain |
| First admin | Bootstrap account | A dev mailbox you control |

Decide these once and write them in `docs/decisions/staging-config.md`. The rest of this runbook assumes Vercel + Neon + R2.

## Required external accounts

You need credentials for all of these before starting:

- [ ] Vercel project (or Render / Fly / VPS equivalent).
- [ ] Neon project (or RDS / DigitalOcean Postgres). Two databases recommended: `staging` and `staging_restore_test` (the second is for backup drills, see `backup-restore.md`).
- [ ] Cloudflare R2 bucket called `erp-staging-uploads` (or equivalent) with:
  - An API token scoped to that bucket.
  - CORS policy allowing the staging host (`https://staging.<domain>`).
- [ ] Google Cloud OAuth client with redirect URI `https://staging.<domain>/api/auth/callback/google`.
- [ ] DNS access to add a `staging` subdomain (CNAME to Vercel / A record to your host).
- [ ] A monitoring / log destination (Vercel logs are sufficient for now; Sentry recommended later).

## Step-by-step provisioning

### 1. Database

1. Create a fresh Postgres 17 database in Neon.
2. Copy the **pooled** connection string into `DATABASE_URL` and the **direct** (non-pooled) connection string into `DATABASE_DIRECT_URL`. Drizzle migrations need the direct URL because the pooler does not support prepared statements.
3. Run migrations from a clean local checkout against the staging URL:
   ```powershell
   $env:DATABASE_URL = "<staging direct url>"
   npm run db:migrate
   ```
4. Seed initial RBAC + admin (set `SEED_DEMO_DATA=false` for staging — only run demo seed if you want fake data):
   ```powershell
   $env:INITIAL_ADMIN_EMAIL = "you@example.com"
   $env:INITIAL_ADMIN_NAME = "Staging Admin"
   $env:INITIAL_ADMIN_PASSWORD = "<random strong password>"
   npm run db:seed
   ```

### 2. Object storage

1. Create the R2 bucket. Disable public access.
2. Create an API token with read/write on that bucket only.
3. Add this CORS policy in the R2 console (replace the origin):
   ```json
   [{
     "AllowedOrigins": ["https://staging.<domain>"],
     "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
     "AllowedHeaders": ["*"],
     "MaxAgeSeconds": 3600
   }]
   ```
4. Capture the values:
   - `STORAGE_PROVIDER=r2`
   - `STORAGE_BUCKET=erp-staging-uploads`
   - `STORAGE_REGION=auto`
   - `STORAGE_ENDPOINT=https://<accountid>.r2.cloudflarestorage.com`
   - `STORAGE_ACCOUNT_ID=<r2 account id>`
   - `STORAGE_ACCESS_KEY_ID=<token id>`
   - `STORAGE_SECRET_ACCESS_KEY=<token secret>`

### 3. Auth

1. In Google Cloud, create a new OAuth 2.0 client (Web). Authorized redirect URI: `https://staging.<domain>/api/auth/callback/google`.
2. Capture `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
3. Pick a 32-byte random secret for `BETTER_AUTH_SECRET` (e.g. `openssl rand -hex 32`). Never reuse the prod secret.
4. Set:
   - `BETTER_AUTH_URL=https://staging.<domain>`
   - `BETTER_AUTH_TRUSTED_ORIGINS=https://staging.<domain>`
   - `NEXT_PUBLIC_BETTER_AUTH_URL=https://staging.<domain>`
   - `APP_URL=https://staging.<domain>`
   - `ALLOWED_EMAIL_DOMAIN=<your domain>` (or leave empty to allow any verified Google account).

### 4. Hosting (Vercel example)

1. `vercel link` from the repo root, pointing at a new project named `erp-agencia-staging`.
2. In the Vercel dashboard, set the `development` branch as the production branch of this project (so each push to `development` ships staging).
3. Add every variable from the `.env.example` file as a Vercel environment variable, scoped to "Production" (this project's "Production" environment is your staging deployment).
4. Trigger a deploy by pushing to `development` or running `vercel --prod`.
5. Add the custom domain `staging.<domain>` to the Vercel project and update DNS.

### 5. Smoke test (closes §14.14)

Run the eight-step flow above end-to-end against the live staging URL. Record the result in `docs/implementation-log.md`.

## What stays manual

These are not in scope for the staging cutover but should be tracked:

- Automated backups (see `backup-restore.md`). Neon's PITR covers point-in-time recovery; daily exports to an off-Neon location is the next step.
- Application monitoring / error tracking. Add Sentry or equivalent before production traffic.
- Log retention. Vercel logs default to 1 day on hobby plans; check your tier.
- WAF / rate limiting. Better Auth has a default login rate limit; Vercel handles edge-level abuse. If you expose this publicly, put Cloudflare in front.

## Acceptance for §14.14

- [ ] Staging URL accessible at `https://staging.<domain>`.
- [ ] Database migrated from zero and seeded.
- [ ] Storage bucket connected and uploads working end-to-end.
- [ ] Google OAuth working with the staging redirect URI.
- [ ] Eight-step smoke test completed by someone other than the developer.
- [ ] Result recorded in `docs/implementation-log.md`.

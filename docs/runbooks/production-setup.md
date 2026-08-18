# Runbook: production environment provisioning

Target: `https://app.formulagroup.com.br` on Vercel + Neon + Cloudflare R2.

Mirrors `staging-setup.md` but with prod-specific defaults (separate OAuth client, separate DB, separate R2 bucket, separate secrets, demo seed disabled). Run this only after staging is green (`docs/runbooks/staging-setup.md`).

## Decisions baked into this runbook

| Decision | Value |
|---|---|
| Public host | `app.formulagroup.com.br` |
| Cookie scope | Isolated to `app.` (Better Auth default — no `cookieDomain` override) |
| Hosting | Vercel |
| Postgres | Neon (separate project from staging) |
| Object storage | Cloudflare R2 bucket `erp-prod-uploads` |
| Google OAuth | Dedicated prod client (NOT shared with staging) |
| Email/password auth | Off (Google SSO only) — flip on later if needed |
| Public self sign-up | Off (invitations only) |
| Email-domain allowlist | `formulagroup.com.br` |
| Demo data seed | Off |
| First admin | A real director mailbox under `@formulagroup.com.br` |

Document any deviation from this table in `docs/decisions/`.

## Required external accounts

- [ ] Vercel project `erp-agencia-prod` (separate from staging).
- [ ] Neon project with a fresh database (separate from staging).
- [ ] Cloudflare R2 bucket `erp-prod-uploads` with a token scoped to that bucket only.
- [ ] Google Cloud OAuth 2.0 client (Web) dedicated to prod.
- [ ] DNS access for `formulagroup.com.br` (to add the `app` record).
- [ ] A monitoring destination (Vercel logs at minimum; Sentry recommended).

## Step-by-step

### 1. DNS

Add a CNAME on `formulagroup.com.br`:

```
app    CNAME    cname.vercel-dns.com.    TTL 300
```

Leave TTL low (300s) until the cutover is verified, then raise to 3600.

### 2. Database

1. Create a fresh Postgres 17 database in Neon (project `erp-prod`).
2. Capture the direct owner/admin URL as `DATABASE_DIRECT_URL`. Provision the
   dedicated runtime role with `docs/runbooks/database-roles.md`, then capture its
   pooled URL as `DATABASE_URL`. The roles must be different.
3. Apply migrations from a clean local checkout pointed at the prod direct URL:
   ```powershell
   $env:DATABASE_DIRECT_URL = "<prod direct url>"
   npm run db:migrate
   ```
   If `db:migrate` exits silently with code 1, check the `public` schema exists on the target database — some managed Postgres setups omit it. Create it with `CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO <db_user>;` and retry.
4. Seed RBAC + initial admin (NO demo data):
   ```powershell
   $env:SEED_DEMO_DATA = "false"
   $env:INITIAL_ADMIN_EMAIL = "<director-mailbox>@formulagroup.com.br"
   $env:INITIAL_ADMIN_NAME = "<full name>"
   $env:INITIAL_ADMIN_PASSWORD = "<openssl rand -base64 24>"
   npm run db:seed
   ```
5. Rotate the bootstrap password via the UI on first login.

### 3. Object storage

1. Create the R2 bucket `erp-prod-uploads`. Public access disabled.
2. Create an API token with read/write on that bucket only.
3. CORS policy (replace placeholders):
   ```json
   [{
     "AllowedOrigins": ["https://app.formulagroup.com.br"],
     "AllowedMethods": ["GET", "PUT", "POST", "HEAD"],
     "AllowedHeaders": ["*"],
     "MaxAgeSeconds": 3600
   }]
   ```
4. Capture the values for the env block below.

### 4. Google OAuth

1. In Google Cloud, create a new OAuth 2.0 client (Web) called `Sistema Interno FG — prod`. Do NOT reuse the staging client.
2. Authorized JavaScript origin: `https://app.formulagroup.com.br`.
3. Authorized redirect URI: `https://app.formulagroup.com.br/api/auth/callback/google`.
4. Set the OAuth consent screen to "Internal" if the Workspace is the company's, so only `@formulagroup.com.br` accounts can authenticate.
5. Capture `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.

### 5. Vercel project

1. `vercel link` from the repo root into a new project named `erp-agencia-prod`.
2. Production branch = `main`. (Staging project tracks `development`; prod tracks `main`.)
3. Add the runtime variables from `.env.production.example` to the Vercel dashboard
   under the "Production" environment. Do not add `DATABASE_DIRECT_URL`; keep it in
   the controlled migration/seed/backup environment only. Suggested values:
   ```
   BETTER_AUTH_URL=https://app.formulagroup.com.br
   BETTER_AUTH_TRUSTED_ORIGINS=https://app.formulagroup.com.br
   NEXT_PUBLIC_BETTER_AUTH_URL=https://app.formulagroup.com.br
   APP_URL=https://app.formulagroup.com.br
   ALLOWED_EMAIL_DOMAIN=formulagroup.com.br
   ENABLE_EMAIL_PASSWORD_AUTH=false
   ENABLE_EMAIL_PASSWORD_SIGN_UP=false
   SEED_DEMO_DATA=false
   STORAGE_PROVIDER=r2
   STORAGE_BUCKET=erp-prod-uploads
   STORAGE_REGION=auto
   ```
   plus the secrets from steps 2–4. Generate a fresh `BETTER_AUTH_SECRET` (`openssl rand -hex 32`) — never reuse staging.
4. Add the custom domain `app.formulagroup.com.br` to the project. Vercel will issue the certificate automatically once DNS resolves.
5. Trigger the first deploy by merging into `main` (or `vercel --prod`).

### 6. Verify cookie scope

Open DevTools after sign-in:

- Cookie `__Secure-better-auth.session_token` must have `Domain` blank or `app.formulagroup.com.br` (host-only). It must NOT show `.formulagroup.com.br`.
- `Secure` and `HttpOnly` flags both set.
- `SameSite=Lax`.

If `Domain` shows `.formulagroup.com.br`, something is overriding the default — investigate before going live, otherwise any subdomain could read the session.

### 7. Smoke test (closes the cutover)

Same eight-step flow as `staging-setup.md` §"What 'staging validated' means", but on `https://app.formulagroup.com.br`, by someone other than the developer who shipped it. Record the result in `docs/implementation-log.md`.

## Post-cutover hardening (not blockers)

- Set up Cloudflare in front of `app.` for WAF + rate limiting if traffic is public-facing.
- Wire Sentry (or equivalent) for error tracking.
- Schedule the daily backup drill described in `backup-restore.md`.
- Raise the DNS TTL once stable.
- Document who has admin role on the prod Neon project, Vercel project, R2 bucket, and Google OAuth client — single owner is a bus factor of 1.

## Acceptance

- [ ] `https://app.formulagroup.com.br` resolves and serves the app over HTTPS.
- [ ] Google sign-in works for a `@formulagroup.com.br` account; an outside account is rejected.
- [ ] Session cookie scope verified host-only on `app.` (step 6).
- [ ] Database migrated from zero and seeded with the bootstrap admin.
- [ ] R2 uploads succeed and the file is retrievable.
- [ ] Eight-step smoke test passed by a non-developer.
- [ ] Result recorded in `docs/implementation-log.md`.

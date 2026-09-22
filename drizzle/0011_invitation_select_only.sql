DROP POLICY "access_invitations_tenant_isolation" ON "access_invitations";--> statement-breakpoint
CREATE POLICY "access_invitations_tenant_isolation"
ON "access_invitations"
FOR ALL TO PUBLIC
USING (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')::uuid
)
WITH CHECK (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')::uuid
);--> statement-breakpoint
CREATE POLICY "access_invitations_pre_auth_lookup"
ON "access_invitations"
FOR SELECT TO PUBLIC
USING (
  "email" = nullif(current_setting('app.invitation_email', true), '')
  AND "used_at" IS NULL
  AND "expires_at" > now()
);

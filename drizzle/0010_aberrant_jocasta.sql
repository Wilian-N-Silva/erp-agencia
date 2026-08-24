CREATE TABLE "access_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"email" text NOT NULL,
	"role_keys" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"invited_by_user_id" text NOT NULL,
	"used_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "access_invitations" ADD CONSTRAINT "access_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_invitations" ADD CONSTRAINT "access_invitations_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "access_invitations" ADD CONSTRAINT "access_invitations_used_by_user_id_user_id_fk" FOREIGN KEY ("used_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "access_invitations_email_idx" ON "access_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "access_invitations_organization_idx" ON "access_invitations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "access_invitations_expires_at_idx" ON "access_invitations" USING btree ("expires_at");;--> statement-breakpoint
ALTER TABLE "access_invitations" ADD CONSTRAINT "access_invitations_email_normalized_check" CHECK ("email" = lower(btrim("email")));--> statement-breakpoint
ALTER TABLE "access_invitations" ADD CONSTRAINT "access_invitations_role_keys_check" CHECK (jsonb_typeof("role_keys") = 'array' AND jsonb_array_length("role_keys") > 0);--> statement-breakpoint
ALTER TABLE "access_invitations" ADD CONSTRAINT "access_invitations_usage_check" CHECK (("used_at" IS NULL) = ("used_by_user_id" IS NULL));--> statement-breakpoint
ALTER TABLE "access_invitations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "access_invitations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "access_invitations_tenant_isolation"
ON "access_invitations"
FOR ALL TO PUBLIC
USING (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')::uuid
  OR "email" = nullif(current_setting('app.invitation_email', true), '')
)
WITH CHECK (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')::uuid
  OR "email" = nullif(current_setting('app.invitation_email', true), '')
);
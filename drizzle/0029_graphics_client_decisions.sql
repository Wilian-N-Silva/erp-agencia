CREATE UNIQUE INDEX "graphic_os_versions_tenant_job_id_idx" ON "graphic_os_versions" USING btree ("organization_id","job_id","id");
--> statement-breakpoint
CREATE TABLE "graphic_client_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"os_version_id" uuid NOT NULL,
	"decision" text NOT NULL,
	"contact" text NOT NULL,
	"channel" text NOT NULL,
	"decided_at" date NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"file_id" uuid,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "graphic_client_decisions_decision_check" CHECK ("graphic_client_decisions"."decision" in ('approved','rejected','revision_requested')),
	CONSTRAINT "graphic_client_decisions_channel_check" CHECK ("graphic_client_decisions"."channel" in ('whatsapp','email','signed','phone','in_person','other'))
);
--> statement-breakpoint
ALTER TABLE "graphic_client_decisions" ADD CONSTRAINT "graphic_client_decisions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_client_decisions" ADD CONSTRAINT "graphic_client_decisions_os_tenant_fk" FOREIGN KEY ("organization_id","job_id","os_version_id") REFERENCES "public"."graphic_os_versions"("organization_id","job_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_client_decisions" ADD CONSTRAINT "graphic_client_decisions_file_tenant_fk" FOREIGN KEY ("organization_id","file_id") REFERENCES "public"."files"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_client_decisions" ADD CONSTRAINT "graphic_client_decisions_user_tenant_fk" FOREIGN KEY ("organization_id","created_by_user_id") REFERENCES "public"."user"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "graphic_client_decisions_job_idx" ON "graphic_client_decisions" USING btree ("organization_id","job_id","created_at");

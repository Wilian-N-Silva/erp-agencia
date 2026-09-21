CREATE TABLE "graphic_os_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"external_number" text NOT NULL,
	"issued_at" date NOT NULL,
	"presented_amount" numeric(14, 2) NOT NULL,
	"file_id" uuid NOT NULL,
	"revision_reason" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "graphic_os_versions_version_check" CHECK ("graphic_os_versions"."version" > 0),
	CONSTRAINT "graphic_os_versions_amount_check" CHECK ("graphic_os_versions"."presented_amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "graphic_os_versions" ADD CONSTRAINT "graphic_os_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_os_versions" ADD CONSTRAINT "graphic_os_versions_job_tenant_fk" FOREIGN KEY ("organization_id","job_id") REFERENCES "public"."graphic_jobs"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_os_versions" ADD CONSTRAINT "graphic_os_versions_file_tenant_fk" FOREIGN KEY ("organization_id","file_id") REFERENCES "public"."files"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_os_versions" ADD CONSTRAINT "graphic_os_versions_user_tenant_fk" FOREIGN KEY ("organization_id","created_by_user_id") REFERENCES "public"."user"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "graphic_os_versions_job_version_idx" ON "graphic_os_versions" USING btree ("organization_id","job_id","version");--> statement-breakpoint
CREATE INDEX "graphic_os_versions_number_idx" ON "graphic_os_versions" USING btree ("organization_id","external_number");
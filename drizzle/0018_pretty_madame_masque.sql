CREATE TYPE "public"."graphic_job_financial_status" AS ENUM('not_started', 'pending', 'partial', 'settled', 'overdue');--> statement-breakpoint
CREATE TYPE "public"."graphic_job_operational_status" AS ENUM('supplier_sourcing', 'supplier_approval_pending', 'os_pending', 'client_approval_pending', 'client_revision', 'client_rejected', 'approved', 'in_production', 'waiting', 'ready', 'delivered', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."graphic_project_kind" AS ENUM('project', 'event');--> statement-breakpoint
CREATE TABLE "graphic_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"internal_code" text NOT NULL,
	"client_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"responsible_employee_id" uuid NOT NULL,
	"project_id" uuid,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"desired_delivery_at" timestamp with time zone,
	"operational_status" "graphic_job_operational_status" DEFAULT 'supplier_sourcing' NOT NULL,
	"financial_status" "graphic_job_financial_status" DEFAULT 'not_started' NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "graphic_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"description" text,
	"kind" "graphic_project_kind" DEFAULT 'project' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "graphic_projects_period_check" CHECK ("graphic_projects"."ends_at" is null or "graphic_projects"."starts_at" is null or "graphic_projects"."ends_at" >= "graphic_projects"."starts_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "clients_organization_id_idx" ON "clients" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_organization_id_idx" ON "employees" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "graphic_projects_organization_id_idx" ON "graphic_projects" USING btree ("organization_id","id");--> statement-breakpoint
ALTER TABLE "graphic_jobs" ADD CONSTRAINT "graphic_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_jobs" ADD CONSTRAINT "graphic_jobs_client_tenant_fk" FOREIGN KEY ("organization_id","client_id") REFERENCES "public"."clients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_jobs" ADD CONSTRAINT "graphic_jobs_responsible_tenant_fk" FOREIGN KEY ("organization_id","responsible_employee_id") REFERENCES "public"."employees"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_jobs" ADD CONSTRAINT "graphic_jobs_project_tenant_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."graphic_projects"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_projects" ADD CONSTRAINT "graphic_projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "graphic_jobs_internal_code_idx" ON "graphic_jobs" USING btree ("organization_id","internal_code");--> statement-breakpoint
CREATE UNIQUE INDEX "graphic_jobs_organization_id_idx" ON "graphic_jobs" USING btree ("organization_id","id");--> statement-breakpoint
CREATE INDEX "graphic_jobs_operational_status_idx" ON "graphic_jobs" USING btree ("organization_id","operational_status");--> statement-breakpoint
CREATE INDEX "graphic_jobs_client_idx" ON "graphic_jobs" USING btree ("organization_id","client_id");--> statement-breakpoint
CREATE INDEX "graphic_jobs_responsible_idx" ON "graphic_jobs" USING btree ("organization_id","responsible_employee_id");--> statement-breakpoint
CREATE INDEX "graphic_jobs_project_idx" ON "graphic_jobs" USING btree ("organization_id","project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "graphic_projects_organization_code_idx" ON "graphic_projects" USING btree ("organization_id","code");--> statement-breakpoint
CREATE INDEX "graphic_projects_active_idx" ON "graphic_projects" USING btree ("organization_id","deleted_at");--> statement-breakpoint

DO $$
DECLARE
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY ARRAY[
    'graphic_jobs',
    'graphic_projects'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', tenant_table);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO PUBLIC
       USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)
       WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',
      tenant_table || '_tenant_isolation',
      tenant_table
    );
  END LOOP;
END
$$;

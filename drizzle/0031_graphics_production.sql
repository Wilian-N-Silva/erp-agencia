CREATE TABLE "graphic_production_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"from_status" "graphic_job_operational_status" NOT NULL,
	"to_status" "graphic_job_operational_status" NOT NULL,
	"waiting_reason" text,
	"responsible_employee_id" uuid NOT NULL,
	"due_at" date,
	"notes" text DEFAULT '' NOT NULL,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "graphic_production_events_waiting_check" CHECK (("graphic_production_events"."to_status" = 'waiting' and "graphic_production_events"."waiting_reason" in ('client','art','internal','supplier','material','payment','other')) or ("graphic_production_events"."to_status" <> 'waiting' and "graphic_production_events"."waiting_reason" is null))
);
--> statement-breakpoint
ALTER TABLE "graphic_production_events" ADD CONSTRAINT "graphic_production_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_production_events" ADD CONSTRAINT "graphic_production_events_job_tenant_fk" FOREIGN KEY ("organization_id","job_id") REFERENCES "public"."graphic_jobs"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_production_events" ADD CONSTRAINT "graphic_production_events_employee_tenant_fk" FOREIGN KEY ("organization_id","responsible_employee_id") REFERENCES "public"."employees"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_production_events" ADD CONSTRAINT "graphic_production_events_user_tenant_fk" FOREIGN KEY ("organization_id","created_by_user_id") REFERENCES "public"."user"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "graphic_production_events_job_idx" ON "graphic_production_events" USING btree ("organization_id","job_id","created_at");
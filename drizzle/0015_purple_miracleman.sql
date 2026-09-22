CREATE TYPE "public"."work_item_priority" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."work_item_status" AS ENUM('open', 'in_progress', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TABLE "work_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"source_type" text NOT NULL,
	"source_id" text NOT NULL,
	"occurrence_key" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"assigned_user_id" text,
	"assigned_employee_id" uuid,
	"due_at" timestamp with time zone,
	"priority" "work_item_priority" DEFAULT 'medium' NOT NULL,
	"status" "work_item_status" DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by_user_id" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "work_items_single_owner_check" CHECK ("work_items"."assigned_user_id" is null or "work_items"."assigned_employee_id" is null),
	CONSTRAINT "work_items_resolution_state_check" CHECK ((
        "work_items"."status" in ('open', 'in_progress')
        and "work_items"."resolution" is null
        and "work_items"."resolved_by_user_id" is null
        and "work_items"."resolved_at" is null
      ) or (
        "work_items"."status" in ('resolved', 'dismissed')
        and "work_items"."resolution" is not null
        and "work_items"."resolved_by_user_id" is not null
        and "work_items"."resolved_at" is not null
      ))
);
--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_assigned_user_id_user_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_assigned_employee_id_employees_id_fk" FOREIGN KEY ("assigned_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_resolved_by_user_id_user_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "work_items_occurrence_idx" ON "work_items" USING btree ("organization_id","kind","source_type","source_id","occurrence_key");--> statement-breakpoint
CREATE INDEX "work_items_status_idx" ON "work_items" USING btree ("organization_id","status","priority","due_at");--> statement-breakpoint
CREATE INDEX "work_items_assigned_user_idx" ON "work_items" USING btree ("organization_id","assigned_user_id","status");--> statement-breakpoint
CREATE INDEX "work_items_assigned_employee_idx" ON "work_items" USING btree ("organization_id","assigned_employee_id","status");--> statement-breakpoint
ALTER TABLE "work_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "work_items" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "work_items_tenant_isolation"
ON "work_items"
FOR ALL TO PUBLIC
USING (
	"organization_id" = nullif(current_setting('app.organization_id', true), '')::uuid
)
WITH CHECK (
	"organization_id" = nullif(current_setting('app.organization_id', true), '')::uuid
);

CREATE TABLE "lifecycle_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checklist_id" uuid NOT NULL,
	"key" text NOT NULL,
	"title" text NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"responsible_user_id" text,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" text,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lifecycle_checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" text,
	"created_by_user_id" text NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lifecycle_checklist_items" ADD CONSTRAINT "lifecycle_checklist_items_checklist_id_lifecycle_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."lifecycle_checklists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_checklist_items" ADD CONSTRAINT "lifecycle_checklist_items_responsible_user_id_user_id_fk" FOREIGN KEY ("responsible_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_checklist_items" ADD CONSTRAINT "lifecycle_checklist_items_completed_by_user_id_user_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_checklists" ADD CONSTRAINT "lifecycle_checklists_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_checklists" ADD CONSTRAINT "lifecycle_checklists_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_checklists" ADD CONSTRAINT "lifecycle_checklists_completed_by_user_id_user_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lifecycle_checklists" ADD CONSTRAINT "lifecycle_checklists_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lifecycle_items_checklist_idx" ON "lifecycle_checklist_items" USING btree ("checklist_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lifecycle_items_checklist_key_idx" ON "lifecycle_checklist_items" USING btree ("checklist_id","key");--> statement-breakpoint
CREATE INDEX "lifecycle_items_status_idx" ON "lifecycle_checklist_items" USING btree ("status");--> statement-breakpoint
CREATE INDEX "lifecycle_checklists_employee_type_idx" ON "lifecycle_checklists" USING btree ("employee_id","type");--> statement-breakpoint
CREATE INDEX "lifecycle_checklists_status_idx" ON "lifecycle_checklists" USING btree ("organization_id","status");
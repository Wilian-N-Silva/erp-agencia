CREATE TABLE "compensation_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"previous_amount" numeric(12, 2) NOT NULL,
	"new_amount" numeric(12, 2) NOT NULL,
	"difference_amount" numeric(12, 2) NOT NULL,
	"effective_date" date NOT NULL,
	"reason" text NOT NULL,
	"approved_by_user_id" text NOT NULL,
	"document_file_id" uuid,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employee_benefits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"benefit_type" text NOT NULL,
	"name" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"recurring" boolean DEFAULT true NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_by_user_id" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "compensation_history" ADD CONSTRAINT "compensation_history_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compensation_history" ADD CONSTRAINT "compensation_history_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compensation_history" ADD CONSTRAINT "compensation_history_approved_by_user_id_user_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compensation_history" ADD CONSTRAINT "compensation_history_document_file_id_files_id_fk" FOREIGN KEY ("document_file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compensation_history" ADD CONSTRAINT "compensation_history_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_benefits" ADD CONSTRAINT "employee_benefits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_benefits" ADD CONSTRAINT "employee_benefits_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "employee_benefits" ADD CONSTRAINT "employee_benefits_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "compensation_history_employee_idx" ON "compensation_history" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "compensation_history_organization_idx" ON "compensation_history" USING btree ("organization_id","effective_date");--> statement-breakpoint
CREATE INDEX "employee_benefits_employee_idx" ON "employee_benefits" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employee_benefits_status_idx" ON "employee_benefits" USING btree ("organization_id","status");
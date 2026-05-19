CREATE TYPE "public"."vacation_balance_status" AS ENUM('active', 'closed');--> statement-breakpoint
CREATE TABLE "vacation_balances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"employee_id" uuid NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"concession_deadline" date NOT NULL,
	"days_acquired" integer DEFAULT 30 NOT NULL,
	"days_sold" integer DEFAULT 0 NOT NULL,
	"status" "vacation_balance_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_by_user_id" text NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vacation_balances" ADD CONSTRAINT "vacation_balances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_balances" ADD CONSTRAINT "vacation_balances_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vacation_balances" ADD CONSTRAINT "vacation_balances_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "vacation_balances_employee_period_idx" ON "vacation_balances" USING btree ("employee_id","period_start");--> statement-breakpoint
CREATE INDEX "vacation_balances_status_idx" ON "vacation_balances" USING btree ("organization_id","status");
CREATE TABLE "client_billing_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"monthly_fee" numeric(12, 2) NOT NULL,
	"billing_day" integer NOT NULL,
	"payment_method" text,
	"payment_terms_days" integer DEFAULT 0 NOT NULL,
	"recurrence" text DEFAULT 'monthly' NOT NULL,
	"auto_generate_entries" boolean DEFAULT false NOT NULL,
	"financial_contact_name" text,
	"financial_email" text,
	"financial_phone" text,
	"billing_owner_employee_id" uuid,
	"reminder_before_days" integer DEFAULT 3 NOT NULL,
	"reminder_after_days" integer DEFAULT 1 NOT NULL,
	"notes" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_payment_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"financial_entry_id" uuid,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_date" date,
	"status" text DEFAULT 'open' NOT NULL,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "received_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "financial_entries" ADD COLUMN "payment_method" text;--> statement-breakpoint
ALTER TABLE "client_billing_profiles" ADD CONSTRAINT "client_billing_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_billing_profiles" ADD CONSTRAINT "client_billing_profiles_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_billing_profiles" ADD CONSTRAINT "client_billing_profiles_billing_owner_employee_id_employees_id_fk" FOREIGN KEY ("billing_owner_employee_id") REFERENCES "public"."employees"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment_reminders" ADD CONSTRAINT "client_payment_reminders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment_reminders" ADD CONSTRAINT "client_payment_reminders_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_payment_reminders" ADD CONSTRAINT "client_payment_reminders_financial_entry_id_financial_entries_id_fk" FOREIGN KEY ("financial_entry_id") REFERENCES "public"."financial_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "client_billing_profiles_client_idx" ON "client_billing_profiles" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_billing_profiles_organization_idx" ON "client_billing_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "client_payment_reminders_client_idx" ON "client_payment_reminders" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "client_payment_reminders_status_idx" ON "client_payment_reminders" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "client_payment_reminders_entry_kind_idx" ON "client_payment_reminders" USING btree ("financial_entry_id","kind");
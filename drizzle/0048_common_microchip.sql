CREATE TABLE "provision_cycles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provision_id" uuid NOT NULL,
	"competence" text NOT NULL,
	"estimated_amount" numeric(12, 2) NOT NULL,
	"due_date" date NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"financial_expense_id" uuid,
	"cancellation_reason" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provision_cycles_amount_check" CHECK ("provision_cycles"."estimated_amount" > 0),
	CONSTRAINT "provision_cycles_competence_check" CHECK ("provision_cycles"."competence" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "provision_cycles_state_check" CHECK (("provision_cycles"."status" = 'planned' and "provision_cycles"."financial_expense_id" is null and "provision_cycles"."cancellation_reason" is null) or ("provision_cycles"."status" = 'realized' and "provision_cycles"."financial_expense_id" is not null and "provision_cycles"."cancellation_reason" is null) or ("provision_cycles"."status" = 'cancelled' and "provision_cycles"."financial_expense_id" is null and length(trim("provision_cycles"."cancellation_reason")) >= 5 and "provision_cycles"."cancellation_reason" is not null))
);
--> statement-breakpoint
ALTER TABLE "provision_cycles" ADD CONSTRAINT "provision_cycles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provision_cycles" ADD CONSTRAINT "provision_cycles_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provisions_tenant_id_idx" ON "provisions" USING btree ("organization_id","id");--> statement-breakpoint
ALTER TABLE "provision_cycles" ADD CONSTRAINT "provision_cycles_provision_tenant_fk" FOREIGN KEY ("organization_id","provision_id") REFERENCES "public"."provisions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provision_cycles" ADD CONSTRAINT "provision_cycles_payable_tenant_fk" FOREIGN KEY ("organization_id","financial_expense_id") REFERENCES "public"."financial_expenses"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "provision_cycles_occurrence_idx" ON "provision_cycles" USING btree ("organization_id","provision_id","competence");--> statement-breakpoint
CREATE UNIQUE INDEX "provision_cycles_payable_idx" ON "provision_cycles" USING btree ("financial_expense_id");--> statement-breakpoint
ALTER TABLE "provision_cycles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "provision_cycles" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "provision_cycles_tenant_policy" ON "provision_cycles" FOR ALL
USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

CREATE UNIQUE INDEX "saas_subscriptions_organization_id_idx" ON "saas_subscriptions" USING btree ("organization_id","id");--> statement-breakpoint
CREATE TABLE "saas_subscription_charges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"competence" text NOT NULL,
	"charged_at" date NOT NULL,
	"due_date" date NOT NULL,
	"original_currency" text NOT NULL,
	"original_amount" numeric(12, 2) NOT NULL,
	"effective_exchange_rate" numeric(12, 6) NOT NULL,
	"principal_amount_brl" numeric(12, 2) NOT NULL,
	"iof_amount_brl" numeric(12, 2) DEFAULT '0' NOT NULL,
	"fee_amount_brl" numeric(12, 2) DEFAULT '0' NOT NULL,
	"total_amount_brl" numeric(12, 2) NOT NULL,
	"charges_included_in_total" boolean DEFAULT true NOT NULL,
	"financial_expense_id" uuid,
	"notes" text,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saas_subscription_charges_currency_check" CHECK ("saas_subscription_charges"."original_currency" in ('BRL','USD','EUR')),
	CONSTRAINT "saas_subscription_charges_competence_check" CHECK ("saas_subscription_charges"."competence" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "saas_subscription_charges_original_amount_check" CHECK ("saas_subscription_charges"."original_amount" > 0),
	CONSTRAINT "saas_subscription_charges_rate_check" CHECK ("saas_subscription_charges"."effective_exchange_rate" > 0),
	CONSTRAINT "saas_subscription_charges_principal_check" CHECK ("saas_subscription_charges"."principal_amount_brl" > 0),
	CONSTRAINT "saas_subscription_charges_iof_check" CHECK ("saas_subscription_charges"."iof_amount_brl" >= 0),
	CONSTRAINT "saas_subscription_charges_fee_check" CHECK ("saas_subscription_charges"."fee_amount_brl" >= 0),
	CONSTRAINT "saas_subscription_charges_total_check" CHECK ("saas_subscription_charges"."total_amount_brl" >= "saas_subscription_charges"."principal_amount_brl")
);
--> statement-breakpoint
ALTER TABLE "saas_subscription_charges" ADD CONSTRAINT "saas_subscription_charges_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_subscription_charges" ADD CONSTRAINT "saas_subscription_charges_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_subscription_charges" ADD CONSTRAINT "saas_subscription_charges_subscription_tenant_fk" FOREIGN KEY ("organization_id","subscription_id") REFERENCES "public"."saas_subscriptions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saas_subscription_charges" ADD CONSTRAINT "saas_subscription_charges_payable_tenant_fk" FOREIGN KEY ("organization_id","financial_expense_id") REFERENCES "public"."financial_expenses"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saas_subscription_charges_occurrence_idx" ON "saas_subscription_charges" USING btree ("organization_id","subscription_id","competence");--> statement-breakpoint
CREATE UNIQUE INDEX "saas_subscription_charges_payable_idx" ON "saas_subscription_charges" USING btree ("financial_expense_id");--> statement-breakpoint
ALTER TABLE "saas_subscription_charges" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "saas_subscription_charges" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "saas_subscription_charges_tenant_isolation" ON "saas_subscription_charges" FOR ALL
USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);

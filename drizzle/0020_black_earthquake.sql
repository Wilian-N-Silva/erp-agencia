CREATE TABLE "financial_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"method" text,
	"reference" text,
	"counterparty_name" text,
	"client_id" uuid,
	"supplier_id" uuid,
	"status" text DEFAULT 'pending_reconciliation' NOT NULL,
	"origin" text DEFAULT 'manual' NOT NULL,
	"import_metadata" jsonb,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_transactions_direction_check" CHECK ("financial_transactions"."direction" in ('in', 'out')),
	CONSTRAINT "financial_transactions_positive_amount_check" CHECK ("financial_transactions"."amount" > 0),
	CONSTRAINT "financial_transactions_status_check" CHECK ("financial_transactions"."status" in ('pending_reconciliation', 'partially_reconciled', 'reconciled', 'reversed')),
	CONSTRAINT "financial_transactions_origin_check" CHECK ("financial_transactions"."origin" in ('manual', 'import', 'legacy_backfill')),
	CONSTRAINT "financial_transactions_counterparty_check" CHECK (not ("financial_transactions"."client_id" is not null and "financial_transactions"."supplier_id" is not null)),
	CONSTRAINT "financial_transactions_direction_counterparty_check" CHECK (("financial_transactions"."direction" = 'in' and "financial_transactions"."supplier_id" is null) or ("financial_transactions"."direction" = 'out' and "financial_transactions"."client_id" is null))
);
--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_accounts_organization_id_idx" ON "financial_accounts" USING btree ("organization_id","id");--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_account_tenant_fk" FOREIGN KEY ("organization_id","account_id") REFERENCES "public"."financial_accounts"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_client_tenant_fk" FOREIGN KEY ("organization_id","client_id") REFERENCES "public"."clients"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_supplier_tenant_fk" FOREIGN KEY ("organization_id","supplier_id") REFERENCES "public"."suppliers"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_transactions_organization_id_idx" ON "financial_transactions" USING btree ("organization_id","id");--> statement-breakpoint
CREATE INDEX "financial_transactions_occurred_at_idx" ON "financial_transactions" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE INDEX "financial_transactions_status_idx" ON "financial_transactions" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "financial_transactions_account_idx" ON "financial_transactions" USING btree ("organization_id","account_id");--> statement-breakpoint

ALTER TABLE "financial_transactions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "financial_transactions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "financial_transactions_tenant_isolation" ON "financial_transactions"
FOR ALL TO PUBLIC
USING (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')::uuid
)
WITH CHECK (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')::uuid
);

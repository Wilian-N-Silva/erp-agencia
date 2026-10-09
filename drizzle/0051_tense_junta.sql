CREATE TABLE "financial_transaction_reversals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"reason" text NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" text NOT NULL,
	CONSTRAINT "financial_reversals_amount_check" CHECK ("financial_transaction_reversals"."amount" > 0),
	CONSTRAINT "financial_reversals_reason_check" CHECK (length(trim("financial_transaction_reversals"."reason")) >= 3)
);
--> statement-breakpoint
ALTER TABLE "financial_transaction_reversals" ADD CONSTRAINT "financial_transaction_reversals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transaction_reversals" ADD CONSTRAINT "financial_transaction_reversals_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_transaction_reversals" ADD CONSTRAINT "financial_reversals_transaction_tenant_fk" FOREIGN KEY ("organization_id","transaction_id") REFERENCES "public"."financial_transactions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_reversals_transaction_idx" ON "financial_transaction_reversals" USING btree ("organization_id","transaction_id");
--> statement-breakpoint
ALTER TABLE financial_transaction_reversals ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_transaction_reversals FORCE ROW LEVEL SECURITY;
CREATE POLICY financial_transaction_reversals_tenant_isolation ON financial_transaction_reversals FOR ALL
USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
--> statement-breakpoint
CREATE FUNCTION reject_financial_reversal_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Financial reversal history is immutable' USING ERRCODE = '55000'; END;
$$;
CREATE TRIGGER financial_reversals_immutable BEFORE UPDATE OR DELETE ON financial_transaction_reversals
FOR EACH ROW EXECUTE FUNCTION reject_financial_reversal_change();
--> statement-breakpoint
INSERT INTO permissions (key,description) VALUES ('finance.reverse','Estornar movimentacoes financeiras com motivo e auditoria') ON CONFLICT (key) DO NOTHING;
INSERT INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.key IN ('director','finance') AND p.key='finance.reverse' ON CONFLICT DO NOTHING;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION fin_004_guard_allocated_title_update() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE allocated_amount numeric;
BEGIN
  SELECT coalesce(sum(a.amount),0) INTO allocated_amount FROM financial_allocations a
  JOIN financial_transactions t ON t.id=a.transaction_id AND t.organization_id=a.organization_id
  WHERE a.organization_id=OLD.organization_id AND t.status <> 'reversed'
  AND ((TG_TABLE_NAME='financial_entries' AND a.financial_entry_id=OLD.id)
    OR (TG_TABLE_NAME='financial_expenses' AND a.financial_expense_id=OLD.id));
  IF allocated_amount > NEW.amount THEN
    RAISE EXCEPTION 'financial title amount cannot be lower than its allocations' USING ERRCODE='23514';
  END IF;
  IF allocated_amount > 0 AND (NEW.status='cancelled' OR NEW.deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'allocated financial title cannot be cancelled or deleted' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;

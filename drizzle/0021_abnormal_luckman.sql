CREATE TABLE "financial_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"transaction_id" uuid NOT NULL,
	"financial_entry_id" uuid,
	"financial_expense_id" uuid,
	"amount" numeric(14, 2) NOT NULL,
	"metadata" jsonb,
	"created_by_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "financial_allocations_positive_amount_check" CHECK ("financial_allocations"."amount" > 0),
	CONSTRAINT "financial_allocations_single_target_check" CHECK (("financial_allocations"."financial_entry_id" is not null) <> ("financial_allocations"."financial_expense_id" is not null))
);
--> statement-breakpoint
ALTER TABLE "financial_expenses" ADD COLUMN "paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "financial_entries_organization_id_idx" ON "financial_entries" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "financial_expenses_organization_id_idx" ON "financial_expenses" USING btree ("organization_id","id");--> statement-breakpoint
ALTER TABLE "financial_allocations" ADD CONSTRAINT "financial_allocations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_allocations" ADD CONSTRAINT "financial_allocations_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_allocations" ADD CONSTRAINT "financial_allocations_transaction_tenant_fk" FOREIGN KEY ("organization_id","transaction_id") REFERENCES "public"."financial_transactions"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_allocations" ADD CONSTRAINT "financial_allocations_entry_tenant_fk" FOREIGN KEY ("organization_id","financial_entry_id") REFERENCES "public"."financial_entries"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_allocations" ADD CONSTRAINT "financial_allocations_expense_tenant_fk" FOREIGN KEY ("organization_id","financial_expense_id") REFERENCES "public"."financial_expenses"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "financial_allocations_transaction_idx" ON "financial_allocations" USING btree ("organization_id","transaction_id");--> statement-breakpoint
CREATE INDEX "financial_allocations_entry_idx" ON "financial_allocations" USING btree ("organization_id","financial_entry_id");--> statement-breakpoint
CREATE INDEX "financial_allocations_expense_idx" ON "financial_allocations" USING btree ("organization_id","financial_expense_id");--> statement-breakpoint

UPDATE "financial_expenses"
SET "paid_amount" = "amount"
WHERE "status" = 'paid';--> statement-breakpoint

CREATE OR REPLACE FUNCTION validate_financial_allocation_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  transaction_amount numeric;
  transaction_direction text;
  transaction_allocated numeric;
  target_amount numeric;
  target_cached numeric;
  target_allocated numeric;
BEGIN
  SELECT amount, direction
  INTO transaction_amount, transaction_direction
  FROM financial_transactions
  WHERE organization_id = NEW.organization_id AND id = NEW.transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'financial allocation transaction is outside tenant scope'
      USING ERRCODE = '23503';
  END IF;

  SELECT coalesce(sum(amount), 0)
  INTO transaction_allocated
  FROM financial_allocations
  WHERE organization_id = NEW.organization_id
    AND transaction_id = NEW.transaction_id;

  IF transaction_allocated + NEW.amount > transaction_amount THEN
    RAISE EXCEPTION 'financial transaction over-allocation'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.financial_entry_id IS NOT NULL THEN
    IF transaction_direction <> 'in' THEN
      RAISE EXCEPTION 'outgoing transaction cannot be allocated to receivable'
        USING ERRCODE = '23514';
    END IF;

    SELECT amount,
      coalesce(received_amount, CASE WHEN status = 'received' THEN amount ELSE 0 END)
    INTO target_amount, target_cached
    FROM financial_entries
    WHERE organization_id = NEW.organization_id AND id = NEW.financial_entry_id
      AND deleted_at IS NULL AND status <> 'cancelled'
    FOR UPDATE;

    SELECT coalesce(sum(amount), 0)
    INTO target_allocated
    FROM financial_allocations
    WHERE organization_id = NEW.organization_id
      AND financial_entry_id = NEW.financial_entry_id;
  ELSE
    IF transaction_direction <> 'out' THEN
      RAISE EXCEPTION 'incoming transaction cannot be allocated to payable'
        USING ERRCODE = '23514';
    END IF;

    SELECT amount, paid_amount
    INTO target_amount, target_cached
    FROM financial_expenses
    WHERE organization_id = NEW.organization_id AND id = NEW.financial_expense_id
      AND deleted_at IS NULL AND status <> 'cancelled'
    FOR UPDATE;

    SELECT coalesce(sum(amount), 0)
    INTO target_allocated
    FROM financial_allocations
    WHERE organization_id = NEW.organization_id
      AND financial_expense_id = NEW.financial_expense_id;
  END IF;

  IF target_amount IS NULL THEN
    RAISE EXCEPTION 'financial allocation target is outside tenant scope or unavailable'
      USING ERRCODE = '23503';
  END IF;

  IF greatest(target_cached - target_allocated, 0) + target_allocated + NEW.amount > target_amount THEN
    RAISE EXCEPTION 'financial target over-allocation'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$function$;--> statement-breakpoint

CREATE TRIGGER financial_allocations_capacity_guard
BEFORE INSERT ON "financial_allocations"
FOR EACH ROW EXECUTE FUNCTION validate_financial_allocation_capacity();--> statement-breakpoint

ALTER TABLE "financial_allocations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "financial_allocations" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "financial_allocations_tenant_isolation" ON "financial_allocations"
FOR ALL TO PUBLIC
USING (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')::uuid
)
WITH CHECK (
  "organization_id" = nullif(current_setting('app.organization_id', true), '')::uuid
);--> statement-breakpoint

INSERT INTO "permissions" ("key", "description")
VALUES ('finance.settle', 'Alocar movimentacoes e liquidar titulos financeiros')
ON CONFLICT ("key") DO UPDATE SET "description" = excluded."description";--> statement-breakpoint

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT role."id", permission."id"
FROM "roles" AS role
CROSS JOIN "permissions" AS permission
WHERE role."key" IN ('technical_admin', 'director')
  AND permission."key" = 'finance.settle'
ON CONFLICT DO NOTHING;

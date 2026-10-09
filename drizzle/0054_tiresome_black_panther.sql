ALTER TABLE "financial_entries" ADD COLUMN "legacy_settled_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_expenses" ADD COLUMN "legacy_settled_amount" numeric(12, 2) DEFAULT '0' NOT NULL;
--> statement-breakpoint
LOCK TABLE financial_entries, financial_expenses, financial_allocations, financial_transactions IN ACCESS EXCLUSIVE MODE;
--> statement-breakpoint
UPDATE financial_entries e SET legacy_settled_amount = greatest(
  coalesce(e.received_amount, CASE WHEN e.status='received' THEN e.amount ELSE 0 END)
  - coalesce((select sum(a.amount) from financial_allocations a join financial_transactions t on t.id=a.transaction_id and t.organization_id=a.organization_id
    where a.organization_id=e.organization_id and a.financial_entry_id=e.id and t.status <> 'reversed'),0),0);
--> statement-breakpoint
UPDATE financial_expenses e SET legacy_settled_amount = greatest(
  CASE WHEN e.status='paid' AND e.paid_amount=0 THEN e.amount ELSE e.paid_amount END
  - coalesce((select sum(a.amount) from financial_allocations a join financial_transactions t on t.id=a.transaction_id and t.organization_id=a.organization_id
    where a.organization_id=e.organization_id and a.financial_expense_id=e.id and t.status <> 'reversed'),0),0);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION fin_004_guard_allocated_title_update() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE allocated_amount numeric;
BEGIN
  IF NEW.legacy_settled_amount IS DISTINCT FROM OLD.legacy_settled_amount THEN
    RAISE EXCEPTION 'Historical settlement baseline is immutable' USING ERRCODE='55000';
  END IF;
  SELECT coalesce(sum(a.amount),0) INTO allocated_amount FROM financial_allocations a
  JOIN financial_transactions t ON t.id=a.transaction_id AND t.organization_id=a.organization_id
  WHERE a.organization_id=OLD.organization_id AND t.status <> 'reversed'
    AND ((TG_TABLE_NAME='financial_entries' AND a.financial_entry_id=OLD.id)
      OR (TG_TABLE_NAME='financial_expenses' AND a.financial_expense_id=OLD.id));
  IF allocated_amount + OLD.legacy_settled_amount > NEW.amount THEN
    RAISE EXCEPTION 'financial title amount cannot be lower than its allocations and historical settlement' USING ERRCODE='23514';
  END IF;
  IF allocated_amount + OLD.legacy_settled_amount > 0 AND (NEW.status='cancelled' OR NEW.deleted_at IS NOT NULL) THEN
    RAISE EXCEPTION 'settled financial title cannot be cancelled or deleted' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
ALTER TABLE financial_entries ADD CONSTRAINT financial_entries_legacy_nonnegative CHECK (legacy_settled_amount >= 0);
--> statement-breakpoint
ALTER TABLE financial_expenses ADD CONSTRAINT financial_expenses_legacy_nonnegative CHECK (legacy_settled_amount >= 0);

--> statement-breakpoint
CREATE OR REPLACE FUNCTION validate_financial_allocation_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  transaction_amount numeric;
  transaction_direction text;
  transaction_status text;
  transaction_allocated numeric;
  target_amount numeric;
  target_legacy numeric;
  target_allocated numeric;
BEGIN
  SELECT amount, direction, status
  INTO transaction_amount, transaction_direction, transaction_status
  FROM financial_transactions
  WHERE organization_id = NEW.organization_id AND id = NEW.transaction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'financial allocation transaction is outside tenant scope'
      USING ERRCODE = '23503';
  END IF;

  IF transaction_status = 'reversed' THEN
    RAISE EXCEPTION 'reversed movement cannot receive allocations' USING ERRCODE='23514';
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
      legacy_settled_amount
    INTO target_amount, target_legacy
    FROM financial_entries
    WHERE organization_id = NEW.organization_id AND id = NEW.financial_entry_id
      AND deleted_at IS NULL AND status <> 'cancelled'
    FOR UPDATE;

    SELECT coalesce(sum(a.amount), 0) INTO target_allocated
    FROM financial_allocations a JOIN financial_transactions t ON t.id=a.transaction_id AND t.organization_id=a.organization_id
    WHERE a.organization_id=NEW.organization_id AND a.financial_entry_id=NEW.financial_entry_id AND t.status <> 'reversed';
  ELSE
    IF transaction_direction <> 'out' THEN
      RAISE EXCEPTION 'incoming transaction cannot be allocated to payable'
        USING ERRCODE = '23514';
    END IF;

    SELECT amount, legacy_settled_amount
    INTO target_amount, target_legacy
    FROM financial_expenses
    WHERE organization_id = NEW.organization_id AND id = NEW.financial_expense_id
      AND deleted_at IS NULL AND status <> 'cancelled'
    FOR UPDATE;

    SELECT coalesce(sum(a.amount), 0) INTO target_allocated
    FROM financial_allocations a JOIN financial_transactions t ON t.id=a.transaction_id AND t.organization_id=a.organization_id
    WHERE a.organization_id=NEW.organization_id AND a.financial_expense_id=NEW.financial_expense_id AND t.status <> 'reversed';
  END IF;

  IF target_amount IS NULL THEN
    RAISE EXCEPTION 'financial allocation target is outside tenant scope or unavailable'
      USING ERRCODE = '23503';
  END IF;

  IF target_legacy + target_allocated + NEW.amount > target_amount THEN
    RAISE EXCEPTION 'financial target over-allocation'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$function$;

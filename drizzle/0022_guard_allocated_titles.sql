CREATE FUNCTION "fin_004_guard_allocated_title_update"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
DECLARE
  allocated_amount numeric;
BEGIN
  IF TG_TABLE_NAME = 'financial_entries' THEN
    SELECT coalesce(sum(amount), 0)
    INTO allocated_amount
    FROM financial_allocations
    WHERE organization_id = OLD.organization_id
      AND financial_entry_id = OLD.id;
  ELSIF TG_TABLE_NAME = 'financial_expenses' THEN
    SELECT coalesce(sum(amount), 0)
    INTO allocated_amount
    FROM financial_allocations
    WHERE organization_id = OLD.organization_id
      AND financial_expense_id = OLD.id;
  ELSE
    RAISE EXCEPTION 'unsupported financial allocation target table: %', TG_TABLE_NAME;
  END IF;

  IF allocated_amount > NEW.amount THEN
    RAISE EXCEPTION 'financial title amount cannot be lower than its allocations'
      USING ERRCODE = '23514';
  END IF;

  IF allocated_amount > 0
    AND (NEW.status = 'cancelled' OR NEW.deleted_at IS NOT NULL)
  THEN
    RAISE EXCEPTION 'allocated financial title cannot be cancelled or deleted'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$$;--> statement-breakpoint

CREATE TRIGGER "financial_entries_allocated_title_guard"
BEFORE UPDATE OF "amount", "status", "deleted_at" ON "financial_entries"
FOR EACH ROW
EXECUTE FUNCTION "fin_004_guard_allocated_title_update"();--> statement-breakpoint

CREATE TRIGGER "financial_expenses_allocated_title_guard"
BEFORE UPDATE OF "amount", "status", "deleted_at" ON "financial_expenses"
FOR EACH ROW
EXECUTE FUNCTION "fin_004_guard_allocated_title_update"();

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
  target_cached numeric;
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
      coalesce(received_amount, CASE WHEN status = 'received' THEN amount ELSE 0 END)
    INTO target_amount, target_cached
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

    SELECT amount, paid_amount
    INTO target_amount, target_cached
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

  IF greatest(target_cached - target_allocated, 0) + target_allocated + NEW.amount > target_amount THEN
    RAISE EXCEPTION 'financial target over-allocation'
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END
$function$;

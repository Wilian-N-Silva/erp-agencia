CREATE OR REPLACE FUNCTION guard_financial_legacy_release() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
DECLARE reserved numeric;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Legacy review history is immutable' USING ERRCODE='55000'; END IF;
  IF NEW.organization_id IS DISTINCT FROM nullif(current_setting('app.organization_id', true), '')::uuid THEN
    RAISE EXCEPTION 'Legacy review organization is outside tenant scope' USING ERRCODE='42501';
  END IF;
  IF NEW.financial_entry_id IS NOT NULL THEN
    PERFORM 1 FROM financial_entries WHERE organization_id=NEW.organization_id AND id=NEW.financial_entry_id
      AND deleted_at IS NULL AND status <> 'cancelled' FOR UPDATE;
  ELSE
    PERFORM 1 FROM financial_expenses WHERE organization_id=NEW.organization_id AND id=NEW.financial_expense_id
      AND deleted_at IS NULL AND status <> 'cancelled' FOR UPDATE;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'Legacy review target is unavailable' USING ERRCODE='23503'; END IF;
  SELECT financial_legacy_reserved(NEW.organization_id, NEW.financial_entry_id, NEW.financial_expense_id) INTO reserved;
  IF NEW.amount > reserved THEN RAISE EXCEPTION 'Legacy release exceeds historical reserve' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;

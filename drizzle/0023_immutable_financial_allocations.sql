CREATE FUNCTION "fin_004_reject_financial_allocation_update"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path FROM CURRENT
AS $$
BEGIN
  RAISE EXCEPTION 'financial allocations are immutable'
    USING ERRCODE = '55000';
END
$$;--> statement-breakpoint

CREATE TRIGGER "financial_allocations_immutable_guard"
BEFORE UPDATE ON "financial_allocations"
FOR EACH ROW
EXECUTE FUNCTION "fin_004_reject_financial_allocation_update"();

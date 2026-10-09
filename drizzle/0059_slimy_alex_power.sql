ALTER TABLE "provision_cycles" DROP CONSTRAINT "provision_cycles_state_check";--> statement-breakpoint
ALTER TABLE "provision_cycles" ADD CONSTRAINT "provision_cycles_state_check" CHECK (("provision_cycles"."status" = 'planned' and "provision_cycles"."financial_expense_id" is null and "provision_cycles"."cancellation_reason" is null) or ("provision_cycles"."status" = 'realized' and "provision_cycles"."financial_expense_id" is not null and "provision_cycles"."cancellation_reason" is null) or ("provision_cycles"."status" = 'cancelled' and length(trim("provision_cycles"."cancellation_reason")) >= 5 and "provision_cycles"."cancellation_reason" is not null));
--> statement-breakpoint
CREATE FUNCTION guard_provision_payable_link() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF OLD.financial_expense_id IS NOT NULL AND NEW.financial_expense_id IS DISTINCT FROM OLD.financial_expense_id THEN
    RAISE EXCEPTION 'Realized provision payable link is immutable' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER provision_payable_link_guard BEFORE UPDATE OF financial_expense_id ON provision_cycles
FOR EACH ROW EXECUTE FUNCTION guard_provision_payable_link();
--> statement-breakpoint
CREATE FUNCTION validate_provision_payable_state() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM provision_cycles c JOIN financial_expenses e ON e.organization_id=c.organization_id AND e.id=c.financial_expense_id
    WHERE c.organization_id=NEW.organization_id
      AND ((TG_TABLE_NAME='provision_cycles' AND c.id=NEW.id) OR (TG_TABLE_NAME='financial_expenses' AND e.id=NEW.id))
      AND (e.deleted_at IS NOT NULL OR (c.status='cancelled') IS DISTINCT FROM (e.status='cancelled'))
  ) THEN RAISE EXCEPTION 'Provision and payable cancellation states must agree' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER provision_payable_state_guard AFTER INSERT OR UPDATE ON provision_cycles
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_provision_payable_state();
CREATE CONSTRAINT TRIGGER payable_provision_state_guard AFTER UPDATE ON financial_expenses
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_provision_payable_state();

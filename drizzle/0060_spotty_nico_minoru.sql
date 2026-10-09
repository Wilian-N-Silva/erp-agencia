DROP INDEX "saas_subscription_charges_occurrence_idx";--> statement-breakpoint
ALTER TABLE "saas_subscription_charges" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "saas_subscription_charges" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
CREATE UNIQUE INDEX "saas_subscription_charges_occurrence_idx" ON "saas_subscription_charges" USING btree ("organization_id","subscription_id","competence") WHERE "saas_subscription_charges"."cancelled_at" is null;--> statement-breakpoint
ALTER TABLE "saas_subscription_charges" ADD CONSTRAINT "saas_subscription_charges_cancellation_check" CHECK (("saas_subscription_charges"."cancelled_at" is null and "saas_subscription_charges"."cancellation_reason" is null) or ("saas_subscription_charges"."cancelled_at" is not null and "saas_subscription_charges"."cancellation_reason" is not null and length(trim("saas_subscription_charges"."cancellation_reason")) >= 5));
--> statement-breakpoint
-- Preserve the factual state of already-cancelled APs. This timestamp is the
-- migration observation, not an invented cancellation date/actor or cash event.
UPDATE saas_subscription_charges c SET cancelled_at=now(),
  cancellation_reason='AP vinculada já estava cancelada antes desta migração. Data é a observação da migração; autor original desconhecido.'
FROM financial_expenses e WHERE e.organization_id=c.organization_id AND e.id=c.financial_expense_id
  AND e.status='cancelled' AND c.cancelled_at IS NULL;
--> statement-breakpoint
CREATE FUNCTION guard_saas_charge_history() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id
    OR NEW.subscription_id IS DISTINCT FROM OLD.subscription_id
    OR NEW.competence IS DISTINCT FROM OLD.competence
    OR NEW.financial_expense_id IS DISTINCT FROM OLD.financial_expense_id THEN
    RAISE EXCEPTION 'SaaS charge origin and payable link are immutable' USING ERRCODE='55000';
  END IF;
  IF OLD.cancelled_at IS NOT NULL AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Cancelled SaaS charge is immutable' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER saas_charge_history_guard BEFORE UPDATE ON saas_subscription_charges
FOR EACH ROW EXECUTE FUNCTION guard_saas_charge_history();
--> statement-breakpoint
CREATE FUNCTION validate_saas_charge_payable_state() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM saas_subscription_charges c JOIN financial_expenses e ON e.organization_id=c.organization_id AND e.id=c.financial_expense_id
    WHERE c.organization_id=NEW.organization_id
      AND ((TG_TABLE_NAME='saas_subscription_charges' AND c.id=NEW.id) OR (TG_TABLE_NAME='financial_expenses' AND e.id=NEW.id))
      AND (e.deleted_at IS NOT NULL OR (c.cancelled_at IS NOT NULL) IS DISTINCT FROM (e.status='cancelled'))
  ) THEN RAISE EXCEPTION 'SaaS charge and payable cancellation states must agree' USING ERRCODE='23514'; END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER saas_charge_payable_state_guard AFTER INSERT OR UPDATE ON saas_subscription_charges
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_saas_charge_payable_state();
CREATE CONSTRAINT TRIGGER payable_saas_charge_state_guard AFTER UPDATE ON financial_expenses
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION validate_saas_charge_payable_state();
--> statement-breakpoint
CREATE FUNCTION guard_saas_subscription_financial_history() RETURNS trigger LANGUAGE plpgsql SET search_path FROM CURRENT AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND EXISTS (SELECT 1 FROM saas_subscription_charges c WHERE c.organization_id=NEW.organization_id AND c.subscription_id=NEW.id) THEN
    RAISE EXCEPTION 'Subscription with charge history cannot be archived' USING ERRCODE='55000';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER saas_subscription_financial_history_guard BEFORE UPDATE OF deleted_at ON saas_subscriptions
FOR EACH ROW EXECUTE FUNCTION guard_saas_subscription_financial_history();

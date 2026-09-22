ALTER TABLE graphic_reconciliation_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE graphic_reconciliation_suggestions FORCE ROW LEVEL SECURITY;
CREATE POLICY graphic_reconciliation_suggestions_tenant_isolation ON graphic_reconciliation_suggestions FOR ALL
USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
--> statement-breakpoint
CREATE FUNCTION protect_graphic_reconciliation_suggestion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Suggestion history cannot be deleted' USING ERRCODE = '23514'; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status <> 'pending' OR NEW.status NOT IN ('accepted','rejected') OR
      ROW(NEW.id,NEW.organization_id,NEW.job_id,NEW.transaction_id,NEW.entry_id,NEW.amount,NEW.reason,NEW.created_by_user_id,NEW.created_at)
      IS DISTINCT FROM ROW(OLD.id,OLD.organization_id,OLD.job_id,OLD.transaction_id,OLD.entry_id,OLD.amount,OLD.reason,OLD.created_by_user_id,OLD.created_at)
    THEN RAISE EXCEPTION 'Suggestion history is immutable' USING ERRCODE = '23514'; END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM graphic_sales s JOIN graphic_sale_installments i ON i.sale_id=s.id AND i.organization_id=s.organization_id
    WHERE s.organization_id=NEW.organization_id AND s.job_id=NEW.job_id AND i.entry_id=NEW.entry_id)
  THEN RAISE EXCEPTION 'Suggested entry must belong to the job' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER graphic_reconciliation_suggestions_history BEFORE INSERT OR UPDATE OR DELETE ON graphic_reconciliation_suggestions
FOR EACH ROW EXECUTE FUNCTION protect_graphic_reconciliation_suggestion();
--> statement-breakpoint
INSERT INTO permissions (key,description) VALUES ('graphics.reconcile_suggest','Sugerir vinculos de recebimentos com trabalhos da Grafica')
ON CONFLICT (key) DO UPDATE SET description=excluded.description;
INSERT INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.key IN ('technical_admin','director') AND p.key='graphics.reconcile_suggest' ON CONFLICT DO NOTHING;

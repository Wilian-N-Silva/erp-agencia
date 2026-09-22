ALTER TABLE graphic_client_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE graphic_client_decisions FORCE ROW LEVEL SECURITY;
CREATE POLICY graphic_client_decisions_tenant_isolation ON graphic_client_decisions FOR ALL
USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
--> statement-breakpoint
CREATE FUNCTION prevent_graphic_client_decision_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Client decisions are immutable' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER graphic_client_decisions_immutable BEFORE UPDATE OR DELETE ON graphic_client_decisions
FOR EACH ROW EXECUTE FUNCTION prevent_graphic_client_decision_mutation();
--> statement-breakpoint
INSERT INTO permissions (key, description) VALUES ('graphics.client_approval_write', 'Registrar a decisao do cliente sobre a OS da Grafica')
ON CONFLICT (key) DO UPDATE SET description = excluded.description;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.key IN ('technical_admin', 'director') AND p.key = 'graphics.client_approval_write'
ON CONFLICT DO NOTHING;

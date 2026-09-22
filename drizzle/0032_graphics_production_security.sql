ALTER TABLE graphic_production_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE graphic_production_events FORCE ROW LEVEL SECURITY;
CREATE POLICY graphic_production_events_tenant_isolation ON graphic_production_events FOR ALL
USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
--> statement-breakpoint
CREATE FUNCTION prevent_graphic_production_event_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Production events are immutable' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER graphic_production_events_immutable BEFORE UPDATE OR DELETE ON graphic_production_events
FOR EACH ROW EXECUTE FUNCTION prevent_graphic_production_event_mutation();
--> statement-breakpoint
INSERT INTO permissions (key, description) VALUES ('graphics.production_write', 'Registrar producao, bloqueios e entrega da Grafica')
ON CONFLICT (key) DO UPDATE SET description = excluded.description;
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r CROSS JOIN permissions p
WHERE r.key IN ('technical_admin', 'director') AND p.key = 'graphics.production_write'
ON CONFLICT DO NOTHING;

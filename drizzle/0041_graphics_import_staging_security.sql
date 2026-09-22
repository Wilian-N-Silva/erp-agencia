ALTER TABLE graphic_import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE graphic_import_batches FORCE ROW LEVEL SECURITY;
CREATE POLICY graphic_import_batches_tenant_isolation ON graphic_import_batches FOR ALL
USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE graphic_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE graphic_import_rows FORCE ROW LEVEL SECURITY;
CREATE POLICY graphic_import_rows_tenant_isolation ON graphic_import_rows FOR ALL
USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
--> statement-breakpoint
CREATE FUNCTION protect_graphic_import_provenance() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Import history cannot be deleted' USING ERRCODE = '23514'; END IF;
  IF TG_TABLE_NAME = 'graphic_import_batches' THEN
    IF ROW(NEW.id,NEW.organization_id,NEW.checksum,NEW.file_name,NEW.byte_size,NEW.mapping,NEW.created_by_user_id,NEW.created_at)
      IS DISTINCT FROM ROW(OLD.id,OLD.organization_id,OLD.checksum,OLD.file_name,OLD.byte_size,OLD.mapping,OLD.created_by_user_id,OLD.created_at)
    THEN RAISE EXCEPTION 'Import provenance is immutable' USING ERRCODE = '23514'; END IF;
  ELSE
    IF OLD.status IN ('imported','ignored') OR
      ROW(NEW.id,NEW.organization_id,NEW.batch_id,NEW.kind,NEW.source_sheet,NEW.source_row,NEW.raw,NEW.normalized,NEW.classification,NEW.issues)
      IS DISTINCT FROM ROW(OLD.id,OLD.organization_id,OLD.batch_id,OLD.kind,OLD.source_sheet,OLD.source_row,OLD.raw,OLD.normalized,OLD.classification,OLD.issues)
    THEN RAISE EXCEPTION 'Import provenance is immutable' USING ERRCODE = '23514'; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER graphic_import_batches_provenance BEFORE UPDATE OR DELETE ON graphic_import_batches FOR EACH ROW EXECUTE FUNCTION protect_graphic_import_provenance();
CREATE TRIGGER graphic_import_rows_provenance BEFORE UPDATE OR DELETE ON graphic_import_rows FOR EACH ROW EXECUTE FUNCTION protect_graphic_import_provenance();
--> statement-breakpoint
INSERT INTO permissions (key,description) VALUES ('graphics.import','Importar e revisar historico da Grafica')
ON CONFLICT (key) DO UPDATE SET description=excluded.description;
INSERT INTO role_permissions (role_id,permission_id) SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.key IN ('technical_admin','director') AND p.key='graphics.import' ON CONFLICT DO NOTHING;

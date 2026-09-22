ALTER TABLE graphic_supplier_commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE graphic_supplier_commitments FORCE ROW LEVEL SECURITY;
CREATE POLICY graphic_supplier_commitments_tenant_isolation ON graphic_supplier_commitments FOR ALL
USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
--> statement-breakpoint
CREATE FUNCTION prevent_graphic_supplier_commitment_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Supplier commitments are immutable' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER graphic_supplier_commitments_immutable BEFORE UPDATE OR DELETE ON graphic_supplier_commitments
FOR EACH ROW EXECUTE FUNCTION prevent_graphic_supplier_commitment_mutation();

ALTER TABLE graphic_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE graphic_sales FORCE ROW LEVEL SECURITY;
CREATE POLICY graphic_sales_tenant_isolation ON graphic_sales FOR ALL
USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
ALTER TABLE graphic_sale_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE graphic_sale_installments FORCE ROW LEVEL SECURITY;
CREATE POLICY graphic_sale_installments_tenant_isolation ON graphic_sale_installments FOR ALL
USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
--> statement-breakpoint
CREATE FUNCTION prevent_graphic_sale_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Sale origin records are immutable' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER graphic_sales_immutable BEFORE UPDATE OR DELETE ON graphic_sales
FOR EACH ROW EXECUTE FUNCTION prevent_graphic_sale_mutation();
CREATE TRIGGER graphic_sale_installments_immutable BEFORE UPDATE OR DELETE ON graphic_sale_installments
FOR EACH ROW EXECUTE FUNCTION prevent_graphic_sale_mutation();

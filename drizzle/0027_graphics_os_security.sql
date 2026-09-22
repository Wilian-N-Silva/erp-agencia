-- Custom SQL migration file, put your code below! --
ALTER TABLE "graphic_os_versions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "graphic_os_versions" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "graphic_os_versions_tenant_policy" ON "graphic_os_versions"
FOR ALL USING (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid)
WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), '')::uuid);
--> statement-breakpoint
CREATE FUNCTION "grf_005_preserve_os_version"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'OS versions are immutable; register a new version' USING ERRCODE = '23514';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "graphic_os_versions_immutable" BEFORE UPDATE OR DELETE ON "graphic_os_versions"
FOR EACH ROW EXECUTE FUNCTION "grf_005_preserve_os_version"();

-- Custom SQL migration file, put your code below! --
ALTER POLICY "graphic_os_versions_tenant_policy" ON "graphic_os_versions"
RENAME TO "graphic_os_versions_tenant_isolation";

-- SEC-003: tenant RLS baseline.
-- Auth/bootstrap and global RBAC exceptions are intentionally not included here;
-- the complete inventory lives in src/lib/db/rls-policy-matrix.ts.

DO $$
DECLARE
  direct_tenant_tables CONSTANT text[] := ARRAY[
    'access_records',
    'alerts',
    'app_settings',
    'areas',
    'audit_logs',
    'client_billing_profiles',
    'client_payment_reminders',
    'clients',
    'compensation_history',
    'documents',
    'employee_benefits',
    'employees',
    'equipment',
    'files',
    'financial_entries',
    'financial_expenses',
    'invoice_requests',
    'lifecycle_checklists',
    'positions',
    'provisions',
    'reimbursement_requests',
    'saas_subscriptions',
    'time_off_requests',
    'vacation_balances'
  ];
  tenant_table text;
BEGIN
  FOREACH tenant_table IN ARRAY direct_tenant_tables LOOP
    EXECUTE format(
      'ALTER TABLE %I ENABLE ROW LEVEL SECURITY',
      tenant_table
    );
    EXECUTE format(
      'ALTER TABLE %I FORCE ROW LEVEL SECURITY',
      tenant_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO PUBLIC
       USING (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)
       WITH CHECK (organization_id = nullif(current_setting(''app.organization_id'', true), '''')::uuid)',
      tenant_table || '_tenant_isolation',
      tenant_table
    );
  END LOOP;
END
$$;
--> statement-breakpoint

-- Child tables derive their tenant from a protected parent and must not remain
-- directly queryable outside that tenant.
ALTER TABLE invoice_request_items ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE invoice_request_items FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY invoice_request_items_tenant_isolation
ON invoice_request_items
FOR ALL TO PUBLIC
USING (
  EXISTS (
    SELECT 1
    FROM invoice_requests AS tenant_parent
    WHERE tenant_parent.id = invoice_request_id
      AND tenant_parent.organization_id =
        nullif(current_setting('app.organization_id', true), '')::uuid
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM invoice_requests AS tenant_parent
    WHERE tenant_parent.id = invoice_request_id
      AND tenant_parent.organization_id =
        nullif(current_setting('app.organization_id', true), '')::uuid
  )
);--> statement-breakpoint

ALTER TABLE lifecycle_checklist_items ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE lifecycle_checklist_items FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY lifecycle_checklist_items_tenant_isolation
ON lifecycle_checklist_items
FOR ALL TO PUBLIC
USING (
  EXISTS (
    SELECT 1
    FROM lifecycle_checklists AS tenant_parent
    WHERE tenant_parent.id = checklist_id
      AND tenant_parent.organization_id =
        nullif(current_setting('app.organization_id', true), '')::uuid
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM lifecycle_checklists AS tenant_parent
    WHERE tenant_parent.id = checklist_id
      AND tenant_parent.organization_id =
        nullif(current_setting('app.organization_id', true), '')::uuid
  )
);--> statement-breakpoint

ALTER TABLE saas_subscription_users ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE saas_subscription_users FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY saas_subscription_users_tenant_isolation
ON saas_subscription_users
FOR ALL TO PUBLIC
USING (
  EXISTS (
    SELECT 1
    FROM saas_subscriptions AS tenant_parent
    WHERE tenant_parent.id = subscription_id
      AND tenant_parent.organization_id =
        nullif(current_setting('app.organization_id', true), '')::uuid
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM saas_subscriptions AS tenant_parent
    WHERE tenant_parent.id = subscription_id
      AND tenant_parent.organization_id =
        nullif(current_setting('app.organization_id', true), '')::uuid
  )
);

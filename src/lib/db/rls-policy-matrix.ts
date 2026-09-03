export const directTenantPolicyTables = [
  "access_invitations",
  "access_records",
  "alerts",
  "app_settings",
  "areas",
  "audit_logs",
  "client_billing_profiles",
  "client_payment_reminders",
  "clients",
  "compensation_history",
  "cost_centers",
  "documents",
  "employee_benefits",
  "employees",
  "equipment",
  "files",
  "financial_entries",
  "financial_expenses",
  "financial_accounts",
  "financial_categories",
  "graphic_jobs",
  "graphic_projects",
  "invoice_requests",
  "lifecycle_checklists",
  "positions",
  "provisions",
  "reimbursement_requests",
  "saas_subscriptions",
  "suppliers",
  "time_off_requests",
  "vacation_balances",
  "work_items",
] as const;

export const inheritedTenantPolicyTables = {
  invoice_request_items: "invoice_requests",
  lifecycle_checklist_items: "lifecycle_checklists",
  saas_subscription_users: "saas_subscriptions",
} as const;

export const rlsExemptTables = {
  account: "Better Auth bootstrap table",
  organizations: "organization bootstrap before tenant context exists",
  permissions: "global RBAC catalog",
  rate_limit_buckets:
    "internal hashed counters required before tenant context and shared across instances",
  role_permissions: "global RBAC catalog relationship",
  roles: "global RBAC catalog",
  session: "Better Auth bootstrap table",
  user: "Better Auth identity table used before tenant context exists",
  user_roles: "RBAC bootstrap relationship used to build AccessContext",
  verification: "Better Auth bootstrap table",
} as const;

export const tenantPolicyTables = [
  ...directTenantPolicyTables,
  ...Object.keys(inheritedTenantPolicyTables),
] as const;

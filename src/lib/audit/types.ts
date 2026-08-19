export const auditActions = [
  "auth.login",
  "auth.logout",
  "auth.denied",
  "create",
  "update",
  "delete",
  "export",
  "sensitive_read",
  "approve",
  "reject",
  "status_change",
  "permission_change",
  "rate_limit_exceeded",
] as const;

export type AuditAction = (typeof auditActions)[number];

export type AuditEntityType =
  | "user"
  | "role"
  | "permission"
  | "employee"
  | "client"
  | "financial_entry"
  | "financial_expense"
  | "provision"
  | "file"
  | "invoice_request"
  | "reimbursement_request"
  | "time_off_request"
  | "equipment"
  | "access_record"
  | "saas_subscription"
  | "lifecycle_checklist"
  | "lifecycle_checklist_item"
  | "alert"
  | (string & {});

export type AuditJson =
  | null
  | string
  | number
  | boolean
  | AuditJson[]
  | { [key: string]: AuditJson };

export type AuditSnapshot = Record<string, AuditJson> | null;

export type AuditLogInput = {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export type RequestAuditMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

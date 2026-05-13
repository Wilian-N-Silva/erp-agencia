import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const employeeStatusEnum = pgEnum("employee_status", [
  "active",
  "on_vacation",
  "away",
  "notice",
  "terminated",
  "paused",
  "occasional_freelancer",
]);

export const employmentTypeEnum = pgEnum("employment_type", [
  "clt",
  "pj",
  "intern",
  "freelancer",
  "partner",
  "temporary",
  "other",
]);

export const financialEntryStatusEnum = pgEnum("financial_entry_status", [
  "planned",
  "received",
  "overdue",
  "cancelled",
]);

export const financialExpenseStatusEnum = pgEnum("financial_expense_status", [
  "planned",
  "paid",
  "overdue",
  "cancelled",
]);

export const clientStatusEnum = pgEnum("client_status", [
  "active",
  "paused",
  "cancelled",
]);

export const invoiceRequestStatusEnum = pgEnum("invoice_request_status", [
  "draft",
  "published",
  "submitted",
  "under_review",
  "adjustment_requested",
  "approved",
  "rejected",
  "paid",
  "cancelled",
]);

export const reimbursementStatusEnum = pgEnum("reimbursement_status", [
  "draft",
  "submitted",
  "manager_approved",
  "manager_rejected",
  "finance_approved",
  "finance_rejected",
  "included_in_invoice",
  "paid",
  "cancelled",
]);

export const timeOffStatusEnum = pgEnum("time_off_status", [
  "requested",
  "approved",
  "rejected",
  "cancelled",
]);

export const fileSensitivityEnum = pgEnum("file_sensitivity", [
  "public_internal",
  "restricted",
  "sensitive",
  "highly_sensitive",
]);

export const alertStatusEnum = pgEnum("alert_status", [
  "open",
  "resolved",
  "dismissed",
]);

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    organizationId: uuid("organization_id").references(() => organizations.id),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex("users_email_idx").on(table.email),
    organizationIdx: index("users_organization_idx").on(table.organizationId),
  }),
);

export const accounts = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    idToken: text("id_token"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("accounts_user_id_idx").on(table.userId),
    providerAccountIdx: uniqueIndex("accounts_provider_account_idx").on(
      table.providerId,
      table.accountId,
    ),
  }),
);

export const sessions = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("sessions_user_id_idx").on(table.userId),
  }),
);

export const verifications = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  key: text("key").notNull().unique(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "cascade" }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.roleId, table.permissionId] }),
  }),
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    assignedByUserId: text("assigned_by_user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.roleId] }),
  }),
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    actorUserId: text("actor_user_id").references(() => users.id),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    before: jsonb("before"),
    after: jsonb("after"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    organizationIdx: index("audit_logs_organization_idx").on(table.organizationId),
    actorIdx: index("audit_logs_actor_idx").on(table.actorUserId),
    entityIdx: index("audit_logs_entity_idx").on(table.entityType, table.entityId),
  }),
);

export const areas = pgTable(
  "areas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueName: uniqueIndex("areas_org_name_idx").on(table.organizationId, table.name),
  }),
);

export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    uniqueName: uniqueIndex("positions_org_name_idx").on(table.organizationId, table.name),
  }),
);

export const employees = pgTable(
  "employees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    userId: text("user_id").references(() => users.id),
    registrationNumber: text("registration_number").notNull(),
    fullName: text("full_name").notNull(),
    socialName: text("social_name"),
    corporateEmail: text("corporate_email"),
    personalEmail: text("personal_email"),
    phone: text("phone"),
    cpf: text("cpf"),
    rg: text("rg"),
    birthDate: date("birth_date"),
    address: text("address"),
    pix: text("pix"),
    emergencyContact: text("emergency_contact"),
    positionId: uuid("position_id")
      .notNull()
      .references(() => positions.id),
    areaId: uuid("area_id")
      .notNull()
      .references(() => areas.id),
    managerEmployeeId: uuid("manager_employee_id"),
    employmentType: employmentTypeEnum("employment_type").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    status: employeeStatusEnum("status").notNull().default("active"),
    workModel: text("work_model"),
    location: text("location"),
    currentCompensation: numeric("current_compensation", {
      precision: 12,
      scale: 2,
    }).notNull(),
    recurringCostAllowance: numeric("recurring_cost_allowance", {
      precision: 12,
      scale: 2,
    }),
    recurringTransport: numeric("recurring_transport", {
      precision: 12,
      scale: 2,
    }),
    internalNotes: text("internal_notes"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    registrationIdx: uniqueIndex("employees_registration_idx").on(
      table.organizationId,
      table.registrationNumber,
    ),
    cpfIdx: uniqueIndex("employees_cpf_idx").on(table.organizationId, table.cpf),
    corporateEmailIdx: uniqueIndex("employees_corporate_email_idx").on(
      table.organizationId,
      table.corporateEmail,
    ),
    userIdx: index("employees_user_idx").on(table.userId),
    statusIdx: index("employees_status_idx").on(table.organizationId, table.status),
  }),
);

export const compensationHistory = pgTable(
  "compensation_history",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    previousAmount: numeric("previous_amount", { precision: 12, scale: 2 }).notNull(),
    newAmount: numeric("new_amount", { precision: 12, scale: 2 }).notNull(),
    differenceAmount: numeric("difference_amount", { precision: 12, scale: 2 }).notNull(),
    effectiveDate: date("effective_date").notNull(),
    reason: text("reason").notNull(),
    approvedByUserId: text("approved_by_user_id")
      .notNull()
      .references(() => users.id),
    documentFileId: uuid("document_file_id").references(() => files.id),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    employeeIdx: index("compensation_history_employee_idx").on(table.employeeId),
    organizationIdx: index("compensation_history_organization_idx").on(
      table.organizationId,
      table.effectiveDate,
    ),
  }),
);

export const employeeBenefits = pgTable(
  "employee_benefits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    benefitType: text("benefit_type").notNull(),
    name: text("name").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    recurring: boolean("recurring").notNull().default(true),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    employeeIdx: index("employee_benefits_employee_idx").on(table.employeeId),
    statusIdx: index("employee_benefits_status_idx").on(table.organizationId, table.status),
  }),
);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    code: text("code").notNull(),
    status: clientStatusEnum("status").notNull().default("active"),
    monthlyFee: numeric("monthly_fee", { precision: 12, scale: 2 }).notNull(),
    billingDay: integer("billing_day").notNull(),
    internalOwnerEmployeeId: uuid("internal_owner_employee_id").references(() => employees.id),
    billingMethod: text("billing_method"),
    notes: text("notes"),
    startDate: date("start_date"),
    cancellationDate: date("cancellation_date"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    codeIdx: uniqueIndex("clients_code_idx").on(table.organizationId, table.code),
    statusIdx: index("clients_status_idx").on(table.organizationId, table.status),
  }),
);

export const clientBillingProfiles = pgTable(
  "client_billing_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    monthlyFee: numeric("monthly_fee", { precision: 12, scale: 2 }).notNull(),
    billingDay: integer("billing_day").notNull(),
    paymentMethod: text("payment_method"),
    paymentTermsDays: integer("payment_terms_days").notNull().default(0),
    recurrence: text("recurrence").notNull().default("monthly"),
    autoGenerateEntries: boolean("auto_generate_entries").notNull().default(false),
    financialContactName: text("financial_contact_name"),
    financialEmail: text("financial_email"),
    financialPhone: text("financial_phone"),
    billingOwnerEmployeeId: uuid("billing_owner_employee_id").references(() => employees.id),
    reminderBeforeDays: integer("reminder_before_days").notNull().default(3),
    reminderAfterDays: integer("reminder_after_days").notNull().default(1),
    notes: text("notes"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdx: uniqueIndex("client_billing_profiles_client_idx").on(table.clientId),
    organizationIdx: index("client_billing_profiles_organization_idx").on(table.organizationId),
  }),
);

export const financialEntries = pgTable(
  "financial_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    clientId: uuid("client_id").references(() => clients.id),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    receivedAmount: numeric("received_amount", { precision: 12, scale: 2 }),
    dueDate: date("due_date").notNull(),
    receivedDate: date("received_date"),
    paymentMethod: text("payment_method"),
    competence: text("competence").notNull(),
    status: financialEntryStatusEnum("status").notNull().default("planned"),
    recurring: boolean("recurring").notNull().default(false),
    notes: text("notes"),
    responsibleUserId: text("responsible_user_id")
      .notNull()
      .references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dueDateIdx: index("financial_entries_due_date_idx").on(table.organizationId, table.dueDate),
    statusIdx: index("financial_entries_status_idx").on(table.organizationId, table.status),
    competenceIdx: index("financial_entries_competence_idx").on(
      table.organizationId,
      table.competence,
    ),
  }),
);

export const clientPaymentReminders = pgTable(
  "client_payment_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    financialEntryId: uuid("financial_entry_id").references(() => financialEntries.id, {
      onDelete: "cascade",
    }),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    dueDate: date("due_date"),
    status: text("status").notNull().default("open"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    clientIdx: index("client_payment_reminders_client_idx").on(table.clientId),
    statusIdx: index("client_payment_reminders_status_idx").on(
      table.organizationId,
      table.status,
    ),
    entryKindIdx: uniqueIndex("client_payment_reminders_entry_kind_idx").on(
      table.financialEntryId,
      table.kind,
    ),
  }),
);

export const financialExpenses = pgTable(
  "financial_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    supplier: text("supplier").notNull(),
    category: text("category").notNull(),
    subcategory: text("subcategory"),
    description: text("description").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    dueDate: date("due_date").notNull(),
    paidDate: date("paid_date"),
    competence: text("competence").notNull(),
    status: financialExpenseStatusEnum("status").notNull().default("planned"),
    costCenter: text("cost_center"),
    recurring: boolean("recurring").notNull().default(false),
    notes: text("notes"),
    responsibleUserId: text("responsible_user_id")
      .notNull()
      .references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dueDateIdx: index("financial_expenses_due_date_idx").on(table.organizationId, table.dueDate),
    statusIdx: index("financial_expenses_status_idx").on(table.organizationId, table.status),
    competenceIdx: index("financial_expenses_competence_idx").on(
      table.organizationId,
      table.competence,
    ),
  }),
);

export const provisions = pgTable(
  "provisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    category: text("category").notNull(),
    estimatedMonthlyAmount: numeric("estimated_monthly_amount", {
      precision: 12,
      scale: 2,
    }).notNull(),
    expectedDay: integer("expected_day"),
    recurring: boolean("recurring").notNull().default(true),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    categoryIdx: index("provisions_category_idx").on(table.organizationId, table.category),
  }),
);

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    ownerEmployeeId: uuid("owner_employee_id").references(() => employees.id),
    storageProvider: text("storage_provider").notNull(),
    bucket: text("bucket"),
    storageKey: text("storage_key").notNull(),
    originalName: text("original_name").notNull(),
    mimeType: text("mime_type").notNull(),
    extension: text("extension").notNull(),
    byteSize: integer("byte_size").notNull(),
    sensitivity: fileSensitivityEnum("sensitivity").notNull().default("restricted"),
    checksum: text("checksum"),
    uploadedByUserId: text("uploaded_by_user_id")
      .notNull()
      .references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("files_owner_idx").on(table.ownerEmployeeId),
    storageIdx: uniqueIndex("files_storage_idx").on(table.storageProvider, table.storageKey),
  }),
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    ownerType: text("owner_type").notNull(),
    ownerId: text("owner_id").notNull(),
    documentType: text("document_type").notNull(),
    fileId: uuid("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    visibility: text("visibility").notNull().default("restricted"),
    version: integer("version").notNull().default(1),
    status: text("status").notNull().default("active"),
    uploadedByUserId: text("uploaded_by_user_id")
      .notNull()
      .references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("documents_owner_idx").on(table.organizationId, table.ownerType, table.ownerId),
    fileIdx: uniqueIndex("documents_file_idx").on(table.fileId),
    statusIdx: index("documents_status_idx").on(table.organizationId, table.status),
  }),
);

export const invoiceRequests = pgTable(
  "invoice_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    competence: text("competence").notNull(),
    dueDate: date("due_date").notNull(),
    expectedAmount: numeric("expected_amount", { precision: 12, scale: 2 }).notNull(),
    issuedAmount: numeric("issued_amount", { precision: 12, scale: 2 }),
    suggestedDescription: text("suggested_description").notNull(),
    status: invoiceRequestStatusEnum("status").notNull().default("draft"),
    fileId: uuid("file_id").references(() => files.id),
    approvedByUserId: text("approved_by_user_id").references(() => users.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => users.id),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    employeeCompetenceIdx: uniqueIndex("invoice_requests_employee_competence_idx").on(
      table.employeeId,
      table.competence,
    ),
    statusIdx: index("invoice_requests_status_idx").on(table.organizationId, table.status),
  }),
);

export const invoiceRequestItems = pgTable(
  "invoice_request_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceRequestId: uuid("invoice_request_id")
      .notNull()
      .references(() => invoiceRequests.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    kind: text("kind").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (table) => ({
    invoiceIdx: index("invoice_request_items_invoice_idx").on(table.invoiceRequestId),
  }),
);

export const reimbursementRequests = pgTable(
  "reimbursement_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    title: text("title").notNull(),
    category: text("category").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    expenseDate: date("expense_date").notNull(),
    status: reimbursementStatusEnum("status").notNull().default("draft"),
    fileId: uuid("file_id").references(() => files.id),
    managerApproverUserId: text("manager_approver_user_id").references(() => users.id),
    financeApproverUserId: text("finance_approver_user_id").references(() => users.id),
    includedInvoiceRequestId: uuid("included_invoice_request_id").references(
      () => invoiceRequests.id,
    ),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    employeeIdx: index("reimbursements_employee_idx").on(table.employeeId),
    statusIdx: index("reimbursements_status_idx").on(table.organizationId, table.status),
  }),
);

export const timeOffRequests = pgTable(
  "time_off_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    type: text("type").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    businessDays: integer("business_days").notNull(),
    soldDays: integer("sold_days").notNull().default(0),
    status: timeOffStatusEnum("status").notNull().default("requested"),
    requestedByUserId: text("requested_by_user_id")
      .notNull()
      .references(() => users.id),
    approvedByUserId: text("approved_by_user_id").references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    employeeIdx: index("time_off_employee_idx").on(table.employeeId),
    dateIdx: index("time_off_date_idx").on(table.organizationId, table.startDate),
  }),
);

export const equipment = pgTable(
  "equipment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    assetNumber: text("asset_number").notNull(),
    type: text("type").notNull(),
    brand: text("brand"),
    model: text("model"),
    serialNumber: text("serial_number"),
    status: text("status").notNull().default("available"),
    currentEmployeeId: uuid("current_employee_id").references(() => employees.id),
    notes: text("notes"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    assetIdx: uniqueIndex("equipment_asset_idx").on(table.organizationId, table.assetNumber),
    statusIdx: index("equipment_status_idx").on(table.organizationId, table.status),
  }),
);

export const accessRecords = pgTable(
  "access_records",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    platform: text("platform").notNull(),
    accountIdentifier: text("account_identifier"),
    accessLevel: text("access_level").notNull(),
    critical: boolean("critical").notNull().default(false),
    status: text("status").notNull().default("active"),
    reviewDueDate: date("review_due_date"),
    removedAt: timestamp("removed_at", { withTimezone: true }),
    responsibleUserId: text("responsible_user_id").references(() => users.id),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    employeeIdx: index("access_records_employee_idx").on(table.employeeId),
    statusIdx: index("access_records_status_idx").on(table.organizationId, table.status),
  }),
);

export const saasSubscriptions = pgTable(
  "saas_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    name: text("name").notNull(),
    category: text("category").notNull(),
    provider: text("provider"),
    monthlyCost: numeric("monthly_cost", { precision: 12, scale: 2 }),
    renewalDate: date("renewal_date"),
    status: text("status").notNull().default("active"),
    responsibleUserId: text("responsible_user_id").references(() => users.id),
    notes: text("notes"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("saas_status_idx").on(table.organizationId, table.status),
    renewalIdx: index("saas_renewal_idx").on(table.organizationId, table.renewalDate),
  }),
);

export const saasSubscriptionUsers = pgTable(
  "saas_subscription_users",
  {
    subscriptionId: uuid("subscription_id")
      .notNull()
      .references(() => saasSubscriptions.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("active"),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
    unlinkedAt: timestamp("unlinked_at", { withTimezone: true }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.subscriptionId, table.employeeId] }),
  }),
);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    title: text("title").notNull(),
    description: text("description"),
    severity: text("severity").notNull().default("medium"),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    status: alertStatusEnum("status").notNull().default("open"),
    dueDate: date("due_date"),
    resolvedByUserId: text("resolved_by_user_id").references(() => users.id),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("alerts_status_idx").on(table.organizationId, table.status),
    severityIdx: index("alerts_severity_idx").on(table.organizationId, table.severity),
  }),
);

export type User = typeof users.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

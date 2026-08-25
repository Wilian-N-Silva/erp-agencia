import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { canReadAuditLogs } from "@/lib/audit";
import { bindTenantContext, db } from "@/lib/db";
import {
  auditLogs,
  clientBillingProfiles,
  clientPaymentReminders,
  clients,
  employees,
  financialEntries,
  users,
} from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan, assertCanAny } from "@/lib/rbac";

import {
  applyClientFilters,
  buildClientReminderCandidates,
  canGenerateClientExpectedEntry,
  canReadClientFinancialValues,
  clientReminderKindLabels,
  getClientMonthlyFinancialStatus,
  getClientPaymentStatus,
  getNextClientBillingDueDate,
  getOutstandingPaymentAmount,
  getClientListScope,
  toClientListItem,
  type ClientFilters,
  type ClientFinancialStatus,
  type ClientListItem,
  type ClientReminderTarget,
  type ClientReminderKind,
} from "./rules";
import {
  centsToMoney,
  moneyToCents,
  type FinancialEntryStatus,
} from "@/features/finance/rules";

export type ClientOwnerOption = {
  id: string;
  name: string;
};

export type ClientDetail = ClientListItem & {
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ClientBillingProfileDetail = {
  id: string | null;
  isConfigured: boolean;
  monthlyFee: string | null;
  billingDay: number | null;
  paymentMethod: string | null;
  paymentTermsDays: number;
  recurrence: string;
  autoGenerateEntries: boolean;
  financialContactName: string | null;
  financialEmail: string | null;
  financialPhone: string | null;
  billingOwnerEmployeeId: string | null;
  reminderBeforeDays: number;
  reminderAfterDays: number;
  notes: string | null;
  valueHidden: boolean;
};

export type ClientPaymentListItem = {
  id: string;
  description: string;
  competence: string;
  dueDate: string;
  amount: string | null;
  receivedAmount: string | null;
  paymentMethod: string | null;
  status: ClientFinancialStatus;
  entryStatus: FinancialEntryStatus;
  receivedDate: string | null;
  recurring: boolean;
  notes: string | null;
  valueHidden: boolean;
};

export type ClientBillingSummary = {
  financialStatus: ClientFinancialStatus;
  nextDueDate: string | null;
  defaultPaymentMethod: string | null;
  lastPaymentDate: string | null;
  totalOverdue: string | null;
  openChargesCount: number;
  canGenerateExpectedEntry: boolean;
  valueHidden: boolean;
};

export type ClientPaymentReminderItem = {
  id: string | null;
  clientId: string;
  clientName: string;
  financialEntryId: string | null;
  kind: ClientReminderKind;
  title: string;
  description: string | null;
  dueDate: string | null;
  severity: "low" | "medium" | "high";
  createdAt: Date | null;
};

export type ClientAuditLogItem = {
  id: string;
  action: string;
  actorName: string | null;
  actorEmail: string | null;
  metadata: unknown;
  createdAt: Date;
};

async function listClients(
  context: AccessContext,
  filters: ClientFilters = {},
): Promise<ClientListItem[]> {
  assertCanAny(["clients.read", "clients.read_limited", "clients.configure"], context);
  const organizationId = requireOrganizationId(context);
  const scope = getClientListScope(context);

  if (scope === "none" || (scope === "owned" && !context.employeeId)) {
    return [];
  }

  const whereClause =
    scope === "owned"
      ? and(
          eq(clients.organizationId, organizationId),
          eq(clients.internalOwnerEmployeeId, context.employeeId as string),
          isNull(clients.deletedAt),
        )
      : and(eq(clients.organizationId, organizationId), isNull(clients.deletedAt));

  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      code: clients.code,
      status: clients.status,
      monthlyFee: clients.monthlyFee,
      billingDay: clients.billingDay,
      internalOwnerEmployeeId: clients.internalOwnerEmployeeId,
      internalOwnerName: employees.fullName,
      billingMethod: clients.billingMethod,
      startDate: clients.startDate,
      cancellationDate: clients.cancellationDate,
    })
    .from(clients)
    .leftJoin(employees, eq(clients.internalOwnerEmployeeId, employees.id))
    .where(whereClause)
    .orderBy(asc(clients.name));

  return applyClientFilters(
    rows.map((row) => toClientListItem(row, context)),
    filters,
  );
}

async function getClientDetail(
  context: AccessContext,
  id: string,
): Promise<ClientDetail | null> {
  assertCanAny(["clients.read", "clients.read_limited", "clients.configure"], context);
  const organizationId = requireOrganizationId(context);
  const scope = getClientListScope(context);

  if (scope === "none" || (scope === "owned" && !context.employeeId)) {
    return null;
  }

  const whereClause =
    scope === "owned"
      ? and(
          eq(clients.id, id),
          eq(clients.organizationId, organizationId),
          eq(clients.internalOwnerEmployeeId, context.employeeId as string),
          isNull(clients.deletedAt),
        )
      : and(eq(clients.id, id), eq(clients.organizationId, organizationId), isNull(clients.deletedAt));

  const [row] = await db
    .select({
      id: clients.id,
      name: clients.name,
      code: clients.code,
      status: clients.status,
      monthlyFee: clients.monthlyFee,
      billingDay: clients.billingDay,
      internalOwnerEmployeeId: clients.internalOwnerEmployeeId,
      internalOwnerName: employees.fullName,
      billingMethod: clients.billingMethod,
      notes: clients.notes,
      startDate: clients.startDate,
      cancellationDate: clients.cancellationDate,
      createdAt: clients.createdAt,
      updatedAt: clients.updatedAt,
    })
    .from(clients)
    .leftJoin(employees, eq(clients.internalOwnerEmployeeId, employees.id))
    .where(whereClause)
    .limit(1);

  if (!row) {
    return null;
  }

  return {
    ...toClientListItem(row, context),
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function getClientBillingProfile(
  context: AccessContext,
  clientId: string,
): Promise<ClientBillingProfileDetail | null> {
  const client = await getClientDetail(context, clientId);

  if (!client) {
    return null;
  }

  const organizationId = requireOrganizationId(context);
  const [profile] = await db
    .select({
      id: clientBillingProfiles.id,
      monthlyFee: clientBillingProfiles.monthlyFee,
      billingDay: clientBillingProfiles.billingDay,
      paymentMethod: clientBillingProfiles.paymentMethod,
      paymentTermsDays: clientBillingProfiles.paymentTermsDays,
      recurrence: clientBillingProfiles.recurrence,
      autoGenerateEntries: clientBillingProfiles.autoGenerateEntries,
      financialContactName: clientBillingProfiles.financialContactName,
      financialEmail: clientBillingProfiles.financialEmail,
      financialPhone: clientBillingProfiles.financialPhone,
      billingOwnerEmployeeId: clientBillingProfiles.billingOwnerEmployeeId,
      reminderBeforeDays: clientBillingProfiles.reminderBeforeDays,
      reminderAfterDays: clientBillingProfiles.reminderAfterDays,
      notes: clientBillingProfiles.notes,
    })
    .from(clientBillingProfiles)
    .where(
      and(
        eq(clientBillingProfiles.organizationId, organizationId),
        eq(clientBillingProfiles.clientId, clientId),
        isNull(clientBillingProfiles.deletedAt),
      ),
    )
    .limit(1);
  const valueHidden = !canReadClientFinancialValues(context);
  const isConfigured = Boolean(
    profile || (client.monthlyFee !== null && client.billingDay !== null),
  );

  return {
    id: profile?.id ?? null,
    isConfigured,
    monthlyFee: valueHidden ? null : (profile?.monthlyFee ?? client.monthlyFee),
    billingDay: profile?.billingDay ?? client.billingDay,
    paymentMethod: profile?.paymentMethod ?? client.billingMethod,
    paymentTermsDays: profile?.paymentTermsDays ?? 0,
    recurrence: profile?.recurrence ?? "monthly",
    autoGenerateEntries: profile?.autoGenerateEntries ?? false,
    financialContactName: profile?.financialContactName ?? null,
    financialEmail: profile?.financialEmail ?? null,
    financialPhone: profile?.financialPhone ?? null,
    billingOwnerEmployeeId: profile?.billingOwnerEmployeeId ?? client.internalOwnerEmployeeId,
    reminderBeforeDays: profile?.reminderBeforeDays ?? 3,
    reminderAfterDays: profile?.reminderAfterDays ?? 1,
    notes: profile?.notes ?? null,
    valueHidden,
  };
}

async function listClientPayments(
  context: AccessContext,
  clientId: string,
  options: { asOf?: Date | string } = {},
): Promise<ClientPaymentListItem[]> {
  const client = await getClientDetail(context, clientId);

  if (!client) {
    return [];
  }

  if (!canReadClientFinancialValues(context)) {
    return [];
  }

  const organizationId = requireOrganizationId(context);
  const asOf = options.asOf ?? new Date();
  const rows = await db
    .select({
      id: financialEntries.id,
      description: financialEntries.description,
      amount: financialEntries.amount,
      receivedAmount: financialEntries.receivedAmount,
      dueDate: financialEntries.dueDate,
      receivedDate: financialEntries.receivedDate,
      paymentMethod: financialEntries.paymentMethod,
      competence: financialEntries.competence,
      status: financialEntries.status,
      recurring: financialEntries.recurring,
      notes: financialEntries.notes,
    })
    .from(financialEntries)
    .where(
      and(
        eq(financialEntries.organizationId, organizationId),
        eq(financialEntries.clientId, clientId),
        isNull(financialEntries.deletedAt),
      ),
    )
    .orderBy(desc(financialEntries.dueDate), asc(financialEntries.description));

  return rows.map((row) => ({
    ...row,
    amount: row.amount,
    receivedAmount: row.receivedAmount,
    status: getClientPaymentStatus(row, asOf),
    entryStatus: row.status,
    valueHidden: false,
  }));
}

async function getClientBillingSummary(
  context: AccessContext,
  clientId: string,
  options: { asOf?: Date | string } = {},
): Promise<ClientBillingSummary | null> {
  const client = await getClientDetail(context, clientId);
  const profile = await getClientBillingProfile(context, clientId);

  if (!client || !profile) {
    return null;
  }

  const valueHidden = !canReadClientFinancialValues(context);
  const nextDueDate =
    profile.isConfigured && profile.billingDay !== null
      ? getNextClientBillingDueDate(
          {
            billingDay: profile.billingDay,
            paymentTermsDays: profile.paymentTermsDays,
          },
          options.asOf ?? new Date(),
        )
      : null;

  if (valueHidden) {
    return {
      financialStatus: "restricted",
      nextDueDate,
      defaultPaymentMethod: profile.paymentMethod,
      lastPaymentDate: null,
      totalOverdue: null,
      openChargesCount: 0,
      canGenerateExpectedEntry: false,
      valueHidden,
    };
  }

  const payments = await listClientPayments(context, clientId, options);
  const totalOverdueCents = payments
    .filter((payment) => payment.status === "overdue" && payment.amount)
    .reduce((total, payment) => {
      if (!payment.amount) {
        return total;
      }

      return total + moneyToCents(getOutstandingPaymentAmount({
        amount: payment.amount,
        receivedAmount: payment.receivedAmount,
        dueDate: payment.dueDate,
        receivedDate: payment.receivedDate,
        status: payment.entryStatus,
      }));
    }, 0);
  const lastPaymentDate =
    payments
      .map((payment) => payment.receivedDate)
      .filter((date): date is string => Boolean(date))
      .sort()
      .at(-1) ?? null;

  return {
    financialStatus: getClientMonthlyFinancialStatus(
      payments.map((payment) => ({
        amount: payment.amount ?? "0.00",
        receivedAmount: payment.receivedAmount,
        dueDate: payment.dueDate,
        receivedDate: payment.receivedDate,
        status: payment.entryStatus,
      })),
      options.asOf ?? new Date(),
    ),
    nextDueDate,
    defaultPaymentMethod: profile.paymentMethod,
    lastPaymentDate,
    totalOverdue: centsToMoney(totalOverdueCents),
    openChargesCount: payments.filter((payment) =>
      ["planned", "due_today", "overdue", "partial"].includes(payment.status),
    ).length,
    canGenerateExpectedEntry: canGenerateClientExpectedEntry({
      billingDay: profile.billingDay,
      clientStatus: client.status,
      monthlyFee: profile.monthlyFee,
      paymentTermsDays: profile.paymentTermsDays,
    }),
    valueHidden,
  };
}

async function listClientPaymentReminders(
  context: AccessContext,
  clientId: string,
  options: { asOf?: Date | string; limit?: number } = {},
): Promise<ClientPaymentReminderItem[]> {
  const client = await getClientDetail(context, clientId);
  const profile = await getClientBillingProfile(context, clientId);

  if (!client || !profile || !canReadClientFinancialValues(context)) {
    return [];
  }

  const organizationId = requireOrganizationId(context);
  const [payments, storedReminders] = await Promise.all([
    listClientPayments(context, clientId, { asOf: options.asOf }),
    db
      .select({
        id: clientPaymentReminders.id,
        financialEntryId: clientPaymentReminders.financialEntryId,
        kind: clientPaymentReminders.kind,
        title: clientPaymentReminders.title,
        description: clientPaymentReminders.description,
        dueDate: clientPaymentReminders.dueDate,
        createdAt: clientPaymentReminders.createdAt,
      })
      .from(clientPaymentReminders)
      .where(
        and(
          eq(clientPaymentReminders.organizationId, organizationId),
          eq(clientPaymentReminders.clientId, clientId),
          eq(clientPaymentReminders.status, "open"),
        ),
      )
      .orderBy(asc(clientPaymentReminders.dueDate), desc(clientPaymentReminders.createdAt)),
  ]);
  const candidates = buildClientReminderCandidates({
    asOf: options.asOf,
    reminderBeforeDays: profile.reminderBeforeDays,
    payments: payments
      .filter((payment): payment is ClientPaymentListItem & { amount: string } =>
        Boolean(payment.amount),
      )
      .map((payment) => ({
        id: payment.id,
        clientName: client.name,
        amount: payment.amount,
        receivedAmount: payment.receivedAmount,
        dueDate: payment.dueDate,
        receivedDate: payment.receivedDate,
        status: payment.entryStatus,
      })),
  });
  const remindersByKey = new Map<string, ClientPaymentReminderItem>();

  for (const candidate of candidates) {
    remindersByKey.set(reminderKey(candidate.financialEntryId, candidate.kind), {
      ...candidate,
      id: null,
      clientId: client.id,
      clientName: client.name,
      createdAt: null,
    });
  }

  for (const reminder of storedReminders) {
    if (!isClientReminderKind(reminder.kind)) {
      continue;
    }

    remindersByKey.set(reminderKey(reminder.financialEntryId, reminder.kind), {
      id: reminder.id,
      clientId: client.id,
      clientName: client.name,
      financialEntryId: reminder.financialEntryId,
      kind: reminder.kind,
      title: reminder.title,
      description: reminder.description,
      dueDate: reminder.dueDate,
      severity: getReminderSeverity(reminder.kind),
      createdAt: reminder.createdAt,
    });
  }

  return [...remindersByKey.values()]
    .sort(compareReminders)
    .slice(0, options.limit ?? 20);
}

async function listClientPaymentAlerts(
  context: AccessContext,
  options: { asOf?: Date | string; limit?: number } = {},
): Promise<ClientPaymentReminderItem[]> {
  assertCan("finance.read", context);
  const organizationId = requireOrganizationId(context);
  const asOf = options.asOf ?? new Date();
  const rows = await db
    .select({
      clientId: clients.id,
      clientName: clients.name,
      reminderBeforeDays: clientBillingProfiles.reminderBeforeDays,
      entryId: financialEntries.id,
      amount: financialEntries.amount,
      receivedAmount: financialEntries.receivedAmount,
      dueDate: financialEntries.dueDate,
      receivedDate: financialEntries.receivedDate,
      status: financialEntries.status,
    })
    .from(financialEntries)
    .innerJoin(clients, eq(financialEntries.clientId, clients.id))
    .leftJoin(
      clientBillingProfiles,
      and(
        eq(clientBillingProfiles.clientId, clients.id),
        isNull(clientBillingProfiles.deletedAt),
      ),
    )
    .where(
      and(
        eq(financialEntries.organizationId, organizationId),
        isNull(financialEntries.deletedAt),
        isNull(clients.deletedAt),
      ),
    )
    .orderBy(asc(financialEntries.dueDate));
  const grouped = new Map<
    string,
    {
      clientName: string;
      reminderBeforeDays: number | null;
      payments: ClientReminderTarget[];
    }
  >();

  for (const row of rows) {
    const group = grouped.get(row.clientId) ?? {
      clientName: row.clientName,
      reminderBeforeDays: row.reminderBeforeDays,
      payments: [],
    };

    group.payments.push({
      id: row.entryId,
      clientName: row.clientName,
      amount: row.amount,
      receivedAmount: row.receivedAmount,
      dueDate: row.dueDate,
      receivedDate: row.receivedDate,
      status: row.status,
    });
    grouped.set(row.clientId, group);
  }

  return [...grouped.entries()]
    .flatMap(([clientId, group]) =>
      buildClientReminderCandidates({
        asOf,
        reminderBeforeDays: group.reminderBeforeDays,
        payments: group.payments,
      }).map((candidate) => ({
        ...candidate,
        id: null,
        clientId,
        clientName: group.clientName,
        createdAt: null,
      })),
    )
    .sort(compareReminders)
    .slice(0, options.limit ?? 8);
}

async function listClientOwnerOptions(
  context: AccessContext,
): Promise<ClientOwnerOption[]> {
  assertCanAny(["clients.write", "clients.configure"], context);
  const organizationId = requireOrganizationId(context);

  const rows = await db
    .select({
      id: employees.id,
      name: employees.fullName,
    })
    .from(employees)
    .where(and(eq(employees.organizationId, organizationId), isNull(employees.deletedAt)))
    .orderBy(asc(employees.fullName));

  return rows;
}

async function listClientAuditLogs(
  context: AccessContext,
  clientId: string,
  options: { limit?: number } = {},
): Promise<ClientAuditLogItem[]> {
  if (!canReadAuditLogs(context)) {
    return [];
  }

  const organizationId = requireOrganizationId(context);

  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      actorName: users.name,
      actorEmail: users.email,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(
      and(
        eq(auditLogs.organizationId, organizationId),
        eq(auditLogs.entityType, "client"),
        eq(auditLogs.entityId, clientId),
      ),
    )
    .orderBy(desc(auditLogs.createdAt))
    .limit(options.limit ?? 10);
}

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return context.organizationId;
}

function isClientReminderKind(value: string): value is ClientReminderKind {
  return Object.keys(clientReminderKindLabels).includes(value);
}

function reminderKey(financialEntryId: string | null, kind: ClientReminderKind) {
  return `${financialEntryId ?? "client"}:${kind}`;
}

function getReminderSeverity(kind: ClientReminderKind): "low" | "medium" | "high" {
  if (kind === "overdue" || kind === "multiple_open") {
    return "high";
  }

  if (kind === "partial_payment" || kind === "due_today") {
    return "medium";
  }

  return "low";
}

function compareReminders(
  first: ClientPaymentReminderItem,
  second: ClientPaymentReminderItem,
) {
  const severityOrder = { high: 0, medium: 1, low: 2 };
  const severityDelta =
    severityOrder[first.severity] - severityOrder[second.severity];

  if (severityDelta !== 0) {
    return severityDelta;
  }

  return (first.dueDate ?? "9999-12-31").localeCompare(
    second.dueDate ?? "9999-12-31",
  );
}

export {
  tenantListClients as listClients,
  tenantGetClientDetail as getClientDetail,
  tenantGetClientBillingProfile as getClientBillingProfile,
  tenantListClientPayments as listClientPayments,
  tenantGetClientBillingSummary as getClientBillingSummary,
  tenantListClientPaymentReminders as listClientPaymentReminders,
  tenantListClientPaymentAlerts as listClientPaymentAlerts,
  tenantListClientOwnerOptions as listClientOwnerOptions,
  tenantListClientAuditLogs as listClientAuditLogs,
};

const tenantListClients = bindTenantContext(listClients);
const tenantGetClientDetail = bindTenantContext(getClientDetail);
const tenantGetClientBillingProfile = bindTenantContext(getClientBillingProfile);
const tenantListClientPayments = bindTenantContext(listClientPayments);
const tenantGetClientBillingSummary = bindTenantContext(getClientBillingSummary);
const tenantListClientPaymentReminders = bindTenantContext(listClientPaymentReminders);
const tenantListClientPaymentAlerts = bindTenantContext(listClientPaymentAlerts);
const tenantListClientOwnerOptions = bindTenantContext(listClientOwnerOptions);
const tenantListClientAuditLogs = bindTenantContext(listClientAuditLogs);

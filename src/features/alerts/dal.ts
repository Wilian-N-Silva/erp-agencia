import { and, asc, desc, eq, isNull } from "drizzle-orm";

import { bindTenantContext, db } from "@/lib/db";
import {
  alerts,
  clientBillingProfiles,
  clients,
  employees,
  equipment,
  financialEntries,
  financialExpenses,
  invoiceRequests,
  lifecycleChecklists,
  reimbursementRequests,
  saasSubscriptionUsers,
  saasSubscriptions,
  timeOffRequests,
  users,
  vacationBalances,
} from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

import { buildClientReminderCandidates } from "@/features/clients/rules";
import {
  addDaysToDateKey,
  getFinancialExpenseEffectiveStatus,
  toDateKey,
} from "@/features/finance/rules";
import { getLifecycleChecklistState } from "@/features/lifecycle/rules";
import { hasInvoiceDivergence, type InvoiceRequestStatus, type ReimbursementStatus } from "@/features/portal/rules";
import { isEquipmentReturnAlert, type EquipmentStatus } from "@/features/equipment/rules";
import { getSaasRenewalState, type SaasSubscriptionStatus } from "@/features/saas/rules";
import {
  calculateAvailableBalance,
  calculatePeriodTakenDays,
  isVacationExpired,
  isVacationExpiring,
  type TimeOffStatus,
  type VacationBalanceStatus,
} from "@/features/timeoff/rules";

import {
  applyAlertFilters,
  dedupeAlertCandidates,
  getUpcomingBirthdayMatch,
  mapReminderSeverity,
  sortAlertCandidates,
  type AlertCandidate,
  type AlertFilters,
  type AlertSeverity,
  type AlertStatus,
} from "./rules";

export type StoredAlertListItem = {
  id: string;
  title: string;
  description: string | null;
  severity: AlertSeverity;
  entityType: string;
  entityId: string | null;
  status: AlertStatus;
  dueDate: string | null;
  resolvedByUserName: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

async function listStoredAlerts(
  context: AccessContext,
  filters: AlertFilters = {},
): Promise<StoredAlertListItem[]> {
  assertCanAny(["alerts.read", "alerts.write"], context);
  const organizationId = requireOrganizationId(context);
  const rows = await db
    .select({
      id: alerts.id,
      title: alerts.title,
      description: alerts.description,
      severity: alerts.severity,
      entityType: alerts.entityType,
      entityId: alerts.entityId,
      status: alerts.status,
      dueDate: alerts.dueDate,
      resolvedByUserName: users.name,
      resolvedAt: alerts.resolvedAt,
      createdAt: alerts.createdAt,
      updatedAt: alerts.updatedAt,
    })
    .from(alerts)
    .leftJoin(users, eq(alerts.resolvedByUserId, users.id))
    .where(eq(alerts.organizationId, organizationId))
    .orderBy(desc(alerts.createdAt));

  return applyAlertFilters(
    rows.map((row) => ({
      ...row,
      severity: row.severity as AlertSeverity,
      status: row.status as AlertStatus,
    })),
    filters,
  );
}

async function listAlertCandidates(
  context: AccessContext,
  filters: AlertFilters = {},
): Promise<AlertCandidate[]> {
  assertCanAny(["alerts.read", "alerts.write"], context);
  const candidates = await generateAlertCandidatesForOrganization(context);

  return applyAlertFilters(
    sortAlertCandidates(dedupeAlertCandidates(candidates)),
    {
      ...filters,
      status: "all",
    },
  );
}

async function generateAlertCandidatesForOrganization(
  context: AccessContext,
  asOf: string | Date = new Date(),
): Promise<AlertCandidate[]> {
  const organizationId = requireOrganizationId(context);
  const asOfKey = toDateKey(asOf);
  const [
    clientCandidates,
    expenseCandidates,
    invoiceCandidates,
    reimbursementCandidates,
    timeOffCandidates,
    vacationBalanceCandidates,
    lifecycleCandidates,
    equipmentCandidates,
    saasCandidates,
    birthdayCandidates,
  ] = await Promise.all([
    buildClientPaymentAlertCandidates(organizationId, asOfKey),
    buildFinancialExpenseAlertCandidates(organizationId, asOfKey),
    buildInvoiceAlertCandidates(organizationId),
    buildReimbursementAlertCandidates(organizationId),
    buildTimeOffAlertCandidates(organizationId, asOfKey),
    buildVacationBalanceAlertCandidates(organizationId, asOfKey),
    buildLifecycleAlertCandidates(organizationId, asOfKey),
    buildEquipmentAlertCandidates(organizationId),
    buildSaasAlertCandidates(organizationId, asOfKey),
    buildBirthdayAlertCandidates(organizationId, asOfKey),
  ]);

  return sortAlertCandidates(
    dedupeAlertCandidates([
      ...clientCandidates,
      ...expenseCandidates,
      ...invoiceCandidates,
      ...reimbursementCandidates,
      ...timeOffCandidates,
      ...vacationBalanceCandidates,
      ...lifecycleCandidates,
      ...equipmentCandidates,
      ...saasCandidates,
      ...birthdayCandidates,
    ]),
  );
}

async function buildBirthdayAlertCandidates(
  organizationId: string,
  asOf: string,
): Promise<AlertCandidate[]> {
  const rows = await db
    .select({
      id: employees.id,
      fullName: employees.fullName,
      birthDate: employees.birthDate,
      status: employees.status,
    })
    .from(employees)
    .where(and(eq(employees.organizationId, organizationId), isNull(employees.deletedAt)));

  return rows
    .map((row): AlertCandidate | null => {
      if (row.status === "terminated") {
        return null;
      }

      const match = getUpcomingBirthdayMatch(row.birthDate, asOf);

      if (!match) {
        return null;
      }

      const when =
        match.daysUntil === 0
          ? "hoje"
          : match.daysUntil === 1
            ? "amanha"
            : `em ${match.daysUntil} dias`;

      return {
        kind: "birthday",
        title: `${row.fullName}: aniversario ${when}`,
        description: `Aniversario na semana (${match.occursOn}).`,
        severity: "low",
        entityType: "employee",
        entityId: row.id,
        dueDate: match.occursOn,
      };
    })
    .filter(isAlertCandidate);
}

async function buildVacationBalanceAlertCandidates(
  organizationId: string,
  asOf: string,
): Promise<AlertCandidate[]> {
  const balances = await db
    .select({
      id: vacationBalances.id,
      employeeId: vacationBalances.employeeId,
      employeeName: employees.fullName,
      periodStart: vacationBalances.periodStart,
      concessionDeadline: vacationBalances.concessionDeadline,
      daysAcquired: vacationBalances.daysAcquired,
      daysSold: vacationBalances.daysSold,
      status: vacationBalances.status,
    })
    .from(vacationBalances)
    .innerJoin(employees, eq(vacationBalances.employeeId, employees.id))
    .where(and(eq(vacationBalances.organizationId, organizationId), isNull(vacationBalances.deletedAt)));

  if (balances.length === 0) {
    return [];
  }

  const employeeIds = Array.from(new Set(balances.map((row) => row.employeeId)));
  const requestRows = await db
    .select({
      employeeId: timeOffRequests.employeeId,
      startDate: timeOffRequests.startDate,
      endDate: timeOffRequests.endDate,
      status: timeOffRequests.status,
      type: timeOffRequests.type,
    })
    .from(timeOffRequests)
    .where(eq(timeOffRequests.organizationId, organizationId));
  const requestsByEmployee = new Map<
    string,
    { startDate: string; endDate: string; status: TimeOffStatus; type: string }[]
  >();

  for (const row of requestRows) {
    if (!employeeIds.includes(row.employeeId)) {
      continue;
    }

    const list = requestsByEmployee.get(row.employeeId) ?? [];

    list.push({
      startDate: row.startDate,
      endDate: row.endDate,
      status: row.status as TimeOffStatus,
      type: row.type,
    });
    requestsByEmployee.set(row.employeeId, list);
  }

  return balances
    .map((row): AlertCandidate | null => {
      if ((row.status as VacationBalanceStatus) !== "active") {
        return null;
      }

      const requests = requestsByEmployee.get(row.employeeId) ?? [];
      const daysTaken = calculatePeriodTakenDays(
        { periodStart: row.periodStart, concessionDeadline: row.concessionDeadline },
        requests,
      );
      const daysAvailable = calculateAvailableBalance({
        daysAcquired: row.daysAcquired,
        daysSold: row.daysSold,
        daysTaken,
      });

      if (daysAvailable <= 0) {
        return null;
      }

      if (isVacationExpired({ concessionDeadline: row.concessionDeadline, availableBalance: daysAvailable, today: asOf })) {
        return {
          kind: "vacation_expiring",
          title: `${row.employeeName}: ferias vencidas`,
          description: `Saldo de ${daysAvailable} dias com concessao expirada em ${row.concessionDeadline}.`,
          severity: "high",
          entityType: "vacation_balance",
          entityId: row.id,
          dueDate: row.concessionDeadline,
        };
      }

      if (isVacationExpiring({ concessionDeadline: row.concessionDeadline, today: asOf })) {
        return {
          kind: "vacation_expiring",
          title: `${row.employeeName}: ferias proximas do vencimento`,
          description: `Saldo de ${daysAvailable} dias com concessao ate ${row.concessionDeadline}.`,
          severity: "medium",
          entityType: "vacation_balance",
          entityId: row.id,
          dueDate: row.concessionDeadline,
        };
      }

      return null;
    })
    .filter(isAlertCandidate);
}

async function buildClientPaymentAlertCandidates(
  organizationId: string,
  asOf: string,
): Promise<AlertCandidate[]> {
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
      and(eq(clientBillingProfiles.clientId, clients.id), isNull(clientBillingProfiles.deletedAt)),
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
      payments: {
        id: string;
        clientName: string;
        amount: string;
        receivedAmount: string | null;
        dueDate: string;
        receivedDate: string | null;
        status: "planned" | "received" | "overdue" | "cancelled";
      }[];
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

  return [...grouped.entries()].flatMap(([clientId, group]) =>
    buildClientReminderCandidates({
      asOf,
      reminderBeforeDays: group.reminderBeforeDays,
      payments: group.payments,
    }).map((candidate) => ({
      description: candidate.description,
      dueDate: candidate.dueDate,
      entityId: candidate.financialEntryId ?? clientId,
      entityType: candidate.financialEntryId ? "financial_entry" : "client",
      kind: "client_payment",
      severity: mapReminderSeverity(candidate.severity),
      title: candidate.title,
    })),
  );
}

async function buildFinancialExpenseAlertCandidates(
  organizationId: string,
  asOf: string,
): Promise<AlertCandidate[]> {
  const rows = await db
    .select({
      id: financialExpenses.id,
      supplier: financialExpenses.supplier,
      description: financialExpenses.description,
      dueDate: financialExpenses.dueDate,
      paidDate: financialExpenses.paidDate,
      status: financialExpenses.status,
    })
    .from(financialExpenses)
    .where(and(eq(financialExpenses.organizationId, organizationId), isNull(financialExpenses.deletedAt)));

  return rows
    .map((row): AlertCandidate | null => {
      const status = getFinancialExpenseEffectiveStatus(row, asOf);

      if (status !== "overdue") {
        return null;
      }

      return {
        kind: "financial_expense",
        title: `${row.supplier}: conta atrasada`,
        description: row.description,
        severity: "high",
        entityType: "financial_expense",
        entityId: row.id,
        dueDate: row.dueDate,
      };
    })
    .filter(isAlertCandidate);
}

async function buildInvoiceAlertCandidates(organizationId: string): Promise<AlertCandidate[]> {
  const rows = await db
    .select({
      id: invoiceRequests.id,
      employeeName: employees.fullName,
      competence: invoiceRequests.competence,
      dueDate: invoiceRequests.dueDate,
      expectedAmount: invoiceRequests.expectedAmount,
      issuedAmount: invoiceRequests.issuedAmount,
      status: invoiceRequests.status,
    })
    .from(invoiceRequests)
    .innerJoin(employees, eq(invoiceRequests.employeeId, employees.id))
    .where(and(eq(invoiceRequests.organizationId, organizationId), isNull(invoiceRequests.deletedAt)));

  return rows
    .map((row): AlertCandidate | null => {
      const status = row.status as InvoiceRequestStatus;

      if (hasInvoiceDivergence(row.expectedAmount, row.issuedAmount)) {
        return {
          kind: "invoice_pending",
          title: `${row.employeeName}: NF com divergencia`,
          description: `Competencia ${row.competence} com valor emitido diferente do esperado.`,
          severity: "high",
          entityType: "invoice_request",
          entityId: row.id,
          dueDate: row.dueDate,
        };
      }

      if (status === "published" || status === "adjustment_requested") {
        return {
          kind: "invoice_pending",
          title: `${row.employeeName}: NF aguardando envio`,
          description: `Competencia ${row.competence} ainda nao enviada pelo colaborador.`,
          severity: "medium",
          entityType: "invoice_request",
          entityId: row.id,
          dueDate: row.dueDate,
        };
      }

      if (status === "submitted" || status === "under_review") {
        return {
          kind: "invoice_pending",
          title: `${row.employeeName}: NF aguardando financeiro`,
          description: `Competencia ${row.competence} precisa de conferencia.`,
          severity: "medium",
          entityType: "invoice_request",
          entityId: row.id,
          dueDate: row.dueDate,
        };
      }

      return null;
    })
    .filter(isAlertCandidate);
}

async function buildReimbursementAlertCandidates(organizationId: string): Promise<AlertCandidate[]> {
  const rows = await db
    .select({
      id: reimbursementRequests.id,
      employeeName: employees.fullName,
      title: reimbursementRequests.title,
      expenseDate: reimbursementRequests.expenseDate,
      status: reimbursementRequests.status,
    })
    .from(reimbursementRequests)
    .innerJoin(employees, eq(reimbursementRequests.employeeId, employees.id))
    .where(eq(reimbursementRequests.organizationId, organizationId));

  return rows
    .map((row): AlertCandidate | null => {
      const status = row.status as ReimbursementStatus;

      if (!["submitted", "manager_approved", "finance_approved"].includes(status)) {
        return null;
      }

      return {
        kind: "reimbursement_pending",
        title: `${row.employeeName}: reembolso pendente`,
        description: `${row.title} esta em status ${status}.`,
        severity: status === "finance_approved" ? "medium" : "low",
        entityType: "reimbursement_request",
        entityId: row.id,
        dueDate: row.expenseDate,
      };
    })
    .filter(isAlertCandidate);
}

async function buildTimeOffAlertCandidates(
  organizationId: string,
  asOf: string,
): Promise<AlertCandidate[]> {
  const rows = await db
    .select({
      id: timeOffRequests.id,
      employeeName: employees.fullName,
      startDate: timeOffRequests.startDate,
      status: timeOffRequests.status,
      type: timeOffRequests.type,
    })
    .from(timeOffRequests)
    .innerJoin(employees, eq(timeOffRequests.employeeId, employees.id))
    .where(eq(timeOffRequests.organizationId, organizationId));
  const dueSoonLimit = addDaysToDateKey(asOf, 30);

  return rows
    .map((row): AlertCandidate | null => {
      if (row.status === "requested" && row.startDate < asOf) {
        return {
          kind: "timeoff_pending",
          title: `${row.employeeName}: solicitacao de ferias/pausa vencida`,
          description: `${row.type} tem inicio anterior a hoje e ainda nao foi aprovada.`,
          severity: "high",
          entityType: "time_off_request",
          entityId: row.id,
          dueDate: row.startDate,
        };
      }

      if (row.status === "approved" && row.startDate >= asOf && row.startDate <= dueSoonLimit) {
        return {
          kind: "timeoff_pending",
          title: `${row.employeeName}: ferias/pausa proxima`,
          description: `${row.type} com inicio dentro dos proximos 30 dias.`,
          severity: "low",
          entityType: "time_off_request",
          entityId: row.id,
          dueDate: row.startDate,
        };
      }

      return null;
    })
    .filter(isAlertCandidate);
}

async function buildLifecycleAlertCandidates(
  organizationId: string,
  asOf: string,
): Promise<AlertCandidate[]> {
  const rows = await db
    .select({
      id: lifecycleChecklists.id,
      employeeName: employees.fullName,
      type: lifecycleChecklists.type,
      status: lifecycleChecklists.status,
      dueDate: lifecycleChecklists.dueDate,
    })
    .from(lifecycleChecklists)
    .innerJoin(employees, eq(lifecycleChecklists.employeeId, employees.id))
    .where(and(eq(lifecycleChecklists.organizationId, organizationId), isNull(lifecycleChecklists.deletedAt)));

  return rows
    .map((row): AlertCandidate | null => {
      if (row.status !== "open") {
        return null;
      }

      const state = getLifecycleChecklistState({
        dueDate: row.dueDate,
        status: "open",
      }, asOf);

      return {
        kind: "lifecycle_pending",
        title: `${row.employeeName}: checklist de ${row.type} em aberto`,
        description: state === "overdue" ? "Checklist esta atrasado." : "Checklist possui pendencias.",
        severity: state === "overdue" ? "high" : "medium",
        entityType: "lifecycle_checklist",
        entityId: row.id,
        dueDate: row.dueDate,
      };
    })
    .filter(isAlertCandidate);
}

async function buildEquipmentAlertCandidates(organizationId: string): Promise<AlertCandidate[]> {
  const rows = await db
    .select({
      id: equipment.id,
      assetNumber: equipment.assetNumber,
      type: equipment.type,
      status: equipment.status,
      currentEmployeeId: equipment.currentEmployeeId,
      employeeName: employees.fullName,
      employeeStatus: employees.status,
    })
    .from(equipment)
    .leftJoin(employees, eq(equipment.currentEmployeeId, employees.id))
    .where(and(eq(equipment.organizationId, organizationId), isNull(equipment.deletedAt)));

  return rows
    .map((row): AlertCandidate | null => {
      const target = {
        currentEmployeeId: row.currentEmployeeId,
        currentEmployeeStatus: row.employeeStatus,
        status: row.status as EquipmentStatus,
      };

      if (!isEquipmentReturnAlert(target)) {
        return null;
      }

      return {
        kind: "equipment_return",
        title: `${row.assetNumber}: equipamento pendente`,
        description: `${row.type} vinculado a ${row.employeeName ?? "sem responsavel valido"}.`,
        severity: row.employeeStatus === "terminated" ? "critical" : "high",
        entityType: "equipment",
        entityId: row.id,
        dueDate: null,
      };
    })
    .filter(isAlertCandidate);
}

async function buildSaasAlertCandidates(
  organizationId: string,
  asOf: string,
): Promise<AlertCandidate[]> {
  const subscriptions = await db
    .select({
      id: saasSubscriptions.id,
      name: saasSubscriptions.name,
      provider: saasSubscriptions.provider,
      renewalDate: saasSubscriptions.renewalDate,
      responsibleUserId: saasSubscriptions.responsibleUserId,
      status: saasSubscriptions.status,
    })
    .from(saasSubscriptions)
    .where(and(eq(saasSubscriptions.organizationId, organizationId), isNull(saasSubscriptions.deletedAt)));
  const links = await db
    .select({
      subscriptionId: saasSubscriptionUsers.subscriptionId,
      employeeName: employees.fullName,
      employeeStatus: employees.status,
      status: saasSubscriptionUsers.status,
    })
    .from(saasSubscriptionUsers)
    .innerJoin(employees, eq(saasSubscriptionUsers.employeeId, employees.id));
  const linksBySubscription = new Map<string, typeof links>();

  for (const link of links) {
    const current = linksBySubscription.get(link.subscriptionId) ?? [];

    current.push(link);
    linksBySubscription.set(link.subscriptionId, current);
  }

  return subscriptions.flatMap((subscription): AlertCandidate[] => {
    const status = subscription.status as SaasSubscriptionStatus;
    const subscriptionLinks = linksBySubscription.get(subscription.id) ?? [];
    const activeLinks = subscriptionLinks.filter((link) => link.status === "active");
    const candidates: AlertCandidate[] = [];
    const renewalState = getSaasRenewalState(
      {
        renewalDate: subscription.renewalDate,
        status,
      },
      asOf,
    );

    if (renewalState === "overdue" || renewalState === "due_soon") {
      candidates.push({
        kind: "saas_renewal",
        title: `${subscription.name}: renovacao de assinatura`,
        description: renewalState === "overdue" ? "Assinatura com renovacao vencida." : "Assinatura proxima da renovacao.",
        severity: renewalState === "overdue" ? "high" : "medium",
        entityType: "saas_subscription",
        entityId: subscription.id,
        dueDate: subscription.renewalDate,
      });
    }

    if (status === "active" && activeLinks.length === 0) {
      candidates.push({
        kind: "saas_license",
        title: `${subscription.name}: sem usuario ativo`,
        description: "Assinatura ativa nao possui usuarios vinculados ativos.",
        severity: "medium",
        entityType: "saas_subscription",
        entityId: subscription.id,
        dueDate: subscription.renewalDate,
      });
    }

    for (const link of activeLinks) {
      if (link.employeeStatus === "terminated") {
        candidates.push({
          kind: "saas_license",
          title: `${subscription.name}: licenca de colaborador desligado`,
          description: `${link.employeeName} esta desligado e ainda possui licenca ativa.`,
          severity: "critical",
          entityType: "saas_subscription",
          entityId: subscription.id,
          dueDate: subscription.renewalDate,
        });
      }
    }

    if (!subscription.responsibleUserId && status === "active") {
      candidates.push({
        kind: "saas_license",
        title: `${subscription.name}: sem responsavel`,
        description: "Assinatura ativa nao possui responsavel interno.",
        severity: "medium",
        entityType: "saas_subscription",
        entityId: subscription.id,
        dueDate: subscription.renewalDate,
      });
    }

    return candidates;
  });
}

function isAlertCandidate(value: AlertCandidate | null): value is AlertCandidate {
  return value !== null;
}

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return context.organizationId;
}

export {
  tenantListStoredAlerts as listStoredAlerts,
  tenantListAlertCandidates as listAlertCandidates,
  tenantGenerateAlertCandidatesForOrganization as generateAlertCandidatesForOrganization,
};

const tenantListStoredAlerts = bindTenantContext(listStoredAlerts);
const tenantListAlertCandidates = bindTenantContext(listAlertCandidates);
const tenantGenerateAlertCandidatesForOrganization = bindTenantContext(
  generateAlertCandidatesForOrganization,
);

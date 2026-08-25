import type { AccessContext } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";

import {
  addDaysToDateKey,
  centsToMoney,
  formatCompetence,
  moneyToCents,
  toDateKey,
  type FinancialEntryStatus,
} from "@/features/finance/rules";

export const clientStatusLabels = {
  active: "Ativo",
  paused: "Pausado",
  cancelled: "Cancelado",
} as const;

export const clientFinancialStatusLabels = {
  not_generated: "Nao gerado",
  planned: "Previsto",
  due_today: "Vence hoje",
  overdue: "Atrasado",
  partial: "Parcial",
  received: "Recebido",
  cancelled: "Cancelado",
  restricted: "Restrito",
} as const;

export const clientReminderKindLabels = {
  due_soon: "Proximo vencimento",
  due_today: "Vence hoje",
  overdue: "Atrasado",
  partial_payment: "Pagamento parcial",
  multiple_open: "Multiplas cobrancas abertas",
} as const;

export type ClientStatus = keyof typeof clientStatusLabels;
export type ClientListScope = "all" | "owned" | "none";
export type ClientFinancialStatus = keyof typeof clientFinancialStatusLabels;
export type ClientReminderKind = keyof typeof clientReminderKindLabels;

export type ClientRecord = {
  id: string;
  name: string;
  code: string;
  status: ClientStatus;
  monthlyFee: string | null;
  billingDay: number | null;
  internalOwnerEmployeeId: string | null;
  internalOwnerName: string | null;
  billingMethod: string | null;
  startDate: string | null;
  cancellationDate: string | null;
};

export type ClientListItem = Omit<ClientRecord, "monthlyFee"> & {
  monthlyFee: string | null;
  valueHidden: boolean;
};

export type ClientFilters = {
  query?: string;
  status?: ClientStatus | "all";
};

export type ClientBillingSchedule = {
  billingDay: number;
  paymentTermsDays?: number | null;
};

export type ClientExpectedEntryTarget = Omit<ClientBillingSchedule, "billingDay"> & {
  billingDay: number | null | undefined;
  clientStatus: ClientStatus;
  monthlyFee: string | null | undefined;
};

export type ClientPaymentStatusTarget = {
  amount: string;
  receivedAmount?: string | null;
  dueDate: string | Date;
  receivedDate?: string | Date | null;
  status: FinancialEntryStatus;
};

export type ClientReminderTarget = ClientPaymentStatusTarget & {
  id: string;
  clientName: string;
};

export type ClientReminderCandidate = {
  kind: ClientReminderKind;
  title: string;
  description: string;
  dueDate: string | null;
  financialEntryId: string | null;
  severity: "low" | "medium" | "high";
};

const readClientPermissions = [
  "clients.read",
  "clients.read_limited",
  "clients.configure",
] as const;

export function canReadClients(context: AccessContext) {
  return canAny(readClientPermissions, context);
}

export function canWriteClients(context: AccessContext) {
  return canAny(["clients.write", "clients.configure"], context);
}

export function canReadClientFinancialValues(context: AccessContext) {
  return can("finance.read", context);
}

export function generateClientCode(sequence: number) {
  return `CLI-${String(sequence).padStart(5, "0")}`;
}

export function buildClientBillingDueDate(
  competence: string,
  billingDay: number,
  paymentTermsDays: number | null | undefined = 0,
) {
  return addDaysToDateKey(
    buildClampedDateKey(competence, billingDay),
    paymentTermsDays ?? 0,
  );
}

export function getNextClientBillingDueDate(
  schedule: ClientBillingSchedule,
  asOf: string | Date = new Date(),
) {
  const asOfKey = toDateKey(asOf);
  const currentCompetence = asOfKey.slice(0, 7);
  const currentDueDate = buildClientBillingDueDate(
    currentCompetence,
    schedule.billingDay,
    schedule.paymentTermsDays,
  );

  if (currentDueDate >= asOfKey) {
    return currentDueDate;
  }

  return buildClientBillingDueDate(
    getNextMonthKey(currentCompetence),
    schedule.billingDay,
    schedule.paymentTermsDays,
  );
}

export function canGenerateClientExpectedEntry(target: ClientExpectedEntryTarget) {
  return (
    target.clientStatus === "active" &&
    typeof target.billingDay === "number" &&
    target.billingDay >= 1 &&
    target.billingDay <= 31 &&
    moneyToCents(target.monthlyFee) > 0
  );
}

export function buildClientExpectedEntryDescription(
  clientName: string,
  competence: string,
) {
  return `Fee ${formatCompetence(competence)} - ${clientName}`;
}

export function getClientPaymentStatus(
  payment: ClientPaymentStatusTarget,
  asOf: string | Date = new Date(),
): ClientFinancialStatus {
  if (payment.status === "cancelled") {
    return "cancelled";
  }

  if (payment.receivedDate || payment.status === "received") {
    return "received";
  }

  if (isPartialPayment(payment)) {
    return "partial";
  }

  const dueDate = toDateKey(payment.dueDate);
  const asOfKey = toDateKey(asOf);

  if (dueDate < asOfKey) {
    return "overdue";
  }

  if (dueDate === asOfKey) {
    return "due_today";
  }

  return "planned";
}

export function getClientMonthlyFinancialStatus(
  payments: readonly ClientPaymentStatusTarget[],
  asOf: string | Date = new Date(),
): ClientFinancialStatus {
  const competence = toDateKey(asOf).slice(0, 7);
  const monthlyPayments = payments.filter(
    (payment) => toDateKey(payment.dueDate).slice(0, 7) === competence,
  );

  if (monthlyPayments.length === 0) {
    return "not_generated";
  }

  const statuses = monthlyPayments.map((payment) => getClientPaymentStatus(payment, asOf));

  if (statuses.includes("partial")) {
    return "partial";
  }

  if (statuses.includes("overdue")) {
    return "overdue";
  }

  if (statuses.includes("due_today")) {
    return "due_today";
  }

  if (statuses.includes("planned")) {
    return "planned";
  }

  if (statuses.every((status) => status === "received")) {
    return "received";
  }

  return "cancelled";
}

export function getOutstandingPaymentAmount(payment: ClientPaymentStatusTarget) {
  const amountCents = moneyToCents(payment.amount);
  const receivedCents = moneyToCents(payment.receivedAmount);

  return centsToMoney(Math.max(amountCents - receivedCents, 0));
}

export function buildClientReminderCandidates(input: {
  payments: readonly ClientReminderTarget[];
  asOf?: string | Date;
  reminderBeforeDays?: number | null;
}) {
  const asOfKey = toDateKey(input.asOf ?? new Date());
  const dueSoonLimit = addDaysToDateKey(asOfKey, input.reminderBeforeDays ?? 3);
  const openPayments = input.payments.filter((payment) =>
    ["planned", "due_today", "overdue", "partial"].includes(
      getClientPaymentStatus(payment, asOfKey),
    ),
  );
  const reminders: ClientReminderCandidate[] = [];

  for (const payment of openPayments) {
    const dueDate = toDateKey(payment.dueDate);
    const status = getClientPaymentStatus(payment, asOfKey);
    const base = {
      dueDate,
      financialEntryId: payment.id,
    };

    if (status === "partial") {
      reminders.push({
        ...base,
        kind: "partial_payment",
        title: `${payment.clientName}: pagamento parcial`,
        description: "Ha uma cobranca com valor recebido menor que o previsto.",
        severity: "medium",
      });
      continue;
    }

    if (status === "overdue") {
      reminders.push({
        ...base,
        kind: "overdue",
        title: `${payment.clientName}: cobranca atrasada`,
        description: "Ha uma cobranca aberta com vencimento anterior a hoje.",
        severity: "high",
      });
      continue;
    }

    if (status === "due_today") {
      reminders.push({
        ...base,
        kind: "due_today",
        title: `${payment.clientName}: vencimento hoje`,
        description: "Ha uma cobranca aberta vencendo hoje.",
        severity: "medium",
      });
      continue;
    }

    if (dueDate > asOfKey && dueDate <= dueSoonLimit) {
      reminders.push({
        ...base,
        kind: "due_soon",
        title: `${payment.clientName}: vencimento proximo`,
        description: "Ha uma cobranca aberta dentro da janela de lembrete.",
        severity: "low",
      });
    }
  }

  if (openPayments.length >= 2) {
    reminders.push({
      kind: "multiple_open",
      title: `${openPayments[0]?.clientName ?? "Cliente"}: multiplas cobrancas abertas`,
      description: "Cliente possui mais de uma cobranca aberta.",
      dueDate: null,
      financialEntryId: null,
      severity: "high",
    });
  }

  return reminders;
}

export function normalizeClientFilters(input: {
  q?: string | string[];
  query?: string | string[];
  status?: string | string[];
}): ClientFilters {
  const status = firstValue(input.status);
  const query = firstValue(input.q) ?? firstValue(input.query);

  return {
    query: normalizeSearchQuery(query),
    status: isClientStatusFilter(status) ? status : "all",
  };
}

export function applyClientFilters<T extends ClientListItem>(
  clients: readonly T[],
  filters: ClientFilters,
) {
  const query = filters.query?.toLowerCase();

  return clients.filter(
    (client) =>
      (!filters.status || filters.status === "all" || client.status === filters.status) &&
      (!query ||
        [
          client.name,
          client.code,
          client.internalOwnerName ?? "",
          client.billingMethod ?? "",
        ].some((value) => value.toLowerCase().includes(query))),
  );
}

export function getClientListScope(context: AccessContext): ClientListScope {
  if (canAny(["clients.read", "clients.configure"], context)) {
    return "all";
  }

  if (!can("clients.read_limited", context)) {
    return "none";
  }

  return context.roles.includes("leadership") ? "owned" : "all";
}

export function toClientListItem(
  record: ClientRecord,
  context: AccessContext,
): ClientListItem {
  const canReadValues = canReadClientFinancialValues(context);

  return {
    ...record,
    monthlyFee: canReadValues ? record.monthlyFee : null,
    valueHidden: !canReadValues,
  };
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSearchQuery(value: string | undefined) {
  const normalized = value?.trim();

  return normalized || undefined;
}

function isClientStatusFilter(value: string | undefined): value is ClientStatus | "all" {
  return Boolean(value && (value === "all" || Object.keys(clientStatusLabels).includes(value)));
}

function isPartialPayment(payment: ClientPaymentStatusTarget) {
  const receivedCents = moneyToCents(payment.receivedAmount);

  return receivedCents > 0 && receivedCents < moneyToCents(payment.amount);
}

function buildClampedDateKey(monthKey: string, targetDay: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = String(Math.min(Math.max(targetDay, 1), lastDay)).padStart(2, "0");

  return `${monthKey}-${day}`;
}

function getNextMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

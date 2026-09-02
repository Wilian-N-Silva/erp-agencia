import { z } from "zod";

import { isoMonthSchema } from "@/lib/validation";

export const financialObligationStatusLabels = {
  open: "Em aberto",
  partial: "Parcialmente liquidado",
  settled: "Liquidado",
  overdue: "Vencido",
  cancelled: "Cancelado",
} as const;

export const financialEntryStatusLabels = financialObligationStatusLabels;
export const financialExpenseStatusLabels = financialObligationStatusLabels;

export type FinancialObligationStatus = keyof typeof financialObligationStatusLabels;
export type FinancialEntryStatus = FinancialObligationStatus;
export type FinancialExpenseStatus = FinancialObligationStatus;
export type LegacyFinancialEntryStatus = "planned" | "received" | "overdue" | "cancelled";
export type LegacyFinancialExpenseStatus = "planned" | "paid" | "overdue" | "cancelled";
type FinancialEntryStatusSource = LegacyFinancialEntryStatus | FinancialEntryStatus;
type FinancialExpenseStatusSource = LegacyFinancialExpenseStatus | FinancialExpenseStatus;

export type FinanceEntryRecord = {
  amount: string;
  competence: string;
  dueDate: string | Date;
  receivedAmount?: string | null;
  receivedDate?: string | Date | null;
  status: LegacyFinancialEntryStatus;
};

export type FinanceExpenseRecord = {
  amount: string;
  competence: string;
  dueDate: string | Date;
  paidDate?: string | Date | null;
  status: LegacyFinancialExpenseStatus;
};

export type ProvisionRecord = {
  estimatedMonthlyAmount: string;
  expectedDay?: number | null;
  recurring: boolean;
  status: string;
};

export type FinanceDashboardTotals = {
  incomeExpected: string;
  incomeReceived: string;
  incomeOverdue: string;
  expensesExpected: string;
  expensesPaid: string;
  expensesOverdue: string;
  provisionsExpected: string;
  resultRealized: string;
  forecast30Days: string;
};

export type FinanceDashboardComputation = {
  competence: string;
  totals: FinanceDashboardTotals;
};

export type FinanceFilters = {
  competence?: string;
  entryStatus?: FinancialEntryStatus | "all";
  expenseStatus?: FinancialExpenseStatus | "all";
  query?: string;
};

export type FinancialExpenseEditableFields = {
  amount: string;
  competence: string;
  description: string;
  dueDate: string;
  notes: string | null;
  recurring: boolean;
  subcategory: string | null;
};

export function buildFinancialExpenseUpdateValues(
  input: FinancialExpenseEditableFields,
  masterData: {
    categoryId: string | null;
    costCenterId: string | null;
    supplierId: string | null;
  },
  updatedAt: Date = new Date(),
) {
  return {
    supplierId: masterData.supplierId,
    categoryId: masterData.categoryId,
    costCenterId: masterData.costCenterId,
    subcategory: input.subcategory,
    description: input.description,
    amount: input.amount,
    dueDate: input.dueDate,
    competence: input.competence,
    recurring: input.recurring,
    notes: input.notes,
    updatedAt,
  };
}

const financeExportFiltersSchema = z.strictObject({
  competence: isoMonthSchema.optional(),
  entryStatus: z
    .enum(["all", "open", "partial", "settled", "overdue", "cancelled"])
    .optional(),
  expenseStatus: z
    .enum(["all", "open", "partial", "settled", "overdue", "cancelled"])
    .optional(),
  q: z.string().trim().max(180).optional(),
  query: z.string().trim().max(180).optional(),
});

export type FinanceEntryFilterTarget = FinanceEntryRecord & {
  clientName?: string | null;
  description: string;
};

export type FinanceExpenseFilterTarget = FinanceExpenseRecord & {
  category: string;
  description: string;
  supplier: string;
};

export type ProvisionFilterTarget = ProvisionRecord & {
  category: string;
  name: string;
};

const moneyPattern = /^-?\d+(?:\.\d{1,2})?$/;
const positiveMoneyPattern = /^\d+(?:\.\d{1,2})?$/;
const maxMoneyCents = 999_999_999_999;

export function toDateKey(value: string | Date) {
  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getCompetenceKey(value: string | Date) {
  return toDateKey(value).slice(0, 7);
}

export function addDaysToDateKey(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

export function moneyToCents(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const normalized = value.trim();

  if (!moneyPattern.test(normalized)) {
    throw new Error(`Invalid money value: ${value}`);
  }

  const sign = normalized.startsWith("-") ? -1 : 1;
  const unsigned = sign === -1 ? normalized.slice(1) : normalized;
  const [units, cents = ""] = unsigned.split(".");
  const valueInCents =
    Number(units) * 100 + Number(cents.padEnd(2, "0"));

  if (
    !Number.isSafeInteger(valueInCents) ||
    valueInCents > maxMoneyCents
  ) {
    throw new Error("Money value exceeds the supported range.");
  }

  return sign * valueInCents;
}

export function normalizeMoneyInput(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(",", ".");

  if (!positiveMoneyPattern.test(normalized)) {
    throw new Error("Money value must be a positive decimal.");
  }

  const cents = moneyToCents(normalized);

  if (cents <= 0) {
    throw new Error("Money value must be greater than zero.");
  }

  return centsToMoney(cents);
}

export function centsToMoney(cents: number) {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const units = Math.floor(absolute / 100);
  const remainder = String(absolute % 100).padStart(2, "0");

  return `${sign}${units}.${remainder}`;
}

export function sumMoney(values: readonly (string | null | undefined)[]) {
  return centsToMoney(values.reduce((total, value) => total + moneyToCents(value), 0));
}

export function formatMoney(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format(moneyToCents(value) / 100);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "-";
  }

  const dateKey = toDateKey(value);
  const [year, month, day] = dateKey.split("-");

  if (!year || !month || !day) {
    return "-";
  }

  return `${day}/${month}/${year}`;
}

export function formatCompetence(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  const [year, month] = value.split("-");

  if (!year || !month) {
    return value;
  }

  return `${month}/${year}`;
}

export function normalizeFinanceFilters(input: {
  competence?: string | string[];
  entryStatus?: string | string[];
  expenseStatus?: string | string[];
  q?: string | string[];
  query?: string | string[];
}): FinanceFilters {
  const competence = firstValue(input.competence);
  const entryStatus = firstValue(input.entryStatus);
  const expenseStatus = firstValue(input.expenseStatus);
  const query = firstValue(input.q) ?? firstValue(input.query);

  return {
    competence: isCompetenceKey(competence) ? competence : undefined,
    entryStatus: isEntryStatusFilter(entryStatus) ? entryStatus : "all",
    expenseStatus: isExpenseStatusFilter(expenseStatus) ? expenseStatus : "all",
    query: normalizeSearchQuery(query),
  };
}

export function parseFinanceExportFilters(searchParams: URLSearchParams) {
  return normalizeFinanceFilters(
    financeExportFiltersSchema.parse(
      Object.fromEntries(searchParams.entries()),
    ),
  );
}

export function applyFinanceEntryFilters<T extends FinanceEntryFilterTarget>(
  entries: readonly T[],
  filters: FinanceFilters,
  asOf: string | Date = new Date(),
) {
  const query = filters.query?.toLowerCase();

  return entries.filter((entry) => {
    const status = getFinancialEntryEffectiveStatus(entry, asOf);

    return (
      (!filters.competence || entry.competence === filters.competence) &&
      (!filters.entryStatus || filters.entryStatus === "all" || status === filters.entryStatus) &&
      (!query ||
        [entry.description, entry.clientName ?? ""]
          .some((value) => value.toLowerCase().includes(query)))
    );
  });
}

export function applyFinanceExpenseFilters<T extends FinanceExpenseFilterTarget>(
  expenses: readonly T[],
  filters: FinanceFilters,
  asOf: string | Date = new Date(),
) {
  const query = filters.query?.toLowerCase();

  return expenses.filter((expense) => {
    const status = getFinancialExpenseEffectiveStatus(expense, asOf);

    return (
      (!filters.competence || expense.competence === filters.competence) &&
      (!filters.expenseStatus ||
        filters.expenseStatus === "all" ||
        status === filters.expenseStatus) &&
      (!query ||
        [expense.description, expense.supplier, expense.category]
          .some((value) => value.toLowerCase().includes(query)))
    );
  });
}

export function applyProvisionFilters<T extends ProvisionFilterTarget>(
  provisions: readonly T[],
  filters: FinanceFilters,
) {
  const query = filters.query?.toLowerCase();

  return provisions.filter(
    (provision) =>
      !query ||
      [provision.name, provision.category].some((value) =>
        value.toLowerCase().includes(query),
      ),
  );
}

export function getFinancialEntryEffectiveStatus(
  entry: {
    amount: string;
    dueDate: string | Date;
    receivedAmount?: string | null;
    receivedDate?: string | Date | null;
    status: FinancialEntryStatusSource;
  },
  asOf: string | Date = new Date(),
): FinancialEntryStatus {
  return deriveFinancialObligation({
    amount: entry.amount,
    settledAmount: getFinancialEntrySettledAmount(entry),
    dueDate: entry.dueDate,
    cancelled: entry.status === "cancelled",
    asOf,
  }).status;
}

export function getFinancialExpenseEffectiveStatus(
  expense: {
    amount: string;
    dueDate: string | Date;
    paidDate?: string | Date | null;
    status: FinancialExpenseStatusSource;
  },
  asOf: string | Date = new Date(),
): FinancialExpenseStatus {
  return deriveFinancialObligation({
    amount: expense.amount,
    settledAmount: getFinancialExpenseSettledAmount(expense),
    dueDate: expense.dueDate,
    cancelled: expense.status === "cancelled",
    asOf,
  }).status;
}

export function deriveFinancialObligation(input: {
  amount: string;
  settledAmount?: string | null;
  dueDate: string | Date;
  cancelled?: boolean;
  asOf?: string | Date;
}) {
  const amountCents = moneyToCents(input.amount);
  const settledCents = Math.max(moneyToCents(input.settledAmount), 0);
  const outstandingCents = Math.max(amountCents - settledCents, 0);
  let status: FinancialObligationStatus;

  if (input.cancelled) {
    status = "cancelled";
  } else if (amountCents > 0 && settledCents >= amountCents) {
    status = "settled";
  } else if (settledCents > 0) {
    status = "partial";
  } else if (toDateKey(input.dueDate) < toDateKey(input.asOf ?? new Date())) {
    status = "overdue";
  } else {
    status = "open";
  }

  return {
    status,
    settledAmount: centsToMoney(settledCents),
    outstandingAmount: centsToMoney(outstandingCents),
  };
}

export function getFinancialEntrySettledAmount(
  entry: {
    amount: string;
    receivedAmount?: string | null;
    status: FinancialEntryStatusSource;
  },
) {
  if (entry.receivedAmount !== null && entry.receivedAmount !== undefined) {
    return centsToMoney(Math.max(moneyToCents(entry.receivedAmount), 0));
  }

  return entry.status === "received" || entry.status === "settled"
    ? entry.amount
    : "0.00";
}

export function getFinancialExpenseSettledAmount(
  expense: { amount: string; status: FinancialExpenseStatusSource },
) {
  return expense.status === "paid" || expense.status === "settled"
    ? expense.amount
    : "0.00";
}

export function computeFinanceDashboard(input: {
  entries: readonly FinanceEntryRecord[];
  expenses: readonly FinanceExpenseRecord[];
  provisions: readonly ProvisionRecord[];
  asOf?: string | Date;
  competence?: string;
  forecastDays?: number;
}): FinanceDashboardComputation {
  const asOfKey = toDateKey(input.asOf ?? new Date());
  const competence = input.competence ?? getCompetenceKey(asOfKey);
  const forecastEndKey = addDaysToDateKey(asOfKey, input.forecastDays ?? 30);

  const entriesInCompetence = input.entries.filter((entry) => entry.competence === competence);
  const expensesInCompetence = input.expenses.filter((expense) => expense.competence === competence);
  const activeProvisions = input.provisions.filter(
    (provision) => provision.recurring && provision.status === "active",
  );

  const incomeExpected = sumMoney(
    entriesInCompetence
      .filter((entry) => getFinancialEntryEffectiveStatus(entry, asOfKey) !== "cancelled")
      .map((entry) => entry.amount),
  );
  const incomeReceived = sumMoney(
    entriesInCompetence
      .filter((entry) => entry.status !== "cancelled")
      .map(getFinancialEntrySettledAmount),
  );
  const incomeOverdue = sumMoney(
    entriesInCompetence
      .filter((entry) => getFinancialEntryEffectiveStatus(entry, asOfKey) === "overdue")
      .map((entry) => entry.amount),
  );
  const expensesExpected = sumMoney(
    expensesInCompetence
      .filter((expense) => getFinancialExpenseEffectiveStatus(expense, asOfKey) !== "cancelled")
      .map((expense) => expense.amount),
  );
  const expensesPaid = sumMoney(
    expensesInCompetence
      .filter((expense) => expense.status !== "cancelled")
      .map(getFinancialExpenseSettledAmount),
  );
  const expensesOverdue = sumMoney(
    expensesInCompetence
      .filter((expense) => getFinancialExpenseEffectiveStatus(expense, asOfKey) === "overdue")
      .map((expense) => expense.amount),
  );
  const provisionsExpected = sumMoney(
    activeProvisions.map((provision) => provision.estimatedMonthlyAmount),
  );
  const forecastIncomeCents = input.entries
    .filter((entry) => {
      const dueDate = toDateKey(entry.dueDate);
      return (
        dueDate >= asOfKey &&
        dueDate <= forecastEndKey &&
        !["settled", "cancelled"].includes(getFinancialEntryEffectiveStatus(entry, asOfKey))
      );
    })
    .reduce(
      (total, entry) =>
        total +
        moneyToCents(
          deriveFinancialObligation({
            amount: entry.amount,
            settledAmount: getFinancialEntrySettledAmount(entry),
            dueDate: entry.dueDate,
            asOf: asOfKey,
          }).outstandingAmount,
        ),
      0,
    );
  const forecastExpenseCents = input.expenses
    .filter((expense) => {
      const dueDate = toDateKey(expense.dueDate);
      return (
        dueDate >= asOfKey &&
        dueDate <= forecastEndKey &&
        !["settled", "cancelled"].includes(getFinancialExpenseEffectiveStatus(expense, asOfKey))
      );
    })
    .reduce(
      (total, expense) =>
        total +
        moneyToCents(
          deriveFinancialObligation({
            amount: expense.amount,
            settledAmount: getFinancialExpenseSettledAmount(expense),
            dueDate: expense.dueDate,
            asOf: asOfKey,
          }).outstandingAmount,
        ),
      0,
    );
  const forecastProvisionCents = activeProvisions
    .filter((provision) =>
      isProvisionDueWithinRange(provision.expectedDay, asOfKey, forecastEndKey),
    )
    .reduce(
      (total, provision) => total + moneyToCents(provision.estimatedMonthlyAmount),
      0,
    );

  return {
    competence,
    totals: {
      incomeExpected,
      incomeReceived,
      incomeOverdue,
      expensesExpected,
      expensesPaid,
      expensesOverdue,
      provisionsExpected,
      resultRealized: centsToMoney(
        moneyToCents(incomeReceived) - moneyToCents(expensesPaid),
      ),
      forecast30Days: centsToMoney(
        forecastIncomeCents - forecastExpenseCents - forecastProvisionCents,
      ),
    },
  };
}

function isProvisionDueWithinRange(
  expectedDay: number | null | undefined,
  startKey: string,
  endKey: string,
) {
  if (!expectedDay) {
    return false;
  }

  const currentDueDate = buildClampedDateKey(startKey.slice(0, 7), expectedDay);
  const nextDueDate = buildClampedDateKey(getNextMonthKey(startKey), expectedDay);

  return (
    (currentDueDate >= startKey && currentDueDate <= endKey) ||
    (nextDueDate >= startKey && nextDueDate <= endKey)
  );
}

function buildClampedDateKey(monthKey: string, expectedDay: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = String(Math.min(Math.max(expectedDay, 1), lastDay)).padStart(2, "0");

  return `${monthKey}-${day}`;
}

function getNextMonthKey(dateKey: string) {
  const [year, month] = dateKey.slice(0, 7).split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeSearchQuery(value: string | undefined) {
  const normalized = value?.trim();

  return normalized || undefined;
}

function isCompetenceKey(value: string | undefined) {
  return Boolean(value && /^\d{4}-\d{2}$/.test(value));
}

function isEntryStatusFilter(
  value: string | undefined,
): value is FinancialEntryStatus | "all" {
  return Boolean(
    value &&
      (value === "all" ||
        Object.keys(financialEntryStatusLabels).includes(value)),
  );
}

function isExpenseStatusFilter(
  value: string | undefined,
): value is FinancialExpenseStatus | "all" {
  return Boolean(
    value &&
      (value === "all" ||
        Object.keys(financialExpenseStatusLabels).includes(value)),
  );
}

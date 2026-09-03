import { and, asc, eq, isNull } from "drizzle-orm";

import { bindTenantContext, db } from "@/lib/db";
import {
  clients,
  financialEntries,
  financialExpenses,
  provisions,
} from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";

import {
  applyFinanceEntryFilters,
  applyFinanceExpenseFilters,
  applyProvisionFilters,
  computeFinanceDashboard,
  getFinancialEntryEffectiveStatus,
  getFinancialEntrySettledAmount,
  getFinancialExpenseEffectiveStatus,
  getFinancialExpenseSettledAmount,
  type FinanceDashboardTotals,
  type FinanceFilters,
  type FinancialEntryStatus,
  type FinancialExpenseStatus,
} from "./rules";

export type FinanceEntryListItem = {
  id: string;
  clientId: string | null;
  clientName: string | null;
  description: string;
  amount: string;
  settledAmount: string;
  receivedAmount: string | null;
  dueDate: string;
  settlementDate: string | null;
  receivedDate: string | null;
  paymentMethod: string | null;
  competence: string;
  status: FinancialEntryStatus;
  recurring: boolean;
  notes: string | null;
};

export type FinanceExpenseListItem = {
  id: string;
  supplierId: string | null;
  categoryId: string | null;
  costCenterId: string | null;
  supplier: string;
  category: string;
  subcategory: string | null;
  description: string;
  amount: string;
  settledAmount: string;
  dueDate: string;
  settlementDate: string | null;
  paidDate: string | null;
  competence: string;
  status: FinancialExpenseStatus;
  costCenter: string | null;
  recurring: boolean;
  notes: string | null;
};

export type ProvisionListItem = {
  id: string;
  name: string;
  category: string;
  estimatedMonthlyAmount: string;
  expectedDay: number | null;
  recurring: boolean;
  status: string;
};

export type FinanceDashboard = {
  competence: string;
  filters: FinanceFilters;
  totals: FinanceDashboardTotals;
  entries: FinanceEntryListItem[];
  expenses: FinanceExpenseListItem[];
  provisions: ProvisionListItem[];
};

async function getFinanceDashboard(
  context: AccessContext,
  options: { asOf?: Date; filters?: FinanceFilters } = {},
): Promise<FinanceDashboard> {
  assertCan("finance.read", context);
  const organizationId = requireOrganizationId(context);
  const asOf = options.asOf ?? new Date();
  const filters = options.filters ?? {};

  const [entryRows, expenseRows, provisionRows] = await Promise.all([
    db
      .select({
        id: financialEntries.id,
        clientId: financialEntries.clientId,
        clientName: clients.name,
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
      .leftJoin(clients, eq(financialEntries.clientId, clients.id))
      .where(
        and(
          eq(financialEntries.organizationId, organizationId),
          isNull(financialEntries.deletedAt),
        ),
      )
      .orderBy(asc(financialEntries.dueDate), asc(financialEntries.description)),
    db
      .select({
        id: financialExpenses.id,
        supplierId: financialExpenses.supplierId,
        categoryId: financialExpenses.categoryId,
        costCenterId: financialExpenses.costCenterId,
        supplier: financialExpenses.supplier,
        category: financialExpenses.category,
        subcategory: financialExpenses.subcategory,
        description: financialExpenses.description,
        amount: financialExpenses.amount,
        paidAmount: financialExpenses.paidAmount,
        dueDate: financialExpenses.dueDate,
        paidDate: financialExpenses.paidDate,
        competence: financialExpenses.competence,
        status: financialExpenses.status,
        costCenter: financialExpenses.costCenter,
        recurring: financialExpenses.recurring,
        notes: financialExpenses.notes,
      })
      .from(financialExpenses)
      .where(
        and(
          eq(financialExpenses.organizationId, organizationId),
          isNull(financialExpenses.deletedAt),
        ),
      )
      .orderBy(asc(financialExpenses.dueDate), asc(financialExpenses.description)),
    db
      .select({
        id: provisions.id,
        name: provisions.name,
        category: provisions.category,
        estimatedMonthlyAmount: provisions.estimatedMonthlyAmount,
        expectedDay: provisions.expectedDay,
        recurring: provisions.recurring,
        status: provisions.status,
      })
      .from(provisions)
      .where(and(eq(provisions.organizationId, organizationId), isNull(provisions.deletedAt)))
      .orderBy(asc(provisions.category), asc(provisions.name)),
  ]);
  const filteredEntryRows = applyFinanceEntryFilters(entryRows, filters, asOf);
  const filteredExpenseRows = applyFinanceExpenseFilters(expenseRows, filters, asOf);
  const filteredProvisionRows = applyProvisionFilters(provisionRows, filters);

  const computed = computeFinanceDashboard({
    entries: filteredEntryRows,
    expenses: filteredExpenseRows,
    provisions: filteredProvisionRows,
    asOf,
    competence: filters.competence,
  });

  return {
    ...computed,
    filters,
    entries: filteredEntryRows.map((entry) => ({
      id: entry.id,
      clientId: entry.clientId,
      clientName: entry.clientName,
      description: entry.description,
      amount: entry.amount,
      settledAmount: getFinancialEntrySettledAmount(entry),
      receivedAmount: entry.receivedAmount,
      dueDate: entry.dueDate,
      settlementDate: entry.receivedDate,
      receivedDate: entry.receivedDate,
      paymentMethod: entry.paymentMethod,
      competence: entry.competence,
      status: getFinancialEntryEffectiveStatus(entry, asOf),
      recurring: entry.recurring,
      notes: entry.notes,
    })),
    expenses: filteredExpenseRows.map((expense) => ({
      id: expense.id,
      supplierId: expense.supplierId,
      categoryId: expense.categoryId,
      costCenterId: expense.costCenterId,
      supplier: expense.supplier,
      category: expense.category,
      subcategory: expense.subcategory,
      description: expense.description,
      amount: expense.amount,
      settledAmount: getFinancialExpenseSettledAmount(expense),
      dueDate: expense.dueDate,
      settlementDate: expense.paidDate,
      paidDate: expense.paidDate,
      competence: expense.competence,
      status: getFinancialExpenseEffectiveStatus(expense, asOf),
      costCenter: expense.costCenter,
      recurring: expense.recurring,
      notes: expense.notes,
    })),
    provisions: filteredProvisionRows,
  };
}

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return context.organizationId;
}

export {
  tenantGetFinanceDashboard as getFinanceDashboard,
};

const tenantGetFinanceDashboard = bindTenantContext(getFinanceDashboard);

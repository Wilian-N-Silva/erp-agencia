import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import { bindTenantContext, db } from "@/lib/db";
import {
  areas,
  documents,
  employees,
  invoiceRequestItems,
  invoiceRequests,
  reimbursementRequests,
  positions,
  users,
} from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { deriveInvoicePayment, deriveReimbursementInvoicePayment, deriveDirectReimbursementPayment } from "./invoice-payment-rules";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

import {
  canEditInvoiceComposition,
  canReadInvoiceRequest,
  canReadReimbursement,
  getReimbursementScope,
  hasInvoiceDivergence,
  type InvoiceItemKind,
  type InvoiceRequestStatus,
  type ReimbursementStatus,
} from "./rules";

export type PortalEmployeeSummary = {
  id: string;
  fullName: string;
  registrationNumber: string;
  positionName: string;
  areaName: string;
  employmentType: string;
};

export type InvoiceRequestItem = {
  id: string;
  label: string;
  amount: string;
  kind: InvoiceItemKind | string;
  sortOrder: number;
};

export type InvoiceRequestListItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRegistrationNumber: string;
  areaName: string;
  managerEmployeeId: string | null;
  competence: string;
  dueDate: string;
  expectedAmount: string;
  issuedAmount: string | null;
  suggestedDescription: string;
  status: InvoiceRequestStatus;
  fileId: string | null;
  documentId: string | null;
  financialExpenseId: string | null;
  payment: ReturnType<typeof deriveInvoicePayment>["payment"];
  approvedAt: Date | null;
  paidAt: Date | null;
  items: InvoiceRequestItem[];
  divergence: boolean;
};

export type ReimbursementListItem = {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeRegistrationNumber: string;
  areaName: string;
  employmentType: string;
  managerEmployeeId: string | null;
  title: string;
  category: string;
  amount: string;
  expenseDate: string;
  status: ReimbursementStatus;
  fileId: string | null;
  includedInvoiceRequestId: string | null;
  financialExpenseId: string | null;
  invoicePaymentLabel: string | null;
  paidAt: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  managerApproverUserId: string | null;
  managerApproverName: string | null;
  financeApproverUserId: string | null;
  financeApproverName: string | null;
};

export type InvoiceEmployeeOption = {
  id: string;
  name: string;
  areaName: string;
  positionName: string;
  currentCompensation: string;
  recurringCostAllowance: string | null;
  recurringTransport: string | null;
};

async function getPortalEmployeeSummary(
  context: AccessContext,
): Promise<PortalEmployeeSummary | null> {
  if (!context.employeeId || !context.organizationId) {
    return null;
  }

  const [employee] = await db
    .select({
      id: employees.id,
      fullName: employees.fullName,
      registrationNumber: employees.registrationNumber,
      positionName: positions.name,
      areaName: areas.name,
      employmentType: employees.employmentType,
    })
    .from(employees)
    .innerJoin(positions, eq(employees.positionId, positions.id))
    .innerJoin(areas, eq(employees.areaId, areas.id))
    .where(
      and(
        eq(employees.id, context.employeeId),
        eq(employees.organizationId, context.organizationId),
        isNull(employees.deletedAt),
      ),
    )
    .limit(1);

  return employee ?? null;
}

async function listInvoiceRequests(
  context: AccessContext,
  options: { ownOnly?: boolean; limit?: number } = {},
): Promise<InvoiceRequestListItem[]> {
  assertCanAny(["invoices.read", "invoices.write", "invoices.approve", "invoices.read_own"], context);
  const organizationId = requireOrganizationId(context);
  const rows = await db
    .select({
      id: invoiceRequests.id,
      employeeId: invoiceRequests.employeeId,
      employeeName: employees.fullName,
      employeeRegistrationNumber: employees.registrationNumber,
      areaName: areas.name,
      managerEmployeeId: employees.managerEmployeeId,
      competence: invoiceRequests.competence,
      dueDate: invoiceRequests.dueDate,
      expectedAmount: invoiceRequests.expectedAmount,
      issuedAmount: invoiceRequests.issuedAmount,
      suggestedDescription: invoiceRequests.suggestedDescription,
      status: invoiceRequests.status,
      fileId: invoiceRequests.fileId,
      documentId: documents.id,
      financialExpenseId: invoiceRequests.financialExpenseId,
      approvedAt: invoiceRequests.approvedAt,
      paidAt: invoiceRequests.paidAt,
    })
    .from(invoiceRequests)
    .leftJoin(documents, and(eq(documents.fileId, invoiceRequests.fileId), eq(documents.organizationId, organizationId), eq(documents.ownerType, "invoice_request"), eq(documents.ownerId, sql`${invoiceRequests.id}::text`), eq(documents.documentType, "invoice"), isNull(documents.deletedAt)))
    .innerJoin(employees, eq(invoiceRequests.employeeId, employees.id))
    .innerJoin(areas, eq(employees.areaId, areas.id))
    .where(and(eq(invoiceRequests.organizationId, organizationId), isNull(invoiceRequests.deletedAt)))
    .orderBy(desc(invoiceRequests.competence), asc(employees.fullName));
  const scopedRows = rows.filter((row) => {
    if (options.ownOnly) {
      return row.employeeId === context.employeeId;
    }

    return canReadInvoiceRequest(context, {
      employeeId: row.employeeId,
      managerEmployeeId: row.managerEmployeeId,
    });
  });
  const limitedRows = scopedRows.slice(0, options.limit);
  const itemsByRequest = await loadInvoiceItems(limitedRows.map((row) => row.id));
  const payments = await loadInvoicePayments(organizationId, limitedRows);

  return limitedRows.map((row) => ({
    ...row,
    ...payments.get(`${row.id}:${row.employeeId}`)!,
    items: itemsByRequest.get(row.id) ?? [],
    divergence: hasInvoiceDivergence(row.expectedAmount, row.issuedAmount),
  }));
}

// Call only with IDs and employee IDs already scoped by the requesting DAL.
async function loadInvoicePayments(organizationId: string, scopedInvoices: readonly { id: string; employeeId: string }[]) {
    const payments = new Map<string, ReturnType<typeof deriveInvoicePayment>>();
    if (scopedInvoices.length) {
      const result = await db.execute(sql`select i.id,i.employee_id,i.status,i.paid_at,i.financial_expense_id,
        e.amount as payable_amount,e.status as payable_status,
        coalesce(sum(case when t.id is not null then a.amount else 0 end),0)::text as paid_amount,
        max(t.occurred_at) as last_payment_at
        from invoice_requests i
        left join financial_expenses e on e.id=i.financial_expense_id and e.organization_id=i.organization_id and e.deleted_at is null
        left join financial_allocations a on a.financial_expense_id=e.id and a.organization_id=i.organization_id
        left join financial_transactions t on t.id=a.transaction_id and t.organization_id=i.organization_id and t.status <> 'reversed' and t.direction='out'
        where i.organization_id=${organizationId} and i.deleted_at is null
        and (${sql.join(scopedInvoices.map(row => sql`(i.id=${row.id}::uuid and i.employee_id=${row.employeeId}::uuid)`),sql` or `)})
        group by i.id,e.id`);
      for (const row of result.rows) payments.set(`${row.id}:${row.employee_id}`, deriveInvoicePayment({
        status: row.status as InvoiceRequestStatus, paidAt: row.paid_at ? new Date(String(row.paid_at)) : null,
        financialExpenseId: row.financial_expense_id as string | null, payableAmount: row.payable_amount as string | null,
        payableStatus: row.payable_status as string | null, paidAmount: String(row.paid_amount),
        lastPaymentAt: row.last_payment_at ? new Date(String(row.last_payment_at)) : null,
      }));
    }

  return payments;
}

async function listReimbursements(
  context: AccessContext,
  options: { ownOnly?: boolean; limit?: number } = {},
): Promise<ReimbursementListItem[]> {
  assertCanAny(
    [
      "reimbursements.read",
      "reimbursements.write",
      "reimbursements.approve_team",
      "reimbursements.approve_finance",
      "reimbursements.read_own",
    ],
    context,
  );
  const organizationId = requireOrganizationId(context);
  const scope = options.ownOnly ? "own" : getReimbursementScope(context);

  if (scope === "none") {
    return [];
  }

  const rows = await db
    .select({
      id: reimbursementRequests.id,
      employeeId: reimbursementRequests.employeeId,
      employeeName: employees.fullName,
      employeeRegistrationNumber: employees.registrationNumber,
      areaName: areas.name,
      employmentType: employees.employmentType,
      managerEmployeeId: employees.managerEmployeeId,
      title: reimbursementRequests.title,
      category: reimbursementRequests.category,
      amount: reimbursementRequests.amount,
      expenseDate: reimbursementRequests.expenseDate,
      status: reimbursementRequests.status,
      fileId: reimbursementRequests.fileId,
      includedInvoiceRequestId: reimbursementRequests.includedInvoiceRequestId,
      financialExpenseId: reimbursementRequests.financialExpenseId,
      paidAt: reimbursementRequests.paidAt,
      notes: reimbursementRequests.notes,
      createdAt: reimbursementRequests.createdAt,
      updatedAt: reimbursementRequests.updatedAt,
      managerApproverUserId: reimbursementRequests.managerApproverUserId,
      financeApproverUserId: reimbursementRequests.financeApproverUserId,
    })
    .from(reimbursementRequests)
    .innerJoin(employees, eq(reimbursementRequests.employeeId, employees.id))
    .innerJoin(areas, eq(employees.areaId, areas.id))
    .where(eq(reimbursementRequests.organizationId, organizationId))
    .orderBy(desc(reimbursementRequests.createdAt));

  const scoped = rows
    .filter((row) => {
      if (scope === "all") {
        return true;
      }

      if (scope === "own") {
        return row.employeeId === context.employeeId;
      }

      return canReadReimbursement(context, {
        employeeId: row.employeeId,
        managerEmployeeId: row.managerEmployeeId,
        status: row.status as ReimbursementStatus,
      });
    })
    .slice(0, options.limit);

  const invoicePayments = await loadInvoicePayments(organizationId, scoped.flatMap(row =>
    row.includedInvoiceRequestId ? [{ id: row.includedInvoiceRequestId, employeeId: row.employeeId }] : []));
  const directPayments = await loadDirectReimbursementPayments(organizationId, scoped.filter(row => row.financialExpenseId));
  const approverIds = new Set<string>();
  for (const row of scoped) {
    if (row.managerApproverUserId) approverIds.add(row.managerApproverUserId);
    if (row.financeApproverUserId) approverIds.add(row.financeApproverUserId);
  }

  const approverNameById = new Map<string, string>();
  if (approverIds.size > 0) {
    const approverRows = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, Array.from(approverIds)));

    for (const approver of approverRows) {
      approverNameById.set(approver.id, approver.name);
    }
  }

  return scoped.map((row) => ({
    ...row,
    ...(row.financialExpenseId || !row.includedInvoiceRequestId
      ? deriveDirectReimbursementPayment(row.status as ReimbursementStatus, row.paidAt, row.financialExpenseId, directPayments.get(row.id))
      : deriveReimbursementInvoicePayment(row.status as ReimbursementStatus, row.paidAt,
        row.includedInvoiceRequestId, invoicePayments.get(`${row.includedInvoiceRequestId}:${row.employeeId}`))),
    managerApproverName: row.managerApproverUserId
      ? approverNameById.get(row.managerApproverUserId) ?? null
      : null,
    financeApproverName: row.financeApproverUserId
      ? approverNameById.get(row.financeApproverUserId) ?? null
      : null,
  }));
}

async function listInvoiceEmployeeOptions(
  context: AccessContext,
): Promise<InvoiceEmployeeOption[]> {
  assertCanAny(["invoices.write", "invoices.approve"], context);
  const organizationId = requireOrganizationId(context);

  return db
    .select({
      id: employees.id,
      name: employees.fullName,
      areaName: areas.name,
      positionName: positions.name,
      currentCompensation: employees.currentCompensation,
      recurringCostAllowance: employees.recurringCostAllowance,
      recurringTransport: employees.recurringTransport,
    })
    .from(employees)
    .innerJoin(positions, eq(employees.positionId, positions.id))
    .innerJoin(areas, eq(employees.areaId, areas.id))
    .where(
      and(
        eq(employees.organizationId, organizationId),
        eq(employees.employmentType, "pj"),
        isNull(employees.deletedAt),
      ),
    )
    .orderBy(asc(employees.fullName));
}

export type OpenInvoiceOption = {
  id: string;
  competence: string;
  dueDate: string;
  expectedAmount: string;
  status: InvoiceRequestStatus;
};

async function listOpenInvoicesForEmployee(
  context: AccessContext,
  employeeId: string,
): Promise<OpenInvoiceOption[]> {
  const organizationId = requireOrganizationId(context);

  assertCanAny(["invoices.write"], context);

  const rows = await db
    .select({
      id: invoiceRequests.id,
      competence: invoiceRequests.competence,
      dueDate: invoiceRequests.dueDate,
      expectedAmount: invoiceRequests.expectedAmount,
      status: invoiceRequests.status,
    })
    .from(invoiceRequests)
    .where(
      and(
        eq(invoiceRequests.organizationId, organizationId),
        eq(invoiceRequests.employeeId, employeeId),
        isNull(invoiceRequests.deletedAt),
      ),
    )
    .orderBy(desc(invoiceRequests.competence));

  return rows
    .filter((row) => canEditInvoiceComposition(row.status as InvoiceRequestStatus))
    .map((row) => ({
      id: row.id,
      competence: row.competence,
      dueDate: row.dueDate,
      expectedAmount: row.expectedAmount,
      status: row.status as InvoiceRequestStatus,
    }));
}

async function loadInvoiceItems(invoiceRequestIds: readonly string[]) {
  const itemsByRequest = new Map<string, InvoiceRequestItem[]>();

  if (invoiceRequestIds.length === 0) {
    return itemsByRequest;
  }

  const rows = await db
    .select({
      id: invoiceRequestItems.id,
      invoiceRequestId: invoiceRequestItems.invoiceRequestId,
      label: invoiceRequestItems.label,
      amount: invoiceRequestItems.amount,
      kind: invoiceRequestItems.kind,
      sortOrder: invoiceRequestItems.sortOrder,
    })
    .from(invoiceRequestItems)
    .orderBy(asc(invoiceRequestItems.sortOrder));

  for (const row of rows) {
    if (!invoiceRequestIds.includes(row.invoiceRequestId)) {
      continue;
    }

    const items = itemsByRequest.get(row.invoiceRequestId) ?? [];

    items.push({
      id: row.id,
      label: row.label,
      amount: row.amount,
      kind: row.kind,
      sortOrder: row.sortOrder,
    });
    itemsByRequest.set(row.invoiceRequestId, items);
  }

  return itemsByRequest;
}

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return context.organizationId;
}

export {
  tenantGetPortalEmployeeSummary as getPortalEmployeeSummary,
  tenantListInvoiceRequests as listInvoiceRequests,
  tenantListReimbursements as listReimbursements,
  tenantListInvoiceEmployeeOptions as listInvoiceEmployeeOptions,
  tenantListOpenInvoicesForEmployee as listOpenInvoicesForEmployee,
};

const tenantGetPortalEmployeeSummary = bindTenantContext(getPortalEmployeeSummary);
const tenantListInvoiceRequests = bindTenantContext(listInvoiceRequests);
const tenantListReimbursements = bindTenantContext(listReimbursements);
const tenantListInvoiceEmployeeOptions = bindTenantContext(listInvoiceEmployeeOptions);
const tenantListOpenInvoicesForEmployee = bindTenantContext(listOpenInvoicesForEmployee);

// IDs come from reimbursement rows already authorized for own/team/all scope above.
async function loadDirectReimbursementPayments(org: string, scoped: readonly { id: string; employeeId: string }[]) {
  const payments = new Map<string, ReturnType<typeof deriveInvoicePayment>>();
  if (!scoped.length) return payments;
  const result = await db.execute(sql`select r.id,r.financial_expense_id,e.amount,e.status,
    coalesce(sum(case when t.id is not null then a.amount else 0 end),0)::text as paid,
    max(t.occurred_at) as paid_at
    from reimbursement_requests r left join financial_expenses e on e.id=r.financial_expense_id and e.organization_id=r.organization_id and e.deleted_at is null
    left join financial_allocations a on a.financial_expense_id=e.id and a.organization_id=r.organization_id
    left join financial_transactions t on t.id=a.transaction_id and t.organization_id=r.organization_id and t.direction='out' and t.status <> 'reversed'
    where r.organization_id=${org} and (${sql.join(scoped.map(row => sql`(r.id=${row.id}::uuid and r.employee_id=${row.employeeId}::uuid)`),sql` or `)})
    group by r.id,e.id`);
  for (const row of result.rows) payments.set(String(row.id), deriveInvoicePayment({ status: "approved", paidAt: null,
    financialExpenseId: row.financial_expense_id as string, payableAmount: row.amount as string | null,
    payableStatus: row.status as string | null, paidAmount: String(row.paid), lastPaymentAt: row.paid_at ? new Date(String(row.paid_at)) : null }));
  return payments;
}

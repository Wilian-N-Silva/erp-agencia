import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { bindTenantContext, db } from "@/lib/db";
import {
  areas,
  employees,
  invoiceRequestItems,
  invoiceRequests,
  reimbursementRequests,
  positions,
  users,
} from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
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
      approvedAt: invoiceRequests.approvedAt,
      paidAt: invoiceRequests.paidAt,
    })
    .from(invoiceRequests)
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

  return limitedRows.map((row) => ({
    ...row,
    status: row.status as InvoiceRequestStatus,
    items: itemsByRequest.get(row.id) ?? [],
    divergence: hasInvoiceDivergence(row.expectedAmount, row.issuedAmount),
  }));
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
    status: row.status as ReimbursementStatus,
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

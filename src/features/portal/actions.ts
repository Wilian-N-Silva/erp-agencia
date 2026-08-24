"use server";

import { randomUUID } from "node:crypto";

import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  areas,
  documents,
  employees,
  files,
  financialExpenses,
  invoiceRequestItems,
  invoiceRequests,
  reimbursementRequests,
  positions,
} from "@/lib/db/schema";
import {
  bindCurrentTenantContext,
  getCurrentAccessContext,
  type AccessContext,
} from "@/lib/dal";
import {
  enforceAuthenticatedRateLimit,
  withRateLimitActionResult,
} from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { formDataToObject, isoDateSchema, isoMonthSchema } from "@/lib/validation";
import {
  createStorageKey,
  getSha256Hex,
  putStorageObject,
} from "@/lib/storage";

import {
  validateUploadMetadata,
  type DocumentOwnerType,
  type DocumentType,
  type DocumentVisibility,
  type FileSensitivity,
} from "@/features/documents/rules";
import { normalizeMoneyInput } from "@/features/finance/rules";

import {
  buildSuggestedInvoiceDescription,
  calculateInvoiceExpectedAmount,
  canApproveReimbursementByFinance,
  canApproveReimbursementByManager,
  canExcludeReimbursementFromInvoice,
  canIncludeReimbursementInInvoice,
  canMarkInvoicePaid,
  canMarkReimbursementPaid,
  canReviewInvoice,
  canSubmitInvoiceRequest,
  hasInvoiceDivergence,
  invoiceItemKindLabels,
  reimbursementCategories,
  type InvoiceItemKind,
  type InvoiceRequestStatus,
  type ReimbursementStatus,
} from "./rules";

const competenceSchema = isoMonthSchema;
const dateSchema = isoDateSchema;
const idSchema = z.strictObject({
  id: z.string().uuid(),
});

const createInvoiceRequestSchema = z.strictObject({
  employeeId: z.string().uuid(),
  competence: competenceSchema,
  dueDate: dateSchema,
  baseAmount: z.string().trim().min(1).transform(normalizeMoneyInput),
  transportAmount: optionalMoneySchema(),
  allowanceAmount: optionalMoneySchema(),
  reimbursementAmount: optionalMoneySchema(),
  otherAmount: optionalMoneySchema(),
  discountAmount: optionalMoneySchema(),
  suggestedDescription: optionalTextSchema(700),
});

const submitInvoiceSchema = z.strictObject({
  id: z.string().uuid(),
  issuedAmount: z.string().trim().min(1).transform(normalizeMoneyInput),
});

const rejectInvoiceSchema = z.strictObject({
  id: z.string().uuid(),
  adjustment: z
    .string()
    .optional()
    .transform((value) => value === "on"),
});

const createReimbursementSchema = z.strictObject({
  title: z.string().trim().min(1).max(180),
  category: z
    .string()
    .trim()
    .refine((value) => (reimbursementCategories as readonly string[]).includes(value), {
      message: "Invalid category.",
    }),
  amount: z.string().trim().min(1).transform(normalizeMoneyInput),
  expenseDate: dateSchema,
  notes: optionalTextSchema(1000),
});

export type InvoiceRequestFormState = {
  ok: boolean;
  error?: string;
};

async function createInvoiceRequestFormAction(
  _prevState: InvoiceRequestFormState,
  formData: FormData,
): Promise<InvoiceRequestFormState> {
  try {
    await createInvoiceRequestAction(formData);
    return { ok: true };
  } catch (error) {
    if (error instanceof AccessDeniedError) {
      return { ok: false, error: "Você não tem permissão para criar composições." };
    }

    if (error instanceof z.ZodError) {
      const first = error.issues[0];
      return {
        ok: false,
        error: first?.message
          ? `Verifique os campos: ${first.message}.`
          : "Verifique os campos do formulário.",
      };
    }

    if (error instanceof Error) {
      if (error.message === "Invoice request already exists for this competence.") {
        return {
          ok: false,
          error: "Já existe uma composição de NF para esse colaborador e competência.",
        };
      }
      return { ok: false, error: error.message };
    }

    return { ok: false, error: "Não foi possível publicar a composição. Tente novamente." };
  }
}

async function createInvoiceRequestAction(formData: FormData) {
  const { context, organizationId } = await requireInvoiceWriterContext();
  const input = createInvoiceRequestSchema.parse(formDataToObject(formData));
  const employee = await getInvoiceEmployeeForWrite(input.employeeId, organizationId);
  const existing = await getInvoiceByEmployeeCompetence(
    input.employeeId,
    input.competence,
    organizationId,
  );

  if (existing) {
    throw new Error("Invoice request already exists for this competence.");
  }

  const items = buildInvoiceItems(input);
  const expectedAmount = calculateInvoiceExpectedAmount(items);
  const suggestedDescription =
    input.suggestedDescription ??
    buildSuggestedInvoiceDescription({
      areaName: employee.areaName,
      competence: input.competence,
      positionName: employee.positionName,
    });

  const [invoice] = await db
    .insert(invoiceRequests)
    .values({
      organizationId,
      employeeId: input.employeeId,
      competence: input.competence,
      dueDate: input.dueDate,
      expectedAmount,
      suggestedDescription,
      status: "published",
      createdByUserId: context.userId,
    })
    .returning();

  await db.insert(invoiceRequestItems).values(
    items.map((item, index) => ({
      invoiceRequestId: invoice.id,
      label: item.label,
      amount: item.amount,
      kind: item.kind,
      sortOrder: index,
    })),
  );

  await writeAuditLog(context, {
    action: "create",
    entityType: "invoice_request",
    entityId: invoice.id,
    after: invoice,
    metadata: {
      employeeId: input.employeeId,
      itemCount: items.length,
    },
  });

  revalidateInvoicePaths();
}

async function submitInvoiceRequestAction(formData: FormData) {
  const context = await requireCurrentContext();
  const input = submitInvoiceSchema.parse(formDataToObject(formData, ["file"]));
  const before = await getInvoiceForWrite(input.id, context.organizationId);

  if (
    !canSubmitInvoiceRequest(context, {
      employeeId: before.employeeId,
      status: before.status as InvoiceRequestStatus,
    })
  ) {
    throw new AccessDeniedError();
  }

  const uploadedFile = getRequiredUploadedFile(formData, "Invoice file is required.");
  const storedDocument = await storePortalDocument({
    context,
    documentType: "invoice",
    ownerEmployeeId: before.employeeId,
    ownerId: input.id,
    ownerType: "invoice_request",
    sensitivity: "restricted",
    uploadedFile,
    visibility: "employee_visible",
  });
  const divergence = hasInvoiceDivergence(before.expectedAmount, input.issuedAmount);
  const [after] = await db
    .update(invoiceRequests)
    .set({
      fileId: storedDocument.file.id,
      issuedAmount: input.issuedAmount,
      status: divergence ? "under_review" : "submitted",
      updatedAt: new Date(),
    })
    .where(eq(invoiceRequests.id, input.id))
    .returning();

  await writeAuditLog(context, {
    action: "update",
    entityType: "invoice_request",
    entityId: input.id,
    before,
    after,
    metadata: {
      documentId: storedDocument.document.id,
      divergence,
      fileId: storedDocument.file.id,
      source: "portal",
    },
  });

  revalidateInvoicePaths();
}

async function approveInvoiceRequestAction(formData: FormData) {
  const { context, organizationId } = await requireInvoiceApproverContext();
  await enforceAuthenticatedRateLimit("common_mutation", context);
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getInvoiceForWrite(input.id, organizationId);

  if (!canReviewInvoice(before.status as InvoiceRequestStatus)) {
    throw new Error("Invoice request cannot be approved from current status.");
  }

  const [after] = await db
    .update(invoiceRequests)
    .set({
      approvedByUserId: context.userId,
      approvedAt: new Date(),
      status: "approved",
      updatedAt: new Date(),
    })
    .where(eq(invoiceRequests.id, input.id))
    .returning();

  await db.insert(financialExpenses).values({
    organizationId,
    supplier: `PJ ${before.employeeId}`,
    category: "nota_fiscal_pj",
    description: `NF ${before.competence}`,
    amount: before.expectedAmount,
    dueDate: before.dueDate,
    competence: before.competence,
    status: "planned",
    recurring: false,
    responsibleUserId: context.userId,
  });

  await writeAuditLog(context, {
    action: "approve",
    entityType: "invoice_request",
    entityId: input.id,
    before,
    after,
    metadata: {
      generatedFinancialExpense: true,
    },
  });

  revalidateInvoicePaths();
  revalidatePath("/app/financeiro");
}

async function rejectInvoiceRequestAction(formData: FormData) {
  const { context, organizationId } = await requireInvoiceApproverContext();
  await enforceAuthenticatedRateLimit("common_mutation", context);
  const input = rejectInvoiceSchema.parse(formDataToObject(formData));
  const before = await getInvoiceForWrite(input.id, organizationId);

  if (!canReviewInvoice(before.status as InvoiceRequestStatus)) {
    throw new Error("Invoice request cannot be rejected from current status.");
  }

  const [after] = await db
    .update(invoiceRequests)
    .set({
      status: input.adjustment ? "adjustment_requested" : "rejected",
      updatedAt: new Date(),
    })
    .where(eq(invoiceRequests.id, input.id))
    .returning();

  await writeAuditLog(context, {
    action: input.adjustment ? "status_change" : "reject",
    entityType: "invoice_request",
    entityId: input.id,
    before,
    after,
    metadata: {
      status: after.status,
    },
  });

  revalidateInvoicePaths();
}

async function markInvoicePaidAction(formData: FormData) {
  const { context, organizationId } = await requireInvoiceApproverContext();
  await enforceAuthenticatedRateLimit("reconciliation", context);
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getInvoiceForWrite(input.id, organizationId);

  if (!canMarkInvoicePaid(before.status as InvoiceRequestStatus)) {
    throw new Error("Invoice request cannot be marked paid from current status.");
  }

  const [after] = await db
    .update(invoiceRequests)
    .set({
      paidAt: new Date(),
      status: "paid",
      updatedAt: new Date(),
    })
    .where(eq(invoiceRequests.id, input.id))
    .returning();

  const paidReimbursements = await db
    .update(reimbursementRequests)
    .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(reimbursementRequests.includedInvoiceRequestId, input.id),
        eq(reimbursementRequests.status, "included_in_invoice"),
      ),
    )
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "invoice_request",
    entityId: input.id,
    before,
    after,
    metadata: {
      status: "paid",
      cascadedReimbursementIds: paidReimbursements.map((row) => row.id),
    },
  });

  for (const reimbursement of paidReimbursements) {
    await writeAuditLog(context, {
      action: "status_change",
      entityType: "reimbursement_request",
      entityId: reimbursement.id,
      metadata: {
        status: "paid",
        reason: "invoice_paid_cascade",
        invoiceRequestId: input.id,
      },
    });
  }

  revalidateInvoicePaths();
  revalidateReimbursementPaths();
}

async function createReimbursementAction(formData: FormData) {
  const context = await requireCurrentContext();

  if (!context.employeeId || !context.organizationId) {
    throw new AccessDeniedError();
  }

  assertCan("reimbursements.read_own", context);
  const input = createReimbursementSchema.parse(
    formDataToObject(formData, ["file"]),
  );
  const uploadedFile = getUploadedFile(formData);
  const reimbursementId = randomUUID();
  const storedDocument = uploadedFile
    ? await storePortalDocument({
        context,
        documentType: "reimbursement_receipt",
        ownerEmployeeId: context.employeeId,
        ownerId: reimbursementId,
        ownerType: "reimbursement_request",
        sensitivity: "restricted",
        uploadedFile,
        visibility: "employee_visible",
      })
    : null;
  const [reimbursement] = await db
    .insert(reimbursementRequests)
    .values({
      id: reimbursementId,
      fileId: storedDocument?.file.id ?? null,
      organizationId: context.organizationId,
      employeeId: context.employeeId,
      title: input.title,
      category: input.category,
      amount: input.amount,
      expenseDate: input.expenseDate,
      status: "submitted",
      notes: input.notes,
    })
    .returning();

  await writeAuditLog(context, {
    action: "create",
    entityType: "reimbursement_request",
    entityId: reimbursement.id,
    after: reimbursement,
    metadata: storedDocument
      ? {
          documentId: storedDocument.document.id,
          fileId: storedDocument.file.id,
        }
      : undefined,
  });

  revalidateReimbursementPaths();
}

async function approveReimbursementByManagerAction(formData: FormData) {
  const context = await requireCurrentContext();
  await enforceAuthenticatedRateLimit("common_mutation", context);
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getReimbursementForWrite(input.id, context.organizationId);

  if (
    !canApproveReimbursementByManager(context, {
      employeeId: before.employeeId,
      managerEmployeeId: before.managerEmployeeId,
      status: before.status,
    })
  ) {
    throw new AccessDeniedError();
  }

  await updateReimbursementStatus(context, before, "manager_approved", "approve", {
    managerApproverUserId: context.userId,
  });
}

async function rejectReimbursementByManagerAction(formData: FormData) {
  const context = await requireCurrentContext();
  await enforceAuthenticatedRateLimit("common_mutation", context);
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getReimbursementForWrite(input.id, context.organizationId);

  if (
    !canApproveReimbursementByManager(context, {
      employeeId: before.employeeId,
      managerEmployeeId: before.managerEmployeeId,
      status: before.status,
    })
  ) {
    throw new AccessDeniedError();
  }

  await updateReimbursementStatus(context, before, "manager_rejected", "reject", {
    managerApproverUserId: context.userId,
  });
}

async function approveReimbursementByFinanceAction(formData: FormData) {
  const context = await requireCurrentContext();
  await enforceAuthenticatedRateLimit("common_mutation", context);
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getReimbursementForWrite(input.id, context.organizationId);

  if (
    !canApproveReimbursementByFinance(context, {
      employeeId: before.employeeId,
      managerEmployeeId: before.managerEmployeeId,
      status: before.status,
    })
  ) {
    throw new AccessDeniedError();
  }

  await updateReimbursementStatus(context, before, "finance_approved", "approve", {
    financeApproverUserId: context.userId,
  });
}

async function rejectReimbursementByFinanceAction(formData: FormData) {
  const context = await requireCurrentContext();
  await enforceAuthenticatedRateLimit("common_mutation", context);
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getReimbursementForWrite(input.id, context.organizationId);

  if (
    !canApproveReimbursementByFinance(context, {
      employeeId: before.employeeId,
      managerEmployeeId: before.managerEmployeeId,
      status: before.status,
    })
  ) {
    throw new AccessDeniedError();
  }

  await updateReimbursementStatus(context, before, "finance_rejected", "reject", {
    financeApproverUserId: context.userId,
  });
}

const includeReimbursementSchema = z.strictObject({
  reimbursementId: z.string().uuid(),
  invoiceRequestId: z.string().uuid(),
});

const excludeReimbursementSchema = z.strictObject({
  reimbursementId: z.string().uuid(),
});

async function includeReimbursementInInvoiceAction(formData: FormData) {
  const { context, organizationId } = await requireInvoiceWriterContext();
  const input = includeReimbursementSchema.parse(formDataToObject(formData));
  const reimbursementBefore = await getReimbursementForWrite(input.reimbursementId, organizationId);
  const invoiceBefore = await getInvoiceForWrite(input.invoiceRequestId, organizationId);

  if (
    !canIncludeReimbursementInInvoice(
      context,
      { employeeId: reimbursementBefore.employeeId, status: reimbursementBefore.status },
      {
        employeeId: invoiceBefore.employeeId,
        status: invoiceBefore.status as InvoiceRequestStatus,
      },
    )
  ) {
    throw new AccessDeniedError();
  }

  const reimbursementRow = await getReimbursementCompositionDetails(
    input.reimbursementId,
    organizationId,
  );

  const nextSortOrder = await getNextInvoiceItemSortOrder(input.invoiceRequestId);

  await db.insert(invoiceRequestItems).values({
    invoiceRequestId: input.invoiceRequestId,
    label: reimbursementRow.title,
    amount: reimbursementRow.amount,
    kind: "reimbursement",
    sortOrder: nextSortOrder,
    sourceReimbursementId: input.reimbursementId,
  });

  const newExpectedAmount = await recomputeInvoiceExpectedAmount(input.invoiceRequestId);

  const [invoiceAfter] = await db
    .update(invoiceRequests)
    .set({ expectedAmount: newExpectedAmount, updatedAt: new Date() })
    .where(eq(invoiceRequests.id, input.invoiceRequestId))
    .returning();

  await writeAuditLog(context, {
    action: "update",
    entityType: "invoice_request",
    entityId: input.invoiceRequestId,
    before: invoiceBefore,
    after: invoiceAfter,
    metadata: {
      reimbursementId: input.reimbursementId,
      reason: "include_reimbursement",
    },
  });

  await updateReimbursementStatus(
    context,
    reimbursementBefore,
    "included_in_invoice",
    "status_change",
    { includedInvoiceRequestId: input.invoiceRequestId },
  );
}

async function excludeReimbursementFromInvoiceAction(formData: FormData) {
  const { context, organizationId } = await requireInvoiceWriterContext();
  const input = excludeReimbursementSchema.parse(formDataToObject(formData));
  const reimbursementBefore = await getReimbursementForWrite(input.reimbursementId, organizationId);

  if (!reimbursementBefore.includedInvoiceRequestId) {
    throw new Error("Reimbursement is not linked to an invoice request.");
  }

  const invoiceBefore = await getInvoiceForWrite(
    reimbursementBefore.includedInvoiceRequestId,
    organizationId,
  );

  if (
    !canExcludeReimbursementFromInvoice(
      context,
      { status: reimbursementBefore.status },
      { status: invoiceBefore.status as InvoiceRequestStatus },
    )
  ) {
    throw new AccessDeniedError();
  }

  await db
    .delete(invoiceRequestItems)
    .where(eq(invoiceRequestItems.sourceReimbursementId, input.reimbursementId));

  const newExpectedAmount = await recomputeInvoiceExpectedAmount(invoiceBefore.id);

  const [invoiceAfter] = await db
    .update(invoiceRequests)
    .set({ expectedAmount: newExpectedAmount, updatedAt: new Date() })
    .where(eq(invoiceRequests.id, invoiceBefore.id))
    .returning();

  await writeAuditLog(context, {
    action: "update",
    entityType: "invoice_request",
    entityId: invoiceBefore.id,
    before: invoiceBefore,
    after: invoiceAfter,
    metadata: {
      reimbursementId: input.reimbursementId,
      reason: "exclude_reimbursement",
    },
  });

  await updateReimbursementStatus(
    context,
    reimbursementBefore,
    "finance_approved",
    "status_change",
    { includedInvoiceRequestId: null },
  );
}

async function markReimbursementPaidAction(formData: FormData) {
  const context = await requireCurrentContext();
  await enforceAuthenticatedRateLimit("reconciliation", context);
  const input = idSchema.parse(formDataToObject(formData));
  const before = await getReimbursementForWrite(input.id, context.organizationId);

  if (
    !canMarkReimbursementPaid(context, {
      employeeId: before.employeeId,
      managerEmployeeId: before.managerEmployeeId,
      status: before.status,
    })
  ) {
    throw new AccessDeniedError();
  }

  await updateReimbursementStatus(context, before, "paid", "status_change", {
    paidAt: new Date(),
  });
}

type AuthorizedContext = AccessContext & { organizationId: string };

type StorePortalDocumentInput = {
  context: AuthorizedContext;
  documentType: DocumentType;
  ownerEmployeeId: string | null;
  ownerId: string;
  ownerType: DocumentOwnerType;
  sensitivity: FileSensitivity;
  uploadedFile: File;
  visibility: DocumentVisibility;
};

async function requireCurrentContext(): Promise<AuthorizedContext> {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return {
    ...context,
    organizationId: context.organizationId,
  };
}

async function requireInvoiceWriterContext() {
  const context = await requireCurrentContext();

  assertCan("invoices.write", context);

  return {
    context,
    organizationId: context.organizationId,
  };
}

async function requireInvoiceApproverContext() {
  const context = await requireCurrentContext();

  assertCan("invoices.approve", context);

  return {
    context,
    organizationId: context.organizationId,
  };
}

async function getInvoiceEmployeeForWrite(employeeId: string, organizationId: string) {
  const [employee] = await db
    .select({
      id: employees.id,
      areaName: areas.name,
      employmentType: employees.employmentType,
      positionName: positions.name,
    })
    .from(employees)
    .innerJoin(positions, eq(employees.positionId, positions.id))
    .innerJoin(areas, eq(employees.areaId, areas.id))
    .where(
      and(
        eq(employees.id, employeeId),
        eq(employees.organizationId, organizationId),
        isNull(employees.deletedAt),
      ),
    )
    .limit(1);

  if (!employee || employee.employmentType !== "pj") {
    throw new AccessDeniedError();
  }

  return employee;
}

async function getInvoiceByEmployeeCompetence(
  employeeId: string,
  competence: string,
  organizationId: string,
) {
  const [invoice] = await db
    .select({ id: invoiceRequests.id })
    .from(invoiceRequests)
    .where(
      and(
        eq(invoiceRequests.employeeId, employeeId),
        eq(invoiceRequests.competence, competence),
        eq(invoiceRequests.organizationId, organizationId),
        isNull(invoiceRequests.deletedAt),
      ),
    )
    .limit(1);

  return invoice ?? null;
}

async function getInvoiceForWrite(id: string, organizationId: string | null) {
  if (!organizationId) {
    throw new AccessDeniedError();
  }

  const [invoice] = await db
    .select()
    .from(invoiceRequests)
    .where(
      and(
        eq(invoiceRequests.id, id),
        eq(invoiceRequests.organizationId, organizationId),
        isNull(invoiceRequests.deletedAt),
      ),
    )
    .limit(1);

  if (!invoice) {
    throw new AccessDeniedError();
  }

  return invoice;
}

async function getReimbursementForWrite(id: string, organizationId: string | null) {
  if (!organizationId) {
    throw new AccessDeniedError();
  }

  const [row] = await db
    .select({
      id: reimbursementRequests.id,
      organizationId: reimbursementRequests.organizationId,
      employeeId: reimbursementRequests.employeeId,
      managerEmployeeId: employees.managerEmployeeId,
      status: reimbursementRequests.status,
      includedInvoiceRequestId: reimbursementRequests.includedInvoiceRequestId,
    })
    .from(reimbursementRequests)
    .innerJoin(employees, eq(reimbursementRequests.employeeId, employees.id))
    .where(and(eq(reimbursementRequests.id, id), eq(reimbursementRequests.organizationId, organizationId)))
    .limit(1);

  if (!row) {
    throw new AccessDeniedError();
  }

  return {
    ...row,
    status: row.status as ReimbursementStatus,
  };
}

async function getReimbursementCompositionDetails(id: string, organizationId: string) {
  const [row] = await db
    .select({
      title: reimbursementRequests.title,
      amount: reimbursementRequests.amount,
    })
    .from(reimbursementRequests)
    .where(
      and(
        eq(reimbursementRequests.id, id),
        eq(reimbursementRequests.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!row) {
    throw new AccessDeniedError();
  }

  return row;
}

async function getNextInvoiceItemSortOrder(invoiceRequestId: string) {
  const rows = await db
    .select({ sortOrder: invoiceRequestItems.sortOrder })
    .from(invoiceRequestItems)
    .where(eq(invoiceRequestItems.invoiceRequestId, invoiceRequestId));

  const maxSortOrder = rows.reduce((max, row) => Math.max(max, row.sortOrder), -1);

  return maxSortOrder + 1;
}

async function recomputeInvoiceExpectedAmount(invoiceRequestId: string) {
  const rows = await db
    .select({
      amount: invoiceRequestItems.amount,
      kind: invoiceRequestItems.kind,
    })
    .from(invoiceRequestItems)
    .where(eq(invoiceRequestItems.invoiceRequestId, invoiceRequestId));

  return calculateInvoiceExpectedAmount(rows);
}

async function updateReimbursementStatus(
  context: Awaited<ReturnType<typeof requireCurrentContext>>,
  before: Awaited<ReturnType<typeof getReimbursementForWrite>>,
  status: ReimbursementStatus,
  action: "approve" | "reject" | "status_change",
  extra: Partial<typeof reimbursementRequests.$inferInsert>,
) {
  const [after] = await db
    .update(reimbursementRequests)
    .set({
      ...extra,
      status,
      updatedAt: new Date(),
    })
    .where(eq(reimbursementRequests.id, before.id))
    .returning();

  await writeAuditLog(context, {
    action,
    entityType: "reimbursement_request",
    entityId: before.id,
    before,
    after,
    metadata: {
      status,
    },
  });

  revalidateReimbursementPaths();
}

async function storePortalDocument(input: StorePortalDocumentInput) {
  await enforceAuthenticatedRateLimit("upload", input.context);
  const originalName = input.uploadedFile.name;
  const mimeType = input.uploadedFile.type || "application/octet-stream";
  const byteSize = input.uploadedFile.size;
  const upload = validateUploadMetadata({
    byteSize,
    mimeType,
    originalName,
  });
  const body = Buffer.from(await input.uploadedFile.arrayBuffer());
  const storedObject = await putStorageObject({
    body,
    contentType: upload.normalizedMimeType,
    key: createStorageKey({
      fileName: originalName,
      organizationId: input.context.organizationId,
      prefix: `documents/${input.ownerType}/${input.ownerId}`,
    }),
  });
  const [{ total }] = await db
    .select({ total: count() })
    .from(documents)
    .where(
      and(
        eq(documents.organizationId, input.context.organizationId),
        eq(documents.ownerType, input.ownerType),
        eq(documents.ownerId, input.ownerId),
        eq(documents.documentType, input.documentType),
      ),
    );
  const [file] = await db
    .insert(files)
    .values({
      organizationId: input.context.organizationId,
      ownerEmployeeId: input.ownerEmployeeId,
      storageProvider: storedObject.provider,
      bucket: storedObject.bucket,
      storageKey: storedObject.key,
      originalName,
      mimeType: upload.normalizedMimeType,
      extension: upload.extension,
      byteSize,
      sensitivity: input.sensitivity,
      checksum: getSha256Hex(body),
      uploadedByUserId: input.context.userId,
    })
    .returning();
  const [document] = await db
    .insert(documents)
    .values({
      organizationId: input.context.organizationId,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      documentType: input.documentType,
      fileId: file.id,
      visibility: input.visibility,
      version: total + 1,
      uploadedByUserId: input.context.userId,
    })
    .returning();

  await writeAuditLog(input.context, {
    action: "create",
    entityType: "file",
    entityId: file.id,
    after: {
      document,
      file,
    },
    metadata: {
      ownerId: input.ownerId,
      ownerType: input.ownerType,
      source: "portal",
    },
  });

  return {
    document,
    file,
  };
}

function buildInvoiceItems(input: z.infer<typeof createInvoiceRequestSchema>) {
  const rawItems: { amount: string | null; kind: InvoiceItemKind; label: string }[] = [
    {
      amount: input.baseAmount,
      kind: "base",
      label: invoiceItemKindLabels.base,
    },
    {
      amount: input.transportAmount,
      kind: "transport",
      label: invoiceItemKindLabels.transport,
    },
    {
      amount: input.allowanceAmount,
      kind: "allowance",
      label: invoiceItemKindLabels.allowance,
    },
    {
      amount: input.reimbursementAmount,
      kind: "reimbursement",
      label: invoiceItemKindLabels.reimbursement,
    },
    {
      amount: input.otherAmount,
      kind: "other",
      label: invoiceItemKindLabels.other,
    },
    {
      amount: input.discountAmount,
      kind: "discount",
      label: invoiceItemKindLabels.discount,
    },
  ];

  return rawItems.filter(
    (item): item is { amount: string; kind: InvoiceItemKind; label: string } =>
      Boolean(item.amount),
  );
}

function revalidateInvoicePaths() {
  revalidatePath("/portal");
  revalidatePath("/app/nfs");
}

function revalidateReimbursementPaths() {
  revalidatePath("/portal");
  revalidatePath("/app/reembolsos");
}

function getRequiredUploadedFile(formData: FormData, message: string) {
  const file = getUploadedFile(formData);

  if (!file) {
    throw new Error(message);
  }

  return file;
}

function getUploadedFile(formData: FormData) {
  const file = formData.get("file");

  return typeof File !== "undefined" && file instanceof File && file.size > 0 ? file : null;
}

function optionalTextSchema(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => value || null);
}

function optionalMoneySchema() {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? normalizeMoneyInput(value) : null));
}

export {
  tenantCreateInvoiceRequestFormAction as createInvoiceRequestFormAction,
  tenantCreateInvoiceRequestAction as createInvoiceRequestAction,
  tenantSubmitInvoiceRequestAction as submitInvoiceRequestAction,
  tenantApproveInvoiceRequestAction as approveInvoiceRequestAction,
  tenantRejectInvoiceRequestAction as rejectInvoiceRequestAction,
  tenantMarkInvoicePaidAction as markInvoicePaidAction,
  tenantCreateReimbursementAction as createReimbursementAction,
  tenantApproveReimbursementByManagerAction as approveReimbursementByManagerAction,
  tenantRejectReimbursementByManagerAction as rejectReimbursementByManagerAction,
  tenantApproveReimbursementByFinanceAction as approveReimbursementByFinanceAction,
  tenantRejectReimbursementByFinanceAction as rejectReimbursementByFinanceAction,
  tenantIncludeReimbursementInInvoiceAction as includeReimbursementInInvoiceAction,
  tenantExcludeReimbursementFromInvoiceAction as excludeReimbursementFromInvoiceAction,
  tenantMarkReimbursementPaidAction as markReimbursementPaidAction,
};

const tenantCreateInvoiceRequestFormAction = bindCurrentTenantContext(
  createInvoiceRequestFormAction,
);
const tenantCreateInvoiceRequestAction = bindCurrentTenantContext(
  createInvoiceRequestAction,
);
const tenantSubmitInvoiceRequestAction = withRateLimitActionResult(
  bindCurrentTenantContext(submitInvoiceRequestAction),
);
const tenantApproveInvoiceRequestAction = withRateLimitActionResult(
  bindCurrentTenantContext(approveInvoiceRequestAction),
);
const tenantRejectInvoiceRequestAction = withRateLimitActionResult(
  bindCurrentTenantContext(rejectInvoiceRequestAction),
);
const tenantMarkInvoicePaidAction = withRateLimitActionResult(
  bindCurrentTenantContext(markInvoicePaidAction),
);
const tenantCreateReimbursementAction = withRateLimitActionResult(
  bindCurrentTenantContext(createReimbursementAction),
);
const tenantApproveReimbursementByManagerAction = withRateLimitActionResult(
  bindCurrentTenantContext(approveReimbursementByManagerAction),
);
const tenantRejectReimbursementByManagerAction = withRateLimitActionResult(
  bindCurrentTenantContext(rejectReimbursementByManagerAction),
);
const tenantApproveReimbursementByFinanceAction = withRateLimitActionResult(
  bindCurrentTenantContext(approveReimbursementByFinanceAction),
);
const tenantRejectReimbursementByFinanceAction = withRateLimitActionResult(
  bindCurrentTenantContext(rejectReimbursementByFinanceAction),
);
const tenantIncludeReimbursementInInvoiceAction = bindCurrentTenantContext(
  includeReimbursementInInvoiceAction,
);
const tenantExcludeReimbursementFromInvoiceAction = bindCurrentTenantContext(
  excludeReimbursementFromInvoiceAction,
);
const tenantMarkReimbursementPaidAction = withRateLimitActionResult(
  bindCurrentTenantContext(markReimbursementPaidAction),
);

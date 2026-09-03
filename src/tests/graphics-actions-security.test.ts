import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccessDeniedError } from "@/lib/rbac";
import { createAccessContext } from "@/tests/helpers/access-context";

const mocks = vi.hoisted(() => ({
  enforceAuthenticatedRateLimit: vi.fn(),
  deleteStorageObject: vi.fn(),
  getCurrentAccessContext: vi.fn(),
  insert: vi.fn(),
  insertResults: [] as unknown[][],
  lockModes: [] as string[],
  revalidatePath: vi.fn(),
  putStorageObject: vi.fn(),
  runWithCurrentTenantDb: vi.fn(),
  select: vi.fn(),
  selectResults: [] as unknown[][],
  update: vi.fn(),
  updateSets: [] as unknown[],
  updateResults: [] as unknown[][],
  writeAuditLog: vi.fn(),
  generateWorkItem: vi.fn(),
  resolveWorkItem: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/features/work-items/dal", () => ({
  generateWorkItem: mocks.generateWorkItem,
  resolveWorkItem: mocks.resolveWorkItem,
}));
vi.mock("@/lib/db", () => ({
  db: {
    insert: mocks.insert,
    select: mocks.select,
    update: mocks.update,
  },
}));
vi.mock("@/lib/dal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dal")>();
  return {
    ...actual,
    getCurrentAccessContext: mocks.getCurrentAccessContext,
    runWithCurrentTenantDb: mocks.runWithCurrentTenantDb,
  };
});
vi.mock("@/lib/rate-limit", () => ({
  enforceAuthenticatedRateLimit: mocks.enforceAuthenticatedRateLimit,
  withRateLimitActionResult: (operation: (...args: unknown[]) => Promise<unknown>) => operation,
}));
vi.mock("@/lib/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/storage")>();
  return {
    ...actual,
    deleteStorageObject: mocks.deleteStorageObject,
    putStorageObject: mocks.putStorageObject,
  };
});

import {
  approveGraphicSupplierQuoteAction,
  createGraphicSupplierQuoteAction,
  createGraphicJobAction,
  deleteGraphicJobAction,
  updateGraphicJobAction,
  rejectGraphicSupplierQuoteAction,
} from "@/features/graphics/actions";

const organizationId = "30000000-0000-4000-8000-000000000001";
const jobId = "40000000-0000-4000-8000-000000000001";

describe("graphic job Action security boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceAuthenticatedRateLimit.mockReset();
    mocks.deleteStorageObject.mockReset();
    mocks.putStorageObject.mockReset();
    mocks.writeAuditLog.mockReset();
    mocks.generateWorkItem.mockReset();
    mocks.resolveWorkItem.mockReset();
    mocks.selectResults.length = 0;
    mocks.insertResults.length = 0;
    mocks.lockModes.length = 0;
    mocks.updateResults.length = 0;
    mocks.updateSets.length = 0;
    mocks.runWithCurrentTenantDb.mockImplementation(
      (operation: () => Promise<unknown>) => operation(),
    );
    mocks.putStorageObject.mockResolvedValue({
      bucket: "quotes",
      key: "graphics/supplier-quotes/quote/valid.pdf",
      provider: "r2",
    });
    mocks.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          let result: unknown[] | undefined;
          const getResult = () => result ??= mocks.selectResults.shift() ?? [];
          const limit = vi.fn().mockImplementation(() => Promise.resolve(getResult()));
          return {
            for: vi.fn().mockImplementation((mode: string) => {
              mocks.lockModes.push(mode);
              return { limit };
            }),
            limit,
            then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
              Promise.resolve(getResult()).then(resolve, reject),
          };
        }),
      }),
    }));
    mocks.update.mockImplementation(() => ({
      set: vi.fn().mockImplementation((values) => {
        mocks.updateSets.push(values);
        return {
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockImplementation(() =>
              Promise.resolve(mocks.updateResults.shift() ?? []),
            ),
          }),
        };
      }),
    }));
    mocks.insert.mockImplementation(() => ({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockImplementation(() =>
          Promise.resolve(mocks.insertResults.shift() ?? []),
        ),
      }),
    }));
  });

  it("denies users without graphics.write before rate limit or database access", async () => {
    mocks.getCurrentAccessContext.mockResolvedValue(createAccessContext({
      permissions: ["graphics.read"],
      roles: [],
      userId: "reader",
    }));

    await expect(createGraphicJobAction(new FormData())).rejects.toBeInstanceOf(AccessDeniedError);
    expect(mocks.enforceAuthenticatedRateLimit).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it.each([
    ["update", updateGraphicJobAction, validUpdateForm],
    ["archive", deleteGraphicJobAction, validDeleteForm],
  ])("denies %s without graphics.write before database access", async (
    _operation,
    action,
    formFactory,
  ) => {
    mocks.getCurrentAccessContext.mockResolvedValue(createAccessContext({
      organizationId,
      permissions: ["graphics.read"],
      roles: [],
      userId: "reader",
    }));

    await expect(action(formFactory())).rejects.toBeInstanceOf(AccessDeniedError);
    expect(mocks.enforceAuthenticatedRateLimit).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("rejects organization and status mass assignment before database access", async () => {
    const context = writerContext();
    mocks.getCurrentAccessContext.mockResolvedValue(context);
    const form = validForm();
    form.set("organizationId", "90000000-0000-4000-8000-000000000009");
    form.set("operationalStatus", "closed");

    await expect(createGraphicJobAction(form)).rejects.toThrow();
    expect(mocks.enforceAuthenticatedRateLimit).toHaveBeenCalledWith("common_mutation", context);
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it.each([
    ["update", updateGraphicJobAction, validUpdateForm],
    ["archive", deleteGraphicJobAction, validDeleteForm],
  ])("rejects server-owned fields in the %s payload before database access", async (
    _operation,
    action,
    formFactory,
  ) => {
    mocks.getCurrentAccessContext.mockResolvedValue(writerContext());
    const form = formFactory();
    form.set("organizationId", "90000000-0000-4000-8000-000000000009");
    form.set("operationalStatus", "closed");

    await expect(action(form)).rejects.toThrow();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("stops a rate-limited mutation before validation and database access", async () => {
    const context = writerContext();
    mocks.getCurrentAccessContext.mockResolvedValue(context);
    mocks.enforceAuthenticatedRateLimit.mockRejectedValue(new Error("rate limited"));

    await expect(createGraphicJobAction(validForm())).rejects.toThrow("rate limited");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("requires the dedicated supplier quote write permission", async () => {
    mocks.getCurrentAccessContext.mockResolvedValue(writerContext());

    await expect(createGraphicSupplierQuoteAction(validQuoteForm())).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    expect(mocks.enforceAuthenticatedRateLimit).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it.each([
    ["approve", approveGraphicSupplierQuoteAction, validApprovalForm],
    ["reject", rejectGraphicSupplierQuoteAction, validRejectionForm],
  ])("requires the dedicated supplier quote approval permission to %s", async (
    _decision,
    action,
    formFactory,
  ) => {
    mocks.getCurrentAccessContext.mockResolvedValue(quoteWriterContext());

    await expect(action(formFactory())).rejects.toBeInstanceOf(AccessDeniedError);
    expect(mocks.enforceAuthenticatedRateLimit).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("requires a rejection reason before reading or changing a quote", async () => {
    mocks.getCurrentAccessContext.mockResolvedValue(quoteApproverContext());
    const form = validApprovalForm();

    await expect(rejectGraphicSupplierQuoteAction(form)).rejects.toThrow();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rejects server-owned reviewer and status fields in approval payloads", async () => {
    mocks.getCurrentAccessContext.mockResolvedValue(quoteApproverContext());
    const form = validApprovalForm();
    form.set("status", "approved");
    form.set("reviewerUserId", "attacker");

    await expect(approveGraphicSupplierQuoteAction(form)).rejects.toThrow();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("denies approval of a known cross-tenant quote id", async () => {
    mocks.getCurrentAccessContext.mockResolvedValue(quoteApproverContext());
    mocks.selectResults.push([]);

    await expect(approveGraphicSupplierQuoteAction(validApprovalForm()))
      .rejects.toBeInstanceOf(AccessDeniedError);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("approves a quote, advances the job, and resolves its work item atomically", async () => {
    let transactionActive = false;
    const context = quoteApproverContext();
    const quote = pendingQuote();
    const job = approvalPendingJob();
    mocks.getCurrentAccessContext.mockResolvedValue(context);
    mocks.runWithCurrentTenantDb.mockImplementation(async (operation: () => Promise<unknown>) => {
      transactionActive = true;
      try { return await operation(); } finally { transactionActive = false; }
    });
    mocks.selectResults.push([job], [quote], []);
    mocks.updateResults.push(
      [{ ...quote, status: "approved", reviewerUserId: context.userId, reviewedAt: new Date() }],
      [{ ...job, operationalStatus: "os_pending" }],
      [],
    );
    mocks.generateWorkItem.mockResolvedValue({
      item: { id: "70000000-0000-4000-8000-000000000001", status: "open" },
    });
    mocks.resolveWorkItem.mockImplementation(async () => {
      expect(transactionActive).toBe(true);
    });

    await approveGraphicSupplierQuoteAction(validApprovalForm());

    expect(mocks.updateSets).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "approved", reviewerUserId: context.userId }),
      expect.objectContaining({ operationalStatus: "os_pending" }),
    ]));
    expect(mocks.generateWorkItem).toHaveBeenCalledOnce();
    expect(mocks.resolveWorkItem).toHaveBeenCalledOnce();
    expect(mocks.writeAuditLog).toHaveBeenCalledTimes(2);
    expect(mocks.runWithCurrentTenantDb).toHaveBeenCalledOnce();
    expect(transactionActive).toBe(false);
  });

  it("rejects a quote with reason and returns a job without alternatives to sourcing", async () => {
    const context = quoteApproverContext();
    const quote = pendingQuote();
    const job = approvalPendingJob();
    mocks.getCurrentAccessContext.mockResolvedValue(context);
    mocks.selectResults.push([job], [quote], []);
    mocks.updateResults.push(
      [{ ...quote, status: "rejected", reviewerUserId: context.userId, rejectionReason: "Prazo incompatível" }],
      [{ ...job, operationalStatus: "supplier_sourcing" }],
    );
    mocks.generateWorkItem.mockResolvedValue({
      item: { id: "70000000-0000-4000-8000-000000000001", status: "open" },
    });

    await rejectGraphicSupplierQuoteAction(validRejectionForm());

    expect(mocks.updateSets).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: "rejected", rejectionReason: "Prazo incompatível" }),
      expect.objectContaining({ operationalStatus: "supplier_sourcing" }),
    ]));
    expect(mocks.resolveWorkItem).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ resolution: "Cotacao rejeitada: Prazo incompatível" }),
    );
    expect(mocks.writeAuditLog).toHaveBeenCalledTimes(2);
  });

  it("rejects quote approval fields as mass assignment before database access", async () => {
    const context = quoteWriterContext();
    mocks.getCurrentAccessContext.mockResolvedValue(context);
    const form = validQuoteForm();
    form.set("organizationId", "90000000-0000-4000-8000-000000000009");
    form.set("status", "approved");
    form.set("reviewerUserId", "attacker");

    await expect(createGraphicSupplierQuoteAction(form)).rejects.toThrow();
    expect(mocks.enforceAuthenticatedRateLimit).toHaveBeenCalledWith("common_mutation", context);
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects a cross-tenant job id when creating a quote", async () => {
    mocks.getCurrentAccessContext.mockResolvedValue(quoteWriterContext());
    mocks.selectResults.push([], [{ id: "supplier" }]);

    await expect(createGraphicSupplierQuoteAction(validQuoteForm())).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    expect(mocks.select).toHaveBeenCalledOnce();
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it("keeps quote creation and its history in one transaction boundary", async () => {
    let transactionActive = false;
    mocks.getCurrentAccessContext.mockResolvedValue(quoteWriterContext());
    mocks.runWithCurrentTenantDb.mockImplementation(async (operation: () => Promise<unknown>) => {
      transactionActive = true;
      try { return await operation(); } finally { transactionActive = false; }
    });
    mocks.selectResults.push([quoteSubmissionJob()], [{ id: "supplier" }]);
    mocks.insertResults.push([{
      id: "60000000-0000-4000-8000-000000000001",
      jobId,
      status: "pending",
    }]);
    mocks.updateResults.push([{ ...quoteSubmissionJob(), operationalStatus: "supplier_approval_pending" }]);
    mocks.writeAuditLog.mockImplementation(async () => {
      expect(transactionActive).toBe(true);
      throw new Error("audit failed");
    });

    await expect(createGraphicSupplierQuoteAction(validQuoteForm())).rejects.toThrow("audit failed");
    expect(mocks.runWithCurrentTenantDb).toHaveBeenCalledOnce();
    expect(mocks.insert).toHaveBeenCalledOnce();
    expect(mocks.writeAuditLog).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("submits a new quote for approval and creates a deduplicated work item", async () => {
    const context = quoteWriterContext();
    const job = quoteSubmissionJob();
    const quote = pendingQuote();
    mocks.getCurrentAccessContext.mockResolvedValue(context);
    mocks.selectResults.push([job], [{ id: "supplier" }]);
    mocks.insertResults.push([quote]);
    mocks.updateResults.push([{ ...job, operationalStatus: "supplier_approval_pending" }]);

    await createGraphicSupplierQuoteAction(validQuoteForm());

    expect(mocks.lockModes).toContain("update");
    expect(mocks.updateSets).toContainEqual(expect.objectContaining({
      operationalStatus: "supplier_approval_pending",
    }));
    expect(mocks.generateWorkItem).toHaveBeenCalledWith(context, expect.objectContaining({
      kind: "graphic_supplier_quote_approval",
      occurrenceKey: "internal_approval",
      sourceId: quote.id,
      sourceType: "graphic_supplier_quote",
    }));
    expect(mocks.writeAuditLog).toHaveBeenCalledTimes(2);
  });

  it("removes uploaded objects when a later attachment has an invalid signature", async () => {
    const storedObject = {
      bucket: "quotes",
      key: "graphics/supplier-quotes/quote/valid.pdf",
      provider: "r2" as const,
    };
    mocks.getCurrentAccessContext.mockResolvedValue(quoteWriterContext());
    mocks.putStorageObject.mockResolvedValue(storedObject);
    mocks.selectResults.push([quoteSubmissionJob()], [{ id: "supplier" }]);
    mocks.insertResults.push(
      [{ id: "60000000-0000-4000-8000-000000000001", jobId, status: "pending" }],
      [{ id: "70000000-0000-4000-8000-000000000001" }],
      [{ id: "80000000-0000-4000-8000-000000000001" }],
    );
    const form = validQuoteForm();
    form.append(
      "attachments",
      attachmentFile("%PDF-1.7\nvalid", "valid.pdf"),
    );
    form.append(
      "attachments",
      attachmentFile("invalid", "invalid.pdf"),
    );

    await expect(createGraphicSupplierQuoteAction(form)).rejects.toThrow(
      /anexo n.o corresponde ao tipo informado/,
    );
    expect(mocks.putStorageObject).toHaveBeenCalledOnce();
    expect(mocks.deleteStorageObject).toHaveBeenCalledOnce();
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith(storedObject);
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("removes uploaded objects when audit failure rolls back quote metadata", async () => {
    const storedObject = {
      bucket: "quotes",
      key: "graphics/supplier-quotes/quote/valid.pdf",
      provider: "r2" as const,
    };
    mocks.getCurrentAccessContext.mockResolvedValue(quoteWriterContext());
    mocks.putStorageObject.mockResolvedValue(storedObject);
    mocks.selectResults.push([quoteSubmissionJob()], [{ id: "supplier" }]);
    mocks.insertResults.push(
      [{ id: "60000000-0000-4000-8000-000000000001", jobId, status: "pending" }],
      [{ id: "70000000-0000-4000-8000-000000000001" }],
      [{ id: "80000000-0000-4000-8000-000000000001" }],
    );
    mocks.updateResults.push([{ ...quoteSubmissionJob(), operationalStatus: "supplier_approval_pending" }]);
    mocks.writeAuditLog.mockRejectedValue(new Error("audit failed"));
    const form = validQuoteForm();
    form.append("attachments", attachmentFile("%PDF-1.7\nvalid", "valid.pdf"));

    await expect(createGraphicSupplierQuoteAction(form)).rejects.toThrow("audit failed");
    expect(mocks.deleteStorageObject).toHaveBeenCalledOnce();
    expect(mocks.deleteStorageObject).toHaveBeenCalledWith(storedObject);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ["update", updateGraphicJobAction, validUpdateForm],
    ["archive", deleteGraphicJobAction, validDeleteForm],
  ])("denies %s of a known cross-tenant job id without writing or auditing", async (
    _operation,
    action,
    formFactory,
  ) => {
    mocks.getCurrentAccessContext.mockResolvedValue(writerContext());
    mocks.selectResults.push([]);

    await expect(action(formFactory())).rejects.toBeInstanceOf(AccessDeniedError);
    expect(mocks.select).toHaveBeenCalledOnce();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it.each([
    ["client", 1],
    ["responsible employee", 2],
    ["project", 3],
  ])("rejects an update referencing a cross-tenant %s", async (
    _reference,
    missingResultIndex,
  ) => {
    mocks.getCurrentAccessContext.mockResolvedValue(writerContext());
    const referenceResults = [[{ id: "owned" }], [{ id: "owned" }], [{ id: "owned" }]];
    referenceResults[missingResultIndex - 1] = [];
    mocks.selectResults.push([existingJob()], ...referenceResults);

    await expect(updateGraphicJobAction(validUpdateForm())).rejects.toBeInstanceOf(
      AccessDeniedError,
    );
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it.each([
    ["update", updateGraphicJobAction, validUpdateForm, true],
    ["archive", deleteGraphicJobAction, validDeleteForm, false],
  ])("keeps the %s write and audit in one transaction boundary", async (
    _operation,
    action,
    formFactory,
    validatesReferences,
  ) => {
    const auditError = new Error("audit failed");
    let transactionActive = false;
    mocks.getCurrentAccessContext.mockResolvedValue(writerContext());
    mocks.runWithCurrentTenantDb.mockImplementation(async (operation: () => Promise<unknown>) => {
      transactionActive = true;
      try {
        return await operation();
      } finally {
        transactionActive = false;
      }
    });
    mocks.selectResults.push([existingJob()]);
    if (validatesReferences) {
      mocks.selectResults.push([{ id: "client" }], [{ id: "employee" }], [{ id: "project" }]);
    }
    mocks.updateResults.push([{ ...existingJob(), title: "Atualizado" }]);
    mocks.writeAuditLog.mockImplementation(async () => {
      expect(transactionActive).toBe(true);
      throw auditError;
    });

    await expect(action(formFactory())).rejects.toBe(auditError);
    expect(mocks.runWithCurrentTenantDb).toHaveBeenCalledOnce();
    expect(mocks.update).toHaveBeenCalledOnce();
    expect(mocks.writeAuditLog).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(transactionActive).toBe(false);
  });
});

function writerContext() {
  return createAccessContext({
    organizationId,
    permissions: ["graphics.write"],
    roles: [],
    userId: "writer",
  });
}

function quoteWriterContext() {
  return createAccessContext({
    organizationId,
    permissions: ["graphics.supplier_quote_write"],
    roles: [],
    userId: "quote-writer",
  });
}

function quoteApproverContext() {
  return createAccessContext({
    organizationId,
    permissions: ["graphics.supplier_quote_approve"],
    roles: [],
    userId: "quote-approver",
  });
}

function pendingQuote() {
  return {
    id: "60000000-0000-4000-8000-000000000001",
    jobId,
    status: "pending",
  };
}

function approvalPendingJob() {
  return {
    ...quoteSubmissionJob(),
    organizationId,
    operationalStatus: "supplier_approval_pending",
  };
}

function existingJob() {
  return {
    id: jobId,
    organizationId,
    title: "Banner",
  };
}

function quoteSubmissionJob() {
  return {
    id: jobId,
    internalCode: "GRF-42",
    operationalStatus: "supplier_sourcing",
    responsibleEmployeeId: "20000000-0000-4000-8000-000000000001",
    title: "Banner",
  };
}

function validForm() {
  const form = new FormData();
  form.set("clientId", "10000000-0000-4000-8000-000000000001");
  form.set("description", "Material promocional");
  form.set("desiredDeliveryAt", "");
  form.set("internalCode", "GRF-42");
  form.set("notes", "");
  form.set("projectId", "50000000-0000-4000-8000-000000000001");
  form.set("requestedAt", "2026-09-02");
  form.set("responsibleEmployeeId", "20000000-0000-4000-8000-000000000001");
  form.set("title", "Banner");
  return form;
}

function validUpdateForm() {
  const form = validForm();
  form.set("id", jobId);
  return form;
}

function validDeleteForm() {
  const form = new FormData();
  form.set("id", jobId);
  return form;
}

function validQuoteForm() {
  const form = new FormData();
  form.set("jobId", jobId);
  form.set("supplierId", "50000000-0000-4000-8000-000000000001");
  form.set("description", "Impressão e acabamento");
  form.set("quotedAmount", "1250,00");
  form.set("quotedAt", "2026-09-03");
  form.set("estimatedDeliveryAt", "2026-09-10");
  form.set("conditions", "50% na entrada");
  return form;
}

function validApprovalForm() {
  const form = new FormData();
  form.set("id", "60000000-0000-4000-8000-000000000001");
  form.set("jobId", jobId);
  return form;
}

function validRejectionForm() {
  const form = validApprovalForm();
  form.set("rejectionReason", "Prazo incompatível");
  return form;
}

function attachmentFile(contents: string, name: string) {
  const body = new TextEncoder().encode(contents);
  const file = new File([body], name, { type: "application/pdf" });
  Object.defineProperty(file, "arrayBuffer", {
    value: async () => body.buffer,
  });
  return file;
}

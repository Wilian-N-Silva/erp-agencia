import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccessDeniedError } from "@/lib/rbac";
import { createAccessContext } from "@/tests/helpers/access-context";

const mocks = vi.hoisted(() => ({
  enforceAuthenticatedRateLimit: vi.fn(),
  getCurrentAccessContext: vi.fn(),
  insert: vi.fn(),
  revalidatePath: vi.fn(),
  runWithCurrentTenantDb: vi.fn(),
  select: vi.fn(),
  selectResults: [] as unknown[][],
  update: vi.fn(),
  updateResults: [] as unknown[][],
  writeAuditLog: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
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

import {
  createGraphicJobAction,
  deleteGraphicJobAction,
  updateGraphicJobAction,
} from "@/features/graphics/actions";

const organizationId = "30000000-0000-4000-8000-000000000001";
const jobId = "40000000-0000-4000-8000-000000000001";

describe("graphic job Action security boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforceAuthenticatedRateLimit.mockReset();
    mocks.writeAuditLog.mockReset();
    mocks.selectResults.length = 0;
    mocks.updateResults.length = 0;
    mocks.runWithCurrentTenantDb.mockImplementation(
      (operation: () => Promise<unknown>) => operation(),
    );
    mocks.select.mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() =>
            Promise.resolve(mocks.selectResults.shift() ?? []),
          ),
        }),
      }),
    }));
    mocks.update.mockImplementation(() => ({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockImplementation(() =>
            Promise.resolve(mocks.updateResults.shift() ?? []),
          ),
        }),
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

function existingJob() {
  return {
    id: jobId,
    organizationId,
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

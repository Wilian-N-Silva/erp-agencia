import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enforceAuthenticatedRateLimit: vi.fn(),
  getCurrentAccessContext: vi.fn(),
  insert: vi.fn(),
  putStorageObject: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("better-auth/crypto", () => ({ hashPassword: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/db", () => ({
  db: {
    insert: mocks.insert,
    select: mocks.select,
    update: mocks.update,
  },
}));
vi.mock("@/lib/dal", () => ({
  bindCurrentTenantContext: (operation: unknown) => operation,
  getCurrentAccessContext: mocks.getCurrentAccessContext,
  runWithCurrentTenantDb: (operation: () => unknown) => operation(),
}));
vi.mock("@/lib/rate-limit", () => ({
  enforceAuthenticatedRateLimit: mocks.enforceAuthenticatedRateLimit,
}));
vi.mock("@/lib/rbac", () => ({
  AccessDeniedError: class AccessDeniedError extends Error {},
  assertCan: vi.fn(),
  can: vi.fn().mockReturnValue(true),
  canAny: vi.fn().mockReturnValue(true),
  isRoleKey: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/storage", () => ({
  createStorageKey: vi.fn(),
  getSha256Hex: vi.fn(),
  putStorageObject: mocks.putStorageObject,
}));

import { registerDocumentAction } from "@/features/documents/actions";
import {
  cancelFinancialEntryAction,
  cancelFinancialExpenseAction,
  markFinancialEntryReceivedAction,
  markFinancialExpensePaidAction,
} from "@/features/finance/actions";
import {
  createReimbursementAction,
  markInvoicePaidAction,
  markReimbursementPaidAction,
} from "@/features/portal/actions";
import { createSettingsUserAction } from "@/features/settings/actions";

const context = {
  employeeId: "30000000-0000-4000-8000-000000000001",
  organizationId: "10000000-0000-4000-8000-000000000001",
  roles: ["finance"],
  userId: "user-1",
};
const blockedError = new Error("rate limit exceeded");

describe("critical Action rate-limit entrypoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAccessContext.mockResolvedValue(context);
    mocks.enforceAuthenticatedRateLimit.mockRejectedValue(blockedError);
  });

  it("blocks invitations before validating or writing user data", async () => {
    await expect(createSettingsUserAction(new FormData())).rejects.toBe(blockedError);

    expectRateLimit("invitation");
    expectNoDataOrStorageAccess();
  });

  it("blocks document uploads before reading or writing document data", async () => {
    await expect(registerDocumentAction(createDocumentUploadForm())).rejects.toBe(
      blockedError,
    );

    expectRateLimit("upload");
    expectNoDataOrStorageAccess();
  });

  it("blocks portal reimbursement uploads before storage or data writes", async () => {
    await expect(createReimbursementAction(createReimbursementUploadForm())).rejects.toBe(
      blockedError,
    );

    expectRateLimit("upload");
    expectNoDataOrStorageAccess();
  });

  it.each([
    ["receiving a financial entry", markFinancialEntryReceivedAction],
    ["cancelling a financial entry", cancelFinancialEntryAction],
    ["paying a financial expense", markFinancialExpensePaidAction],
    ["cancelling a financial expense", cancelFinancialExpenseAction],
    ["paying an invoice request", markInvoicePaidAction],
    ["paying a reimbursement", markReimbursementPaidAction],
  ])("blocks %s before reading or writing financial data", async (_label, action) => {
    await expect(action(new FormData())).rejects.toBe(blockedError);

    expectRateLimit("reconciliation");
    expectNoDataOrStorageAccess();
  });
});

function createDocumentUploadForm() {
  const formData = new FormData();
  formData.set("ownerType", "employee");
  formData.set("ownerId", context.employeeId);
  formData.set("documentType", "other");
  formData.set("sensitivity", "restricted");
  formData.set("visibility", "internal");
  formData.set("file", new File(["document"], "document.pdf", { type: "application/pdf" }));
  return formData;
}

function createReimbursementUploadForm() {
  const formData = new FormData();
  formData.set("title", "Taxi");
  formData.set("category", "Transporte por aplicativo");
  formData.set("amount", "50.00");
  formData.set("expenseDate", "2026-08-18");
  formData.set("file", new File(["receipt"], "receipt.pdf", { type: "application/pdf" }));
  return formData;
}

function expectRateLimit(action: "invitation" | "reconciliation" | "upload") {
  expect(mocks.enforceAuthenticatedRateLimit).toHaveBeenCalledTimes(1);
  expect(mocks.enforceAuthenticatedRateLimit).toHaveBeenCalledWith(action, context);
}

function expectNoDataOrStorageAccess() {
  expect(mocks.select).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.putStorageObject).not.toHaveBeenCalled();
  expect(mocks.writeAuditLog).not.toHaveBeenCalled();
}

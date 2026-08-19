import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  delete: vi.fn(),
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
    delete: mocks.delete,
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
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/rate-limit")>();

  return {
    ...actual,
    enforceAuthenticatedRateLimit: mocks.enforceAuthenticatedRateLimit,
  };
});
vi.mock("@/lib/rbac", () => ({
  AccessDeniedError: class AccessDeniedError extends Error {},
  assertCan: vi.fn(),
  assertCanAny: vi.fn(),
  can: vi.fn().mockReturnValue(true),
  canAny: vi.fn().mockReturnValue(true),
  isRoleKey: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/storage", () => ({
  createStorageKey: vi.fn(),
  getSha256Hex: vi.fn(),
  putStorageObject: mocks.putStorageObject,
}));

import {
  approveAccessRecordAction,
  markAccessRemovedAction,
} from "@/features/accesses/actions";
import { registerDocumentAction } from "@/features/documents/actions";
import {
  cancelFinancialEntryAction,
  cancelFinancialExpenseAction,
  markFinancialEntryReceivedAction,
  markFinancialExpensePaidAction,
} from "@/features/finance/actions";
import {
  approveInvoiceRequestAction,
  approveReimbursementByFinanceAction,
  approveReimbursementByManagerAction,
  createReimbursementAction,
  markInvoicePaidAction,
  markReimbursementPaidAction,
  rejectInvoiceRequestAction,
  rejectReimbursementByFinanceAction,
  rejectReimbursementByManagerAction,
} from "@/features/portal/actions";
import {
  createSettingsUserAction,
  updateSettingsUserRolesAction,
  updateSettingsUserStatusAction,
} from "@/features/settings/actions";
import {
  approveTimeOffRequestAction,
  rejectTimeOffRequestAction,
} from "@/features/timeoff/actions";
import {
  RATE_LIMIT_ERROR_MESSAGE,
  RateLimitExceededError,
} from "@/lib/rate-limit";

const context = {
  employeeId: "30000000-0000-4000-8000-000000000001",
  organizationId: "10000000-0000-4000-8000-000000000001",
  roles: ["finance"],
  userId: "user-1",
};
const retryAfterSeconds = 37;
const blockedError = new RateLimitExceededError({
  allowed: false,
  limit: 1,
  remaining: 0,
  resetAt: new Date("2026-08-18T12:01:00.000Z"),
  retryAfterSeconds,
});
const blockedActionError = {
  code: "RATE_LIMITED",
  message: RATE_LIMIT_ERROR_MESSAGE,
  ok: false,
  retryAfterSeconds,
};

describe("critical Action rate-limit entrypoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAccessContext.mockResolvedValue(context);
    mocks.enforceAuthenticatedRateLimit.mockRejectedValue(blockedError);
  });

  it("blocks invitations before validating or writing user data", async () => {
    await expect(createSettingsUserAction(new FormData())).resolves.toEqual(
      blockedActionError,
    );

    expectRateLimit("invitation");
    expectNoDataOrStorageAccess();
  });

  it.each([
    ["role changes", updateSettingsUserRolesAction],
    ["activation changes", updateSettingsUserStatusAction],
  ])("blocks user %s before validating or writing access data", async (_label, action) => {
    await expect(action(new FormData())).resolves.toEqual(blockedActionError);

    expectRateLimit("invitation");
    expectNoDataOrStorageAccess();
  });

  it("blocks document uploads before reading or writing document data", async () => {
    await expect(registerDocumentAction(createDocumentUploadForm())).resolves.toEqual(
      blockedActionError,
    );

    expectRateLimit("upload");
    expectNoDataOrStorageAccess();
  });

  it("blocks legacy document registration without a File before data writes", async () => {
    await expect(registerDocumentAction(createLegacyDocumentForm())).resolves.toEqual(
      blockedActionError,
    );

    expectRateLimit("upload");
    expectNoDataOrStorageAccess();
  });

  it("blocks portal reimbursement uploads before storage or data writes", async () => {
    await expect(createReimbursementAction(createReimbursementUploadForm())).resolves.toEqual(
      blockedActionError,
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
    await expect(action(new FormData())).resolves.toEqual(blockedActionError);

    expectRateLimit("reconciliation");
    expectNoDataOrStorageAccess();
  });

  it.each([
    ["approving an invoice request", approveInvoiceRequestAction],
    ["rejecting an invoice request", rejectInvoiceRequestAction],
    ["manager-approving a reimbursement", approveReimbursementByManagerAction],
    ["manager-rejecting a reimbursement", rejectReimbursementByManagerAction],
    ["finance-approving a reimbursement", approveReimbursementByFinanceAction],
    ["finance-rejecting a reimbursement", rejectReimbursementByFinanceAction],
    ["approving a time-off request", approveTimeOffRequestAction],
    ["rejecting a time-off request", rejectTimeOffRequestAction],
    ["approving an access record", approveAccessRecordAction],
    ["removing an access record", markAccessRemovedAction],
  ])("blocks %s before reading or writing business data", async (_label, action) => {
    await expect(action(new FormData())).resolves.toEqual(blockedActionError);

    expectRateLimit("common_mutation");
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

function createLegacyDocumentForm() {
  const formData = new FormData();
  formData.set("ownerType", "employee");
  formData.set("ownerId", context.employeeId);
  formData.set("documentType", "other");
  formData.set("sensitivity", "restricted");
  formData.set("visibility", "internal");
  formData.set("originalName", "legacy-document.pdf");
  formData.set("mimeType", "application/pdf");
  formData.set("byteSize", "1024");
  formData.set("storageKey", "legacy/documents/legacy-document.pdf");
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

function expectRateLimit(
  action: "common_mutation" | "invitation" | "reconciliation" | "upload",
) {
  expect(mocks.enforceAuthenticatedRateLimit).toHaveBeenCalledTimes(1);
  expect(mocks.enforceAuthenticatedRateLimit).toHaveBeenCalledWith(action, context);
}

function expectNoDataOrStorageAccess() {
  expect(mocks.select).not.toHaveBeenCalled();
  expect(mocks.insert).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.delete).not.toHaveBeenCalled();
  expect(mocks.putStorageObject).not.toHaveBeenCalled();
  expect(mocks.writeAuditLog).not.toHaveBeenCalled();
}

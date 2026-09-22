import { describe, expect, it } from "vitest";

import { canReadClientFinancialValues, canWriteClients } from "@/features/clients/rules";
import {
  canReadDocument,
  canReadOwnDocument,
  validateUploadMetadata,
} from "@/features/documents/rules";
import {
  canExportAuditReport,
  canReadAuditPayloads,
  getVisibleAuditEntityTypes,
} from "@/features/audit/rules";
import {
  canApproveInvoiceRequest,
  canApproveReimbursementByFinance,
  canApproveReimbursementByManager,
  canReadInvoiceRequest,
  canReadReimbursement,
  canSubmitInvoiceRequest,
  canSubmitReimbursement,
} from "@/features/portal/rules";
import { canReadCompensationForTarget, canWriteCompensation } from "@/features/people/rules";
import { canReadTimeOff, canReadVacationBalance } from "@/features/timeoff/rules";
import { canManageSettings } from "@/features/settings/rules";
import { createAccessContext } from "@/tests/helpers/access-context";
import { assertCan } from "@/lib/rbac";
import { getStorageConfig } from "@/lib/storage";

describe("security critical permission boundaries", () => {
  it("denies finance and settings operations to common employees", () => {
    const context = createAccessContext({
      userId: "employee_1",
      employeeId: "employee_1",
      roles: ["employee"],
    });

    expect(canReadClientFinancialValues(context)).toBe(false);
    expect(canManageSettings(context)).toBe(false);
    expect(() => assertCan("finance.read", context)).toThrow("Access denied.");
    expect(() => assertCan("settings.manage", context)).toThrow("Access denied.");
  });

  it("keeps technical admin out of financial and personal document data by default", () => {
    const context = createAccessContext({
      userId: "tech_1",
      roles: ["technical_admin"],
    });

    expect(canReadClientFinancialValues(context)).toBe(false);
    expect(
      canReadDocument(context, {
        ownerEmployeeId: "employee_1",
        sensitivity: "sensitive",
        visibility: "restricted",
      }),
    ).toBe(false);
  });

  it("prevents document IDOR for unrelated employee-visible documents", () => {
    const context = createAccessContext({
      userId: "employee_1",
      employeeId: "employee_1",
      roles: ["employee"],
    });

    expect(
      canReadOwnDocument(context, {
        ownerEmployeeId: "employee_2",
        sensitivity: "restricted",
        visibility: "employee_visible",
      }),
    ).toBe(false);
    expect(
      canReadOwnDocument(context, {
        ownerEmployeeId: "employee_1",
        sensitivity: "highly_sensitive",
        visibility: "employee_visible",
      }),
    ).toBe(false);
  });

  it("does not expose audit payloads or user logs to limited audit readers", () => {
    const context = createAccessContext({
      userId: "finance_1",
      roles: ["finance"],
    });

    expect(canReadAuditPayloads(context)).toBe(false);
    expect(canExportAuditReport(context)).toBe(false);
    expect(getVisibleAuditEntityTypes(context)).not.toContain("user");
  });
});

describe("security critical upload boundaries", () => {
  it("rejects disallowed upload types and oversized files", () => {
    expect(() =>
      validateUploadMetadata({
        byteSize: 100,
        mimeType: "application/x-msdownload",
        originalName: "malware.exe",
      }),
    ).toThrow("MIME type");
    expect(() =>
      validateUploadMetadata(
        {
          byteSize: 101,
          mimeType: "application/pdf",
          originalName: "document.pdf",
        },
        100,
      ),
    ).toThrow("size exceeds");
  });

  it("falls back to local storage when R2 secrets are not configured", () => {
    expect(
      getStorageConfig({
        LOCAL_UPLOAD_DIR: "uploads",
        STORAGE_BUCKET: "bucket",
      }).provider,
    ).toBe("local");
  });
});

describe("security critical IDOR boundaries", () => {
  const ownerContext = createAccessContext({
    userId: "user_owner",
    employeeId: "employee_owner",
    roles: ["employee"],
  });

  it("denies cross-employee read on invoice requests when scope is read_own", () => {
    expect(
      canReadInvoiceRequest(ownerContext, { employeeId: "employee_other" }),
    ).toBe(false);
    expect(
      canReadInvoiceRequest(ownerContext, { employeeId: "employee_owner" }),
    ).toBe(true);
  });

  it("denies submission of someone else's invoice request even with own scope", () => {
    expect(
      canSubmitInvoiceRequest(ownerContext, {
        employeeId: "employee_other",
        status: "draft",
      }),
    ).toBe(false);
  });

  it("denies cross-employee read on reimbursements when scope is read_own", () => {
    expect(
      canReadReimbursement(ownerContext, { employeeId: "employee_other", status: "submitted" }),
    ).toBe(false);
    expect(
      canReadReimbursement(ownerContext, { employeeId: "employee_owner", status: "submitted" }),
    ).toBe(true);
  });

  it("denies submission of someone else's reimbursement", () => {
    expect(
      canSubmitReimbursement(ownerContext, {
        employeeId: "employee_other",
        status: "draft",
      }),
    ).toBe(false);
  });

  it("denies cross-employee read on time-off requests when scope is read_own", () => {
    expect(
      canReadTimeOff(ownerContext, { employeeId: "employee_other", status: "approved" }),
    ).toBe(false);
    expect(
      canReadTimeOff(ownerContext, { employeeId: "employee_owner", status: "approved" }),
    ).toBe(true);
  });

  it("denies cross-employee read on vacation balances when scope is read_own", () => {
    expect(
      canReadVacationBalance(ownerContext, {
        employeeId: "employee_other",
        status: "active",
      }),
    ).toBe(false);
  });
});

describe("security critical vertical privilege escalation", () => {
  const employee = createAccessContext({
    userId: "employee_1",
    employeeId: "employee_1",
    roles: ["employee"],
  });

  it("blocks an employee from finance writes and approvals", () => {
    expect(() => assertCan("finance.read", employee)).toThrow("Access denied.");
    expect(() => assertCan("finance.write", employee)).toThrow("Access denied.");
    expect(canApproveInvoiceRequest(employee)).toBe(false);
  });

  it("blocks an employee from settings, people writes, and compensation", () => {
    expect(canManageSettings(employee)).toBe(false);
    expect(() => assertCan("people.write", employee)).toThrow("Access denied.");
    expect(canWriteCompensation(employee)).toBe(false);
    expect(canWriteClients(employee)).toBe(false);
  });

  it("does not let a different employee approve another's reimbursement by tampering with team scope", () => {
    const otherTeamLeader = createAccessContext({
      userId: "leader_1",
      employeeId: "leader_1",
      roles: ["leadership"],
    });

    expect(
      canApproveReimbursementByManager(otherTeamLeader, {
        employeeId: "employee_target",
        managerEmployeeId: "leader_2",
        status: "submitted",
      }),
    ).toBe(false);
  });
});

describe("security critical status / payload tamper boundaries", () => {
  const employee = createAccessContext({
    userId: "employee_1",
    employeeId: "employee_1",
    roles: ["employee"],
  });

  it("ignores client-supplied non-submittable status for invoice submission", () => {
    expect(
      canSubmitInvoiceRequest(employee, {
        employeeId: "employee_1",
        status: "approved",
      }),
    ).toBe(false);
    expect(
      canSubmitInvoiceRequest(employee, {
        employeeId: "employee_1",
        status: "paid",
      }),
    ).toBe(false);
  });

  it("ignores client-supplied non-submittable status for reimbursement submission", () => {
    expect(
      canSubmitReimbursement(employee, {
        employeeId: "employee_1",
        status: "manager_approved",
      }),
    ).toBe(false);
    expect(
      canSubmitReimbursement(employee, {
        employeeId: "employee_1",
        status: "paid",
      }),
    ).toBe(false);
  });

  it("blocks finance approval on reimbursements that are not in submitted/manager_approved", () => {
    const finance = createAccessContext({
      userId: "finance_1",
      roles: ["finance"],
    });

    expect(
      canApproveReimbursementByFinance(finance, {
        employeeId: "employee_1",
        status: "draft",
      }),
    ).toBe(false);
    expect(
      canApproveReimbursementByFinance(finance, {
        employeeId: "employee_1",
        status: "paid",
      }),
    ).toBe(false);
  });
});

describe("security critical compensation visibility", () => {
  it("hides compensation values from employees outside finance/people scope", () => {
    const employee = createAccessContext({
      userId: "employee_1",
      employeeId: "employee_1",
      roles: ["employee"],
    });

    expect(
      canReadCompensationForTarget(employee, { employeeId: "employee_2" }),
    ).toBe(false);
  });

  it("exposes compensation to finance users with the right permission", () => {
    const finance = createAccessContext({
      userId: "finance_1",
      roles: ["finance"],
    });

    expect(
      canReadCompensationForTarget(finance, { employeeId: "employee_2" }),
    ).toBe(true);
  });
});

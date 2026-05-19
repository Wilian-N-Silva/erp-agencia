import { describe, expect, it } from "vitest";

import { canReadClientFinancialValues } from "@/features/clients/rules";
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
import { canManageSettings } from "@/features/settings/rules";
import { createAccessContext } from "@/lib/dal";
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

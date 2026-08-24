import { describe, expect, it } from "vitest";

import {
  canReadDocument,
  canReadOwnDocument,
  validateUploadMetadata,
} from "@/features/documents/rules";
import {
  calculateBusinessDays,
  calculateCalendarDays,
  canApproveTimeOff,
  getTimeOffDisplayType,
} from "@/features/timeoff/rules";
import { createAccessContext } from "@/tests/helpers/access-context";

describe("document metadata rules", () => {
  it("accepts allowed upload metadata", () => {
    expect(
      validateUploadMetadata({
        byteSize: 1024,
        mimeType: "application/pdf",
        originalName: "contrato.pdf",
      }),
    ).toEqual({
      extension: "pdf",
      normalizedMimeType: "application/pdf",
    });
  });

  it("rejects blocked mime types, mismatched extensions and oversized files", () => {
    expect(() =>
      validateUploadMetadata({
        byteSize: 1024,
        mimeType: "text/plain",
        originalName: "contrato.txt",
      }),
    ).toThrow(/MIME/);
    expect(() =>
      validateUploadMetadata({
        byteSize: 1024,
        mimeType: "application/pdf",
        originalName: "contrato.png",
      }),
    ).toThrow(/extension/);
    expect(() =>
      validateUploadMetadata(
        {
          byteSize: 2048,
          mimeType: "application/pdf",
          originalName: "contrato.pdf",
        },
        1024,
      ),
    ).toThrow(/size/);
  });

  it("protects sensitive documents and allows employee-visible own documents", () => {
    const writer = createAccessContext({
      userId: "writer_1",
      employeeId: "employee_writer",
      roles: ["employee"],
      permissions: ["documents.write"],
    });
    const sensitiveReader = createAccessContext({
      userId: "reader_1",
      roles: ["employee"],
      permissions: ["documents.read_sensitive"],
    });
    const owner = createAccessContext({
      userId: "employee_1",
      employeeId: "employee_1",
      roles: ["employee"],
      permissions: ["documents.read_own"],
    });

    expect(
      canReadDocument(writer, {
        ownerEmployeeId: "employee_1",
        sensitivity: "sensitive",
        visibility: "restricted",
      }),
    ).toBe(false);
    expect(
      canReadDocument(sensitiveReader, {
        ownerEmployeeId: "employee_1",
        sensitivity: "highly_sensitive",
        visibility: "restricted",
      }),
    ).toBe(true);
    expect(
      canReadOwnDocument(owner, {
        ownerEmployeeId: "employee_1",
        sensitivity: "restricted",
        visibility: "employee_visible",
      }),
    ).toBe(true);
    expect(
      canReadOwnDocument(owner, {
        ownerEmployeeId: "employee_1",
        sensitivity: "highly_sensitive",
        visibility: "employee_visible",
      }),
    ).toBe(false);
  });
});

describe("time off rules", () => {
  it("calculates calendar and business days", () => {
    expect(calculateCalendarDays("2026-05-15", "2026-05-18")).toBe(4);
    expect(calculateBusinessDays("2026-05-15", "2026-05-18")).toBe(2);
    expect(() => calculateCalendarDays("2026-05-18", "2026-05-15")).toThrow(/End date/);
  });

  it("maps vacation wording by employment type", () => {
    expect(getTimeOffDisplayType("clt", "vacation")).toBe("Ferias");
    expect(getTimeOffDisplayType("pj", "vacation")).toBe("Pausa programada");
  });

  it("allows HR and direct leaders to approve requested time off", () => {
    const hr = createAccessContext({
      userId: "hr_1",
      roles: ["hr_admin"],
    });
    const leader = createAccessContext({
      userId: "leader_1",
      employeeId: "leader_employee_1",
      roles: ["leadership"],
    });
    const employee = createAccessContext({
      userId: "employee_1",
      employeeId: "employee_1",
      roles: ["employee"],
    });

    expect(
      canApproveTimeOff(hr, {
        employeeId: "employee_1",
        managerEmployeeId: null,
        status: "requested",
      }),
    ).toBe(true);
    expect(
      canApproveTimeOff(leader, {
        employeeId: "employee_1",
        managerEmployeeId: "leader_employee_1",
        status: "requested",
      }),
    ).toBe(true);
    expect(
      canApproveTimeOff(employee, {
        employeeId: "employee_2",
        managerEmployeeId: null,
        status: "requested",
      }),
    ).toBe(false);
    expect(
      canApproveTimeOff(leader, {
        employeeId: "employee_1",
        managerEmployeeId: "leader_employee_1",
        status: "approved",
      }),
    ).toBe(false);
  });
});

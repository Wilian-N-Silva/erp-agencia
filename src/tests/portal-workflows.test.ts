import { describe, expect, it } from "vitest";

import {
  buildSuggestedInvoiceDescription,
  calculateInvoiceExpectedAmount,
  canApproveReimbursementByFinance,
  canApproveReimbursementByManager,
  canReadInvoiceRequest,
  canSubmitInvoice,
  canSubmitInvoiceRequest,
  getReimbursementScope,
  hasInvoiceDivergence,
} from "@/features/portal/rules";
import { createAccessContext } from "@/lib/dal";

describe("portal invoice rules", () => {
  it("calculates expected invoice totals with discounts", () => {
    expect(
      calculateInvoiceExpectedAmount([
        { amount: "5000.00", kind: "base" },
        { amount: "300.00", kind: "allowance" },
        { amount: "100.00", kind: "transport" },
        { amount: "250.00", kind: "reimbursement" },
        { amount: "50.00", kind: "discount" },
      ]),
    ).toBe("5600.00");
  });

  it("detects issued amount divergence", () => {
    expect(hasInvoiceDivergence("1000.00", "1000.00")).toBe(false);
    expect(hasInvoiceDivergence("1000.00", "999.99")).toBe(true);
    expect(hasInvoiceDivergence("1000.00", null)).toBe(false);
  });

  it("allows only own collaborator to submit published invoice requests", () => {
    const employeeContext = createAccessContext({
      userId: "employee_1",
      employeeId: "employee_1",
      roles: ["employee"],
    });

    expect(canSubmitInvoice("published")).toBe(true);
    expect(
      canSubmitInvoiceRequest(employeeContext, {
        employeeId: "employee_1",
        status: "published",
      }),
    ).toBe(true);
    expect(
      canSubmitInvoiceRequest(employeeContext, {
        employeeId: "employee_2",
        status: "published",
      }),
    ).toBe(false);
  });

  it("keeps invoice reads scoped to own records unless finance can read all", () => {
    const employeeContext = createAccessContext({
      userId: "employee_1",
      employeeId: "employee_1",
      roles: ["employee"],
    });
    const financeContext = createAccessContext({
      userId: "finance_1",
      roles: ["finance"],
    });

    expect(canReadInvoiceRequest(employeeContext, { employeeId: "employee_1" })).toBe(true);
    expect(canReadInvoiceRequest(employeeContext, { employeeId: "employee_2" })).toBe(false);
    expect(canReadInvoiceRequest(financeContext, { employeeId: "employee_2" })).toBe(true);
  });

  it("builds the suggested PJ invoice description", () => {
    expect(
      buildSuggestedInvoiceDescription({
        areaName: "Operacoes",
        competence: "2026-05",
        positionName: "Analista",
      }),
    ).toContain("05/2026");
  });
});

describe("reimbursement workflow rules", () => {
  it("scopes reimbursements to finance, direct leaders, or own records", () => {
    const financeContext = createAccessContext({
      userId: "finance_1",
      roles: ["finance"],
    });
    const leaderContext = createAccessContext({
      userId: "leader_1",
      employeeId: "manager_1",
      roles: ["leadership"],
    });
    const employeeContext = createAccessContext({
      userId: "employee_1",
      employeeId: "employee_1",
      roles: ["employee"],
    });

    expect(getReimbursementScope(financeContext)).toBe("all");
    expect(getReimbursementScope(leaderContext)).toBe("team");
    expect(getReimbursementScope(employeeContext)).toBe("own");
  });

  it("allows manager and finance approvals only from valid states", () => {
    const leaderContext = createAccessContext({
      userId: "leader_1",
      employeeId: "manager_1",
      roles: ["leadership"],
    });
    const financeContext = createAccessContext({
      userId: "finance_1",
      roles: ["finance"],
    });

    expect(
      canApproveReimbursementByManager(leaderContext, {
        employeeId: "employee_1",
        managerEmployeeId: "manager_1",
        status: "submitted",
      }),
    ).toBe(true);
    expect(
      canApproveReimbursementByManager(leaderContext, {
        employeeId: "employee_1",
        managerEmployeeId: "manager_2",
        status: "submitted",
      }),
    ).toBe(false);
    expect(
      canApproveReimbursementByFinance(financeContext, {
        employeeId: "employee_1",
        status: "manager_approved",
      }),
    ).toBe(true);
  });
});

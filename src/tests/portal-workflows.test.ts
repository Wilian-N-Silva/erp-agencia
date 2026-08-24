import { describe, expect, it } from "vitest";

import {
  buildSuggestedInvoiceDescription,
  calculateInvoiceExpectedAmount,
  canApproveReimbursementByFinance,
  canApproveReimbursementByManager,
  canEditInvoiceComposition,
  canExcludeReimbursementFromInvoice,
  canIncludeReimbursementInInvoice,
  canReadInvoiceRequest,
  canSubmitInvoice,
  canSubmitInvoiceRequest,
  getReimbursementScope,
  hasInvoiceDivergence,
} from "@/features/portal/rules";
import { createAccessContext } from "@/tests/helpers/access-context";

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

describe("reimbursement inclusion in invoice composition", () => {
  const financeContext = createAccessContext({
    userId: "finance_1",
    roles: ["finance"],
  });
  const employeeContext = createAccessContext({
    userId: "employee_1",
    employeeId: "employee_1",
    roles: ["employee"],
  });

  it("treats only pre-approval invoice statuses as composition-editable", () => {
    expect(canEditInvoiceComposition("draft")).toBe(true);
    expect(canEditInvoiceComposition("published")).toBe(true);
    expect(canEditInvoiceComposition("adjustment_requested")).toBe(true);
    expect(canEditInvoiceComposition("submitted")).toBe(false);
    expect(canEditInvoiceComposition("approved")).toBe(false);
    expect(canEditInvoiceComposition("paid")).toBe(false);
  });

  it("allows finance to include a finance-approved reimbursement in an editable invoice for the same employee", () => {
    expect(
      canIncludeReimbursementInInvoice(
        financeContext,
        { employeeId: "employee_1", status: "finance_approved" },
        { employeeId: "employee_1", status: "published" },
      ),
    ).toBe(true);
  });

  it("rejects inclusion when employees do not match", () => {
    expect(
      canIncludeReimbursementInInvoice(
        financeContext,
        { employeeId: "employee_1", status: "finance_approved" },
        { employeeId: "employee_2", status: "published" },
      ),
    ).toBe(false);
  });

  it("rejects inclusion when the invoice is no longer editable", () => {
    expect(
      canIncludeReimbursementInInvoice(
        financeContext,
        { employeeId: "employee_1", status: "finance_approved" },
        { employeeId: "employee_1", status: "approved" },
      ),
    ).toBe(false);
  });

  it("rejects inclusion when the reimbursement is not finance-approved", () => {
    expect(
      canIncludeReimbursementInInvoice(
        financeContext,
        { employeeId: "employee_1", status: "manager_approved" },
        { employeeId: "employee_1", status: "published" },
      ),
    ).toBe(false);
  });

  it("rejects inclusion for users without invoices.write permission", () => {
    expect(
      canIncludeReimbursementInInvoice(
        employeeContext,
        { employeeId: "employee_1", status: "finance_approved" },
        { employeeId: "employee_1", status: "published" },
      ),
    ).toBe(false);
  });

  it("allows exclusion only while the invoice is still editable", () => {
    expect(
      canExcludeReimbursementFromInvoice(
        financeContext,
        { status: "included_in_invoice" },
        { status: "published" },
      ),
    ).toBe(true);
    expect(
      canExcludeReimbursementFromInvoice(
        financeContext,
        { status: "included_in_invoice" },
        { status: "approved" },
      ),
    ).toBe(false);
    expect(
      canExcludeReimbursementFromInvoice(
        financeContext,
        { status: "finance_approved" },
        { status: "published" },
      ),
    ).toBe(false);
  });

  it("recomputes expected amount when reimbursements are added", () => {
    const before = calculateInvoiceExpectedAmount([
      { amount: "5000.00", kind: "base" },
      { amount: "100.00", kind: "transport" },
    ]);
    const after = calculateInvoiceExpectedAmount([
      { amount: "5000.00", kind: "base" },
      { amount: "100.00", kind: "transport" },
      { amount: "250.00", kind: "reimbursement" },
    ]);

    expect(before).toBe("5100.00");
    expect(after).toBe("5350.00");
  });
});

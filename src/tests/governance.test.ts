import { describe, expect, it } from "vitest";

import {
  getAccessReviewState,
  isAccessReviewAlert,
  isTerminatedEmployeeAccessAlert,
} from "@/features/accesses/rules";
import {
  canReadEquipment,
  equipmentStatusRequiresEmployee,
  getNextEquipmentAssetNumber,
  isEquipmentReturnAlert,
} from "@/features/equipment/rules";
import {
  canReadSaasCost,
  canReadSaasSubscription,
  getSaasRenewalState,
} from "@/features/saas/rules";
import { createAccessContext } from "@/lib/dal";

describe("equipment governance rules", () => {
  it("generates sequential asset numbers and enforces responsible statuses", () => {
    expect(getNextEquipmentAssetNumber(["EQ-00001", "EQ-00003", "LEGACY"])).toBe("EQ-00004");
    expect(equipmentStatusRequiresEmployee("in_use")).toBe(true);
    expect(equipmentStatusRequiresEmployee("pending_return")).toBe(true);
    expect(equipmentStatusRequiresEmployee("available")).toBe(false);
  });

  it("scopes equipment to own and direct team assignments", () => {
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
      canReadEquipment(leader, {
        currentEmployeeId: "employee_1",
        currentEmployeeManagerId: "leader_employee_1",
        status: "in_use",
      }),
    ).toBe(true);
    expect(
      canReadEquipment(employee, {
        currentEmployeeId: "employee_1",
        currentEmployeeManagerId: "leader_employee_1",
        status: "in_use",
      }),
    ).toBe(true);
    expect(
      canReadEquipment(employee, {
        currentEmployeeId: "employee_2",
        currentEmployeeManagerId: "leader_employee_1",
        status: "in_use",
      }),
    ).toBe(false);
  });

  it("flags pending return and terminated employee assignments", () => {
    expect(
      isEquipmentReturnAlert({
        currentEmployeeId: "employee_1",
        currentEmployeeStatus: "active",
        status: "pending_return",
      }),
    ).toBe(true);
    expect(
      isEquipmentReturnAlert({
        currentEmployeeId: "employee_1",
        currentEmployeeStatus: "terminated",
        status: "in_use",
      }),
    ).toBe(true);
  });
});

describe("access record rules", () => {
  it("detects critical access review states", () => {
    expect(
      getAccessReviewState(
        {
          critical: true,
          reviewDueDate: "2026-05-20",
          status: "active",
        },
        "2026-05-14",
      ),
    ).toBe("due_soon");
    expect(
      getAccessReviewState(
        {
          critical: true,
          reviewDueDate: "2026-05-01",
          status: "active",
        },
        "2026-05-14",
      ),
    ).toBe("overdue");
    expect(
      isAccessReviewAlert({
        critical: true,
        employeeId: "employee_1",
        reviewDueDate: null,
        status: "active",
      }),
    ).toBe(true);
  });

  it("flags active access for terminated employees", () => {
    expect(
      isTerminatedEmployeeAccessAlert({
        critical: false,
        employeeId: "employee_1",
        employeeStatus: "terminated",
        status: "active",
      }),
    ).toBe(true);
  });

  it("does not flag terminated-employee alert when access is already removed", () => {
    expect(
      isTerminatedEmployeeAccessAlert({
        critical: true,
        employeeId: "employee_1",
        employeeStatus: "terminated",
        status: "removed",
      }),
    ).toBe(false);
  });

  it("does not flag terminated-employee alert when employee is still active", () => {
    expect(
      isTerminatedEmployeeAccessAlert({
        critical: true,
        employeeId: "employee_1",
        employeeStatus: "active",
        status: "active",
      }),
    ).toBe(false);
    expect(
      isTerminatedEmployeeAccessAlert({
        critical: true,
        employeeId: "employee_1",
        employeeStatus: "on_vacation",
        status: "active",
      }),
    ).toBe(false);
  });
});

describe("saas governance rules", () => {
  it("hides costs without finance permission", () => {
    const itContext = createAccessContext({
      userId: "it_1",
      roles: ["it_governance"],
    });
    const financeContext = createAccessContext({
      userId: "finance_1",
      roles: ["finance"],
    });

    expect(canReadSaasCost(itContext)).toBe(false);
    expect(canReadSaasCost(financeContext)).toBe(true);
  });

  it("allows linked employees and direct leaders to read linked subscriptions", () => {
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
      canReadSaasSubscription(employee, {
        linkedEmployeeIds: ["employee_1"],
        linkedManagerEmployeeIds: ["leader_employee_1"],
        status: "active",
      }),
    ).toBe(true);
    expect(
      canReadSaasSubscription(leader, {
        linkedEmployeeIds: ["employee_1"],
        linkedManagerEmployeeIds: ["leader_employee_1"],
        status: "active",
      }),
    ).toBe(true);
  });

  it("detects renewal windows", () => {
    expect(
      getSaasRenewalState(
        {
          renewalDate: "2026-06-01",
          status: "active",
        },
        "2026-05-14",
      ),
    ).toBe("due_soon");
    expect(
      getSaasRenewalState(
        {
          renewalDate: "2026-05-01",
          status: "active",
        },
        "2026-05-14",
      ),
    ).toBe("overdue");
  });
});

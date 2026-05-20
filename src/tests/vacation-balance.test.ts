import { describe, expect, it } from "vitest";

import {
  calculateAvailableBalance,
  calculatePeriodTakenDays,
  canManageVacationBalance,
  canReadVacationBalance,
  computeVacationPeriod,
  daysBetween,
  getMaxSellableDays,
  isVacationExpired,
  isVacationExpiring,
  validateSoldDays,
} from "@/features/timeoff/rules";
import { createAccessContext } from "@/lib/dal";

describe("CLT vacation balance rules", () => {
  describe("computeVacationPeriod", () => {
    it("returns the first aquisitive period as the 12 months after employment start", () => {
      expect(computeVacationPeriod("2024-03-15", 1)).toEqual({
        periodStart: "2024-03-15",
        periodEnd: "2025-03-14",
        concessionDeadline: "2026-03-14",
      });
    });

    it("shifts the period start by one year per additional tenure year", () => {
      expect(computeVacationPeriod("2024-03-15", 3)).toEqual({
        periodStart: "2026-03-15",
        periodEnd: "2027-03-14",
        concessionDeadline: "2028-03-14",
      });
    });

    it("rejects tenure year zero or negative", () => {
      expect(() => computeVacationPeriod("2024-03-15", 0)).toThrow();
    });
  });

  describe("calculatePeriodTakenDays", () => {
    const period = {
      periodStart: "2024-03-15",
      concessionDeadline: "2026-03-14",
    };

    it("sums business days of approved vacation requests within the concession window", () => {
      expect(
        calculatePeriodTakenDays(period, [
          { startDate: "2024-07-01", endDate: "2024-07-12", status: "approved", type: "vacation" },
          { startDate: "2025-02-03", endDate: "2025-02-07", status: "approved", type: "vacation" },
        ]),
      ).toBe(15);
    });

    it("ignores requests that are not approved or not of type vacation", () => {
      expect(
        calculatePeriodTakenDays(period, [
          { startDate: "2024-07-01", endDate: "2024-07-05", status: "requested", type: "vacation" },
          { startDate: "2024-07-08", endDate: "2024-07-12", status: "approved", type: "planned_pause" },
          { startDate: "2024-07-15", endDate: "2024-07-19", status: "cancelled", type: "vacation" },
        ]),
      ).toBe(0);
    });

    it("ignores requests starting outside the concession window", () => {
      expect(
        calculatePeriodTakenDays(period, [
          { startDate: "2024-01-01", endDate: "2024-01-05", status: "approved", type: "vacation" },
          { startDate: "2026-04-01", endDate: "2026-04-05", status: "approved", type: "vacation" },
        ]),
      ).toBe(0);
    });
  });

  describe("calculateAvailableBalance", () => {
    it("subtracts taken and sold days from acquired total", () => {
      expect(calculateAvailableBalance({ daysAcquired: 30, daysSold: 10, daysTaken: 15 })).toBe(5);
    });

    it("clamps at zero when the period is over-consumed", () => {
      expect(calculateAvailableBalance({ daysAcquired: 30, daysSold: 10, daysTaken: 25 })).toBe(0);
    });
  });

  describe("validateSoldDays", () => {
    it("accepts zero and the one-third cap", () => {
      expect(validateSoldDays({ daysAcquired: 30, daysSold: 0, daysTaken: 0 })).toBeNull();
      expect(validateSoldDays({ daysAcquired: 30, daysSold: 10, daysTaken: 0 })).toBeNull();
    });

    it("rejects negative sold days", () => {
      expect(validateSoldDays({ daysAcquired: 30, daysSold: -1, daysTaken: 0 })).toContain(
        "negativos",
      );
    });

    it("rejects more than one-third sold", () => {
      expect(validateSoldDays({ daysAcquired: 30, daysSold: 11, daysTaken: 0 })).toContain("1/3");
    });

    it("rejects when sold plus taken exceeds acquired", () => {
      expect(validateSoldDays({ daysAcquired: 30, daysSold: 10, daysTaken: 25 })).toContain(
        "excedem",
      );
    });

    it("exposes the max sellable cap", () => {
      expect(getMaxSellableDays(30)).toBe(10);
      expect(getMaxSellableDays(24)).toBe(8);
    });
  });

  describe("expiry helpers", () => {
    it("flags vacation as expiring within the configured threshold", () => {
      expect(
        isVacationExpiring({
          concessionDeadline: "2026-06-15",
          today: "2026-05-01",
        }),
      ).toBe(true);
      expect(
        isVacationExpiring({
          concessionDeadline: "2026-12-31",
          today: "2026-05-01",
        }),
      ).toBe(false);
    });

    it("flags vacation as expired only when there is unused balance past the deadline", () => {
      expect(
        isVacationExpired({
          concessionDeadline: "2026-03-14",
          availableBalance: 5,
          today: "2026-05-01",
        }),
      ).toBe(true);
      expect(
        isVacationExpired({
          concessionDeadline: "2026-03-14",
          availableBalance: 0,
          today: "2026-05-01",
        }),
      ).toBe(false);
    });

    it("daysBetween returns the signed delta", () => {
      expect(daysBetween("2026-05-01", "2026-05-10")).toBe(9);
      expect(daysBetween("2026-05-10", "2026-05-01")).toBe(-9);
    });
  });

  describe("authorization", () => {
    const rhContext = createAccessContext({
      userId: "rh_1",
      roles: ["hr_admin"],
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

    it("lets RH manage balances and read any", () => {
      expect(canManageVacationBalance(rhContext)).toBe(true);
      expect(
        canReadVacationBalance(rhContext, {
          employeeId: "employee_1",
          managerEmployeeId: "manager_1",
          status: "active",
        }),
      ).toBe(true);
    });

    it("blocks regular employees from managing", () => {
      expect(canManageVacationBalance(employeeContext)).toBe(false);
    });

    it("scopes reads correctly for own and team", () => {
      expect(
        canReadVacationBalance(employeeContext, {
          employeeId: "employee_1",
          managerEmployeeId: "manager_1",
          status: "active",
        }),
      ).toBe(true);
      expect(
        canReadVacationBalance(employeeContext, {
          employeeId: "employee_2",
          managerEmployeeId: "manager_1",
          status: "active",
        }),
      ).toBe(false);
      expect(
        canReadVacationBalance(leaderContext, {
          employeeId: "employee_1",
          managerEmployeeId: "manager_1",
          status: "active",
        }),
      ).toBe(true);
    });
  });
});

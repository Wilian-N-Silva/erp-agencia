import { describe, expect, it } from "vitest";

import {
  applyPeopleFilters,
  canReadCompensationForTarget,
  generateRegistrationNumber,
  getCompensationDifference,
  getNextRegistrationNumber,
  getPeopleListScope,
  getTenureMonths,
  isBenefitActive,
  normalizePeopleFilters,
  toEmployeeListItem,
} from "@/features/people/rules";
import { createAccessContext } from "@/tests/helpers/access-context";

const employee = {
  id: "employee_1",
  employeeId: "employee_1",
  registrationNumber: "FG-00001",
  fullName: "Ana Pessoa",
  socialName: null,
  corporateEmail: "ana@example.com",
  areaId: "550e8400-e29b-41d4-a716-446655440000",
  areaName: "Operacoes",
  positionId: "550e8400-e29b-41d4-a716-446655440001",
  positionName: "Analista",
  managerEmployeeId: "manager_1",
  employmentType: "pj" as const,
  status: "active" as const,
  startDate: "2025-05-15",
  currentCompensation: "5000.00",
  recurringCostAllowance: "300.00",
  recurringTransport: null,
};

describe("people and compensation rules", () => {
  it("generates collaborator registration numbers without reusing the current max", () => {
    expect(generateRegistrationNumber(1)).toBe("FG-00001");
    expect(getNextRegistrationNumber(["FG-00001", "FG-00010", "legacy"])).toBe(
      "FG-00011",
    );
  });

  it("calculates tenure by completed months", () => {
    expect(getTenureMonths("2025-05-15", "2026-05-14")).toBe(11);
    expect(getTenureMonths("2025-05-15", "2026-05-15")).toBe(12);
  });

  it("computes compensation difference using integer cents", () => {
    expect(getCompensationDifference("5000.00", "5500.50")).toBe("500.50");
    expect(getCompensationDifference("5000.00", "4500.00")).toBe("-500.00");
  });

  it("redacts compensation for users without compensation permission", () => {
    const financeContext = createAccessContext({
      userId: "finance_1",
      roles: ["finance"],
    });
    const itContext = createAccessContext({
      userId: "it_1",
      roles: ["it_governance"],
    });

    expect(canReadCompensationForTarget(financeContext, employee)).toBe(true);
    expect(toEmployeeListItem(employee, financeContext).currentCompensation).toBe("5000.00");
    expect(canReadCompensationForTarget(itContext, employee)).toBe(false);
    expect(toEmployeeListItem(employee, itContext)).toMatchObject({
      currentCompensation: null,
      compensationHidden: true,
    });
  });

  it("scopes people lists by role", () => {
    const directorContext = createAccessContext({
      userId: "director_1",
      roles: ["director"],
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

    expect(getPeopleListScope(directorContext)).toBe("all");
    expect(getPeopleListScope(leaderContext)).toBe("team");
    expect(getPeopleListScope(employeeContext)).toBe("own");
  });

  it("normalizes and applies people filters", () => {
    const filters = normalizePeopleFilters({
      areaId: employee.areaId,
      q: "ana",
      status: "active",
    });

    expect(filters).toMatchObject({
      areaId: employee.areaId,
      query: "ana",
      status: "active",
    });
    expect(
      applyPeopleFilters(
        [
          toEmployeeListItem(
            employee,
            createAccessContext({ userId: "director_1", roles: ["director"] }),
          ),
        ],
        filters,
      ),
    ).toHaveLength(1);
  });

  it("excludes ended benefits from future composition", () => {
    expect(
      isBenefitActive({
        recurring: true,
        status: "active",
        endDate: null,
      }),
    ).toBe(true);
    expect(
      isBenefitActive(
        {
          recurring: true,
          status: "ended",
          endDate: "2026-05-01",
        },
        "2026-05-12",
      ),
    ).toBe(false);
  });
});

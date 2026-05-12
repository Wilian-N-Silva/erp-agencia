import { describe, expect, it } from "vitest";

import { getVisibleNavigationItems } from "@/components/layout/navigation-items";
import { createAccessContext } from "@/lib/dal";

describe("permission-filtered navigation", () => {
  it("shows finance navigation only for finance permissions", () => {
    const financeContext = createAccessContext({
      userId: "finance_1",
      roles: ["finance"],
    });
    const employeeContext = createAccessContext({
      userId: "employee_1",
      roles: ["employee"],
    });

    expect(getVisibleNavigationItems(financeContext).map((item) => item.href))
      .toContain("/app/financeiro");
    expect(getVisibleNavigationItems(employeeContext).map((item) => item.href))
      .not.toContain("/app/financeiro");
  });

  it("shows portal navigation for employees", () => {
    const context = createAccessContext({
      userId: "employee_1",
      roles: ["employee"],
    });

    expect(getVisibleNavigationItems(context).map((item) => item.href)).toContain(
      "/portal",
    );
  });

  it("shows audit navigation for directors", () => {
    const context = createAccessContext({
      userId: "director_1",
      roles: ["director"],
    });

    expect(getVisibleNavigationItems(context).map((item) => item.href)).toContain(
      "/app/auditoria",
    );
  });
});

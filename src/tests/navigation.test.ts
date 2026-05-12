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

  it("hides routes that are not implemented yet", () => {
    const context = createAccessContext({
      userId: "director_1",
      roles: ["director"],
    });
    const hrefs = getVisibleNavigationItems(context).map((item) => item.href);

    expect(hrefs).toContain("/app");
    expect(hrefs).toContain("/app/financeiro");
    expect(hrefs).toContain("/app/clientes");
    expect(hrefs).not.toContain("/app/auditoria");
    expect(hrefs).not.toContain("/app/colaboradores");
    expect(hrefs).not.toContain("/app/reembolsos");
    expect(hrefs).not.toContain("/app/equipamentos");
    expect(hrefs).not.toContain("/app/acessos");
    expect(hrefs).not.toContain("/app/saas");
    expect(hrefs).not.toContain("/app/configuracoes");
  });
});

import { describe, expect, it } from "vitest";

import { getVisibleNavigationItems } from "@/components/layout/navigation-items";
import { createAccessContext } from "@/tests/helpers/access-context";

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
      .toContain("/app/financeiro/entradas");
    expect(getVisibleNavigationItems(employeeContext).map((item) => item.href))
      .not.toContain("/app/financeiro/entradas");
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

  it("shows the graphics module for a supplier quote approver", () => {
    const context = createAccessContext({
      permissions: ["graphics.supplier_quote_approve"],
      roles: [],
      userId: "quote-approver",
    });

    expect(getVisibleNavigationItems(context).map((item) => item.href)).toContain(
      "/app/grafica",
    );
  });

  it("shows only implemented back-office routes", () => {
    const context = createAccessContext({
      userId: "director_1",
      roles: ["director"],
    });
    const hrefs = getVisibleNavigationItems(context).map((item) => item.href);

    expect(hrefs).toContain("/app");
    expect(hrefs).toContain("/app/financeiro/entradas");
    expect(hrefs).toContain("/app/financeiro/saidas");
    expect(hrefs).toContain("/app/financeiro/provisoes");
    expect(hrefs).toContain("/app/financeiro/movimentacoes");
    expect(hrefs).toContain("/app/financeiro/cadastros");
    expect(hrefs).toContain("/app/clientes");
    expect(hrefs).toContain("/app/colaboradores");
    expect(hrefs).toContain("/app/ferias");
    expect(hrefs).toContain("/app/documentos");
    expect(hrefs).toContain("/app/nfs");
    expect(hrefs).toContain("/app/reembolsos");
    expect(hrefs).toContain("/app/equipamentos");
    expect(hrefs).toContain("/app/acessos");
    expect(hrefs).toContain("/app/assinaturas");
    expect(hrefs).toContain("/app/colaboradores/admissoes");
    expect(hrefs).toContain("/app/colaboradores/desligamentos");
    expect(hrefs).toContain("/app/alertas");
    expect(hrefs).toContain("/app/auditoria");
    expect(hrefs).toContain("/app/configuracoes");
    expect(hrefs).not.toContain("/app/saas");
  });
});

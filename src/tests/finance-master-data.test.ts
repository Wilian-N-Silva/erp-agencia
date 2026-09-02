import { describe, expect, it } from "vitest";

import {
  financialAccountInputSchema,
  financialCategoryInputSchema,
  supplierInputSchema,
} from "@/features/finance-master-data/rules";
import { buildFinancialExpenseUpdateValues } from "@/features/finance/rules";
import { getSeedPermissionsForRoles } from "@/lib/db/seed-role-permissions";

describe("FIN-002 master data validation", () => {
  it("normalizes account balances and rejects mass-assignment fields", () => {
    expect(financialAccountInputSchema.parse({
      maskedIdentifier: "•••• 1234",
      name: "Banco principal",
      openingBalance: "-10,5",
      type: "bank",
    }).openingBalance).toBe("-10.50");

    expect(() => financialAccountInputSchema.parse({
      maskedIdentifier: "",
      name: "Banco principal",
      openingBalance: "0",
      organizationId: "00000000-0000-4000-8000-000000000001",
      type: "bank",
    })).toThrow();
  });

  it("whitelists category nature and validates supplier contact data", () => {
    expect(() => financialCategoryInputSchema.parse({
      description: "",
      name: "Operacional",
      nature: "asset",
    })).toThrow();
    expect(() => supplierInputSchema.parse({
      contactName: "",
      email: "not-an-email",
      name: "Fornecedor",
      phone: "",
      taxId: "",
    })).toThrow();
  });

  it("grants finance configuration only to intended bootstrap roles", () => {
    expect(getSeedPermissionsForRoles(["finance"])).toContain("finance.configure");
    expect(getSeedPermissionsForRoles(["director"])).toContain("finance.configure");
    expect(getSeedPermissionsForRoles(["employee"])).not.toContain("finance.configure");
  });

  it("preserves legacy snapshots when linked master data is renamed before an AP edit", () => {
    const legacyExpense = {
      supplier: "Fornecedor original",
      category: "Categoria original",
      costCenter: "Centro original",
      dueDate: "2026-09-10",
    };

    const update = buildFinancialExpenseUpdateValues(
      {
        amount: "100.00",
        competence: "2026-09",
        description: "Despesa migrada",
        dueDate: "2026-09-20",
        notes: null,
        recurring: false,
        subcategory: null,
      },
      {
        supplierId: "72000000-0000-4000-8000-000000000011",
        categoryId: "72000000-0000-4000-8000-000000000021",
        costCenterId: "72000000-0000-4000-8000-000000000031",
      },
      new Date("2026-09-02T12:00:00.000Z"),
    );

    const updatedExpense = { ...legacyExpense, ...update };
    expect(updatedExpense).toMatchObject({
      supplier: "Fornecedor original",
      category: "Categoria original",
      costCenter: "Centro original",
      dueDate: "2026-09-20",
    });
  });
});

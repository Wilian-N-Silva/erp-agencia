import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  financialAccountInputSchema,
  financialCategoryInputSchema,
  financeMasterDataReadPermissions,
  supplierInputSchema,
} from "@/features/finance-master-data/rules";
import { buildFinancialExpenseUpdateValues } from "@/features/finance/rules";
import { getSeedPermissionsForRoles } from "@/lib/db/seed-role-permissions";
import { canAny } from "@/lib/rbac";

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

  it("allows either finance.read or finance.configure to read the configurable CRUD", () => {
    const context = (permissions: ("finance.read" | "finance.configure")[]) => ({
      employeeId: null,
      organizationId: "72000000-0000-4000-8000-000000000001",
      permissions,
      roles: [],
      userId: "fin-002-user",
    });

    expect(canAny(financeMasterDataReadPermissions, context(["finance.read"]))).toBe(true);
    expect(canAny(financeMasterDataReadPermissions, context(["finance.configure"]))).toBe(true);
    expect(canAny(financeMasterDataReadPermissions, context([]))).toBe(false);
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

  it("associates legacy AP master data without replacing its snapshots", () => {
    const updatedAt = new Date("2026-09-02T12:00:00.000Z");
    const legacyExpense = {
      supplier: "Fornecedor original",
      category: "Categoria original",
      costCenter: "Centro original",
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
        supplierId: "72000000-0000-4000-8000-000000000012",
        categoryId: "72000000-0000-4000-8000-000000000022",
        costCenterId: "72000000-0000-4000-8000-000000000032",
      },
      updatedAt,
    );

    expect({ ...legacyExpense, ...update }).toMatchObject({
      supplierId: "72000000-0000-4000-8000-000000000012",
      supplier: "Fornecedor original",
      categoryId: "72000000-0000-4000-8000-000000000022",
      category: "Categoria original",
      costCenterId: "72000000-0000-4000-8000-000000000032",
      costCenter: "Centro original",
    });
    expect(update).not.toHaveProperty("supplier");
    expect(update).not.toHaveProperty("category");
    expect(update).not.toHaveProperty("costCenter");
  });

  it("preserves the AP cost-center snapshot when its link is explicitly removed", () => {
    const legacyExpense = { costCenter: "Centro original" };
    const update = buildFinancialExpenseUpdateValues(
      {
        amount: "100.00",
        competence: "2026-09",
        description: "Despesa sem centro",
        dueDate: "2026-09-20",
        notes: null,
        recurring: false,
        subcategory: null,
      },
      {
        supplierId: null,
        categoryId: null,
        costCenterId: null,
      },
    );

    expect({ ...legacyExpense, ...update }).toMatchObject({
      costCenterId: null,
      costCenter: "Centro original",
    });
    expect(update).not.toHaveProperty("costCenter");
  });

  it("keeps legacy free text unresolved instead of promoting it to canonical master data", async () => {
    const migration = await readFile(
      resolve(process.cwd(), "drizzle/0017_glorious_ultimatum.sql"),
      "utf8",
    );

    expect(migration).not.toMatch(/INSERT INTO "(?:suppliers|financial_categories|cost_centers)"/);
    expect(migration).not.toMatch(/SET "(?:supplier_id|category_id|cost_center_id)"/);
    expect(migration).toContain("'strategy', 'manual_review_required'");
  });
});

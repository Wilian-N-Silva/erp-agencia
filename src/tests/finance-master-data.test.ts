import { describe, expect, it } from "vitest";

import {
  financialAccountInputSchema,
  financialCategoryInputSchema,
  supplierInputSchema,
} from "@/features/finance-master-data/rules";
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
});

import { z } from "zod";

import { centsToMoney, moneyToCents } from "@/features/finance/rules";

export const financeMasterDataReadPermissions = [
  "finance.read",
  "finance.configure",
] as const;

const optionalText = (max: number) =>
  z.string().trim().max(max).transform((value) => value || null);

const optionalOpeningBalance = z
  .string()
  .trim()
  .transform((value) => value.replace(/\s/g, "").replace(",", "."))
  .refine((value) => value === "" || /^-?\d+(?:\.\d{1,2})?$/.test(value), {
    message: "Saldo inicial inválido.",
  })
  .transform((value) => (value === "" ? null : centsToMoney(moneyToCents(value))));

const baseId = z.strictObject({ id: z.string().uuid() });

export const financialAccountInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  type: z.enum(["bank", "cash", "card", "clearing"]),
  maskedIdentifier: optionalText(80),
  openingBalance: optionalOpeningBalance,
});

export const financialAccountUpdateSchema = financialAccountInputSchema.extend({
  id: z.string().uuid(),
});

export const financialCategoryInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(100),
  nature: z.enum(["income", "expense", "both"]),
  description: optionalText(500),
});

export const financialCategoryUpdateSchema = financialCategoryInputSchema.extend({
  id: z.string().uuid(),
});

export const costCenterInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
  code: optionalText(40),
  description: optionalText(500),
});

export const costCenterUpdateSchema = costCenterInputSchema.extend({
  id: z.string().uuid(),
});

export const supplierInputSchema = z.strictObject({
  name: z.string().trim().min(1).max(160),
  taxId: optionalText(30),
  contactName: optionalText(120),
  email: z.union([z.literal(""), z.string().trim().email().max(254)]).transform((value) => value || null),
  phone: optionalText(40),
});

export const supplierUpdateSchema = supplierInputSchema.extend({
  id: z.string().uuid(),
});

export const masterDataStatusSchema = baseId.extend({
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const financialAccountTypeLabels = {
  bank: "Conta bancária",
  cash: "Caixa",
  card: "Cartão / passagem",
  clearing: "Conta de compensação",
} as const;

export const financialCategoryNatureLabels = {
  income: "Receita",
  expense: "Despesa",
  both: "Receita e despesa",
} as const;

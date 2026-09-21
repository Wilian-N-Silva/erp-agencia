"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/lib/audit";
import { bindCurrentTenantContext } from "@/lib/dal";
import { db } from "@/lib/db";
import { costCenters, financialAccounts, financialCategories, suppliers } from "@/lib/db/schema";
import { getCurrentAccessContext } from "@/lib/dal";
import { enforceAuthenticatedRateLimit, withRateLimitActionResult } from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { formDataToObject } from "@/lib/validation";

import {
  costCenterInputSchema,
  costCenterUpdateSchema,
  financialAccountInputSchema,
  financialAccountUpdateSchema,
  financialCategoryInputSchema,
  financialCategoryUpdateSchema,
  masterDataStatusSchema,
  supplierInputSchema,
  supplierUpdateSchema,
} from "./rules";

async function createFinancialAccount(formData: FormData) {
  const { context, organizationId } = await requireConfigurator();
  const input = financialAccountInputSchema.parse(formDataToObject(formData));
  const [after] = await db.insert(financialAccounts).values({ organizationId, ...input }).returning();
  await audit(context, "create", "financial_account", after.id, undefined, after);
  refresh();
}

async function updateFinancialAccount(formData: FormData) {
  const { context, organizationId } = await requireConfigurator();
  const input = financialAccountUpdateSchema.parse(formDataToObject(formData));
  const before = await findOwned(financialAccounts, input.id, organizationId);
  const { id, ...values } = input;
  const [after] = await db.update(financialAccounts).set({ ...values, updatedAt: new Date() }).where(and(eq(financialAccounts.id, id), eq(financialAccounts.organizationId, organizationId))).returning();
  await audit(context, "update", "financial_account", id, before, after);
  refresh();
}

async function setFinancialAccountStatus(formData: FormData) {
  const { context, organizationId } = await requireConfigurator();
  const input = masterDataStatusSchema.parse(formDataToObject(formData));
  const before = await findOwned(financialAccounts, input.id, organizationId);
  const [after] = await db.update(financialAccounts).set({ status: input.active ? "active" : "inactive", updatedAt: new Date() }).where(and(eq(financialAccounts.id, input.id), eq(financialAccounts.organizationId, organizationId))).returning();
  await audit(context, "status_change", "financial_account", input.id, before, after);
  refresh();
}

async function createFinancialCategory(formData: FormData) {
  const { context, organizationId } = await requireConfigurator();
  const input = financialCategoryInputSchema.parse(formDataToObject(formData));
  const [after] = await db.insert(financialCategories).values({ organizationId, ...input }).returning();
  await audit(context, "create", "financial_category", after.id, undefined, after);
  refresh();
}

async function updateFinancialCategory(formData: FormData) {
  const { context, organizationId } = await requireConfigurator();
  const input = financialCategoryUpdateSchema.parse(formDataToObject(formData));
  const before = await findOwned(financialCategories, input.id, organizationId);
  const { id, ...values } = input;
  const [after] = await db.update(financialCategories).set({ ...values, updatedAt: new Date() }).where(and(eq(financialCategories.id, id), eq(financialCategories.organizationId, organizationId))).returning();
  await audit(context, "update", "financial_category", id, before, after);
  refresh();
}

async function setFinancialCategoryStatus(formData: FormData) {
  return setBooleanStatus(formData, financialCategories, "financial_category");
}

async function createCostCenter(formData: FormData) {
  const { context, organizationId } = await requireConfigurator();
  const input = costCenterInputSchema.parse(formDataToObject(formData));
  const [after] = await db.insert(costCenters).values({ organizationId, ...input }).returning();
  await audit(context, "create", "cost_center", after.id, undefined, after);
  refresh();
}

async function updateCostCenter(formData: FormData) {
  const { context, organizationId } = await requireConfigurator();
  const input = costCenterUpdateSchema.parse(formDataToObject(formData));
  const before = await findOwned(costCenters, input.id, organizationId);
  const { id, ...values } = input;
  const [after] = await db.update(costCenters).set({ ...values, updatedAt: new Date() }).where(and(eq(costCenters.id, id), eq(costCenters.organizationId, organizationId))).returning();
  await audit(context, "update", "cost_center", id, before, after);
  refresh();
}

async function setCostCenterStatus(formData: FormData) {
  return setBooleanStatus(formData, costCenters, "cost_center");
}

async function createSupplier(formData: FormData) {
  const { context, organizationId } = await requireConfigurator();
  const input = supplierInputSchema.parse(formDataToObject(formData));
  const [after] = await db.insert(suppliers).values({ organizationId, ...input }).returning();
  await audit(context, "create", "supplier", after.id, undefined, after);
  refresh();
}

async function updateSupplier(formData: FormData) {
  const { context, organizationId } = await requireConfigurator();
  const input = supplierUpdateSchema.parse(formDataToObject(formData));
  const before = await findOwned(suppliers, input.id, organizationId);
  const { id, ...values } = input;
  const [after] = await db.update(suppliers).set({ ...values, updatedAt: new Date() }).where(and(eq(suppliers.id, id), eq(suppliers.organizationId, organizationId))).returning();
  await audit(context, "update", "supplier", id, before, after);
  refresh();
}

async function setSupplierStatus(formData: FormData) {
  return setBooleanStatus(formData, suppliers, "supplier");
}

async function setBooleanStatus(formData: FormData, table: typeof financialCategories | typeof costCenters | typeof suppliers, entityType: string) {
  const { context, organizationId } = await requireConfigurator();
  const input = masterDataStatusSchema.parse(formDataToObject(formData));
  const before = await findOwned(table, input.id, organizationId);
  const [after] = await db.update(table).set({ isActive: input.active, updatedAt: new Date() }).where(and(eq(table.id, input.id), eq(table.organizationId, organizationId))).returning();
  await audit(context, "status_change", entityType, input.id, before, after);
  refresh();
}

async function findOwned(table: typeof financialAccounts | typeof financialCategories | typeof costCenters | typeof suppliers, id: string, organizationId: string) {
  const [row] = await db.select().from(table).where(and(eq(table.id, id), eq(table.organizationId, organizationId))).limit(1);
  if (!row) throw new AccessDeniedError();
  return row;
}

async function requireConfigurator() {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  assertCan("finance.configure", context);
  if (!context.organizationId) throw new AccessDeniedError();
  await enforceAuthenticatedRateLimit("common_mutation", context);
  return { context, organizationId: context.organizationId };
}

async function audit(context: Parameters<typeof writeAuditLog>[0], action: "create" | "update" | "status_change", entityType: string, entityId: string, before?: unknown, after?: unknown) {
  await writeAuditLog(context, { action, entityType, entityId, before, after });
}

function refresh() {
  revalidatePath("/app/financeiro/cadastros");
  revalidatePath("/app/financeiro");
}

const wrap = <T extends (formData: FormData) => Promise<unknown>>(action: T) =>
  withRateLimitActionResult(bindCurrentTenantContext(action));

export const createFinancialAccountAction = wrap(createFinancialAccount);
export const updateFinancialAccountAction = wrap(updateFinancialAccount);
export const setFinancialAccountStatusAction = wrap(setFinancialAccountStatus);
export const createFinancialCategoryAction = wrap(createFinancialCategory);
export const updateFinancialCategoryAction = wrap(updateFinancialCategory);
export const setFinancialCategoryStatusAction = wrap(setFinancialCategoryStatus);
export const createCostCenterAction = wrap(createCostCenter);
export const updateCostCenterAction = wrap(updateCostCenter);
export const setCostCenterStatusAction = wrap(setCostCenterStatus);
export const createSupplierAction = wrap(createSupplier);
export const updateSupplierAction = wrap(updateSupplier);
export const setSupplierStatusAction = wrap(setSupplierStatus);

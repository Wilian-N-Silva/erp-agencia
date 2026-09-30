import { and, asc, eq, gte, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { db, withTenantDb } from "@/lib/db";
import { appSettings, employees, invoiceRequestItems, invoiceRequests, timeOffRequests, users } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan, can } from "@/lib/rbac";
import { isoDateSchema } from "@/lib/validation";
import { normalizeMoneyInput } from "@/features/finance/rules";
import { calculateInvoiceExpectedAmount } from "@/features/portal/rules";
import { calculateBusinessDays, calculateCalendarDays } from "./rules";
import { getPjReferenceToday } from "./pj-reference-rules";
import { calculatePjBalance, pjDaysSchema, PjTimeOffError, suggestPjSale } from "./pj-policy-rules";

const approverKey = "pj_timeoff_approver";
const requestSchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("sale"), days: pjDaysSchema, notes: z.string().trim().min(5).max(1000) }),
  z.strictObject({ kind: z.literal("rest"), startDate: isoDateSchema, endDate: isoDateSchema, notes: z.string().trim().max(1000) }),
]);
const reviewSchema = z.strictObject({ id: z.string().uuid(), decision: z.enum(["approve", "reject"]), amount: z.string().optional(), note: z.string().trim().max(1000).default("") });

function organization(context: AccessContext) {
  if (!context.organizationId) throw new AccessDeniedError();
  return context.organizationId;
}

export async function lockPjEmployee(context: AccessContext, employeeId: string) {
  const [employee] = await db.select().from(employees).where(and(eq(employees.id, employeeId), eq(employees.organizationId, organization(context)), eq(employees.employmentType, "pj"), isNull(employees.deletedAt))).for("update").limit(1);
  if (!employee) throw new AccessDeniedError();
  return employee;
}

async function employeeRequests(context: AccessContext, employeeId: string) {
  return db.select().from(timeOffRequests).where(and(eq(timeOffRequests.organizationId, organization(context)), eq(timeOffRequests.employeeId, employeeId)));
}

export async function getPjApproverId(context: AccessContext) {
  return withTenantDb(context, async () => {
    const [setting] = await db.select().from(appSettings).where(and(eq(appSettings.organizationId, organization(context)), eq(appSettings.key, approverKey))).limit(1);
    return typeof setting?.value === "string" ? setting.value : null;
  });
}

export async function configurePjApprover(context: AccessContext, raw: unknown) {
  assertCan("settings.manage", context);
  const input = z.strictObject({ userId: z.string().min(1).max(200) }).parse(raw);
  return withTenantDb(context, async () => {
    const [user] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, input.userId), eq(users.organizationId, organization(context)), eq(users.isActive, true), eq(users.accessStatus, "active"))).limit(1);
    if (!user) throw new AccessDeniedError();
    const before = await getPjApproverId(context);
    await db.insert(appSettings).values({ organizationId: organization(context), key: approverKey, value: user.id, updatedByUserId: context.userId })
      .onConflictDoUpdate({ target: [appSettings.organizationId, appSettings.key], set: { value: user.id, updatedByUserId: context.userId, updatedAt: new Date() } });
    await writeAuditLog(context, { action: "update", entityType: "app_setting", entityId: approverKey, before: { userId: before }, after: { userId: user.id } });
  });
}

export async function requestPjTimeOff(context: AccessContext, raw: unknown) {
  assertCan("timeoff.read_own", context);
  if (!context.employeeId) throw new AccessDeniedError();
  const input = requestSchema.parse(raw);
  return withTenantDb(context, async () => {
    const employee = await lockPjEmployee(context, context.employeeId!);
    const today = getPjReferenceToday();
    if (employee.status === "terminated" || (employee.endDate && employee.endDate <= today) || employee.startDate > today) throw new PjTimeOffError("O vínculo precisa estar ativo para solicitar dias.");
    const previous = await employeeRequests(context, employee.id);
    const balance = calculatePjBalance(employee.startDate, today, previous);
    const days = input.kind === "sale" ? input.days : calculateCalendarDays(input.startDate, input.endDate);
    if (days > balance.available) throw new PjTimeOffError(`Saldo insuficiente: ${Math.max(0, balance.available)} dia(s) disponível(is).`);
    if (input.kind === "rest") {
      if (input.startDate < today) throw new PjTimeOffError("A solicitação não pode começar no passado.");
      if (days !== 15 && input.notes.length < 5) throw new PjTimeOffError("Descreva o combinado para uma quantidade diferente de 15 dias.");
      if (previous.some(row => row.type !== "sale" && ["requested", "approved"].includes(row.status) && row.startDate <= input.endDate && row.endDate >= input.startDate)) throw new PjTimeOffError("Já existe uma solicitação nesse intervalo.");
    }
    const suggestion = input.kind === "sale" ? suggestPjSale(employee.currentCompensation, days) : null;
    const [created] = await db.insert(timeOffRequests).values({
      organizationId: organization(context), employeeId: employee.id, type: input.kind === "sale" ? "sale" : "planned_pause",
      startDate: input.kind === "sale" ? today : input.startDate, endDate: input.kind === "sale" ? today : input.endDate,
      businessDays: input.kind === "sale" ? 0 : calculateBusinessDays(input.startDate, input.endDate),
      soldDays: input.kind === "sale" ? days : 0, saleBaseAmount: suggestion?.baseAmount,
      saleSuggestedAmount: suggestion?.amount, status: "requested", requestedByUserId: context.userId, notes: input.notes,
    }).returning();
    await writeAuditLog(context, { action: "create", entityType: "time_off_request", entityId: created.id, after: created, metadata: { policy: "pj_annual_30_calendar", reservedDays: days } });
    return created.id;
  });
}

export async function reviewPjTimeOff(context: AccessContext, raw: unknown) {
  assertCan("timeoff.write", context);
  const input = reviewSchema.parse(raw);
  return withTenantDb(context, async () => {
    if (await getPjApproverId(context) !== context.userId) throw new PjTimeOffError("Somente a responsável configurada (Jaci) pode aprovar ou recusar solicitações PJ.");
    const [target] = await db.select().from(timeOffRequests).where(and(eq(timeOffRequests.id, input.id), eq(timeOffRequests.organizationId, organization(context)))).limit(1);
    if (!target) throw new AccessDeniedError();
    const employee = await lockPjEmployee(context, target.employeeId);
    const [before] = await db.select().from(timeOffRequests).where(and(eq(timeOffRequests.id, target.id), eq(timeOffRequests.organizationId, organization(context)))).for("update").limit(1);
    if (before.status !== "requested") throw new PjTimeOffError("Esta solicitação já foi analisada.");
    const today = getPjReferenceToday();
    const approving = input.decision === "approve";
    if (approving && (employee.status === "terminated" || (employee.endDate && employee.endDate <= today))) throw new PjTimeOffError("Vínculo encerrado; recuse a solicitação pendente.");
    if (approving && calculatePjBalance(employee.startDate, today, await employeeRequests(context, employee.id)).available < 0) throw new PjTimeOffError("O saldo foi alterado e é insuficiente. Revise as solicitações pendentes.");
    let amount: string | null = null;
    const suggestion = approving && before.type === "sale" ? suggestPjSale(employee.currentCompensation, before.soldDays) : null;
    if (approving && suggestion) {
      assertCan("compensation.read", context);
      amount = normalizeMoneyInput(input.amount ?? "");
      if (amount !== suggestion.amount && input.note.length < 5) throw new PjTimeOffError("Explique o valor combinado quando diferente da sugestão atual.");
    }
    const [after] = await db.update(timeOffRequests).set({ status: approving ? "approved" : "rejected", approvedByUserId: context.userId, approvedAt: new Date(),
      saleBaseAmount: suggestion?.baseAmount ?? before.saleBaseAmount, saleSuggestedAmount: suggestion?.amount ?? before.saleSuggestedAmount,
      saleApprovedAmount: amount, saleApprovalNote: input.note, updatedAt: new Date(),
    }).where(and(eq(timeOffRequests.id, input.id), eq(timeOffRequests.organizationId, organization(context)))).returning();
    await writeAuditLog(context, { action: approving ? "approve" : "reject", entityType: "time_off_request", entityId: before.id, before, after });
    if (approving && amount) await attachPjSalesToNextInvoice(context, employee.id);
  });
}

// Call while holding the employee lock; all invoice mutations also lock their invoice.
export async function attachPjSalesToNextInvoice(context: AccessContext, employeeId: string) {
  const pending = await db.select().from(timeOffRequests).where(and(eq(timeOffRequests.organizationId, organization(context)), eq(timeOffRequests.employeeId, employeeId), eq(timeOffRequests.type, "sale"), eq(timeOffRequests.status, "approved"))).orderBy(asc(timeOffRequests.approvedAt), asc(timeOffRequests.id));
  for (const sale of pending) {
    if (!sale.saleApprovedAmount || !sale.approvedAt) continue;
    const [attached] = await db.select({ id: invoiceRequestItems.id }).from(invoiceRequestItems).where(eq(invoiceRequestItems.sourceTimeOffId, sale.id)).limit(1);
    if (attached) continue;
    const [invoice] = await db.select().from(invoiceRequests).where(and(eq(invoiceRequests.organizationId, organization(context)), eq(invoiceRequests.employeeId, employeeId), isNull(invoiceRequests.deletedAt), isNull(invoiceRequests.fileId), inArray(invoiceRequests.status, ["draft", "published"]), gte(invoiceRequests.competence, getPjReferenceToday(sale.approvedAt).slice(0, 7)))).orderBy(asc(invoiceRequests.competence)).for("update").limit(1);
    if (!invoice) continue;
    const items = await db.select().from(invoiceRequestItems).where(eq(invoiceRequestItems.invoiceRequestId, invoice.id));
    const [item] = await db.insert(invoiceRequestItems).values({ invoiceRequestId: invoice.id, sourceTimeOffId: sale.id, label: `Venda de ${sale.soldDays} dias de férias PJ autorizada`, amount: sale.saleApprovedAmount, kind: "timeoff_sale", sortOrder: items.length }).returning();
    const [after] = await db.update(invoiceRequests).set({ expectedAmount: calculateInvoiceExpectedAmount([...items, item]), updatedAt: new Date() }).where(and(eq(invoiceRequests.id, invoice.id), eq(invoiceRequests.organizationId, organization(context)))).returning();
    await writeAuditLog(context, { action: "update", entityType: "invoice_request", entityId: invoice.id, before: invoice, after, metadata: { timeOffId: sale.id, invoiceItemId: item.id } });
  }
}

export async function getOwnPjPolicy(context: AccessContext) {
  assertCan("timeoff.read_own", context);
  if (!context.employeeId) throw new AccessDeniedError();
  return withTenantDb(context, async () => {
    const [employee] = await db.select().from(employees).where(and(eq(employees.id, context.employeeId!), eq(employees.organizationId, organization(context)), eq(employees.employmentType, "pj"), isNull(employees.deletedAt))).limit(1);
    if (!employee) throw new AccessDeniedError();
    const requests = await employeeRequests(context, employee.id);
    return { balance: calculatePjBalance(employee.startDate, getPjReferenceToday(), requests), baseAmount: can("compensation.read_own", context) || can("compensation.read", context) ? employee.currentCompensation : null,
      sales: requests.filter(row => row.type === "sale").map(row => ({ id: row.id, days: row.soldDays, status: row.status, approvedAmount: row.saleApprovedAmount, notes: row.notes })) };
  });
}

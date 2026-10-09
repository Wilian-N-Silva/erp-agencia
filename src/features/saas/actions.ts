"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { employees, saasSubscriptionUsers, saasSubscriptions } from "@/lib/db/schema";
import {
  bindCurrentTenantContext,
  getCurrentAccessContext,
  type AccessContext,
} from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";
import { formDataToObject, isIsoDate, isoDateSchema } from "@/lib/validation";

import { normalizeMoneyInput } from "@/features/finance/rules";
import { enforceAuthenticatedRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { removeMistakenSaasSubscription, SaasRemovalError } from "./removal";
import { estimateSaasBilling, saasBillingSchema } from "./billing-rules";
import { recordSaasCharge } from "./charge-dal";

import {
  canReadSaasCost,
  saasSubscriptionStatusLabels,
  type SaasSubscriptionStatus,
} from "./rules";

type AuthorizedContext = AccessContext & { organizationId: string };

const dateSchema = isoDateSchema;
const saasStatusSchema = z.enum(
  Object.keys(saasSubscriptionStatusLabels) as [
    keyof typeof saasSubscriptionStatusLabels,
    ...(keyof typeof saasSubscriptionStatusLabels)[],
  ],
);
const saasBaseSchema = z.strictObject({
  name: z.string().trim().min(1).max(160),
  category: z.string().trim().min(1).max(120),
  provider: optionalTextSchema(120),
  monthlyCost: optionalMoneySchema(),
  renewalDate: optionalDateSchema(),
  status: saasStatusSchema,
  notes: optionalTextSchema(1000),
});
const createSaasSubscriptionSchema = saasBaseSchema.extend(saasBillingSchema.shape);
const updateSaasSubscriptionSchema = saasBaseSchema.extend({
  id: z.string().uuid(),
});
const linkSaasUserSchema = z.strictObject({
  employeeId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
});
const renewSaasSubscriptionSchema = z.strictObject({
  id: z.string().uuid(),
  renewalDate: dateSchema,
});
const idSchema = z.strictObject({
  id: z.string().uuid(),
});

async function createSaasSubscriptionAction(formData: FormData) {
  const context = await requireSaasWriterContext();
  await enforceAuthenticatedRateLimit("common_mutation", context);
  const input = createSaasSubscriptionSchema.parse(formDataToObject(formData));
  const billing = canReadSaasCost(context) ? normalizeBilling(input) : undefined;
  const [created] = await db
    .insert(saasSubscriptions)
    .values({
      organizationId: context.organizationId,
      name: input.name,
      category: input.category,
      provider: input.provider,
      monthlyCost: canReadSaasCost(context) && billing?.billingCurrency === "BRL" && billing.billingCycle === "monthly" && !billing.cycleAmount ? input.monthlyCost : null,
      ...billing,
      renewalDate: input.renewalDate,
      responsibleUserId: context.userId,
      status: input.status,
      notes: input.notes,
    })
    .returning();

  await writeAuditLog(context, {
    action: "create",
    entityType: "saas_subscription",
    entityId: created.id,
    after: created,
  });

  revalidateSaasPaths();
}

function normalizeBilling(input: unknown) {
  const billing = saasBillingSchema.parse(input);
  if (billing.billingCurrency === "BRL") {
    billing.estimatedExchangeRate = null;
    billing.exchangeRateDate = null;
    billing.exchangeRateSource = null;
  }
  estimateSaasBilling(billing);
  return billing;
}

async function updateSaasBillingAction(formData: FormData) {
  const context = await requireSaasWriterContext();
  assertCanAny(["finance.read"], context);
  await enforceAuthenticatedRateLimit("common_mutation", context);
  const input = z.strictObject({ id: z.string().uuid(), ...saasBillingSchema.shape }).parse(formDataToObject(formData));
  const billing = normalizeBilling(input);
  const before = await getSaasSubscriptionForWrite(input.id, context.organizationId);
  const [after] = await db.update(saasSubscriptions).set({ ...billing, monthlyCost: null, updatedAt: new Date() })
    .where(and(eq(saasSubscriptions.id, before.id), eq(saasSubscriptions.organizationId, context.organizationId))).returning();
  await writeAuditLog(context, { action: "update", entityType: "saas_subscription", entityId: before.id, before, after, metadata: { reason: "billing_estimate" } });
  revalidateSaasPaths();
  revalidatePath(`/app/assinaturas/${before.id}`);
}

async function updateSaasSubscriptionAction(formData: FormData) {
  const context = await requireSaasWriterContext();
  const input = updateSaasSubscriptionSchema.parse(formDataToObject(formData));
  const before = await getSaasSubscriptionForWrite(input.id, context.organizationId);
  const [after] = await db
    .update(saasSubscriptions)
    .set({
      name: input.name,
      category: input.category,
      provider: input.provider,
      monthlyCost: canReadSaasCost(context) ? input.monthlyCost : before.monthlyCost,
      renewalDate: input.renewalDate,
      responsibleUserId: context.userId,
      status: input.status,
      notes: input.notes,
      updatedAt: new Date(),
    })
    .where(eq(saasSubscriptions.id, input.id))
    .returning();

  await writeAuditLog(context, {
    action: "update",
    entityType: "saas_subscription",
    entityId: input.id,
    before,
    after,
    metadata: {
      costChanged: before.monthlyCost !== after.monthlyCost,
    },
  });

  revalidateSaasPaths();
}

async function linkEmployeeToSaasSubscriptionAction(formData: FormData) {
  const context = await requireSaasWriterContext();
  const input = linkSaasUserSchema.parse(formDataToObject(formData));

  await getSaasSubscriptionForWrite(input.subscriptionId, context.organizationId);
  await getEmployeeForWrite(input.employeeId, context.organizationId);

  const [link] = await db
    .insert(saasSubscriptionUsers)
    .values({
      subscriptionId: input.subscriptionId,
      employeeId: input.employeeId,
      status: "active",
      unlinkedAt: null,
    })
    .onConflictDoUpdate({
      target: [saasSubscriptionUsers.subscriptionId, saasSubscriptionUsers.employeeId],
      set: {
        status: "active",
        unlinkedAt: null,
      },
    })
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "saas_subscription",
    entityId: input.subscriptionId,
    after: link,
    metadata: {
      employeeId: input.employeeId,
      linkStatus: "active",
    },
  });

  revalidateSaasPaths();
}

async function unlinkEmployeeFromSaasSubscriptionAction(formData: FormData) {
  const context = await requireSaasWriterContext();
  const input = linkSaasUserSchema.parse(formDataToObject(formData));

  await getSaasSubscriptionForWrite(input.subscriptionId, context.organizationId);
  await getEmployeeForWrite(input.employeeId, context.organizationId);

  const before = await getSaasUserLink(input.subscriptionId, input.employeeId);
  const [after] = await db
    .update(saasSubscriptionUsers)
    .set({
      status: "inactive",
      unlinkedAt: new Date(),
    })
    .where(
      and(
        eq(saasSubscriptionUsers.subscriptionId, input.subscriptionId),
        eq(saasSubscriptionUsers.employeeId, input.employeeId),
      ),
    )
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "saas_subscription",
    entityId: input.subscriptionId,
    before,
    after,
    metadata: {
      employeeId: input.employeeId,
      linkStatus: "inactive",
    },
  });

  revalidateSaasPaths();
}

async function markSaasSubscriptionRenewedAction(formData: FormData) {
  const context = await requireSaasWriterContext();
  const input = renewSaasSubscriptionSchema.parse(formDataToObject(formData));

  await updateSaasStatus(context, input.id, "active", {
    renewalDate: input.renewalDate,
  });
}

async function cancelSaasSubscriptionAction(formData: FormData) {
  const context = await requireSaasWriterContext();
  const input = idSchema.parse(formDataToObject(formData));

  await updateSaasStatus(context, input.id, "cancelled");
}

export async function recordSaasChargeAction(data: FormData) {
  try {
    const context = await getCurrentAccessContext();
    if (!context) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
    assertCanAny(["finance.write"], context);
    if (!context.organizationId) throw new AccessDeniedError();
    await enforceAuthenticatedRateLimit("common_mutation", context);
    const input = formDataToObject(data);
    const charge = await recordSaasCharge(context, input);
    revalidateSaasPaths();
    revalidatePath(`/app/assinaturas/${String(input.subscriptionId)}`);
    return {
      ok: true,
      message: charge.financialExpenseId
        ? "Cobrança registrada e conta a pagar criada no Financeiro."
        : "Cobrança registrada.",
    };
  } catch (error) {
    if (error instanceof RateLimitExceededError) return { ok: false, message: "Muitas tentativas. Aguarde antes de tentar novamente." };
    if (error instanceof AccessDeniedError) return { ok: false, message: "Operação indisponível ou acesso não permitido." };
    if (error instanceof z.ZodError) return { ok: false, message: error.issues[0]?.message ?? "Confira os dados da cobrança." };
    if (error instanceof Error && error.message.includes("assinatura cancelada")) return { ok: false, message: error.message };
    return { ok: false, message: "Não foi possível registrar a cobrança. Atualize a página antes de tentar novamente." };
  }
}

export async function removeSaasSubscriptionAction(_state: { error: string } | null, formData: FormData) {
  try {
    const context = await requireSaasWriterContext();
    await enforceAuthenticatedRateLimit("common_mutation", context);
    await removeMistakenSaasSubscription(context, formDataToObject(formData));
  } catch (error) {
    if (error instanceof SaasRemovalError) return { error: error.message };
    if (error instanceof z.ZodError) return { error: "Informe um motivo de 5 a 500 caracteres e confirme a remoção." };
    if (error instanceof AccessDeniedError) return { error: "Assinatura indisponível ou acesso não permitido." };
    if (error instanceof RateLimitExceededError) return { error: "Limite de tentativas atingido. Aguarde antes de tentar novamente." };
    throw error;
  }
  // Redirect only after the removal and its audit transaction have committed.
  revalidateSaasPaths();
  revalidatePath("/app/assinaturas/[id]", "page");
  redirect("/app/assinaturas");
}

async function updateSaasStatus(
  context: AuthorizedContext,
  id: string,
  status: SaasSubscriptionStatus,
  extra: Partial<typeof saasSubscriptions.$inferInsert> = {},
) {
  const before = await getSaasSubscriptionForWrite(id, context.organizationId);
  const [after] = await db
    .update(saasSubscriptions)
    .set({
      ...extra,
      status,
      updatedAt: new Date(),
    })
    .where(eq(saasSubscriptions.id, id))
    .returning();

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "saas_subscription",
    entityId: id,
    before,
    after,
    metadata: {
      status,
    },
  });

  revalidateSaasPaths();
}

async function requireSaasWriterContext(): Promise<AuthorizedContext> {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  assertCanAny(["saas.write", "saas.configure"], context);

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return {
    ...context,
    organizationId: context.organizationId,
  };
}

async function getSaasSubscriptionForWrite(id: string, organizationId: string) {
  const [row] = await db
    .select()
    .from(saasSubscriptions)
    .where(and(eq(saasSubscriptions.id, id), eq(saasSubscriptions.organizationId, organizationId), isNull(saasSubscriptions.deletedAt)))
    .for("update")
    .limit(1);

  if (!row) {
    throw new AccessDeniedError();
  }

  return row;
}

async function getEmployeeForWrite(id: string, organizationId: string) {
  const [employee] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.id, id), eq(employees.organizationId, organizationId), isNull(employees.deletedAt)))
    .limit(1);

  if (!employee) {
    throw new AccessDeniedError();
  }

  return employee;
}

async function getSaasUserLink(subscriptionId: string, employeeId: string) {
  const [link] = await db
    .select()
    .from(saasSubscriptionUsers)
    .where(
      and(
        eq(saasSubscriptionUsers.subscriptionId, subscriptionId),
        eq(saasSubscriptionUsers.employeeId, employeeId),
      ),
    )
    .limit(1);

  if (!link) {
    throw new AccessDeniedError();
  }

  return link;
}

function revalidateSaasPaths() {
  revalidatePath("/app");
  revalidatePath("/app/assinaturas");
  revalidatePath("/portal");
}

function optionalTextSchema(maxLength: number) {
  return z
    .string()
    .trim()
    .max(maxLength)
    .optional()
    .transform((value) => value || null);
}

function optionalDateSchema() {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => value || null)
    .refine((value) => value === null || isIsoDate(value), {
      message: "Invalid date.",
    });
}

function optionalMoneySchema() {
  return z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? normalizeMoneyInput(value) : null));
}

export {
  tenantUpdateSaasBillingAction as updateSaasBillingAction,
  tenantCreateSaasSubscriptionAction as createSaasSubscriptionAction,
  tenantUpdateSaasSubscriptionAction as updateSaasSubscriptionAction,
  tenantLinkEmployeeToSaasSubscriptionAction as linkEmployeeToSaasSubscriptionAction,
  tenantUnlinkEmployeeFromSaasSubscriptionAction as unlinkEmployeeFromSaasSubscriptionAction,
  tenantMarkSaasSubscriptionRenewedAction as markSaasSubscriptionRenewedAction,
  tenantCancelSaasSubscriptionAction as cancelSaasSubscriptionAction,
};

const tenantUpdateSaasBillingAction = bindCurrentTenantContext(updateSaasBillingAction);

const tenantCreateSaasSubscriptionAction = bindCurrentTenantContext(
  createSaasSubscriptionAction,
);
const tenantUpdateSaasSubscriptionAction = bindCurrentTenantContext(
  updateSaasSubscriptionAction,
);
const tenantLinkEmployeeToSaasSubscriptionAction = bindCurrentTenantContext(
  linkEmployeeToSaasSubscriptionAction,
);
const tenantUnlinkEmployeeFromSaasSubscriptionAction = bindCurrentTenantContext(
  unlinkEmployeeFromSaasSubscriptionAction,
);
const tenantMarkSaasSubscriptionRenewedAction = bindCurrentTenantContext(
  markSaasSubscriptionRenewedAction,
);
const tenantCancelSaasSubscriptionAction = bindCurrentTenantContext(
  cancelSaasSubscriptionAction,
);

async function billingFormResult(operation: () => Promise<unknown>) {
  try {
    await operation();
    return { ok: true, message: "Estimativa salva. Confira a cobrança efetiva na fatura." };
  } catch (error) {
    if (error instanceof z.ZodError) return { ok: false, message: error.issues[0]?.message ?? "Confira os campos informados." };
    if (error instanceof RateLimitExceededError) return { ok: false, message: "Aguarde antes de tentar novamente." };
    if (error instanceof AccessDeniedError) return { ok: false, message: "Assinatura indisponível ou acesso não permitido." };
    return { ok: false, message: "Não foi possível salvar. Confira os valores e tente novamente." };
  }
}
export async function createSaasFormAction(_state: { message: string; ok: boolean } | null, data: FormData) {
  return billingFormResult(() => tenantCreateSaasSubscriptionAction(data));
}
export async function updateSaasBillingFormAction(_state: { message: string; ok: boolean } | null, data: FormData) {
  return billingFormResult(() => tenantUpdateSaasBillingAction(data));
}

import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { writeAuditLog } from "@/lib/audit";
import { db, withTenantDb } from "@/lib/db";
import { documents, saasSubscriptions, saasSubscriptionUsers, workItems } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

export class SaasRemovalError extends Error {}

export const removeSaasSchema = z.strictObject({
  id: z.string().uuid(),
  reason: z.string().trim().min(5).max(500),
  confirmation: z.literal("remove"),
});

export async function removeMistakenSaasSubscription(context: AccessContext, raw: unknown) {
  assertCanAny(["saas.write", "saas.configure"], context);
  if (!context.organizationId) throw new AccessDeniedError();
  const input = removeSaasSchema.parse(raw);
  const organizationId = context.organizationId;
  return withTenantDb(context, async () => {
    const [before] = await db.select().from(saasSubscriptions).where(and(
      eq(saasSubscriptions.id, input.id), eq(saasSubscriptions.organizationId, organizationId),
      isNull(saasSubscriptions.deletedAt),
    )).for("update").limit(1);
    if (!before) throw new AccessDeniedError();
    const [link] = await db.select().from(saasSubscriptionUsers)
      .where(eq(saasSubscriptionUsers.subscriptionId, input.id)).limit(1);
    if (link) throw new SaasRemovalError("Esta assinatura possui histórico de colaboradores vinculados. Use o cancelamento para preservar esse histórico.");
    const [document] = await db.select({ id: documents.id }).from(documents).where(and(
      eq(documents.organizationId, organizationId), eq(documents.ownerType, "saas_subscription"),
      eq(documents.ownerId, input.id),
    )).limit(1);
    const [workItem] = await db.select({ id: workItems.id }).from(workItems).where(and(
      eq(workItems.organizationId, organizationId), eq(workItems.sourceType, "saas_subscription"),
      eq(workItems.sourceId, input.id),
    )).limit(1);
    if (document || workItem) throw new SaasRemovalError("Esta assinatura possui documentos ou pendências vinculadas. Use o cancelamento para preservar esse histórico.");
    const now = new Date();
    const [after] = await db.update(saasSubscriptions).set({ deletedAt: now, updatedAt: now })
      .where(and(eq(saasSubscriptions.id, input.id), eq(saasSubscriptions.organizationId, organizationId), isNull(saasSubscriptions.deletedAt))).returning();
    await writeAuditLog(context, {
      action: "delete", entityType: "saas_subscription", entityId: input.id,
      before, after, metadata: { reason: input.reason, removalKind: "incorrect_registration" },
    });
    return after.id;
  });
}

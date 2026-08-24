"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import {
  appSettings,
  areas,
  employees,
  positions,
  roles,
  userRoles,
  users,
} from "@/lib/db/schema";
import { bindCurrentTenantContext, getCurrentAccessContext } from "@/lib/dal";
import {
  enforceAuthenticatedRateLimit,
  withRateLimitActionResult,
} from "@/lib/rate-limit";
import { AccessDeniedError, assertCan, isRoleKey, type RoleKey } from "@/lib/rbac";

import { normalizeRoleSelection, parseSettingValue } from "./rules";
import { updateUserAccessStatusSchema } from "./schemas";

const updateRolesSchema = z.object({
  userId: z.string().min(1).max(200),
});

const updateSettingSchema = z.object({
  description: z.string().trim().max(500).optional(),
  key: z.string().trim().min(1).max(120).regex(/^[a-z0-9_.-]+$/),
  value: z.string().max(5000),
});

const createOrgUnitSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const deleteOrgUnitSchema = z.object({
  id: z.string().uuid(),
});

async function updateSettingsUserRolesAction(formData: FormData) {
  const { context, organizationId } = await requireSettingsManagerContext();
  await enforceAuthenticatedRateLimit("invitation", context);
  const input = updateRolesSchema.parse(formDataToObject(formData));
  const roleKeys = normalizeRoleSelection(formData.getAll("roleKeys").map(String));

  if (roleKeys.length === 0) {
    throw new Error("At least one role is required.");
  }

  const before = await getUserForSettings(input.userId, organizationId);
  await replaceUserRoles(input.userId, roleKeys, context.userId);

  await writeAuditLog(context, {
    action: "permission_change",
    entityType: "user",
    entityId: input.userId,
    before,
    after: {
      ...before,
      roleKeys,
    },
  });

  revalidatePath("/app/configuracoes");
}

async function updateSettingsUserStatusAction(formData: FormData) {
  const { context, organizationId } = await requireSettingsManagerContext();
  await enforceAuthenticatedRateLimit("invitation", context);
  const input = updateUserAccessStatusSchema.parse(formDataToObject(formData));

  if (input.userId === context.userId && input.accessStatus !== "active") {
    throw new Error("User cannot deactivate themselves.");
  }

  const before = await getUserForSettings(input.userId, organizationId);
  const [after] = await db
    .update(users)
    .set({
      accessStatus: input.accessStatus,
      isActive: input.accessStatus === "active",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(users.id, input.userId),
        eq(users.organizationId, organizationId),
      ),
    )
    .returning();

  if (!after) {
    throw new AccessDeniedError();
  }

  await writeAuditLog(context, {
    action: "status_change",
    entityType: "user",
    entityId: input.userId,
    before,
    after,
    metadata: {
      accessStatus: input.accessStatus,
    },
  });

  revalidatePath("/app/configuracoes");
}

async function updateAppSettingAction(formData: FormData) {
  const { context, organizationId } = await requireSettingsManagerContext();
  const input = updateSettingSchema.parse(formDataToObject(formData));
  const before = await db
    .select()
    .from(appSettings)
    .where(and(eq(appSettings.organizationId, organizationId), eq(appSettings.key, input.key)))
    .limit(1);
  const [after] = await db
    .insert(appSettings)
    .values({
      organizationId,
      key: input.key,
      value: parseSettingValue(input.value),
      description: input.description || null,
      updatedByUserId: context.userId,
    })
    .onConflictDoUpdate({
      target: [appSettings.organizationId, appSettings.key],
      set: {
        value: parseSettingValue(input.value),
        description: input.description || null,
        updatedByUserId: context.userId,
        updatedAt: new Date(),
      },
    })
    .returning();

  await writeAuditLog(context, {
    action: before[0] ? "update" : "create",
    entityType: "app_setting",
    entityId: after.id,
    before: before[0] ?? null,
    after,
  });

  revalidatePath("/app/configuracoes");
}

async function createAreaAction(formData: FormData) {
  const { context, organizationId } = await requireSettingsManagerContext();
  const input = createOrgUnitSchema.parse(formDataToObject(formData));

  const [area] = await db
    .insert(areas)
    .values({ organizationId, name: input.name })
    .onConflictDoNothing({ target: [areas.organizationId, areas.name] })
    .returning();

  if (!area) {
    throw new Error("Area com esse nome ja existe.");
  }

  await writeAuditLog(context, {
    action: "create",
    entityType: "area",
    entityId: area.id,
    after: { name: area.name },
  });

  revalidatePath("/app/configuracoes");
}

async function deleteAreaAction(formData: FormData) {
  const { context, organizationId } = await requireSettingsManagerContext();
  const input = deleteOrgUnitSchema.parse(formDataToObject(formData));

  const [area] = await db
    .select()
    .from(areas)
    .where(and(eq(areas.id, input.id), eq(areas.organizationId, organizationId)))
    .limit(1);

  if (!area) {
    throw new AccessDeniedError();
  }

  const usage = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.areaId, area.id), isNull(employees.deletedAt)))
    .limit(1);

  if (usage.length > 0) {
    throw new Error("Nao e possivel remover area com colaboradores vinculados.");
  }

  await db.delete(areas).where(eq(areas.id, area.id));

  await writeAuditLog(context, {
    action: "delete",
    entityType: "area",
    entityId: area.id,
    before: { name: area.name },
  });

  revalidatePath("/app/configuracoes");
}

async function createPositionAction(formData: FormData) {
  const { context, organizationId } = await requireSettingsManagerContext();
  const input = createOrgUnitSchema.parse(formDataToObject(formData));

  const [position] = await db
    .insert(positions)
    .values({ organizationId, name: input.name })
    .onConflictDoNothing({ target: [positions.organizationId, positions.name] })
    .returning();

  if (!position) {
    throw new Error("Cargo com esse nome ja existe.");
  }

  await writeAuditLog(context, {
    action: "create",
    entityType: "position",
    entityId: position.id,
    after: { name: position.name },
  });

  revalidatePath("/app/configuracoes");
}

async function deletePositionAction(formData: FormData) {
  const { context, organizationId } = await requireSettingsManagerContext();
  const input = deleteOrgUnitSchema.parse(formDataToObject(formData));

  const [position] = await db
    .select()
    .from(positions)
    .where(and(eq(positions.id, input.id), eq(positions.organizationId, organizationId)))
    .limit(1);

  if (!position) {
    throw new AccessDeniedError();
  }

  const usage = await db
    .select({ id: employees.id })
    .from(employees)
    .where(and(eq(employees.positionId, position.id), isNull(employees.deletedAt)))
    .limit(1);

  if (usage.length > 0) {
    throw new Error("Nao e possivel remover cargo com colaboradores vinculados.");
  }

  await db.delete(positions).where(eq(positions.id, position.id));

  await writeAuditLog(context, {
    action: "delete",
    entityType: "position",
    entityId: position.id,
    before: { name: position.name },
  });

  revalidatePath("/app/configuracoes");
}

async function replaceUserRoles(
  userId: string,
  roleKeys: readonly RoleKey[],
  assignedByUserId: string,
) {
  const roleRows = await db.select().from(roles);
  const roleIds = roleRows.flatMap((role) => {
    if (!isRoleKey(role.key) || !roleKeys.includes(role.key)) {
      return [];
    }

    return [role.id];
  });

  if (roleIds.length !== roleKeys.length) {
    throw new Error("Invalid role selection.");
  }

  await db.delete(userRoles).where(eq(userRoles.userId, userId));
  await db.insert(userRoles).values(
    roleIds.map((roleId) => ({
      userId,
      roleId,
      assignedByUserId,
    })),
  );
}

async function getUserForSettings(userId: string, organizationId: string) {
  const [user] = await db
    .select({
      accessStatus: users.accessStatus,
      id: users.id,
      email: users.email,
      isActive: users.isActive,
      name: users.name,
    })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.organizationId, organizationId)))
    .limit(1);

  if (!user) {
    throw new AccessDeniedError();
  }

  return user;
}

async function requireSettingsManagerContext() {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  assertCan("settings.manage", context);

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return {
    context,
    organizationId: context.organizationId,
  };
}

function formDataToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export {
  tenantUpdateSettingsUserRolesAction as updateSettingsUserRolesAction,
  tenantUpdateSettingsUserStatusAction as updateSettingsUserStatusAction,
  tenantUpdateAppSettingAction as updateAppSettingAction,
  tenantCreateAreaAction as createAreaAction,
  tenantDeleteAreaAction as deleteAreaAction,
  tenantCreatePositionAction as createPositionAction,
  tenantDeletePositionAction as deletePositionAction,
};

const tenantUpdateSettingsUserRolesAction = withRateLimitActionResult(
  bindCurrentTenantContext(updateSettingsUserRolesAction),
);
const tenantUpdateSettingsUserStatusAction = withRateLimitActionResult(
  bindCurrentTenantContext(updateSettingsUserStatusAction),
);
const tenantUpdateAppSettingAction = bindCurrentTenantContext(updateAppSettingAction);
const tenantCreateAreaAction = bindCurrentTenantContext(createAreaAction);
const tenantDeleteAreaAction = bindCurrentTenantContext(deleteAreaAction);
const tenantCreatePositionAction = bindCurrentTenantContext(createPositionAction);
const tenantDeletePositionAction = bindCurrentTenantContext(deletePositionAction);

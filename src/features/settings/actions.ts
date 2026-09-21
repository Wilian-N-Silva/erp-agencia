"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
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
  users,
} from "@/lib/db/schema";
import { bindCurrentTenantContext, getCurrentAccessContext } from "@/lib/dal";
import {
  enforceAuthenticatedRateLimit,
  withRateLimitActionResult,
} from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { formDataToObject } from "@/lib/validation";

import { replaceUserRoles, updateUserAccessStatus } from "./access";
import { parseSettingValue } from "./rules";
import {
  updateUserAccessStatusSchema,
  updateUserEmployeeLinkSchema,
  updateUserRolesSchema,
} from "./schemas";

const updateSettingSchema = z.strictObject({
  description: z.string().trim().max(500).optional(),
  key: z.string().trim().min(1).max(120).regex(/^[a-z0-9_.-]+$/),
  value: z.string().max(5000),
});

const createOrgUnitSchema = z.strictObject({
  name: z.string().trim().min(1).max(120),
});

const deleteOrgUnitSchema = z.strictObject({
  id: z.string().uuid(),
});

async function updateSettingsUserRolesAction(formData: FormData) {
  const { context } = await requireSettingsManagerContext();
  await enforceAuthenticatedRateLimit("invitation", context);
  const input = updateUserRolesSchema.parse({
    roleKeys: formData.getAll("roleKeys"),
    userId: formData.get("userId"),
  });
  await replaceUserRoles(context, input);

  revalidatePath("/app/configuracoes");
}

async function updateSettingsUserStatusAction(formData: FormData) {
  const { context } = await requireSettingsManagerContext();
  await enforceAuthenticatedRateLimit("invitation", context);
  const input = updateUserAccessStatusSchema.parse(formDataToObject(formData));
  await updateUserAccessStatus(context, input);

  revalidatePath("/app/configuracoes");
}

async function updateSettingsUserEmployeeLinkAction(formData: FormData) {
  const { context, organizationId } = await requireSettingsManagerContext();
  await enforceAuthenticatedRateLimit("invitation", context);
  const input = updateUserEmployeeLinkSchema.parse(formDataToObject(formData));
  const user = await getUserForSettings(input.userId, organizationId);
  await db.execute(sql`
    select pg_advisory_xact_lock(
      hashtextextended(${`acc-003:user:${input.userId}`}, 0)
    )
  `);
  const currentLinks = await db
    .select({ id: employees.id })
    .from(employees)
    .where(
      and(
        eq(employees.organizationId, organizationId),
        eq(employees.userId, input.userId),
      ),
    );
  const targetEmployee = input.employeeId
    ? await getEmployeeLinkTarget(input.employeeId, organizationId)
    : null;

  if (targetEmployee?.userId && targetEmployee.userId !== input.userId) {
    throw new Error("Colaborador já está vinculado a outro usuário.");
  }

  const before = {
    employeeIds: currentLinks.map((employee) => employee.id),
    userId: user.id,
  };

  await db
    .update(employees)
    .set({ userId: null, updatedAt: new Date() })
    .where(
      and(
        eq(employees.organizationId, organizationId),
        eq(employees.userId, input.userId),
      ),
    );

  if (targetEmployee) {
    const [linkedEmployee] = await db
      .update(employees)
      .set({ userId: input.userId, updatedAt: new Date() })
      .where(
        and(
          eq(employees.id, targetEmployee.id),
          eq(employees.organizationId, organizationId),
          isNull(employees.deletedAt),
          isNull(employees.userId),
        ),
      )
      .returning({ id: employees.id });

    if (!linkedEmployee) {
      throw new Error("Não foi possível vincular o colaborador.");
    }
  }

  await writeAuditLog(context, {
    action: "update",
    entityType: "user_employee_link",
    entityId: input.userId,
    before,
    after: {
      employeeIds: targetEmployee ? [targetEmployee.id] : [],
      userId: user.id,
    },
    metadata: {
      employeeId: targetEmployee?.id ?? null,
    },
  });

  revalidatePath("/app/configuracoes");
  revalidatePath("/portal");
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

async function getEmployeeLinkTarget(id: string, organizationId: string) {
  const [employee] = await db
    .select({
      id: employees.id,
      userId: employees.userId,
    })
    .from(employees)
    .where(
      and(
        eq(employees.id, id),
        eq(employees.organizationId, organizationId),
        isNull(employees.deletedAt),
      ),
    )
    .limit(1);

  if (!employee) {
    throw new AccessDeniedError();
  }

  return employee;
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

export {
  tenantUpdateSettingsUserRolesAction as updateSettingsUserRolesAction,
  tenantUpdateSettingsUserStatusAction as updateSettingsUserStatusAction,
  tenantUpdateSettingsUserEmployeeLinkAction as updateSettingsUserEmployeeLinkAction,
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
const tenantUpdateSettingsUserEmployeeLinkAction = withRateLimitActionResult(
  bindCurrentTenantContext(updateSettingsUserEmployeeLinkAction),
);
const tenantUpdateAppSettingAction = bindCurrentTenantContext(updateAppSettingAction);
const tenantCreateAreaAction = bindCurrentTenantContext(createAreaAction);
const tenantDeleteAreaAction = bindCurrentTenantContext(deleteAreaAction);
const tenantCreatePositionAction = bindCurrentTenantContext(createPositionAction);
const tenantDeletePositionAction = bindCurrentTenantContext(deletePositionAction);

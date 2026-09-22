import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";

import { bindTenantContext, db } from "@/lib/db";
import { employees, saasSubscriptionUsers, saasSubscriptions, users } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";

import {
  applySaasSubscriptionFilters,
  canReadSaasCost,
  canReadSaasSubscription,
  getSaasRenewalState,
  getSaasScope,
  isSaasRenewalAlert,
  type SaasSubscriptionFilters,
  type SaasSubscriptionStatus,
  type SaasUserStatus,
} from "./rules";

export type SaasLinkedUser = {
  employeeId: string;
  employeeName: string;
  employeeStatus: string;
  managerEmployeeId: string | null;
  status: SaasUserStatus | string;
  linkedAt: Date;
  unlinkedAt: Date | null;
};

export type SaasSubscriptionListItem = {
  id: string;
  name: string;
  category: string;
  provider: string | null;
  monthlyCost: string | null;
  costHidden: boolean;
  renewalDate: string | null;
  renewalState: "none" | "overdue" | "due_soon" | "ok";
  status: SaasSubscriptionStatus;
  responsibleUserName: string | null;
  notes: string | null;
  linkedUsers: SaasLinkedUser[];
  createdAt: Date;
  updatedAt: Date;
};

export type SaasEmployeeOption = {
  id: string;
  name: string;
};

async function listSaasSubscriptions(
  context: AccessContext,
  filters: SaasSubscriptionFilters = {},
  options: { limit?: number; linkedOnly?: boolean } = {},
): Promise<SaasSubscriptionListItem[]> {
  assertCanAny(["saas.read", "saas.write", "saas.configure", "saas.read_linked"], context);
  const organizationId = requireOrganizationId(context);
  const scope = options.linkedOnly ? "linked" : getSaasScope(context);

  if (scope === "none") {
    return [];
  }

  const rows = await db
    .select({
      id: saasSubscriptions.id,
      name: saasSubscriptions.name,
      category: saasSubscriptions.category,
      provider: saasSubscriptions.provider,
      monthlyCost: saasSubscriptions.monthlyCost,
      renewalDate: saasSubscriptions.renewalDate,
      status: saasSubscriptions.status,
      responsibleUserName: users.name,
      notes: saasSubscriptions.notes,
      createdAt: saasSubscriptions.createdAt,
      updatedAt: saasSubscriptions.updatedAt,
    })
    .from(saasSubscriptions)
    .leftJoin(users, eq(saasSubscriptions.responsibleUserId, users.id))
    .where(and(eq(saasSubscriptions.organizationId, organizationId), isNull(saasSubscriptions.deletedAt)))
    .orderBy(asc(saasSubscriptions.name));
  const linksBySubscription = await loadSaasSubscriptionUsers(rows.map((row) => row.id));
  const canReadCost = canReadSaasCost(context);

  return applySaasSubscriptionFilters(
    rows
      .map((row) => {
        const linkedUsers = linksBySubscription.get(row.id) ?? [];
        const status = row.status as SaasSubscriptionStatus;

        return {
          ...row,
          monthlyCost: canReadCost ? row.monthlyCost : null,
          costHidden: !canReadCost,
          linkedUsers,
          renewalState: getSaasRenewalState({
            renewalDate: row.renewalDate,
            status,
          }),
          status,
        };
      })
      .filter((row) => {
        if (scope === "all") {
          return true;
        }

        return canReadSaasSubscription(context, {
          linkedEmployeeIds: row.linkedUsers
            .filter((user) => user.status === "active")
            .map((user) => user.employeeId),
          linkedManagerEmployeeIds: row.linkedUsers.map((user) => user.managerEmployeeId),
          renewalDate: row.renewalDate,
          status: row.status,
        });
      }),
    filters,
  ).slice(0, options.limit);
}

async function listSaasEmployeeOptions(
  context: AccessContext,
): Promise<SaasEmployeeOption[]> {
  assertCanAny(["saas.write", "saas.configure"], context);
  const organizationId = requireOrganizationId(context);

  return db
    .select({
      id: employees.id,
      name: employees.fullName,
    })
    .from(employees)
    .where(and(eq(employees.organizationId, organizationId), isNull(employees.deletedAt)))
    .orderBy(asc(employees.fullName));
}

async function listSaasRenewalAlerts(
  context: AccessContext,
  options: { limit?: number } = {},
) {
  const items = await listSaasSubscriptions(context);

  return items
    .filter((item) =>
      isSaasRenewalAlert({
        renewalDate: item.renewalDate,
        status: item.status,
      }),
    )
    .slice(0, options.limit);
}

async function loadSaasSubscriptionUsers(subscriptionIds: readonly string[]) {
  const linksBySubscription = new Map<string, SaasLinkedUser[]>();

  if (subscriptionIds.length === 0) {
    return linksBySubscription;
  }

  const rows = await db
    .select({
      subscriptionId: saasSubscriptionUsers.subscriptionId,
      employeeId: saasSubscriptionUsers.employeeId,
      employeeName: employees.fullName,
      employeeStatus: employees.status,
      managerEmployeeId: employees.managerEmployeeId,
      status: saasSubscriptionUsers.status,
      linkedAt: saasSubscriptionUsers.linkedAt,
      unlinkedAt: saasSubscriptionUsers.unlinkedAt,
    })
    .from(saasSubscriptionUsers)
    .innerJoin(employees, eq(saasSubscriptionUsers.employeeId, employees.id))
    .where(inArray(saasSubscriptionUsers.subscriptionId, [...subscriptionIds]))
    .orderBy(desc(saasSubscriptionUsers.status), asc(employees.fullName));

  for (const row of rows) {
    const links = linksBySubscription.get(row.subscriptionId) ?? [];

    links.push({
      employeeId: row.employeeId,
      employeeName: row.employeeName,
      employeeStatus: row.employeeStatus,
      managerEmployeeId: row.managerEmployeeId,
      status: row.status as SaasUserStatus,
      linkedAt: row.linkedAt,
      unlinkedAt: row.unlinkedAt,
    });
    linksBySubscription.set(row.subscriptionId, links);
  }

  return linksBySubscription;
}

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return context.organizationId;
}

export {
  tenantListSaasSubscriptions as listSaasSubscriptions,
  tenantListSaasEmployeeOptions as listSaasEmployeeOptions,
  tenantListSaasRenewalAlerts as listSaasRenewalAlerts,
};

const tenantListSaasSubscriptions = bindTenantContext(listSaasSubscriptions);
const tenantListSaasEmployeeOptions = bindTenantContext(listSaasEmployeeOptions);
const tenantListSaasRenewalAlerts = bindTenantContext(listSaasRenewalAlerts);

import { and, asc, eq, isNull, or } from "drizzle-orm";
import { db, withTenantDb } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCanAny } from "@/lib/rbac";
import { getTimeOffScope } from "./rules";
import { getPjReferenceToday, getPjTenureReference } from "./pj-reference-rules";

export async function listPjTenureReferences(context: AccessContext, ownOnly = false) {
  assertCanAny(["timeoff.read", "timeoff.write", "timeoff.read_team", "timeoff.read_own"], context);
  if (!context.organizationId) throw new AccessDeniedError();
  const scope = ownOnly ? "own" : getTimeOffScope(context);
  if (scope === "none" || (scope !== "all" && !context.employeeId)) return [];
  const today = getPjReferenceToday();
  return withTenantDb(context, async () => {
    const conditions = [eq(employees.organizationId, context.organizationId!), eq(employees.employmentType, "pj"), isNull(employees.deletedAt)];
    if (scope === "own") conditions.push(eq(employees.id, context.employeeId!));
    if (scope === "team") conditions.push(or(eq(employees.id, context.employeeId!), eq(employees.managerEmployeeId, context.employeeId!))!);
    const rows = await db.select({ id: employees.id, name: employees.fullName, startDate: employees.startDate, endDate: employees.endDate, status: employees.status })
      .from(employees).where(and(...conditions)).orderBy(asc(employees.fullName));
    return rows.map(row => ({ ...row, today, ...getPjTenureReference(row.startDate, row.endDate, today, row.status === "terminated") }));
  });
}

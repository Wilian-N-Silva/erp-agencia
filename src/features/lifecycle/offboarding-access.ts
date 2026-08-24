import { and, eq, isNull } from "drizzle-orm";

import { revokeUserSessions } from "@/features/access/session-revocation";
import type { TenantTransaction } from "@/lib/db";
import { employees } from "@/lib/db/schema";
import { AccessDeniedError } from "@/lib/rbac";

export async function terminateEmployeeAndRevokeSessions(
  transaction: TenantTransaction,
  input: {
    employeeId: string;
    endDate: string;
    organizationId: string;
  },
) {
  const [employee] = await transaction
    .update(employees)
    .set({
      endDate: input.endDate,
      status: "terminated",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(employees.id, input.employeeId),
        eq(employees.organizationId, input.organizationId),
        isNull(employees.deletedAt),
      ),
    )
    .returning({
      id: employees.id,
      userId: employees.userId,
    });

  if (!employee) {
    throw new AccessDeniedError();
  }

  if (!employee.userId) {
    return 0;
  }

  return revokeUserSessions(transaction, {
    organizationId: input.organizationId,
    userId: employee.userId,
  });
}

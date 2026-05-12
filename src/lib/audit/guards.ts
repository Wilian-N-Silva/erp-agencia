import type { AccessContext } from "@/lib/dal";
import { assertCanAny, canAny } from "@/lib/rbac";

export function canReadAuditLogs(context: AccessContext) {
  return canAny(["audit.read", "audit.read_limited"], context);
}

export function assertCanReadAuditLogs(context: AccessContext) {
  assertCanAny(["audit.read", "audit.read_limited"], context);
}

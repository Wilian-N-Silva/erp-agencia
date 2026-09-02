import { asc, eq } from "drizzle-orm";

import { bindTenantContext, db } from "@/lib/db";
import { costCenters, financialAccounts, financialCategories, suppliers } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";

async function listFinanceMasterData(context: AccessContext) {
  assertCan("finance.read", context);
  const organizationId = requireOrganizationId(context);
  const [accounts, categories, centers, supplierRows] = await Promise.all([
    db.select().from(financialAccounts).where(eq(financialAccounts.organizationId, organizationId)).orderBy(asc(financialAccounts.name)),
    db.select().from(financialCategories).where(eq(financialCategories.organizationId, organizationId)).orderBy(asc(financialCategories.name)),
    db.select().from(costCenters).where(eq(costCenters.organizationId, organizationId)).orderBy(asc(costCenters.name)),
    db.select().from(suppliers).where(eq(suppliers.organizationId, organizationId)).orderBy(asc(suppliers.name)),
  ]);

  return { accounts, categories, costCenters: centers, suppliers: supplierRows };
}

function requireOrganizationId(context: AccessContext) {
  if (!context.organizationId) throw new AccessDeniedError();
  return context.organizationId;
}

export const getFinanceMasterData = bindTenantContext(listFinanceMasterData);

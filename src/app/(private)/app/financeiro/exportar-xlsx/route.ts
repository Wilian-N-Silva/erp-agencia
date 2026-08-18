import { NextResponse, type NextRequest } from "next/server";

import { buildFinanceXlsx } from "@/features/finance/export-xlsx";
import { getFinanceDashboard } from "@/features/finance/dal";
import { normalizeFinanceFilters } from "@/features/finance/rules";
import { getRequestAuditMetadata, writeAuditLog } from "@/lib/audit";
import { getCurrentAccessContext } from "@/lib/dal";
import {
  enforceAuthenticatedRateLimit,
  toRateLimitResponse,
} from "@/lib/rate-limit";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const context = await getCurrentAccessContext();

  if (!context) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!can("finance.export", context)) {
    return NextResponse.redirect(new URL("/acesso-negado", request.url));
  }

  try {
    await enforceAuthenticatedRateLimit("export", context);
  } catch (error) {
    const response = toRateLimitResponse(error);
    if (response) return response;
    throw error;
  }

  const filters = normalizeFinanceFilters(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
  const dashboard = await getFinanceDashboard(context, { filters });
  const buffer = await buildFinanceXlsx(dashboard);
  const auditMetadata = getRequestAuditMetadata(request.headers);

  await writeAuditLog(context, {
    action: "export",
    entityType: "financial_report",
    metadata: {
      format: "xlsx",
      filters,
      rows: {
        entries: dashboard.entries.length,
        expenses: dashboard.expenses.length,
        provisions: dashboard.provisions.length,
      },
    },
    ...auditMetadata,
  });

  return new NextResponse(buffer as BodyInit, {
    headers: {
      "content-disposition": `attachment; filename="financeiro-${dashboard.competence}.xlsx"`,
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    },
  });
}

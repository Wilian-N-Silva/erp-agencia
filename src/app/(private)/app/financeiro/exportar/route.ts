import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { buildFinanceCsv } from "@/features/finance/export";
import { getFinanceDashboard } from "@/features/finance/dal";
import { parseFinanceExportFilters } from "@/features/finance/rules";
import { getRequestAuditMetadata, writeAuditLog } from "@/lib/audit";
import { getCurrentAccessContext } from "@/lib/dal";
import {
  enforceAuthenticatedRateLimit,
  reportRateLimitSecurityEvent,
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
    await reportRateLimitSecurityEvent(error);
    const response = toRateLimitResponse(error);
    if (response) return response;
    throw error;
  }

  let filters;
  try {
    filters = parseFinanceExportFilters(request.nextUrl.searchParams);
  } catch (error) {
    if (error instanceof ZodError) {
      return invalidFiltersResponse();
    }
    throw error;
  }
  const dashboard = await getFinanceDashboard(context, { filters });
  const csv = buildFinanceCsv(dashboard);
  const auditMetadata = getRequestAuditMetadata(request.headers);

  await writeAuditLog(context, {
    action: "export",
    entityType: "financial_report",
    metadata: {
      filters,
      rows: {
        entries: dashboard.entries.length,
        expenses: dashboard.expenses.length,
        provisions: dashboard.provisions.length,
      },
    },
    ...auditMetadata,
  });

  return new NextResponse(csv, {
    headers: {
      "content-disposition": `attachment; filename="financeiro-${dashboard.competence}.csv"`,
      "content-type": "text/csv; charset=utf-8",
    },
  });
}

function invalidFiltersResponse() {
  return NextResponse.json(
    {
      error: {
        code: "INVALID_EXPORT_FILTERS",
        message: "Filtros de exportacao invalidos.",
      },
    },
    { status: 400 },
  );
}

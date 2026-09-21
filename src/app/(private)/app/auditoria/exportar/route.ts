import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { buildAuditCsv } from "@/features/audit/export";
import { listAuditLogs } from "@/features/audit/dal";
import { canExportAuditReport, parseAuditExportFilters } from "@/features/audit/rules";
import { getRequestAuditMetadata, writeAuditLog } from "@/lib/audit";
import { getCurrentAccessContext } from "@/lib/dal";
import {
  enforceAuthenticatedRateLimit,
  reportRateLimitSecurityEvent,
  toRateLimitResponse,
} from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const context = await getCurrentAccessContext();

  if (!context) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (!canExportAuditReport(context)) {
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
    filters = parseAuditExportFilters(request.nextUrl.searchParams);
  } catch (error) {
    if (error instanceof ZodError) {
      return invalidFiltersResponse();
    }
    throw error;
  }
  const logs = await listAuditLogs(context, filters, { limit: 1000 });
  const csv = buildAuditCsv(logs, filters);
  const auditMetadata = getRequestAuditMetadata(request.headers);

  await writeAuditLog(context, {
    action: "export",
    entityType: "audit_log",
    metadata: {
      filters,
      rows: logs.length,
    },
    ...auditMetadata,
  });

  return new NextResponse(csv, {
    headers: {
      "content-disposition": `attachment; filename="auditoria-${new Date().toISOString().slice(0, 10)}.csv"`,
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

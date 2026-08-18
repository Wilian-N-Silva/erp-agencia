import { NextResponse, type NextRequest } from "next/server";

import { buildAuditCsv } from "@/features/audit/export";
import { listAuditLogs } from "@/features/audit/dal";
import { canExportAuditReport, normalizeAuditFilters } from "@/features/audit/rules";
import { getRequestAuditMetadata, writeAuditLog } from "@/lib/audit";
import { getCurrentAccessContext } from "@/lib/dal";
import {
  enforceAuthenticatedRateLimit,
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
    const response = toRateLimitResponse(error);
    if (response) return response;
    throw error;
  }

  const filters = normalizeAuditFilters(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );
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

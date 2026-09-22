import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

import { listEmployees } from "@/features/people/dal";
import {
  buildPeopleCsv,
  filterPeopleForExport,
  parsePeopleExportFilters,
} from "@/features/people/export";
import { canReadPeople } from "@/features/people/rules";
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

  if (!canReadPeople(context)) {
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
    filters = parsePeopleExportFilters(request.nextUrl.searchParams);
  } catch (error) {
    if (error instanceof ZodError) {
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
    throw error;
  }

  const employees = filterPeopleForExport(await listEmployees(context), filters);
  const csv = buildPeopleCsv(employees);
  const auditMetadata = getRequestAuditMetadata(request.headers);

  await writeAuditLog(context, {
    action: "export",
    entityType: "employee",
    metadata: {
      filters,
      format: "csv",
      rows: employees.length,
    },
    ...auditMetadata,
  });

  return new NextResponse(csv, {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": 'attachment; filename="colaboradores.csv"',
      "content-type": "text/csv; charset=utf-8",
    },
  });
}

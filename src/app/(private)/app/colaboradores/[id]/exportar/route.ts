import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getEmployeeDetail } from "@/features/people/dal";
import {
  buildEmployeeProfile,
  employeeProfileFileName,
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

type RouteContext = {
  params: Promise<{ id: string }>;
};

const employeeIdSchema = z.string().uuid();

export async function GET(request: NextRequest, { params }: RouteContext) {
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

  const parsedId = employeeIdSchema.safeParse((await params).id);

  if (!parsedId.success) {
    return notFoundResponse();
  }

  const employee = await getEmployeeDetail(context, parsedId.data);

  if (!employee) {
    return notFoundResponse();
  }

  const profile = buildEmployeeProfile(employee);
  const auditMetadata = getRequestAuditMetadata(request.headers);

  await writeAuditLog(context, {
    action: "export",
    entityId: employee.id,
    entityType: "employee",
    metadata: { format: "txt", profile: true },
    ...auditMetadata,
  });

  return new NextResponse(profile, {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="${employeeProfileFileName(employee)}"`,
      "content-type": "text/plain; charset=utf-8",
    },
  });
}

function notFoundResponse() {
  return NextResponse.json(
    {
      error: {
        code: "EMPLOYEE_NOT_FOUND",
        message: "Colaborador nao encontrado.",
      },
    },
    { status: 404 },
  );
}

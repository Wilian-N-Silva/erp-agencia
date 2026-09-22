import { NextResponse } from "next/server";
import { z } from "zod";
import { getGraphicImport } from "@/features/graphics/import-staging";
import { getCurrentAccessContext } from "@/lib/dal";
import { writeAuditLog } from "@/lib/audit";
import { can } from "@/lib/rbac";
import { enforceAuthenticatedRateLimit, reportRateLimitSecurityEvent, toRateLimitResponse } from "@/lib/rate-limit";
export const dynamic = "force-dynamic";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentAccessContext();
  if (!context) return new NextResponse("Sessão necessária.", { status: 401 });
  if (!can("graphics.import", context)) return new NextResponse("Acesso negado.", { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return new NextResponse("Lote inválido.", { status: 400 });
  try { await enforceAuthenticatedRateLimit("export", context); }
  catch (error) { await reportRateLimitSecurityEvent(error); const response = toRateLimitResponse(error); if (response) return response; throw error; }
  const data = await getGraphicImport(context, id);
  if (!data) return new NextResponse("Lote não encontrado.", { status: 404 });
  const summary = Object.fromEntries(["pending", "ready", "imported", "ignored"].map(status => [status, data.rows.filter(row => row.status === status).length]));
  await writeAuditLog(context, { action: "export", entityType: "graphic_import_batch", entityId: id, metadata: { format: "json", rowCount: data.rows.length } });
  return new NextResponse(JSON.stringify({ generatedAt: new Date().toISOString(), summary, ...data }, null, 2), { headers: {
    "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="importacao-grafica-${id}.json"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff",
  } });
}

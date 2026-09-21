import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getGraphicOsDownload } from "@/features/graphics/os-dal";
import { getCurrentAccessContext } from "@/lib/dal";
import { writeAuditLog } from "@/lib/audit";
import { getStorageObject, type StorageProvider } from "@/lib/storage";
import { AccessDeniedError } from "@/lib/rbac";

export const dynamic = "force-dynamic";
const schema = z.strictObject({ id: z.string().uuid(), versionId: z.string().uuid() });
const missing = () => NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; versionId: string }> }) {
  const context = await getCurrentAccessContext();
  if (!context) return NextResponse.redirect(new URL("/login", request.url));
  const parsed = schema.safeParse(await params);
  if (!parsed.success) return missing();
  try {
    const file = await getGraphicOsDownload(context, parsed.data.id, parsed.data.versionId);
    if (!file) return missing();
    let body: Buffer;
    try {
      body = await getStorageObject({ bucket: file.bucket, key: file.storageKey, provider: file.storageProvider as StorageProvider });
    } catch { return missing(); }
    await writeAuditLog(context, { action: "sensitive_read", entityType: "file", entityId: file.id,
      metadata: { jobId: parsed.data.id, osVersionId: parsed.data.versionId } });
    return new NextResponse(new Uint8Array(body), { headers: {
      "content-type": "application/pdf", "x-content-type-options": "nosniff", "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="os.pdf"; filename*=UTF-8''${encodeURIComponent(file.originalName).replaceAll("'", "%27")}`,
    } });
  } catch (error) {
    if (error instanceof AccessDeniedError) return missing();
    return NextResponse.json({ error: "Não foi possível baixar o documento." }, { status: 500 });
  }
}

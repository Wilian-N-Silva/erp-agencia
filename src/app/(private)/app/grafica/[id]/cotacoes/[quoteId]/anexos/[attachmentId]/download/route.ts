import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getGraphicSupplierQuoteAttachment } from "@/features/graphics/dal";
import { getRequestAuditMetadata, writeAuditLog } from "@/lib/audit";
import { getCurrentAccessContext } from "@/lib/dal";
import { getStorageObject, type StorageProvider } from "@/lib/storage";

export const dynamic = "force-dynamic";

const paramsSchema = z.strictObject({
  id: z.string().uuid(),
  quoteId: z.string().uuid(),
  attachmentId: z.string().uuid(),
});

export async function GET(request: NextRequest, { params }: {
  params: Promise<{ id: string; quoteId: string; attachmentId: string }>;
}) {
  const context = await getCurrentAccessContext();
  if (!context) return NextResponse.redirect(new URL("/login", request.url));
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return notFoundResponse();

  const attachment = await getGraphicSupplierQuoteAttachment(
    context,
    parsed.data.id,
    parsed.data.quoteId,
    parsed.data.attachmentId,
  );
  const body = await getStorageObject({
    bucket: attachment.bucket,
    key: attachment.storageKey,
    provider: attachment.storageProvider as StorageProvider,
  });
  await writeAuditLog(context, {
    action: "sensitive_read",
    entityType: "file",
    entityId: attachment.fileId,
    metadata: {
      attachmentId: attachment.attachmentId,
      graphicJobId: parsed.data.id,
      quoteId: parsed.data.quoteId,
    },
    ...getRequestAuditMetadata(request.headers),
  });
  return new NextResponse(body, {
    headers: {
      "content-disposition": `attachment; filename="${attachment.originalName.replaceAll('"', "'")}"`,
      "content-type": attachment.mimeType,
    },
  });
}

function notFoundResponse() {
  return NextResponse.json({
    error: { code: "ATTACHMENT_NOT_FOUND", message: "Anexo não encontrado." },
  }, { status: 404 });
}

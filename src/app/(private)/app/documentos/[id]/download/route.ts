import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getDocumentForAccess } from "@/features/documents/dal";
import { getRequestAuditMetadata, writeAuditLog } from "@/lib/audit";
import { getCurrentAccessContext } from "@/lib/dal";
import { AccessDeniedError } from "@/lib/rbac";
import { getStorageObject, type StorageProvider } from "@/lib/storage";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const documentIdSchema = z.string().uuid();

export async function GET(request: NextRequest, { params }: RouteContext) {
  const context = await getCurrentAccessContext();

  if (!context) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const parsedId = documentIdSchema.safeParse((await params).id);

  if (!parsedId.success) {
    return NextResponse.json(
      {
        error: {
          code: "DOCUMENT_NOT_FOUND",
          message: "Documento nao encontrado.",
        },
      },
      { status: 404 },
    );
  }

  let document;
  try {
    document = await getDocumentForAccess(context, parsedId.data);
  } catch (error) {
    if (!(error instanceof AccessDeniedError)) throw error;
    return NextResponse.json({ error: { code: "DOCUMENT_NOT_FOUND", message: "Documento nao encontrado." } }, { status: 404 });
  }
  let body;
  try { body = await getStorageObject({
    bucket: document.bucket,
    key: document.storageKey,
    provider: document.storageProvider as StorageProvider,
  }); } catch {
    return NextResponse.json({ error: { code: "DOCUMENT_UNAVAILABLE", message: "Arquivo indisponível. Tente novamente ou solicite o reenvio." } }, { status: 503, headers: { "cache-control": "private, no-store" } });
  }
  const auditMetadata = getRequestAuditMetadata(request.headers);

  await writeAuditLog(context, {
    action: "sensitive_read",
    entityType: "file",
    entityId: document.fileId,
    metadata: {
      documentId: document.id,
      originalName: document.originalName,
      storageProvider: document.storageProvider,
    },
    ...auditMetadata,
  });

  return new NextResponse(body, {
    headers: {
      "cache-control": "private, no-store",
      "content-disposition": `attachment; filename="${encodeHeaderValue(document.originalName)}"`,
      "content-type": document.mimeType,
    },
  });
}

function encodeHeaderValue(value: string) {
  return value.replaceAll('"', "'");
}

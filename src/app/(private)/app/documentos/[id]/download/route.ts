import { NextResponse, type NextRequest } from "next/server";

import { getDocumentForAccess } from "@/features/documents/dal";
import { getRequestAuditMetadata, writeAuditLog } from "@/lib/audit";
import { getCurrentAccessContext } from "@/lib/dal";
import { getStorageObject, type StorageProvider } from "@/lib/storage";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
  const context = await getCurrentAccessContext();

  if (!context) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { id } = await params;
  const document = await getDocumentForAccess(context, id);
  const body = await getStorageObject({
    bucket: document.bucket,
    key: document.storageKey,
    provider: document.storageProvider as StorageProvider,
  });
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
      "content-disposition": `attachment; filename="${encodeHeaderValue(document.originalName)}"`,
      "content-type": document.mimeType,
    },
  });
}

function encodeHeaderValue(value: string) {
  return value.replaceAll('"', "'");
}

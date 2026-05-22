import { Download, File as FileIcon, Lock } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { Card, EmptyState, StatusBadge } from "@/components/fg";
import { listDocuments, type DocumentListItem } from "@/features/documents/dal";
import {
  documentTypeLabels,
  fileSensitivityLabels,
} from "@/features/documents/rules";
import { formatDate } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function PortalDocumentsPage() {
  const context = await getCurrentAccessContext();
  if (!context) {
    redirect("/login");
  }

  const documents = await listDocuments(context, { ownOnly: true });

  return (
    <>
      <h1 className="fg-portal-h1">Meus documentos</h1>

      {documents.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileIcon size={32} />}
            title="Nenhum documento disponível"
            description="Quando o RH ou o financeiro publicarem documentos para você, eles aparecem aqui."
          />
        </Card>
      ) : (
        <div className="fg-portal-doc-list">
          {documents.map((document) => (
            <DocumentRow key={document.id} document={document} />
          ))}
        </div>
      )}
    </>
  );
}

function DocumentRow({ document }: { document: DocumentListItem }) {
  const downloadHref = `/app/documentos/${document.id}/download` as Route;
  const docTypeLabel =
    documentTypeLabels[document.documentType as keyof typeof documentTypeLabels] ??
    document.documentType;
  const sensitivityLabel =
    fileSensitivityLabels[document.sensitivity] ?? document.sensitivity;

  return (
    <div className="fg-portal-doc">
      <FileIcon size={20} />
      <div className="fg-portal-doc-body">
        <div className="fg-portal-doc-name">{document.originalName}</div>
        <div className="fg-portal-doc-meta">
          <span>{docTypeLabel}</span>
          <span>·</span>
          <span>{formatBytes(document.byteSize)}</span>
          <span>·</span>
          <span className="fg-tabular">{formatDate(document.createdAt)}</span>
          {document.sensitivity !== "public_internal" ? (
            <>
              <span>·</span>
              <Lock size={11} />
              <StatusBadge tone="muted" label={sensitivityLabel} withDot={false} />
            </>
          ) : null}
        </div>
      </div>
      <div className="fg-portal-doc-actions">
        <Link className="fg-icon-btn sm" href={downloadHref} aria-label="Baixar">
          <Download size={14} />
        </Link>
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getAuditLogDetail } from "@/features/audit/dal";
import {
  auditActionLabels,
  auditEntityLabels,
  canReadAuditReport,
} from "@/features/audit/rules";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AuditDetailPage({ params }: PageProps) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canReadAuditReport(context)) {
    redirect("/acesso-negado");
  }

  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const log = await getAuditLogDetail(context, id);

  if (!log) {
    notFound();
  }

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link className={`${secondaryButtonClassName} w-fit`} href="/app/auditoria">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{formatDateTime(log.createdAt)}</p>
          <h1 className="text-2xl font-semibold tracking-normal">
            {auditActionLabels[log.action as keyof typeof auditActionLabels] ?? log.action}
          </h1>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Entidade" value={auditEntityLabels[log.entityType] ?? log.entityType} />
        <SummaryCard label="ID entidade" value={log.entityId ?? "-"} />
        <SummaryCard label="Ator" value={log.actorName ?? "Sistema"} />
        <SummaryCard label="Detalhes" value={log.payloadsVisible ? "Completos" : "Limitados"} />
      </div>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Identificacao</h2>
        </div>
        <dl className="grid gap-0 sm:grid-cols-2">
          <DetailItem label="Log ID" value={log.id} />
          <DetailItem label="Ator email" value={log.actorEmail ?? "-"} />
          <DetailItem label="IP" value={log.payloadsVisible ? log.ipAddress ?? "-" : "Restrito"} />
          <DetailItem label="User agent" value={log.payloadsVisible ? log.userAgent ?? "-" : "Restrito"} />
        </dl>
      </section>

      {log.payloadsVisible ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <PayloadPanel title="Antes" value={log.before} />
          <PayloadPanel title="Depois" value={log.after} />
          <PayloadPanel title="Metadados" value={log.metadata} />
        </div>
      ) : (
        <section className="rounded-lg border border-dashed bg-card p-6 text-sm text-muted-foreground">
          Payloads, IP e user agent sao visiveis apenas para perfis com leitura completa de auditoria.
        </section>
      )}
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold">{value}</p>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b p-4 sm:odd:border-r">
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
    </div>
  );
}

function PayloadPanel({ title, value }: { title: string; value: unknown }) {
  return (
    <section className="min-w-0 rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap break-words p-4 text-xs text-muted-foreground">
        {formatJson(value)}
      </pre>
    </section>
  );
}

function formatJson(value: unknown) {
  if (value === null || value === undefined) {
    return "-";
  }

  return JSON.stringify(value, null, 2);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const secondaryButtonClassName =
  "inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

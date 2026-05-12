import { ArrowLeft, Ban, CheckCircle2, PauseCircle, Save } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { updateClientAction, updateClientStatusAction } from "@/features/clients/actions";
import {
  getClientDetail,
  listClientAuditLogs,
  listClientOwnerOptions,
} from "@/features/clients/dal";
import {
  canWriteClients,
  clientStatusLabels,
  type ClientStatus,
} from "@/features/clients/rules";
import { formatDate, formatMoney } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ClientDetailPage({ params }: PageProps) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const client = await getClientDetail(context, id);

  if (!client) {
    notFound();
  }

  const canWrite = canWriteClients(context);
  const canEditClient = canWrite && !client.valueHidden;
  const [ownerOptions, auditLogs] = await Promise.all([
    canEditClient ? listClientOwnerOptions(context) : Promise.resolve([]),
    listClientAuditLogs(context, client.id, { limit: 12 }),
  ]);

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link className={`${secondaryButtonClassName} w-fit`} href="/app/clientes">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{client.code}</p>
            <h1 className="truncate text-2xl font-semibold tracking-normal">{client.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ClientStatusBadge status={client.status} />
            {canWrite ? <ClientStatusActions id={client.id} status={client.status} /> : null}
          </div>
        </div>
      </div>

      <div className={`grid gap-4 ${canEditClient ? "xl:grid-cols-[0.9fr_1.1fr]" : ""}`}>
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">Detalhes</h2>
          </div>
          <dl className="grid gap-0 sm:grid-cols-2">
            <DetailItem label="Status" value={clientStatusLabels[client.status]} />
            <DetailItem label="Fee mensal" value={client.valueHidden ? "Restrito" : formatMoney(client.monthlyFee)} />
            <DetailItem label="Dia de cobranca" value={`Dia ${client.billingDay}`} />
            <DetailItem label="Cobranca" value={client.billingMethod ?? "-"} />
            <DetailItem label="Responsavel" value={client.internalOwnerName ?? "-"} />
            <DetailItem label="Inicio" value={formatDate(client.startDate)} />
            <DetailItem label="Cancelamento" value={formatDate(client.cancellationDate)} />
            <DetailItem label="Criado em" value={formatDate(client.createdAt)} />
            <DetailItem label="Atualizado em" value={formatDate(client.updatedAt)} />
          </dl>
          <div className="border-t p-4">
            <p className="text-sm font-medium">Observacoes</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {client.notes || "-"}
            </p>
          </div>
        </section>

        {canEditClient ? (
          <section className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="text-base font-semibold">Editar cliente</h2>
            </div>
            <form action={updateClientAction} className="p-4">
              <input name="id" type="hidden" value={client.id} />
              <ClientFormFields client={client} ownerOptions={ownerOptions} />
              <div className="mt-5 flex justify-end">
                <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
                  <Save className="size-4" aria-hidden="true" />
                  Salvar alteracoes
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </div>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Historico recente</h2>
        </div>
        <div className="divide-y">
          {auditLogs.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">Sem logs recentes.</p>
          ) : (
            auditLogs.map((log) => (
              <div className="grid gap-1 px-4 py-3 text-sm md:grid-cols-[12rem_1fr_14rem]" key={log.id}>
                <p className="font-medium">{formatAuditAction(log.action)}</p>
                <p className="text-muted-foreground">
                  {log.actorName ?? log.actorEmail ?? "Sistema"}
                  {formatAuditMetadata(log.metadata) ? ` - ${formatAuditMetadata(log.metadata)}` : ""}
                </p>
                <p className="text-muted-foreground md:text-right">{formatDateTime(log.createdAt)}</p>
              </div>
            ))
          )}
        </div>
      </section>
    </section>
  );
}

function ClientFormFields({
  client,
  ownerOptions,
}: {
  client: {
    billingDay: number;
    billingMethod: string | null;
    internalOwnerEmployeeId: string | null;
    monthlyFee: string | null;
    name: string;
    notes: string | null;
    startDate: string | null;
  };
  ownerOptions: { id: string; name: string }[];
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_minmax(9rem,0.35fr)_minmax(7rem,0.25fr)]">
        <label className={fieldClassName}>
          Nome
          <input className={inputClassName} defaultValue={client.name} maxLength={160} name="name" required />
        </label>
        <label className={fieldClassName}>
          Fee mensal
          <input
            className={inputClassName}
            defaultValue={client.monthlyFee ?? ""}
            inputMode="decimal"
            name="monthlyFee"
            required
          />
        </label>
        <label className={fieldClassName}>
          Dia de cobranca
          <input
            className={inputClassName}
            defaultValue={client.billingDay}
            max={31}
            min={1}
            name="billingDay"
            required
            type="number"
          />
        </label>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <label className={fieldClassName}>
          Responsavel interno
          <select
            className={inputClassName}
            defaultValue={client.internalOwnerEmployeeId ?? ""}
            name="internalOwnerEmployeeId"
          >
            <option value="">Sem responsavel</option>
            {ownerOptions.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Cobranca
          <input
            className={inputClassName}
            defaultValue={client.billingMethod ?? ""}
            maxLength={80}
            name="billingMethod"
          />
        </label>
        <label className={fieldClassName}>
          Inicio
          <input className={inputClassName} defaultValue={client.startDate ?? ""} name="startDate" type="date" />
        </label>
      </div>
      <label className={fieldClassName}>
        Observacoes
        <textarea
          className={textareaClassName}
          defaultValue={client.notes ?? ""}
          maxLength={1000}
          name="notes"
          rows={5}
        />
      </label>
    </div>
  );
}

function ClientStatusActions({ id, status }: { id: string; status: ClientStatus }) {
  return (
    <div className="flex justify-end gap-2">
      {status !== "active" ? (
        <StatusActionButton id={id} label="Ativar" status="active" tone="primary" />
      ) : null}
      {status !== "paused" ? (
        <StatusActionButton id={id} label="Pausar" status="paused" tone="warning" />
      ) : null}
      {status !== "cancelled" ? (
        <StatusActionButton id={id} label="Cancelar" status="cancelled" tone="destructive" />
      ) : null}
    </div>
  );
}

function StatusActionButton({
  id,
  label,
  status,
  tone,
}: {
  id: string;
  label: string;
  status: ClientStatus;
  tone: "destructive" | "primary" | "warning";
}) {
  const Icon = tone === "primary" ? CheckCircle2 : tone === "warning" ? PauseCircle : Ban;
  const className =
    tone === "primary"
      ? "border-primary/30 text-primary hover:bg-primary/10"
      : tone === "warning"
        ? "border-secondary/30 text-secondary-foreground hover:bg-secondary/10"
        : "border-destructive/30 text-destructive hover:bg-destructive/10";

  return (
    <form action={updateClientStatusAction}>
      <input name="id" type="hidden" value={id} />
      <input name="status" type="hidden" value={status} />
      <button
        aria-label={label}
        className={`inline-flex size-8 items-center justify-center rounded-md border transition-colors ${className}`}
        title={label}
        type="submit"
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </form>
  );
}

function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const className =
    status === "active"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "cancelled"
        ? "border-muted bg-muted text-muted-foreground"
        : "border-secondary/30 bg-secondary/10 text-secondary-foreground";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {clientStatusLabels[status]}
    </span>
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

function formatAuditAction(action: string) {
  const labels: Record<string, string> = {
    create: "Criacao",
    status_change: "Status",
    update: "Edicao",
  };

  return labels[action] ?? action;
}

function formatAuditMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const status = (metadata as { status?: unknown }).status;

  if (typeof status === "string" && status in clientStatusLabels) {
    return `Status: ${clientStatusLabels[status as ClientStatus]}`;
  }

  return null;
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

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const textareaClassName =
  "min-h-28 w-full min-w-0 resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

const secondaryButtonClassName =
  "inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

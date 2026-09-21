import { Ban, CheckCircle2, KeyRound, RefreshCw, ShieldAlert } from "lucide-react";
import { redirect } from "next/navigation";

import { ActionDialog } from "@/components/ui/action-dialog";
import { RateLimitedActionForm } from "@/components/fg";
import {
  approveAccessRecordAction,
  createAccessRecordAction,
  markAccessRemovedAction,
  reviewAccessRecordAction,
} from "@/features/accesses/actions";
import {
  listAccessEmployeeOptions,
  listAccessRecords,
  type AccessEmployeeOption,
  type AccessRecordListItem,
} from "@/features/accesses/dal";
import {
  accessRecordStatusLabels,
  accessReviewStateLabels,
  canWriteAccessRecords,
  normalizeAccessRecordFilters,
  type AccessRecordFilters,
  type AccessRecordStatus,
  type AccessReviewState,
} from "@/features/accesses/rules";
import { formatDate } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccessRecordsPage({ searchParams }: PageProps) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (
    !canAny(
      ["access_records.read", "access_records.write", "access_records.configure", "access_records.read_team"],
      context,
    )
  ) {
    redirect("/acesso-negado");
  }

  const filters = normalizeAccessRecordFilters((await searchParams) ?? {});
  const canWrite = canWriteAccessRecords(context);
  const [records, employeeOptions] = await Promise.all([
    listAccessRecords(context, filters),
    canWrite ? listAccessEmployeeOptions(context) : Promise.resolve([]),
  ]);
  const criticalCount = records.filter((record) => record.critical).length;
  const alertCount = records.filter((record) => record.alert).length;

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">Acessos</h1>
        <p className="text-sm text-muted-foreground">Plataformas, contas e revisoes criticas</p>
      </div>

      <AccessFilterForm filters={filters} />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Acessos" value={String(records.length)} />
        <SummaryCard label="Criticos" value={String(criticalCount)} />
        <SummaryCard label="Alertas" value={String(alertCount)} />
      </div>

      {canWrite ? (
        <div className="flex justify-end">
          <ActionDialog
            title="Registrar acesso"
            trigger={
              <>
                <KeyRound className="size-4" aria-hidden="true" />
                Registrar acesso
              </>
            }
            triggerClassName={`${primaryButtonClassName} sm:w-auto`}
            triggerLabel="Registrar acesso"
          >
            <AccessRecordForm employeeOptions={employeeOptions} />
          </ActionDialog>
        </div>
      ) : null}

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Registros</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Colaborador</th>
                <th className="px-4 py-3 font-medium">Plataforma</th>
                <th className="px-4 py-3 font-medium">Nivel</th>
                <th className="px-4 py-3 font-medium">Criticidade</th>
                <th className="px-4 py-3 font-medium">Revisao</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canWrite ? <th className="px-4 py-3 text-right font-medium">Acoes</th> : null}
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={canWrite ? 7 : 6}>
                    Nenhum acesso registrado.
                  </td>
                </tr>
              ) : (
                records.map((record) => (
                  <AccessRecordRow canWrite={canWrite} key={record.id} record={record} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function AccessFilterForm({ filters }: { filters: AccessRecordFilters }) {
  return (
    <form action="/app/acessos" className="rounded-lg border bg-card p-4" method="get">
      <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_minmax(10rem,0.3fr)_minmax(10rem,0.3fr)_auto_auto]">
        <label className={fieldClassName}>
          Busca
          <input
            className={inputClassName}
            defaultValue={filters.query ?? ""}
            name="q"
            placeholder="Plataforma, colaborador, conta"
          />
        </label>
        <label className={fieldClassName}>
          Status
          <select className={inputClassName} defaultValue={filters.status ?? "all"} name="status">
            <option value="all">Todos</option>
            {Object.entries(accessRecordStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Criticidade
          <select className={inputClassName} defaultValue={filters.critical ?? "all"} name="critical">
            <option value="all">Todos</option>
            <option value="critical">Criticos</option>
            <option value="standard">Padrao</option>
          </select>
        </label>
        <button className={`${primaryButtonClassName} self-end`} type="submit">
          Filtrar
        </button>
        <a className={`${secondaryButtonClassName} self-end`} href="/app/acessos">
          Limpar
        </a>
      </div>
    </form>
  );
}

function AccessRecordForm({ employeeOptions }: { employeeOptions: AccessEmployeeOption[] }) {
  return (
    <form action={createAccessRecordAction} className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Colaborador
          <select className={inputClassName} name="employeeId" required>
            <option value="">Selecione</option>
            {employeeOptions.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Plataforma
          <input className={inputClassName} maxLength={160} name="platform" required />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Conta
          <input className={inputClassName} maxLength={160} name="accountIdentifier" />
        </label>
        <label className={fieldClassName}>
          Nivel
          <input className={inputClassName} maxLength={120} name="accessLevel" required />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Status
          <select className={inputClassName} defaultValue="active" name="status">
            {Object.entries(accessRecordStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Revisao
          <input className={inputClassName} name="reviewDueDate" type="date" />
        </label>
      </div>
      <label className={fieldClassName}>
        Observacao
        <textarea className={textareaClassName} maxLength={1000} name="notes" rows={4} />
      </label>
      <label className={fieldClassName}>
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <input className="size-4 accent-primary" name="critical" type="checkbox" />
          Acesso critico
        </span>
      </label>
      <div className="flex justify-end">
        <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
          <KeyRound className="size-4" aria-hidden="true" />
          Registrar acesso
        </button>
      </div>
    </form>
  );
}

function AccessRecordRow({ canWrite, record }: { canWrite: boolean; record: AccessRecordListItem }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3 font-medium">{record.employeeName}</td>
      <td className="px-4 py-3">
        <p className="font-medium">{record.platform}</p>
        <p className="text-xs text-muted-foreground">{record.accountIdentifier ?? "-"}</p>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{record.accessLevel}</td>
      <td className="px-4 py-3">
        {record.critical ? (
          <span className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
            <ShieldAlert className="size-3" aria-hidden="true" />
            Critico
          </span>
        ) : (
          <span className="text-muted-foreground">Padrao</span>
        )}
      </td>
      <td className="px-4 py-3">
        <ReviewBadge state={record.reviewState} />
        <p className="mt-1 text-xs text-muted-foreground">{formatDate(record.reviewDueDate)}</p>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={record.status} />
      </td>
      {canWrite ? (
        <td className="px-4 py-3">
          <div className="flex flex-wrap justify-end gap-2">
            {record.status === "pending" ? (
              <RateLimitedActionForm action={approveAccessRecordAction}>
                <input name="id" type="hidden" value={record.id} />
                <IconButton icon={CheckCircle2} label="Aprovar" tone="primary" />
              </RateLimitedActionForm>
            ) : null}
            {record.status !== "removed" ? (
              <ActionDialog
                title="Revisar acesso"
                trigger={<RefreshCw className="size-4" aria-hidden="true" />}
                triggerClassName={iconButtonClassName("primary")}
                triggerLabel="Revisar acesso"
              >
                <ReviewAccessForm id={record.id} reviewDueDate={record.reviewDueDate} />
              </ActionDialog>
            ) : null}
            {record.status !== "removed" ? (
              <RateLimitedActionForm action={markAccessRemovedAction}>
                <input name="id" type="hidden" value={record.id} />
                <IconButton icon={Ban} label="Remover" tone="destructive" />
              </RateLimitedActionForm>
            ) : null}
          </div>
        </td>
      ) : null}
    </tr>
  );
}

function ReviewAccessForm({ id, reviewDueDate }: { id: string; reviewDueDate: string | null }) {
  return (
    <form action={reviewAccessRecordAction} className="grid gap-4">
      <input name="id" type="hidden" value={id} />
      <label className={fieldClassName}>
        Nova data de revisao
        <input className={inputClassName} defaultValue={reviewDueDate ?? ""} name="reviewDueDate" required type="date" />
      </label>
      <div className="flex justify-end">
        <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
          <RefreshCw className="size-4" aria-hidden="true" />
          Revisar
        </button>
      </div>
    </form>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: AccessRecordStatus }) {
  const className =
    status === "active"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "removed"
        ? "border-muted bg-muted text-muted-foreground"
        : "border-secondary/30 bg-secondary/10 text-secondary-foreground";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {accessRecordStatusLabels[status]}
    </span>
  );
}

function ReviewBadge({ state }: { state: AccessReviewState }) {
  const className =
    state === "overdue" || state === "missing"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : state === "due_soon"
        ? "border-secondary/30 bg-secondary/10 text-secondary-foreground"
        : "border-muted bg-muted text-muted-foreground";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {accessReviewStateLabels[state]}
    </span>
  );
}

function IconButton({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  tone: "destructive" | "primary";
}) {
  return (
    <button
      aria-label={label}
      className={iconButtonClassName(tone)}
      title={label}
      type="submit"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function iconButtonClassName(tone: "destructive" | "primary") {
  const className =
    tone === "primary"
      ? "border-primary/30 text-primary hover:bg-primary/10"
      : "border-destructive/30 text-destructive hover:bg-destructive/10";

  return `inline-flex size-8 shrink-0 items-center justify-center rounded-md border transition-colors ${className}`;
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const textareaClassName =
  "min-h-24 w-full min-w-0 resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

const secondaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

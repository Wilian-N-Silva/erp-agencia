import { Ban, Boxes, CheckCircle2, Link2, RefreshCw, Unlink } from "lucide-react";
import { redirect } from "next/navigation";

import { ActionDialog } from "@/components/ui/action-dialog";
import {
  cancelSaasSubscriptionAction,
  createSaasSubscriptionAction,
  linkEmployeeToSaasSubscriptionAction,
  markSaasSubscriptionRenewedAction,
  unlinkEmployeeFromSaasSubscriptionAction,
} from "@/features/saas/actions";
import {
  listSaasEmployeeOptions,
  listSaasSubscriptions,
  type SaasEmployeeOption,
  type SaasLinkedUser,
  type SaasSubscriptionListItem,
} from "@/features/saas/dal";
import {
  canReadSaasCost,
  canWriteSaasSubscriptions,
  normalizeSaasSubscriptionFilters,
  saasSubscriptionStatusLabels,
  type SaasSubscriptionFilters,
  type SaasSubscriptionStatus,
} from "@/features/saas/rules";
import { formatDate, formatMoney } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SaasSubscriptionsPage({ searchParams }: PageProps) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canAny(["saas.read", "saas.write", "saas.configure"], context)) {
    redirect("/acesso-negado");
  }

  const filters = normalizeSaasSubscriptionFilters((await searchParams) ?? {});
  const canWrite = canWriteSaasSubscriptions(context);
  const canSeeCosts = canReadSaasCost(context);
  const [subscriptions, employeeOptions] = await Promise.all([
    listSaasSubscriptions(context, filters),
    canWrite ? listSaasEmployeeOptions(context) : Promise.resolve([]),
  ]);
  const active = subscriptions.filter((subscription) => subscription.status === "active").length;
  const renewalAlerts = subscriptions.filter((subscription) =>
    subscription.renewalState === "due_soon" || subscription.renewalState === "overdue"
  ).length;

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">Assinaturas</h1>
        <p className="text-sm text-muted-foreground">SaaS, licencas e renovacoes</p>
      </div>

      <SaasFilterForm filters={filters} />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Assinaturas" value={String(subscriptions.length)} />
        <SummaryCard label="Ativas" value={String(active)} />
        <SummaryCard label="Renovacoes" value={String(renewalAlerts)} />
      </div>

      {canWrite ? (
        <div className="flex justify-end">
          <ActionDialog
            title="Cadastrar assinatura"
            trigger={
              <>
                <Boxes className="size-4" aria-hidden="true" />
                Cadastrar assinatura
              </>
            }
            triggerClassName={`${primaryButtonClassName} sm:w-auto`}
            triggerLabel="Cadastrar assinatura"
          >
            <SaasSubscriptionForm canSeeCosts={canSeeCosts} />
          </ActionDialog>
        </div>
      ) : null}

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Carteira SaaS</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Ferramenta</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Licencas</th>
                <th className="px-4 py-3 font-medium">Renovacao</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Custo mensal</th>
                {canWrite ? <th className="px-4 py-3 text-right font-medium">Acoes</th> : null}
              </tr>
            </thead>
            <tbody>
              {subscriptions.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={canWrite ? 7 : 6}>
                    Nenhuma assinatura cadastrada.
                  </td>
                </tr>
              ) : (
                subscriptions.map((subscription) => (
                  <SaasSubscriptionRow
                    canWrite={canWrite}
                    employeeOptions={employeeOptions}
                    key={subscription.id}
                    subscription={subscription}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function SaasFilterForm({ filters }: { filters: SaasSubscriptionFilters }) {
  return (
    <form action="/app/assinaturas" className="rounded-lg border bg-card p-4" method="get">
      <div className="grid gap-3 md:grid-cols-[minmax(14rem,1fr)_minmax(10rem,0.35fr)_auto_auto]">
        <label className={fieldClassName}>
          Busca
          <input
            className={inputClassName}
            defaultValue={filters.query ?? ""}
            name="q"
            placeholder="Nome, fornecedor, categoria"
          />
        </label>
        <label className={fieldClassName}>
          Status
          <select className={inputClassName} defaultValue={filters.status ?? "all"} name="status">
            <option value="all">Todos</option>
            {Object.entries(saasSubscriptionStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className={`${primaryButtonClassName} self-end`} type="submit">
          Filtrar
        </button>
        <a className={`${secondaryButtonClassName} self-end`} href="/app/assinaturas">
          Limpar
        </a>
      </div>
    </form>
  );
}

function SaasSubscriptionForm({ canSeeCosts }: { canSeeCosts: boolean }) {
  return (
    <form action={createSaasSubscriptionAction} className="grid gap-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Nome
          <input className={inputClassName} maxLength={160} name="name" required />
        </label>
        <label className={fieldClassName}>
          Categoria
          <input className={inputClassName} maxLength={120} name="category" required />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Fornecedor
          <input className={inputClassName} maxLength={120} name="provider" />
        </label>
        <label className={fieldClassName}>
          Status
          <select className={inputClassName} defaultValue="active" name="status">
            {Object.entries(saasSubscriptionStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {canSeeCosts ? (
          <label className={fieldClassName}>
            Custo mensal
            <input className={inputClassName} inputMode="decimal" name="monthlyCost" />
          </label>
        ) : null}
        <label className={fieldClassName}>
          Renovacao
          <input className={inputClassName} name="renewalDate" type="date" />
        </label>
      </div>
      <label className={fieldClassName}>
        Observacao
        <textarea className={textareaClassName} maxLength={1000} name="notes" rows={4} />
      </label>
      <div className="flex justify-end">
        <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
          <Boxes className="size-4" aria-hidden="true" />
          Cadastrar assinatura
        </button>
      </div>
    </form>
  );
}

function SaasSubscriptionRow({
  canWrite,
  employeeOptions,
  subscription,
}: {
  canWrite: boolean;
  employeeOptions: SaasEmployeeOption[];
  subscription: SaasSubscriptionListItem;
}) {
  const activeLinks = subscription.linkedUsers.filter((user) => user.status === "active");

  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3">
        <p className="font-medium">{subscription.name}</p>
        <p className="text-xs text-muted-foreground">{subscription.provider ?? "-"}</p>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{subscription.category}</td>
      <td className="px-4 py-3">
        <LinkedUsers users={activeLinks} />
      </td>
      <td className="px-4 py-3">
        <RenewalBadge state={subscription.renewalState} />
        <p className="mt-1 text-xs text-muted-foreground">{formatDate(subscription.renewalDate)}</p>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={subscription.status} />
      </td>
      <td className="px-4 py-3 text-right font-medium">
        {subscription.costHidden ? "Restrito" : formatMoney(subscription.monthlyCost)}
      </td>
      {canWrite ? (
        <td className="px-4 py-3">
          <div className="grid justify-items-end gap-2">
            <ActionDialog
              title="Vincular colaborador"
              trigger={<Link2 className="size-4" aria-hidden="true" />}
              triggerClassName={iconButtonClassName("primary")}
              triggerLabel="Vincular colaborador"
            >
              <LinkSubscriptionForm employeeOptions={employeeOptions} subscriptionId={subscription.id} />
            </ActionDialog>
            <div className="flex flex-wrap justify-end gap-2">
              <ActionDialog
                title="Renovar assinatura"
                trigger={<RefreshCw className="size-4" aria-hidden="true" />}
                triggerClassName={iconButtonClassName("primary")}
                triggerLabel="Renovar assinatura"
              >
                <RenewSubscriptionForm id={subscription.id} renewalDate={subscription.renewalDate} />
              </ActionDialog>
              {activeLinks.map((user) => (
                <form action={unlinkEmployeeFromSaasSubscriptionAction} key={user.employeeId}>
                  <input name="subscriptionId" type="hidden" value={subscription.id} />
                  <input name="employeeId" type="hidden" value={user.employeeId} />
                  <IconButton icon={Unlink} label={`Desvincular ${user.employeeName}`} tone="warning" />
                </form>
              ))}
              {subscription.status !== "cancelled" ? (
                <form action={cancelSaasSubscriptionAction}>
                  <input name="id" type="hidden" value={subscription.id} />
                  <IconButton icon={Ban} label="Cancelar" tone="destructive" />
                </form>
              ) : null}
            </div>
          </div>
        </td>
      ) : null}
    </tr>
  );
}

function LinkSubscriptionForm({
  employeeOptions,
  subscriptionId,
}: {
  employeeOptions: SaasEmployeeOption[];
  subscriptionId: string;
}) {
  return (
    <form action={linkEmployeeToSaasSubscriptionAction} className="grid gap-4">
      <input name="subscriptionId" type="hidden" value={subscriptionId} />
      <label className={fieldClassName}>
        Colaborador
        <select className={inputClassName} name="employeeId" required>
          <option value="">Vincular colaborador</option>
          {employeeOptions.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex justify-end">
        <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
          <Link2 className="size-4" aria-hidden="true" />
          Vincular
        </button>
      </div>
    </form>
  );
}

function RenewSubscriptionForm({ id, renewalDate }: { id: string; renewalDate: string | null }) {
  return (
    <form action={markSaasSubscriptionRenewedAction} className="grid gap-4">
      <input name="id" type="hidden" value={id} />
      <label className={fieldClassName}>
        Nova renovacao
        <input className={inputClassName} defaultValue={renewalDate ?? ""} name="renewalDate" required type="date" />
      </label>
      <div className="flex justify-end">
        <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
          <RefreshCw className="size-4" aria-hidden="true" />
          Renovar
        </button>
      </div>
    </form>
  );
}

function LinkedUsers({ users }: { users: SaasLinkedUser[] }) {
  if (users.length === 0) {
    return <span className="text-muted-foreground">Sem usuarios</span>;
  }

  return (
    <div className="flex max-w-72 flex-wrap gap-1">
      {users.slice(0, 4).map((user) => (
        <span className="rounded-md bg-muted px-2 py-1 text-xs" key={user.employeeId}>
          {user.employeeName}
        </span>
      ))}
      {users.length > 4 ? (
        <span className="rounded-md bg-muted px-2 py-1 text-xs">+{users.length - 4}</span>
      ) : null}
    </div>
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

function StatusBadge({ status }: { status: SaasSubscriptionStatus }) {
  const className =
    status === "active"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "cancelled"
        ? "border-muted bg-muted text-muted-foreground"
        : "border-secondary/30 bg-secondary/10 text-secondary-foreground";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {saasSubscriptionStatusLabels[status]}
    </span>
  );
}

function RenewalBadge({ state }: { state: SaasSubscriptionListItem["renewalState"] }) {
  const label = {
    due_soon: "Proxima",
    none: "Sem data",
    ok: "Em dia",
    overdue: "Vencida",
  }[state];
  const className =
    state === "overdue"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : state === "due_soon"
        ? "border-secondary/30 bg-secondary/10 text-secondary-foreground"
        : "border-muted bg-muted text-muted-foreground";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {label}
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
  tone: "destructive" | "primary" | "warning";
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

function iconButtonClassName(tone: "destructive" | "primary" | "warning") {
  const className =
    tone === "primary"
      ? "border-primary/30 text-primary hover:bg-primary/10"
      : tone === "warning"
        ? "border-secondary/30 text-secondary-foreground hover:bg-secondary/10"
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

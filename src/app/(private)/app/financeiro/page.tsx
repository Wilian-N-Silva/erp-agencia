import {
  Ban,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  TrendingUp,
} from "lucide-react";
import { redirect } from "next/navigation";

import { ActionDialog } from "@/components/ui/action-dialog";
import { listClients } from "@/features/clients/dal";
import {
  cancelFinancialEntryAction,
  cancelFinancialExpenseAction,
  createFinancialEntryAction,
  createFinancialExpenseAction,
  createProvisionAction,
  deactivateProvisionAction,
  markFinancialEntryReceivedAction,
  markFinancialExpensePaidAction,
  updateFinancialEntryAction,
  updateFinancialExpenseAction,
} from "@/features/finance/actions";
import {
  getFinanceDashboard,
  type FinanceEntryListItem,
  type FinanceExpenseListItem,
} from "@/features/finance/dal";
import {
  financialEntryStatusLabels,
  financialExpenseStatusLabels,
  formatCompetence,
  formatDate,
  formatMoney,
  normalizeFinanceFilters,
  type FinanceFilters,
  type FinancialEntryStatus,
  type FinancialExpenseStatus,
} from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FinancePage({ searchParams }: PageProps) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!can("finance.read", context)) {
    redirect("/acesso-negado");
  }

  const filters = normalizeFinanceFilters((await searchParams) ?? {});
  const dashboard = await getFinanceDashboard(context, { filters });
  const canWriteFinance = can("finance.write", context);
  const canExportFinance = can("finance.export", context);
  const clientOptions = canWriteFinance ? await listClients(context) : [];

  const cards = [
    {
      label: "Entradas previstas",
      value: formatMoney(dashboard.totals.incomeExpected),
      icon: TrendingUp,
    },
    {
      label: "Entradas recebidas",
      value: formatMoney(dashboard.totals.incomeReceived),
      icon: ReceiptText,
    },
    {
      label: "Saidas previstas",
      value: formatMoney(dashboard.totals.expensesExpected),
      icon: CalendarClock,
    },
    {
      label: "Previsto 30 dias",
      value: formatMoney(dashboard.totals.forecast30Days),
      icon: CircleAlert,
    },
  ];

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-normal">Financeiro</h1>
        <p className="text-sm text-muted-foreground">
          Competencia {formatCompetence(dashboard.competence)}
        </p>
      </div>

      <FinanceFilterForm canExport={canExportFinance} filters={filters} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div className="rounded-lg border bg-card p-4" key={card.label}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-2 text-2xl font-semibold">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Atrasos a receber" value={formatMoney(dashboard.totals.incomeOverdue)} />
        <Metric label="Atrasos a pagar" value={formatMoney(dashboard.totals.expensesOverdue)} />
        <Metric label="Provisoes do mes" value={formatMoney(dashboard.totals.provisionsExpected)} />
        <Metric label="Resultado realizado" value={formatMoney(dashboard.totals.resultRealized)} />
      </div>

      {canWriteFinance ? (
        <div className="flex flex-wrap gap-2">
          <ActionDialog
            title="Nova entrada"
            trigger={
              <>
                <Plus className="size-4" aria-hidden="true" />
                Nova entrada
              </>
            }
            triggerClassName={`${primaryButtonClassName} sm:w-auto`}
            triggerLabel="Nova entrada"
          >
            <EntryForm
              action={createFinancialEntryAction}
              clientOptions={clientOptions}
              mode="create"
              submitLabel="Criar entrada"
            />
          </ActionDialog>
          <ActionDialog
            title="Nova saida"
            trigger={
              <>
                <Plus className="size-4" aria-hidden="true" />
                Nova saida
              </>
            }
            triggerClassName={`${primaryButtonClassName} sm:w-auto`}
            triggerLabel="Nova saida"
          >
            <ExpenseForm
              action={createFinancialExpenseAction}
              mode="create"
              submitLabel="Criar saida"
            />
          </ActionDialog>
          <ActionDialog
            title="Nova provisao"
            trigger={
              <>
                <Plus className="size-4" aria-hidden="true" />
                Nova provisao
              </>
            }
            triggerClassName={`${secondaryButtonClassName} sm:w-auto`}
            triggerLabel="Nova provisao"
          >
            <ProvisionForm />
          </ActionDialog>
        </div>
      ) : null}

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Entradas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Descricao</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Vencimento</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                {canWriteFinance ? (
                  <th className="px-4 py-3 text-right font-medium">Acoes</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {dashboard.entries.length === 0 ? (
                <EmptyRow
                  colSpan={canWriteFinance ? 6 : 5}
                  label="Nenhuma entrada cadastrada."
                />
              ) : (
                dashboard.entries.map((entry) => (
                  <tr className="border-b last:border-b-0" key={entry.id}>
                    <td className="px-4 py-3 font-medium">{entry.description}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {entry.clientName ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(entry.dueDate)}
                    </td>
                    <td className="px-4 py-3">
                      <EntryStatus status={entry.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatMoney(entry.amount)}
                    </td>
                    {canWriteFinance ? (
                      <td className="px-4 py-3">
                        <EntryActions
                          clientOptions={clientOptions}
                          entry={entry}
                        />
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Saidas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Descricao</th>
                <th className="px-4 py-3 font-medium">Fornecedor</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Vencimento</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Valor</th>
                {canWriteFinance ? (
                  <th className="px-4 py-3 text-right font-medium">Acoes</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {dashboard.expenses.length === 0 ? (
                <EmptyRow
                  colSpan={canWriteFinance ? 7 : 6}
                  label="Nenhuma saida cadastrada."
                />
              ) : (
                dashboard.expenses.map((expense) => (
                  <tr className="border-b last:border-b-0" key={expense.id}>
                    <td className="px-4 py-3 font-medium">{expense.description}</td>
                    <td className="px-4 py-3 text-muted-foreground">{expense.supplier}</td>
                    <td className="px-4 py-3 text-muted-foreground">{expense.category}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(expense.dueDate)}
                    </td>
                    <td className="px-4 py-3">
                      <ExpenseStatus status={expense.status} />
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatMoney(expense.amount)}
                    </td>
                    {canWriteFinance ? (
                      <td className="px-4 py-3">
                        <ExpenseActions expense={expense} />
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Provisoes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Dia</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Estimativa</th>
                {canWriteFinance ? (
                  <th className="px-4 py-3 text-right font-medium">Acoes</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {dashboard.provisions.length === 0 ? (
                <EmptyRow
                  colSpan={canWriteFinance ? 6 : 5}
                  label="Nenhuma provisao cadastrada."
                />
              ) : (
                dashboard.provisions.map((provision) => (
                  <tr className="border-b last:border-b-0" key={provision.id}>
                    <td className="px-4 py-3 font-medium">{provision.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{provision.category}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {provision.expectedDay ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{provision.status}</td>
                    <td className="px-4 py-3 text-right font-medium">
                      {formatMoney(provision.estimatedMonthlyAmount)}
                    </td>
                    {canWriteFinance ? (
                      <td className="px-4 py-3">
                        <ProvisionActions id={provision.id} status={provision.status} />
                      </td>
                    ) : null}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function FinanceFilterForm({
  canExport,
  filters,
}: {
  canExport: boolean;
  filters: FinanceFilters;
}) {
  return (
    <form
      action="/app/financeiro"
      className="rounded-lg border bg-card p-4"
      method="get"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(10rem,0.8fr)_minmax(14rem,1fr)_minmax(10rem,0.8fr)_minmax(10rem,0.8fr)_auto_auto_auto]">
        <label className={fieldClassName}>
          Competencia
          <input
            className={inputClassName}
            defaultValue={filters.competence ?? ""}
            name="competence"
            type="month"
          />
        </label>
        <label className={fieldClassName}>
          Busca
          <input
            className={inputClassName}
            defaultValue={filters.query ?? ""}
            name="q"
            placeholder="Descricao, cliente, fornecedor"
          />
        </label>
        <label className={fieldClassName}>
          Entradas
          <select
            className={inputClassName}
            defaultValue={filters.entryStatus ?? "all"}
            name="entryStatus"
          >
            <option value="all">Todas</option>
            {Object.entries(financialEntryStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Saidas
          <select
            className={inputClassName}
            defaultValue={filters.expenseStatus ?? "all"}
            name="expenseStatus"
          >
            <option value="all">Todas</option>
            {Object.entries(financialExpenseStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className={`${primaryButtonClassName} self-end`} type="submit">
          Filtrar
        </button>
        <a className={`${secondaryButtonClassName} self-end`} href="/app/financeiro">
          Limpar
        </a>
        {canExport ? (
          <a
            className={`${secondaryButtonClassName} self-end`}
            href={`/app/financeiro/exportar${buildFinanceExportQuery(filters)}`}
          >
            Exportar CSV
          </a>
        ) : null}
        {canExport ? (
          <a
            className={`${secondaryButtonClassName} self-end`}
            href={`/app/financeiro/exportar-xlsx${buildFinanceExportQuery(filters)}`}
          >
            Exportar XLSX
          </a>
        ) : null}
      </div>
    </form>
  );
}

function buildFinanceExportQuery(filters: FinanceFilters) {
  const params = new URLSearchParams();

  if (filters.competence) {
    params.set("competence", filters.competence);
  }

  if (filters.query) {
    params.set("q", filters.query);
  }

  if (filters.entryStatus && filters.entryStatus !== "all") {
    params.set("entryStatus", filters.entryStatus);
  }

  if (filters.expenseStatus && filters.expenseStatus !== "all") {
    params.set("expenseStatus", filters.expenseStatus);
  }

  const query = params.toString();

  return query ? `?${query}` : "";
}

type FinanceFormAction = (formData: FormData) => Promise<void>;
type FinanceFormMode = "create" | "edit";

function EntryForm({
  action,
  clientOptions,
  entry,
  mode,
  submitLabel,
}: {
  action: FinanceFormAction;
  clientOptions: { id: string; name: string }[];
  entry?: FinanceEntryListItem;
  mode: FinanceFormMode;
  submitLabel: string;
}) {
  const SubmitIcon = mode === "create" ? Plus : Save;

  return (
    <form action={action} className="grid gap-3">
      {entry ? <input name="id" type="hidden" value={entry.id} /> : null}
      <label className={fieldClassName}>
        Descricao
        <input
          className={inputClassName}
          defaultValue={entry?.description ?? ""}
          maxLength={180}
          name="description"
          required
        />
      </label>
      <label className={fieldClassName}>
        Cliente
        <select className={inputClassName} defaultValue={entry?.clientId ?? ""} name="clientId">
          <option value="">Sem cliente</option>
          {clientOptions.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 md:grid-cols-3">
        <label className={fieldClassName}>
          Valor
          <input
            className={inputClassName}
            defaultValue={entry?.amount ?? ""}
            inputMode="decimal"
            name="amount"
            required
          />
        </label>
        <label className={fieldClassName}>
          Vencimento
          <input
            className={inputClassName}
            defaultValue={entry?.dueDate ?? ""}
            name="dueDate"
            required
            type="date"
          />
        </label>
        <label className={fieldClassName}>
          Competencia
          <input
            className={inputClassName}
            defaultValue={entry?.competence ?? ""}
            name="competence"
            required
            type="month"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          className="size-4 accent-primary"
          defaultChecked={entry?.recurring ?? false}
          name="recurring"
          type="checkbox"
        />
        Recorrente
      </label>
      <label className={fieldClassName}>
        Observacoes
        <textarea
          className={textareaClassName}
          defaultValue={entry?.notes ?? ""}
          maxLength={1000}
          name="notes"
          rows={4}
        />
      </label>
      <button className={primaryButtonClassName} type="submit">
        <SubmitIcon className="size-4" aria-hidden="true" />
        {submitLabel}
      </button>
    </form>
  );
}

function ExpenseForm({
  action,
  expense,
  mode,
  submitLabel,
}: {
  action: FinanceFormAction;
  expense?: FinanceExpenseListItem;
  mode: FinanceFormMode;
  submitLabel: string;
}) {
  const SubmitIcon = mode === "create" ? Plus : Save;

  return (
    <form action={action} className="grid gap-3">
      {expense ? <input name="id" type="hidden" value={expense.id} /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Fornecedor
          <input
            className={inputClassName}
            defaultValue={expense?.supplier ?? ""}
            maxLength={160}
            name="supplier"
            required
          />
        </label>
        <label className={fieldClassName}>
          Categoria
          <input
            className={inputClassName}
            defaultValue={expense?.category ?? ""}
            maxLength={80}
            name="category"
            required
          />
        </label>
      </div>
      <label className={fieldClassName}>
        Subcategoria
        <input
          className={inputClassName}
          defaultValue={expense?.subcategory ?? ""}
          maxLength={80}
          name="subcategory"
        />
      </label>
      <label className={fieldClassName}>
        Descricao
        <input
          className={inputClassName}
          defaultValue={expense?.description ?? ""}
          maxLength={180}
          name="description"
          required
        />
      </label>
      <div className="grid gap-3 md:grid-cols-3">
        <label className={fieldClassName}>
          Valor
          <input
            className={inputClassName}
            defaultValue={expense?.amount ?? ""}
            inputMode="decimal"
            name="amount"
            required
          />
        </label>
        <label className={fieldClassName}>
          Vencimento
          <input
            className={inputClassName}
            defaultValue={expense?.dueDate ?? ""}
            name="dueDate"
            required
            type="date"
          />
        </label>
        <label className={fieldClassName}>
          Competencia
          <input
            className={inputClassName}
            defaultValue={expense?.competence ?? ""}
            name="competence"
            required
            type="month"
          />
        </label>
      </div>
      <label className={fieldClassName}>
        Centro de custo
        <input
          className={inputClassName}
          defaultValue={expense?.costCenter ?? ""}
          maxLength={100}
          name="costCenter"
        />
      </label>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          className="size-4 accent-primary"
          defaultChecked={expense?.recurring ?? false}
          name="recurring"
          type="checkbox"
        />
        Recorrente
      </label>
      <label className={fieldClassName}>
        Observacoes
        <textarea
          className={textareaClassName}
          defaultValue={expense?.notes ?? ""}
          maxLength={1000}
          name="notes"
          rows={4}
        />
      </label>
      <button className={primaryButtonClassName} type="submit">
        <SubmitIcon className="size-4" aria-hidden="true" />
        {submitLabel}
      </button>
    </form>
  );
}

function ProvisionForm() {
  return (
    <form action={createProvisionAction} className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Nome
          <input className={inputClassName} maxLength={160} name="name" required />
        </label>
        <label className={fieldClassName}>
          Categoria
          <input className={inputClassName} maxLength={80} name="category" required />
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Valor mensal
          <input
            className={inputClassName}
            inputMode="decimal"
            name="estimatedMonthlyAmount"
            required
          />
        </label>
        <label className={fieldClassName}>
          Dia previsto
          <input className={inputClassName} max={31} min={1} name="expectedDay" type="number" />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input className="size-4 accent-primary" defaultChecked name="recurring" type="checkbox" />
        Recorrente
      </label>
      <button className={primaryButtonClassName} type="submit">
        <Plus className="size-4" aria-hidden="true" />
        Criar provisao
      </button>
    </form>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td className="px-4 py-8 text-center text-muted-foreground" colSpan={colSpan}>
        {label}
      </td>
    </tr>
  );
}

function EntryActions({
  clientOptions,
  entry,
}: {
  clientOptions: { id: string; name: string }[];
  entry: FinanceEntryListItem;
}) {
  return (
    <div className="flex justify-end gap-2">
      <ActionDialog
        title="Editar entrada"
        trigger={<Pencil className="size-4" aria-hidden="true" />}
        triggerClassName={neutralIconButtonClassName}
        triggerLabel="Editar entrada"
      >
        <EntryForm
          action={updateFinancialEntryAction}
          clientOptions={clientOptions}
          entry={entry}
          mode="edit"
          submitLabel="Salvar entrada"
        />
      </ActionDialog>
      {entry.status !== "received" && entry.status !== "cancelled" ? (
        <form action={markFinancialEntryReceivedAction}>
          <input name="id" type="hidden" value={entry.id} />
          <IconButton label="Receber" tone="primary" />
        </form>
      ) : null}
      {entry.status !== "cancelled" ? (
        <form action={cancelFinancialEntryAction}>
          <input name="id" type="hidden" value={entry.id} />
          <IconButton label="Cancelar" tone="destructive" />
        </form>
      ) : null}
    </div>
  );
}

function ExpenseActions({ expense }: { expense: FinanceExpenseListItem }) {
  return (
    <div className="flex justify-end gap-2">
      <ActionDialog
        title="Editar saida"
        trigger={<Pencil className="size-4" aria-hidden="true" />}
        triggerClassName={neutralIconButtonClassName}
        triggerLabel="Editar saida"
      >
        <ExpenseForm
          action={updateFinancialExpenseAction}
          expense={expense}
          mode="edit"
          submitLabel="Salvar saida"
        />
      </ActionDialog>
      {expense.status !== "paid" && expense.status !== "cancelled" ? (
        <form action={markFinancialExpensePaidAction}>
          <input name="id" type="hidden" value={expense.id} />
          <IconButton label="Pagar" tone="primary" />
        </form>
      ) : null}
      {expense.status !== "cancelled" ? (
        <form action={cancelFinancialExpenseAction}>
          <input name="id" type="hidden" value={expense.id} />
          <IconButton label="Cancelar" tone="destructive" />
        </form>
      ) : null}
    </div>
  );
}

function ProvisionActions({ id, status }: { id: string; status: string }) {
  if (status !== "active") {
    return null;
  }

  return (
    <div className="flex justify-end">
      <form action={deactivateProvisionAction}>
        <input name="id" type="hidden" value={id} />
        <IconButton label="Inativar" tone="destructive" />
      </form>
    </div>
  );
}

function IconButton({
  label,
  tone,
}: {
  label: "Cancelar" | "Inativar" | "Pagar" | "Receber";
  tone: "destructive" | "primary";
}) {
  const Icon = tone === "primary" ? CheckCircle2 : Ban;
  const className =
    tone === "primary"
      ? "border-primary/30 text-primary hover:bg-primary/10"
      : "border-destructive/30 text-destructive hover:bg-destructive/10";

  return (
    <button
      aria-label={label}
      className={`inline-flex size-8 items-center justify-center rounded-md border transition-colors ${className}`}
      title={label}
      type="submit"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function EntryStatus({ status }: { status: FinancialEntryStatus }) {
  return <StatusBadge label={financialEntryStatusLabels[status]} status={status} />;
}

function ExpenseStatus({ status }: { status: FinancialExpenseStatus }) {
  return <StatusBadge label={financialExpenseStatusLabels[status]} status={status} />;
}

function StatusBadge({
  label,
  status,
}: {
  label: string;
  status: FinancialEntryStatus | FinancialExpenseStatus;
}) {
  const className =
    status === "overdue"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : status === "received" || status === "paid"
        ? "border-primary/30 bg-primary/10 text-primary"
        : status === "cancelled"
          ? "border-muted bg-muted text-muted-foreground"
          : "border-secondary/30 bg-secondary/10 text-secondary-foreground";

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const textareaClassName =
  "min-h-24 w-full min-w-0 resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

const secondaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

const neutralIconButtonClassName =
  "inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

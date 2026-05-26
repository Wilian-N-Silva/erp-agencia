import { ArrowLeft, Lock, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { ActionDialog } from "@/components/ui/action-dialog";
import { getEmployeeDetail } from "@/features/people/dal";
import { employmentTypeLabels } from "@/features/people/rules";
import {
  closeVacationBalanceAction,
  createVacationBalanceAction,
  updateVacationBalanceAction,
} from "@/features/timeoff/actions";
import { listVacationBalances, type VacationBalanceListItem } from "@/features/timeoff/dal";
import {
  canManageVacationBalance,
  computeVacationPeriod,
  vacationBalanceStatusLabels,
} from "@/features/timeoff/rules";
import { formatDate } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EmployeeVacationPage({ params }: PageProps) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const employee = await getEmployeeDetail(context, id);

  if (!employee) {
    notFound();
  }

  const balances = await listVacationBalances(context, { employeeId: id });
  const canWrite = canManageVacationBalance(context);
  const current = balances.find((balance) => balance.status === "active") ?? null;
  const history = balances.filter((balance) => balance !== current);
  const isClt = employee.employmentType === "clt";
  const nextTenureYear = balances.length + 1;
  const periodPreview = isClt && employee.startDate
    ? computeVacationPeriod(employee.startDate, nextTenureYear)
    : null;

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link className={`${secondaryButtonClassName} w-fit`} href={`/app/colaboradores/${employee.id}`}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-normal">Ferias</h1>
            <p className="text-sm text-muted-foreground">
              {employee.socialName || employee.fullName} - {employmentTypeLabels[employee.employmentType]}
            </p>
          </div>
          {canWrite && isClt && periodPreview ? (
            <ActionDialog
              title="Novo periodo aquisitivo"
              trigger={
                <>
                  <Plus className="size-4" aria-hidden="true" />
                  Novo periodo
                </>
              }
              triggerClassName={`${primaryButtonClassName} sm:w-auto`}
              triggerLabel="Novo periodo"
            >
              <CreateBalanceForm employeeId={employee.id} nextTenureYear={nextTenureYear} period={periodPreview} />
            </ActionDialog>
          ) : null}
        </div>
      </div>

      {!isClt ? (
        <div className="rounded-lg border bg-card px-4 py-6 text-sm text-muted-foreground">
          Saldo aquisitivo de ferias e exclusivo para CLT. Para outros vinculos, registre pausas programadas em /app/ferias.
        </div>
      ) : null}

      {isClt ? (
        <div className="grid gap-3 md:grid-cols-4">
          <SummaryCard label="Dias disponiveis" value={current ? `${current.daysAvailable}` : "-"} />
          <SummaryCard label="Dias tirados" value={current ? `${current.daysTaken}` : "-"} />
          <SummaryCard label="Dias vendidos" value={current ? `${current.daysSold}` : "-"} />
          <SummaryCard
            label="Vencimento"
            value={current ? formatDate(current.concessionDeadline) : "-"}
            tone={current?.expiring || current?.expired ? "warn" : "default"}
          />
        </div>
      ) : null}

      {isClt ? (
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">Periodos aquisitivos</h2>
          </div>
          <div className="divide-y">
            {balances.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum periodo cadastrado.</p>
            ) : (
              balances.map((balance) => (
                <BalanceRow balance={balance} canWrite={canWrite} key={balance.id} />
              ))
            )}
          </div>
          {history.length > 0 ? null : null}
        </section>
      ) : null}
    </section>
  );
}

function BalanceRow({
  balance,
  canWrite,
}: {
  balance: VacationBalanceListItem;
  canWrite: boolean;
}) {
  const stateLabel = balance.expired
    ? "Vencido"
    : balance.expiring
      ? "Vencendo"
      : vacationBalanceStatusLabels[balance.status];
  const stateTone =
    balance.expired || balance.expiring
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : balance.status === "closed"
        ? "border-secondary/30 bg-secondary/10 text-secondary-foreground"
        : "border-primary/30 bg-primary/10 text-primary";

  return (
    <div className="flex flex-col gap-3 px-4 py-4 text-sm md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-1">
        <p className="font-medium">
          Periodo {formatDate(balance.periodStart)} - {formatDate(balance.periodEnd)}
        </p>
        <p className="text-muted-foreground">
          Concessao ate {formatDate(balance.concessionDeadline)} - Adquiridos {balance.daysAcquired} - Tirados {balance.daysTaken} - Vendidos {balance.daysSold} - Saldo {balance.daysAvailable}
        </p>
        {balance.notes ? <p className="text-muted-foreground">{balance.notes}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${stateTone}`}>
          {stateLabel}
        </span>
        {canWrite && balance.status === "active" ? (
          <ActionDialog
            title="Ajustar periodo"
            trigger={
              <>
                <Pencil className="size-4" aria-hidden="true" />
                Ajustar
              </>
            }
            triggerClassName={compactSecondaryButtonClassName}
            triggerLabel="Ajustar"
          >
            <UpdateBalanceForm balance={balance} />
          </ActionDialog>
        ) : null}
        {canWrite && balance.status === "active" ? (
          <form action={closeVacationBalanceAction}>
            <input name="id" type="hidden" value={balance.id} />
            <button className={compactSecondaryButtonClassName} title="Encerrar periodo" type="submit">
              <Lock className="size-4" aria-hidden="true" />
              Encerrar
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function CreateBalanceForm({
  employeeId,
  nextTenureYear,
  period,
}: {
  employeeId: string;
  nextTenureYear: number;
  period: { periodStart: string; periodEnd: string; concessionDeadline: string };
}) {
  return (
    <form action={createVacationBalanceAction} className="grid gap-4">
      <input name="employeeId" type="hidden" value={employeeId} />
      <input name="tenureYear" type="hidden" value={nextTenureYear} />
      <div className="rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        Periodo {formatDate(period.periodStart)} - {formatDate(period.periodEnd)} (concessao ate {formatDate(period.concessionDeadline)})
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Dias adquiridos
          <input className={inputClassName} defaultValue={30} max={60} min={0} name="daysAcquired" type="number" />
        </label>
        <label className={fieldClassName}>
          Dias vendidos
          <input className={inputClassName} defaultValue={0} max={20} min={0} name="daysSold" type="number" />
        </label>
      </div>
      <label className={fieldClassName}>
        Observacao
        <textarea className={textareaClassName} maxLength={1000} name="notes" rows={2} />
      </label>
      <div className="flex justify-end">
        <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
          <Plus className="size-4" aria-hidden="true" />
          Abrir periodo
        </button>
      </div>
    </form>
  );
}

function UpdateBalanceForm({ balance }: { balance: VacationBalanceListItem }) {
  return (
    <form action={updateVacationBalanceAction} className="grid gap-4">
      <input name="id" type="hidden" value={balance.id} />
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Dias adquiridos
          <input
            className={inputClassName}
            defaultValue={balance.daysAcquired}
            max={60}
            min={0}
            name="daysAcquired"
            type="number"
          />
        </label>
        <label className={fieldClassName}>
          Dias vendidos
          <input
            className={inputClassName}
            defaultValue={balance.daysSold}
            max={20}
            min={0}
            name="daysSold"
            type="number"
          />
        </label>
      </div>
      <label className={fieldClassName}>
        Observacao
        <textarea
          className={textareaClassName}
          defaultValue={balance.notes ?? ""}
          maxLength={1000}
          name="notes"
          rows={2}
        />
      </label>
      <div className="flex justify-end">
        <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
          <Pencil className="size-4" aria-hidden="true" />
          Salvar ajuste
        </button>
      </div>
    </form>
  );
}

function SummaryCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-2 break-words text-xl font-semibold ${tone === "warn" ? "text-destructive" : ""}`}
      >
        {value}
      </p>
    </div>
  );
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const textareaClassName =
  "min-h-20 w-full min-w-0 resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

const secondaryButtonClassName =
  "inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

const compactSecondaryButtonClassName =
  "inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

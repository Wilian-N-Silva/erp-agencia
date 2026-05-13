import { ArrowLeft, Ban, Plus, Save } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  createEmployeeBenefitAction,
  endEmployeeBenefitAction,
  updateEmployeeCompensationAction,
} from "@/features/people/actions";
import {
  getEmployeeDetail,
  listCompensationHistory,
  listEmployeeBenefits,
} from "@/features/people/dal";
import { canWriteCompensation, employmentTypeLabels } from "@/features/people/rules";
import { formatDate, formatMoney } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EmployeeCompensationPage({ params }: PageProps) {
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

  const [history, benefits] = await Promise.all([
    listCompensationHistory(context, id),
    listEmployeeBenefits(context, id),
  ]);
  const canWrite = canWriteCompensation(context);

  if (employee.compensationHidden) {
    return (
      <section className="flex w-full flex-col gap-6">
        <Link className={`${secondaryButtonClassName} w-fit`} href={`/app/colaboradores/${employee.id}`}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
        <div className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Remuneracao restrita.
        </div>
      </section>
    );
  }

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link className={`${secondaryButtonClassName} w-fit`} href={`/app/colaboradores/${employee.id}`}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-normal">Remuneracao</h1>
          <p className="text-sm text-muted-foreground">
            {employee.socialName || employee.fullName} - {employmentTypeLabels[employee.employmentType]}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Remuneracao atual" value={formatMoney(employee.currentCompensation)} />
        <SummaryCard label="Ajuda de custo" value={formatMoney(employee.recurringCostAllowance)} />
        <SummaryCard label="Transporte" value={formatMoney(employee.recurringTransport)} />
      </div>

      {canWrite ? (
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">Alterar remuneracao</h2>
          </div>
          <form action={updateEmployeeCompensationAction} className="grid gap-4 p-4">
            <input name="employeeId" type="hidden" value={employee.id} />
            <div className="grid gap-3 lg:grid-cols-4">
              <label className={fieldClassName}>
                Novo valor
                <input className={inputClassName} defaultValue={employee.currentCompensation ?? ""} inputMode="decimal" name="newAmount" required />
              </label>
              <label className={fieldClassName}>
                Ajuda de custo
                <input className={inputClassName} defaultValue={employee.recurringCostAllowance ?? ""} inputMode="decimal" name="recurringCostAllowance" />
              </label>
              <label className={fieldClassName}>
                Transporte
                <input className={inputClassName} defaultValue={employee.recurringTransport ?? ""} inputMode="decimal" name="recurringTransport" />
              </label>
              <label className={fieldClassName}>
                Vigencia
                <input className={inputClassName} defaultValue={currentDate()} name="effectiveDate" required type="date" />
              </label>
            </div>
            <label className={fieldClassName}>
              Motivo
              <textarea className={textareaClassName} maxLength={500} name="reason" required rows={3} />
            </label>
            <div className="flex justify-end">
              <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
                <Save className="size-4" aria-hidden="true" />
                Registrar alteracao
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">Historico de remuneracao</h2>
          </div>
          <div className="divide-y">
            {history.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma alteracao registrada.</p>
            ) : (
              history.map((item) => (
                <div className="grid gap-2 px-4 py-3 text-sm" key={item.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{formatDate(item.effectiveDate)}</p>
                    <p className="font-medium">{formatMoney(item.newAmount)}</p>
                  </div>
                  <p className="text-muted-foreground">
                    Anterior {formatMoney(item.previousAmount)} - Diferenca {formatMoney(item.differenceAmount)}
                  </p>
                  <p className="text-muted-foreground">{item.reason}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">Beneficios</h2>
          </div>
          <div className="divide-y">
            {benefits.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Nenhum beneficio cadastrado.</p>
            ) : (
              benefits.map((benefit) => (
                <div className="grid gap-2 px-4 py-3 text-sm" key={benefit.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{benefit.name}</p>
                    <p className="font-medium">{formatMoney(benefit.amount)}</p>
                  </div>
                  <p className="text-muted-foreground">
                    {benefit.benefitType} - {benefit.status} - Inicio {formatDate(benefit.startDate)}
                  </p>
                  {benefit.notes ? <p className="text-muted-foreground">{benefit.notes}</p> : null}
                  {canWrite && benefit.status === "active" ? (
                    <form action={endEmployeeBenefitAction} className="flex justify-end">
                      <input name="id" type="hidden" value={benefit.id} />
                      <input name="employeeId" type="hidden" value={employee.id} />
                      <button className={dangerIconButtonClassName} title="Encerrar" type="submit">
                        <Ban className="size-4" aria-hidden="true" />
                      </button>
                    </form>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {canWrite ? (
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">Novo beneficio</h2>
          </div>
          <form action={createEmployeeBenefitAction} className="grid gap-4 p-4">
            <input name="employeeId" type="hidden" value={employee.id} />
            <div className="grid gap-3 lg:grid-cols-4">
              <label className={fieldClassName}>
                Tipo
                <input className={inputClassName} maxLength={80} name="benefitType" required />
              </label>
              <label className={fieldClassName}>
                Nome
                <input className={inputClassName} maxLength={160} name="name" required />
              </label>
              <label className={fieldClassName}>
                Valor
                <input className={inputClassName} inputMode="decimal" name="amount" required />
              </label>
              <label className={fieldClassName}>
                Inicio
                <input className={inputClassName} defaultValue={currentDate()} name="startDate" required type="date" />
              </label>
            </div>
            <div className="grid gap-3 lg:grid-cols-[minmax(10rem,0.3fr)_1fr]">
              <label className="flex items-center gap-2 self-end text-sm text-muted-foreground">
                <input className="size-4 accent-primary" defaultChecked name="recurring" type="checkbox" />
                Recorrente
              </label>
              <label className={fieldClassName}>
                Observacao
                <input className={inputClassName} maxLength={1000} name="notes" />
              </label>
            </div>
            <div className="flex justify-end">
              <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
                <Plus className="size-4" aria-hidden="true" />
                Criar beneficio
              </button>
            </div>
          </form>
        </section>
      ) : null}
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

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const textareaClassName =
  "min-h-24 w-full min-w-0 resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

const secondaryButtonClassName =
  "inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

const dangerIconButtonClassName =
  "inline-flex size-8 items-center justify-center rounded-md border border-destructive/30 text-destructive transition-colors hover:bg-destructive/10";

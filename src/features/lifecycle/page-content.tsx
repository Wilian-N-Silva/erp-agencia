import { Ban, CheckCircle2, ClipboardCheck, ListChecks, MinusCircle, Plus, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ActionDialog } from "@/components/ui/action-dialog";
import { createEmployeeAction } from "@/features/people/actions";
import { listPeopleOptions } from "@/features/people/dal";
import { EmployeeCreateFields, type EmployeeFormOptions } from "@/features/people/employee-form-fields";
import {
  canWriteCompensation,
  canWritePeople,
  employeeStatusLabels,
  employmentTypeLabels,
} from "@/features/people/rules";
import {
  cancelLifecycleChecklistAction,
  completeLifecycleChecklistAction,
  createLifecycleChecklistAction,
  updateLifecycleChecklistItemStatusAction,
} from "@/features/lifecycle/actions";
import {
  listLifecycleChecklists,
  listLifecycleEmployeeOptions,
  type LifecycleChecklistItem,
  type LifecycleChecklistListItem,
  type LifecycleEmployeeOption,
} from "@/features/lifecycle/dal";
import {
  canWriteLifecycle,
  defaultLifecycleChecklistItems,
  lifecycleChecklistItemStatusLabels,
  lifecycleChecklistStatusLabels,
  lifecycleTypeLabels,
  type LifecycleChecklistItemStatus,
  type LifecycleChecklistState,
  type LifecycleChecklistStatus,
  type LifecycleType,
} from "@/features/lifecycle/rules";
import { formatDate } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";

export async function LifecycleChecklistPageContent({ type }: { type: LifecycleType }) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canAny(["lifecycle.read", "lifecycle.write"], context)) {
    redirect("/acesso-negado");
  }

  const canWrite = canWriteLifecycle(context);
  const canCreateEmployee = type === "onboarding" && canWritePeople(context) && canWriteCompensation(context);
  const [checklists, employeeOptions, peopleOptions] = await Promise.all([
    listLifecycleChecklists(context, type),
    canWrite ? listLifecycleEmployeeOptions(context) : Promise.resolve([]),
    canCreateEmployee ? listPeopleOptions(context) : Promise.resolve(null),
  ]);
  const openCount = checklists.filter((checklist) => checklist.status === "open").length;
  const overdueCount = checklists.filter((checklist) => checklist.state === "overdue").length;

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-normal">
            {lifecycleTypeLabels[type]}
          </h1>
          <p className="text-sm text-muted-foreground">
            Fluxo integrado ao cadastro de colaboradores, responsaveis, prazos e pendencias
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={`${secondaryButtonClassName} sm:w-auto`} href="/app/colaboradores">
            <UserRound className="size-4" aria-hidden="true" />
            Colaboradores
          </Link>
          {canWrite ? (
            <ActionDialog
              title={type === "onboarding" ? "Criar checklist para colaborador existente" : "Abrir desligamento"}
              trigger={
                <>
                  <ClipboardCheck className="size-4" aria-hidden="true" />
                  {type === "onboarding" ? "Checklist existente" : "Abrir desligamento"}
                </>
              }
              triggerClassName={`${primaryButtonClassName} sm:w-auto`}
              triggerLabel={type === "onboarding" ? "Criar checklist para colaborador existente" : "Abrir desligamento"}
            >
              <LifecycleChecklistForm employeeOptions={employeeOptions} type={type} />
            </ActionDialog>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Checklists" value={String(checklists.length)} />
        <SummaryCard label="Em aberto" value={String(openCount)} />
        <SummaryCard label="Atrasados" value={String(overdueCount)} />
      </div>

      {type === "onboarding" && canCreateEmployee && peopleOptions ? (
        <OnboardingEmployeeSection options={peopleOptions} />
      ) : null}

      <ChecklistTemplateSection type={type} />

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Checklists</h2>
        </div>
        {checklists.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Nenhum checklist cadastrado.
          </p>
        ) : (
          <div className="divide-y">
            {checklists.map((checklist) => (
              <ChecklistCard canWrite={canWrite} checklist={checklist} key={checklist.id} />
            ))}
          </div>
        )}
      </section>
    </section>
  );
}

function LifecycleChecklistForm({
  employeeOptions,
  type,
}: {
  employeeOptions: LifecycleEmployeeOption[];
  type: LifecycleType;
}) {
  return (
    <form action={createLifecycleChecklistAction} className="grid gap-4">
      <input name="type" type="hidden" value={type} />
      <div className="grid gap-3 md:grid-cols-2">
        <label className={fieldClassName}>
          Colaborador
          <select className={inputClassName} name="employeeId" required>
            <option value="">Selecione</option>
            {employeeOptions.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.registrationNumber} - {employee.name} ({formatEmployeeStatus(employee.status)})
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          {type === "offboarding" ? "Data final / prazo" : "Data de entrada / prazo"}
          <input className={inputClassName} name="dueDate" type="date" />
        </label>
      </div>
      <label className={fieldClassName}>
        {type === "offboarding" ? "Motivo e observacoes" : "Observacoes"}
        <textarea className={textareaClassName} maxLength={1200} name="notes" rows={4} />
      </label>
      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="text-sm font-medium">Lista que sera criada</p>
        <ChecklistTemplateList type={type} />
      </div>
      <div className="flex justify-end">
        <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
          <ClipboardCheck className="size-4" aria-hidden="true" />
          {type === "offboarding" ? "Abrir desligamento" : "Criar checklist"}
        </button>
      </div>
    </form>
  );
}

function OnboardingEmployeeSection({ options }: { options: EmployeeFormOptions }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Novo colaborador com checklist de admissao</h2>
      </div>
      <form action={createEmployeeAction} className="grid gap-5 p-4">
        <input name="createOnboardingChecklist" type="hidden" value="on" />
        <input name="redirectTo" type="hidden" value="/app/colaboradores/admissoes" />
        <EmployeeCreateFields defaultStatus="active" options={options} />
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-sm font-medium">Checklist gerado automaticamente</p>
          <ChecklistTemplateList type="onboarding" />
        </div>
        <div className="flex justify-end">
          <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
            <Plus className="size-4" aria-hidden="true" />
            Criar colaborador e checklist
          </button>
        </div>
      </form>
    </section>
  );
}

function ChecklistTemplateSection({ type }: { type: LifecycleType }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="text-base font-semibold">Modelo de checklist</h2>
        <ListChecks className="size-4 text-primary" aria-hidden="true" />
      </div>
      <div className="p-4">
        <ChecklistTemplateList type={type} />
      </div>
    </section>
  );
}

function ChecklistTemplateList({ type }: { type: LifecycleType }) {
  return (
    <ol className="mt-3 grid gap-2 md:grid-cols-2">
      {defaultLifecycleChecklistItems[type].map((item, index) => (
        <li className="flex gap-2 text-sm" key={item.key}>
          <span className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-md border bg-background text-xs font-medium">
            {index + 1}
          </span>
          <span className="min-w-0">
            <span className="font-medium">{item.title}</span>
            <span className="ml-2 text-xs text-muted-foreground">
              {item.required ? "Obrigatorio" : "Opcional"}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function ChecklistCard({
  canWrite,
  checklist,
}: {
  canWrite: boolean;
  checklist: LifecycleChecklistListItem;
}) {
  return (
    <article className="grid gap-4 p-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              className="text-base font-semibold text-primary underline-offset-4 hover:underline"
              href={`/app/colaboradores/${checklist.employeeId}` as Route}
            >
              {checklist.employeeName}
            </Link>
            <EmployeeStatusBadge status={checklist.employeeStatus} />
            <ChecklistStatusBadge status={checklist.status} />
            <ChecklistStateBadge state={checklist.state} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {checklist.employeeRegistrationNumber} - {checklist.employeePositionName} - {checklist.employeeAreaName}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatEmploymentType(checklist.employeeEmploymentType)} - entrada {formatDate(checklist.employeeStartDate)}
            {checklist.employeeEndDate ? ` - saida ${formatDate(checklist.employeeEndDate)}` : ""} - prazo{" "}
            {formatDate(checklist.dueDate)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {checklist.progress.requiredResolved}/{checklist.progress.requiredTotal} obrigatorios resolvidos
          </p>
          {checklist.notes ? (
            <p className="mt-2 text-sm text-muted-foreground">{checklist.notes}</p>
          ) : null}
        </div>
        {canWrite && checklist.status === "open" ? (
          <div className="flex flex-wrap items-start justify-end gap-2">
            {checklist.progress.canComplete ? (
              <form action={completeLifecycleChecklistAction}>
                <input name="id" type="hidden" value={checklist.id} />
                <TextButton icon={CheckCircle2} label="Concluir" tone="primary" />
              </form>
            ) : null}
            <form action={cancelLifecycleChecklistAction}>
              <input name="id" type="hidden" value={checklist.id} />
              <TextButton icon={Ban} label="Cancelar" tone="destructive" />
            </form>
          </div>
        ) : null}
      </div>

      {checklist.items.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">Responsavel</th>
                <th className="px-3 py-2 font-medium">Prazo</th>
                <th className="px-3 py-2 font-medium">Status</th>
                {canWrite && checklist.status === "open" ? (
                  <th className="px-3 py-2 text-right font-medium">Acoes</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {checklist.items.map((item) => (
                <ChecklistItemRow
                  canWrite={canWrite && checklist.status === "open"}
                  item={item}
                  key={item.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-sm font-medium">Itens esperados para este checklist</p>
          <ChecklistTemplateList type={checklist.type} />
        </div>
      )}
    </article>
  );
}

function ChecklistItemRow({
  canWrite,
  item,
}: {
  canWrite: boolean;
  item: LifecycleChecklistItem;
}) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-3 py-2">
        <p className="font-medium">{item.title}</p>
        <p className="text-xs text-muted-foreground">
          {item.required ? "Obrigatorio" : "Opcional"}
        </p>
      </td>
      <td className="px-3 py-2 text-muted-foreground">{item.responsibleUserName ?? "-"}</td>
      <td className="px-3 py-2 text-muted-foreground">{formatDate(item.dueDate)}</td>
      <td className="px-3 py-2">
        <ItemStatusBadge status={item.status} />
      </td>
      {canWrite ? (
        <td className="px-3 py-2">
          <div className="flex justify-end gap-2">
            <ItemStatusAction id={item.id} label="Concluir item" status="done" tone="primary" />
            <ItemStatusAction
              id={item.id}
              label="Nao aplicavel"
              status="not_applicable"
              tone="neutral"
            />
            <ItemStatusAction id={item.id} label="Bloquear item" status="blocked" tone="destructive" />
          </div>
        </td>
      ) : null}
    </tr>
  );
}

function ItemStatusAction({
  id,
  label,
  status,
  tone,
}: {
  id: string;
  label: string;
  status: LifecycleChecklistItemStatus;
  tone: "destructive" | "neutral" | "primary";
}) {
  const Icon = status === "done" ? CheckCircle2 : status === "blocked" ? Ban : MinusCircle;
  const className =
    tone === "primary"
      ? "border-primary/30 text-primary hover:bg-primary/10"
      : tone === "destructive"
        ? "border-destructive/30 text-destructive hover:bg-destructive/10"
        : "border-muted text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <form action={updateLifecycleChecklistItemStatusAction}>
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ChecklistStatusBadge({ status }: { status: LifecycleChecklistStatus }) {
  const className =
    status === "completed"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "cancelled"
        ? "border-muted bg-muted text-muted-foreground"
        : "border-secondary/30 bg-secondary/10 text-secondary-foreground";

  return <Badge className={className} label={lifecycleChecklistStatusLabels[status]} />;
}

function EmployeeStatusBadge({ status }: { status: string }) {
  const className =
    status === "active"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "terminated"
        ? "border-muted bg-muted text-muted-foreground"
        : "border-secondary/30 bg-secondary/10 text-secondary-foreground";

  return <Badge className={className} label={formatEmployeeStatus(status)} />;
}

function ChecklistStateBadge({ state }: { state: LifecycleChecklistState }) {
  if (state === "ok") {
    return null;
  }

  const label = {
    cancelled: "Cancelado",
    completed: "Concluido",
    overdue: "Atrasado",
  }[state];
  const className =
    state === "overdue"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : "border-muted bg-muted text-muted-foreground";

  return <Badge className={className} label={label} />;
}

function ItemStatusBadge({ status }: { status: LifecycleChecklistItemStatus }) {
  const className =
    status === "done"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "blocked"
        ? "border-destructive/30 bg-destructive/10 text-destructive"
        : status === "not_applicable"
          ? "border-muted bg-muted text-muted-foreground"
          : "border-secondary/30 bg-secondary/10 text-secondary-foreground";

  return <Badge className={className} label={lifecycleChecklistItemStatusLabels[status]} />;
}

function Badge({ className, label }: { className: string; label: string }) {
  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

function formatEmployeeStatus(status: string) {
  return employeeStatusLabels[status as keyof typeof employeeStatusLabels] ?? status;
}

function formatEmploymentType(type: string) {
  return employmentTypeLabels[type as keyof typeof employmentTypeLabels] ?? type;
}

function TextButton({
  icon: Icon,
  label,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  tone: "destructive" | "primary";
}) {
  const className =
    tone === "primary"
      ? primaryButtonClassName
      : "inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border border-destructive/30 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10";

  return (
    <button className={className} type="submit">
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const textareaClassName =
  "min-h-24 w-full min-w-0 resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

const secondaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

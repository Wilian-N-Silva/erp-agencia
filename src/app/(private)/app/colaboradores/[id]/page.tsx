import { ArrowLeft, BadgeDollarSign, Save, UserRound } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { updateEmployeeAction } from "@/features/people/actions";
import {
  getEmployeeDetail,
  listEmployeeAuditLogs,
  listPeopleOptions,
  type EmployeeAuditLogItem,
  type EmployeeDetail,
} from "@/features/people/dal";
import {
  canWritePeople,
  employeeStatusLabels,
  employmentTypeLabels,
} from "@/features/people/rules";
import { formatDate, formatMoney } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EmployeeDetailPage({ params }: PageProps) {
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

  const canWrite = canWritePeople(context);
  const [options, auditLogs] = await Promise.all([
    canWrite ? listPeopleOptions(context) : Promise.resolve(null),
    listEmployeeAuditLogs(context, employee.id, { limit: 12 }),
  ]);

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link className={`${secondaryButtonClassName} w-fit`} href="/app/colaboradores">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{employee.registrationNumber}</p>
            <h1 className="truncate text-2xl font-semibold tracking-normal">
              {employee.socialName || employee.fullName}
            </h1>
          </div>
          <Link
            className={`${secondaryButtonClassName} sm:w-auto`}
            href={`/app/colaboradores/${employee.id}/remuneracao` as Route}
          >
            <BadgeDollarSign className="size-4" aria-hidden="true" />
            Remuneracao
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Status" value={employeeStatusLabels[employee.status]} />
        <SummaryCard label="Vinculo" value={employmentTypeLabels[employee.employmentType]} />
        <SummaryCard label="Tempo de casa" value={`${employee.tenureMonths} mes(es)`} />
        <SummaryCard
          label="Custo mensal"
          value={employee.compensationHidden ? "Restrito" : formatMoney(employee.currentCompensation)}
        />
      </div>

      <div className={`grid gap-4 ${canWrite && options ? "xl:grid-cols-[0.9fr_1.1fr]" : ""}`}>
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">Dados do colaborador</h2>
          </div>
          <dl className="grid gap-0 sm:grid-cols-2">
            <DetailItem label="Nome completo" value={employee.fullName} />
            <DetailItem label="Email corporativo" value={employee.corporateEmail ?? "-"} />
            <DetailItem label="Area" value={employee.areaName} />
            <DetailItem label="Cargo" value={employee.positionName} />
            <DetailItem label="Entrada" value={formatDate(employee.startDate)} />
            <DetailItem label="Saida" value={formatDate(employee.endDate)} />
            <DetailItem label="Modelo" value={employee.workModel ?? "-"} />
            <DetailItem label="Localizacao" value={employee.location ?? "-"} />
            <DetailItem
              label="Email pessoal"
              value={employee.sensitiveProfileHidden ? "Restrito" : (employee.personalEmail ?? "-")}
            />
            <DetailItem
              label="Telefone"
              value={employee.sensitiveProfileHidden ? "Restrito" : (employee.phone ?? "-")}
            />
            <DetailItem
              label="CPF"
              value={employee.sensitiveProfileHidden ? "Restrito" : (employee.cpf ?? "-")}
            />
            <DetailItem
              label="Pix"
              value={employee.sensitiveProfileHidden ? "Restrito" : (employee.pix ?? "-")}
            />
          </dl>
          <div className="border-t p-4">
            <p className="text-sm font-medium">Observacoes internas</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
              {employee.sensitiveProfileHidden ? "Restrito" : employee.internalNotes || "-"}
            </p>
          </div>
        </section>

        {canWrite && options ? (
          <section className="rounded-lg border bg-card">
            <div className="border-b px-4 py-3">
              <h2 className="text-base font-semibold">Editar cadastro</h2>
            </div>
            <form action={updateEmployeeAction} className="grid gap-4 p-4">
              <input name="id" type="hidden" value={employee.id} />
              <EmployeeEditFields employee={employee} options={options} />
              <div className="flex justify-end">
                <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
                  <Save className="size-4" aria-hidden="true" />
                  Salvar cadastro
                </button>
              </div>
            </form>
          </section>
        ) : null}
      </div>

      <HistorySection auditLogs={auditLogs} />
    </section>
  );
}

function EmployeeEditFields({
  employee,
  options,
}: {
  employee: EmployeeDetail;
  options: {
    areas: { id: string; name: string }[];
    managers: { id: string; name: string }[];
    positions: { id: string; name: string }[];
  };
}) {
  return (
    <>
      <div className="grid gap-3 lg:grid-cols-3">
        <label className={fieldClassName}>
          Nome completo
          <input className={inputClassName} defaultValue={employee.fullName} maxLength={180} name="fullName" required />
        </label>
        <label className={fieldClassName}>
          Nome social
          <input className={inputClassName} defaultValue={employee.socialName ?? ""} maxLength={120} name="socialName" />
        </label>
        <label className={fieldClassName}>
          Email corporativo
          <input className={inputClassName} defaultValue={employee.corporateEmail ?? ""} maxLength={160} name="corporateEmail" type="email" />
        </label>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <label className={fieldClassName}>
          Area
          <select className={inputClassName} defaultValue={employee.areaId} name="areaId">
            {options.areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Cargo
          <select className={inputClassName} defaultValue={employee.positionId} name="positionId">
            {options.positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Gestor
          <select className={inputClassName} defaultValue={employee.managerEmployeeId ?? ""} name="managerEmployeeId">
            <option value="">Sem gestor</option>
            {options.managers
              .filter((manager) => manager.id !== employee.id)
              .map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        <label className={fieldClassName}>
          Vinculo
          <select className={inputClassName} defaultValue={employee.employmentType} name="employmentType">
            {Object.entries(employmentTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Status
          <select className={inputClassName} defaultValue={employee.status} name="status">
            {Object.entries(employeeStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Entrada
          <input className={inputClassName} defaultValue={toDateInputValue(employee.startDate)} name="startDate" required type="date" />
        </label>
        <label className={fieldClassName}>
          Saida
          <input className={inputClassName} defaultValue={employee.endDate ?? ""} name="endDate" type="date" />
        </label>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <label className={fieldClassName}>
          Email pessoal
          <input className={inputClassName} defaultValue={employee.personalEmail ?? ""} maxLength={160} name="personalEmail" type="email" />
        </label>
        <label className={fieldClassName}>
          Telefone
          <input className={inputClassName} defaultValue={employee.phone ?? ""} maxLength={40} name="phone" />
        </label>
        <label className={fieldClassName}>
          Modelo de trabalho
          <input className={inputClassName} defaultValue={employee.workModel ?? ""} maxLength={80} name="workModel" />
        </label>
      </div>
      <div className="grid gap-3 lg:grid-cols-4">
        <label className={fieldClassName}>
          CPF
          <input className={inputClassName} defaultValue={employee.cpf ?? ""} maxLength={20} name="cpf" />
        </label>
        <label className={fieldClassName}>
          RG
          <input className={inputClassName} defaultValue={employee.rg ?? ""} maxLength={30} name="rg" />
        </label>
        <label className={fieldClassName}>
          Nascimento
          <input className={inputClassName} defaultValue={employee.birthDate ?? ""} name="birthDate" type="date" />
        </label>
        <label className={fieldClassName}>
          Localizacao
          <input className={inputClassName} defaultValue={employee.location ?? ""} maxLength={120} name="location" />
        </label>
      </div>
      <label className={fieldClassName}>
        Pix
        <input className={inputClassName} defaultValue={employee.pix ?? ""} maxLength={160} name="pix" />
      </label>
      <label className={fieldClassName}>
        Endereco
        <input className={inputClassName} defaultValue={employee.address ?? ""} maxLength={300} name="address" />
      </label>
      <label className={fieldClassName}>
        Contato de emergencia
        <input className={inputClassName} defaultValue={employee.emergencyContact ?? ""} maxLength={200} name="emergencyContact" />
      </label>
      <label className={fieldClassName}>
        Observacoes internas
        <textarea className={textareaClassName} defaultValue={employee.internalNotes ?? ""} maxLength={2000} name="internalNotes" rows={4} />
      </label>
    </>
  );
}

function HistorySection({ auditLogs }: { auditLogs: EmployeeAuditLogItem[] }) {
  return (
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
              <p className="text-muted-foreground">{log.actorName ?? log.actorEmail ?? "Sistema"}</p>
              <p className="text-muted-foreground md:text-right">{formatDateTime(log.createdAt)}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <UserRound className="size-4 shrink-0 text-primary" aria-hidden="true" />
      </div>
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

function formatAuditAction(action: string) {
  const labels: Record<string, string> = {
    create: "Criacao",
    status_change: "Status",
    update: "Edicao",
  };

  return labels[action] ?? action;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function toDateInputValue(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }

  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i.test(value);
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

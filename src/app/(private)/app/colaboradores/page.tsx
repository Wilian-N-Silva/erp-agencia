import { BadgeDollarSign, Plus, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import {
  listEmployees,
  listPeopleFilterOptions,
} from "@/features/people/dal";
import {
  canWritePeople,
  employeeStatusLabels,
  employmentTypeLabels,
  normalizePeopleFilters,
  type EmployeeListItem,
  type PeopleFilters,
} from "@/features/people/rules";
import { formatDate, formatMoney } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PeoplePage({ searchParams }: PageProps) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canAny(["people.read", "people.read_team", "people.read_own", "people.configure"], context)) {
    redirect("/acesso-negado");
  }

  const filters = normalizePeopleFilters((await searchParams) ?? {});
  const [employees, filterOptions] = await Promise.all([
    listEmployees(context, filters),
    listPeopleFilterOptions(context),
  ]);
  const canWrite = canWritePeople(context);
  const activeCount = employees.filter((employee) => employee.status === "active").length;
  const visibleCompensationCount = employees.filter((employee) => !employee.compensationHidden).length;

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-normal">Colaboradores</h1>
          <p className="text-sm text-muted-foreground">Pessoas, vinculos e custos mensais</p>
        </div>
        {canWrite ? (
          <Link className={`${primaryButtonClassName} sm:w-auto`} href="/app/colaboradores/novo">
            <Plus className="size-4" aria-hidden="true" />
            Novo colaborador
          </Link>
        ) : null}
      </div>

      <PeopleFilterForm filters={filters} options={filterOptions} />

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard icon={UsersRound} label="Colaboradores" value={String(employees.length)} />
        <SummaryCard icon={UserRound} label="Ativos" value={String(activeCount)} />
        <SummaryCard
          icon={BadgeDollarSign}
          label="Remuneracao visivel"
          value={String(visibleCompensationCount)}
        />
      </div>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Equipe</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Matricula</th>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Area</th>
                <th className="px-4 py-3 font-medium">Cargo</th>
                <th className="px-4 py-3 font-medium">Vinculo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Entrada</th>
                <th className="px-4 py-3 text-right font-medium">Custo mensal</th>
              </tr>
            </thead>
            <tbody>
              {employees.length === 0 ? (
                <tr>
                  <td className="px-4 py-8 text-center text-muted-foreground" colSpan={8}>
                    Nenhum colaborador cadastrado.
                  </td>
                </tr>
              ) : (
                employees.map((employee) => <EmployeeRow employee={employee} key={employee.id} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function PeopleFilterForm({
  filters,
  options,
}: {
  filters: PeopleFilters;
  options: { areas: { id: string; name: string }[]; positions: { id: string; name: string }[] };
}) {
  return (
    <form action="/app/colaboradores" className="rounded-lg border bg-card p-4" method="get">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(14rem,1fr)_minmax(10rem,0.55fr)_minmax(10rem,0.55fr)_minmax(10rem,0.45fr)_auto_auto]">
        <label className={fieldClassName}>
          Busca
          <input
            className={inputClassName}
            defaultValue={filters.query ?? ""}
            name="q"
            placeholder="Nome, matricula, email"
          />
        </label>
        <label className={fieldClassName}>
          Area
          <select className={inputClassName} defaultValue={filters.areaId ?? ""} name="areaId">
            <option value="">Todas</option>
            {options.areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Cargo
          <select className={inputClassName} defaultValue={filters.positionId ?? ""} name="positionId">
            <option value="">Todos</option>
            {options.positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Status
          <select className={inputClassName} defaultValue={filters.status ?? "all"} name="status">
            <option value="all">Todos</option>
            {Object.entries(employeeStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className={`${primaryButtonClassName} self-end`} type="submit">
          Filtrar
        </button>
        <Link className={`${secondaryButtonClassName} self-end`} href="/app/colaboradores">
          Limpar
        </Link>
      </div>
    </form>
  );
}

function EmployeeRow({ employee }: { employee: EmployeeListItem }) {
  return (
    <tr className="border-b last:border-b-0">
      <td className="px-4 py-3 font-medium">{employee.registrationNumber}</td>
      <td className="px-4 py-3">
        <Link
          className="font-medium text-primary underline-offset-4 hover:underline"
          href={`/app/colaboradores/${employee.id}` as Route}
        >
          {employee.socialName || employee.fullName}
        </Link>
        <p className="text-xs text-muted-foreground">{employee.corporateEmail ?? "-"}</p>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{employee.areaName}</td>
      <td className="px-4 py-3 text-muted-foreground">{employee.positionName}</td>
      <td className="px-4 py-3 text-muted-foreground">
        {employmentTypeLabels[employee.employmentType]}
      </td>
      <td className="px-4 py-3">
        <EmployeeStatusBadge status={employee.status} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">{formatDate(employee.startDate)}</td>
      <td className="px-4 py-3 text-right font-medium">
        {employee.compensationHidden ? "Restrito" : formatMoney(employee.currentCompensation)}
      </td>
    </tr>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function EmployeeStatusBadge({ status }: { status: keyof typeof employeeStatusLabels }) {
  const className =
    status === "active"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "terminated"
        ? "border-muted bg-muted text-muted-foreground"
        : "border-secondary/30 bg-secondary/10 text-secondary-foreground";

  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>{employeeStatusLabels[status]}</span>;
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

const secondaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

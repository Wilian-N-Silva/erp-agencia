import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createEmployeeAction } from "@/features/people/actions";
import { listPeopleOptions } from "@/features/people/dal";
import {
  canWriteCompensation,
  canWritePeople,
  employeeStatusLabels,
  employmentTypeLabels,
} from "@/features/people/rules";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canWritePeople(context) || !canWriteCompensation(context)) {
    redirect("/acesso-negado");
  }

  const options = await listPeopleOptions(context);

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link className={`${secondaryButtonClassName} w-fit`} href="/app/colaboradores">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-normal">Novo colaborador</h1>
          <p className="text-sm text-muted-foreground">Cadastro, vinculo e remuneracao inicial</p>
        </div>
      </div>

      <form action={createEmployeeAction} className="rounded-lg border bg-card p-4">
        <EmployeeFormFields options={options} />
        <div className="mt-5 flex justify-end">
          <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
            <Plus className="size-4" aria-hidden="true" />
            Criar colaborador
          </button>
        </div>
      </form>
    </section>
  );
}

function EmployeeFormFields({
  options,
}: {
  options: {
    areas: { id: string; name: string }[];
    managers: { id: string; name: string }[];
    positions: { id: string; name: string }[];
  };
}) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 lg:grid-cols-3">
        <label className={fieldClassName}>
          Nome completo
          <input className={inputClassName} maxLength={180} name="fullName" required />
        </label>
        <label className={fieldClassName}>
          Nome social
          <input className={inputClassName} maxLength={120} name="socialName" />
        </label>
        <label className={fieldClassName}>
          Email corporativo
          <input className={inputClassName} maxLength={160} name="corporateEmail" type="email" />
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <label className={fieldClassName}>
          Area
          <select className={inputClassName} name="areaId" required>
            {options.areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Cargo
          <select className={inputClassName} name="positionId" required>
            {options.positions.map((position) => (
              <option key={position.id} value={position.id}>
                {position.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Gestor
          <select className={inputClassName} name="managerEmployeeId">
            <option value="">Sem gestor</option>
            {options.managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Vinculo
          <select className={inputClassName} name="employmentType" required>
            {Object.entries(employmentTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <label className={fieldClassName}>
          Data de entrada
          <input className={inputClassName} name="startDate" required type="date" />
        </label>
        <label className={fieldClassName}>
          Data de saida
          <input className={inputClassName} name="endDate" type="date" />
        </label>
        <label className={fieldClassName}>
          Status
          <select className={inputClassName} defaultValue="active" name="status" required>
            {Object.entries(employeeStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Modelo de trabalho
          <input className={inputClassName} maxLength={80} name="workModel" />
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <label className={fieldClassName}>
          Remuneracao atual
          <input className={inputClassName} inputMode="decimal" name="currentCompensation" required />
        </label>
        <label className={fieldClassName}>
          Ajuda de custo recorrente
          <input className={inputClassName} inputMode="decimal" name="recurringCostAllowance" />
        </label>
        <label className={fieldClassName}>
          Transporte recorrente
          <input className={inputClassName} inputMode="decimal" name="recurringTransport" />
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <label className={fieldClassName}>
          Email pessoal
          <input className={inputClassName} maxLength={160} name="personalEmail" type="email" />
        </label>
        <label className={fieldClassName}>
          Telefone
          <input className={inputClassName} maxLength={40} name="phone" />
        </label>
        <label className={fieldClassName}>
          Localizacao
          <input className={inputClassName} maxLength={120} name="location" />
        </label>
      </div>

      <div className="grid gap-3 lg:grid-cols-4">
        <label className={fieldClassName}>
          CPF
          <input className={inputClassName} maxLength={20} name="cpf" />
        </label>
        <label className={fieldClassName}>
          RG
          <input className={inputClassName} maxLength={30} name="rg" />
        </label>
        <label className={fieldClassName}>
          Nascimento
          <input className={inputClassName} name="birthDate" type="date" />
        </label>
        <label className={fieldClassName}>
          Pix
          <input className={inputClassName} maxLength={160} name="pix" />
        </label>
      </div>

      <label className={fieldClassName}>
        Endereco
        <input className={inputClassName} maxLength={300} name="address" />
      </label>
      <label className={fieldClassName}>
        Contato de emergencia
        <input className={inputClassName} maxLength={200} name="emergencyContact" />
      </label>
      <label className={fieldClassName}>
        Observacoes internas
        <textarea className={textareaClassName} maxLength={2000} name="internalNotes" rows={4} />
      </label>
    </div>
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
  "inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

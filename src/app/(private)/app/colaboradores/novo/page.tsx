import { ArrowLeft, Plus, Settings } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { createEmployeeAction } from "@/features/people/actions";
import { listPeopleOptions } from "@/features/people/dal";
import { EmployeeCreateFields } from "@/features/people/employee-form-fields";
import {
  canWriteCompensation,
  canWritePeople,
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
  const hasRequiredOrgUnits = options.areas.length > 0 && options.positions.length > 0;

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link className={`${secondaryButtonClassName} w-fit`} href="/app/colaboradores">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-normal">Novo colaborador ou socio</h1>
          <p className="text-sm text-muted-foreground">Cadastro, vinculo, area, cargo e remuneracao inicial</p>
        </div>
      </div>

      {hasRequiredOrgUnits ? (
        <form action={createEmployeeAction} className="rounded-lg border bg-card p-4">
          <EmployeeCreateFields options={options} />
          <div className="mt-5 flex justify-end">
            <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
              <Plus className="size-4" aria-hidden="true" />
              Criar colaborador
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-lg border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-base font-semibold">Configure areas e cargos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cadastre pelo menos uma area e um cargo antes de criar colaboradores ou socios.
              </p>
            </div>
            <Link className={`${primaryButtonClassName} sm:w-auto`} href="/app/configuracoes">
              <Settings className="size-4" aria-hidden="true" />
              Configuracoes
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <MissingOrgUnitStatus label="Areas cadastradas" ready={options.areas.length > 0} />
            <MissingOrgUnitStatus label="Cargos cadastrados" ready={options.positions.length > 0} />
          </div>
        </div>
      )}
    </section>
  );
}

function MissingOrgUnitStatus({ label, ready }: { label: string; ready: boolean }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs text-muted-foreground">{ready ? "Pronto" : "Pendente"}</p>
    </div>
  );
}

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

const secondaryButtonClassName =
  "inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

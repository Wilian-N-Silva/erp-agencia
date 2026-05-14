import { ArrowLeft, Plus } from "lucide-react";
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
        <EmployeeCreateFields options={options} />
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

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

const secondaryButtonClassName =
  "inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

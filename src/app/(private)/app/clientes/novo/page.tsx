import { ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { MoneyInput } from "@/components/fg";
import { createClientAction } from "@/features/clients/actions";
import { listClientOwnerOptions } from "@/features/clients/dal";
import { canWriteClients } from "@/features/clients/rules";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function NewClientPage() {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canWriteClients(context)) {
    redirect("/acesso-negado");
  }

  const ownerOptions = await listClientOwnerOptions(context);

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link className={`${secondaryButtonClassName} w-fit`} href="/app/clientes">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-normal">Novo cliente</h1>
          <p className="text-sm text-muted-foreground">Cadastro completo da carteira</p>
        </div>
      </div>

      <form action={createClientAction} className="rounded-lg border bg-card p-4">
        <ClientFormFields ownerOptions={ownerOptions} />
        <div className="mt-5 flex justify-end">
          <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
            <Plus className="size-4" aria-hidden="true" />
            Criar cliente
          </button>
        </div>
      </form>
    </section>
  );
}

function ClientFormFields({
  ownerOptions,
}: {
  ownerOptions: { id: string; name: string }[];
}) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_minmax(9rem,0.35fr)_minmax(7rem,0.25fr)]">
        <label className={fieldClassName}>
          Nome
          <input className={inputClassName} maxLength={160} name="name" required />
        </label>
        <label className={fieldClassName}>
          Fee mensal
          <MoneyInput name="monthlyFee" required />
        </label>
        <label className={fieldClassName}>
          Dia de cobranca
          <input
            className={inputClassName}
            max={31}
            min={1}
            name="billingDay"
            required
            type="number"
          />
        </label>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <label className={fieldClassName}>
          Responsavel interno
          <select className={inputClassName} name="internalOwnerEmployeeId">
            <option value="">Sem responsavel</option>
            {ownerOptions.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.name}
              </option>
            ))}
          </select>
        </label>
        <label className={fieldClassName}>
          Cobranca
          <input className={inputClassName} maxLength={80} name="billingMethod" />
        </label>
        <label className={fieldClassName}>
          Inicio
          <input className={inputClassName} name="startDate" type="date" />
        </label>
      </div>
      <label className={fieldClassName}>
        Observacoes
        <textarea className={textareaClassName} maxLength={1000} name="notes" rows={5} />
      </label>
    </div>
  );
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const textareaClassName =
  "min-h-28 w-full min-w-0 resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90";

const secondaryButtonClassName =
  "inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

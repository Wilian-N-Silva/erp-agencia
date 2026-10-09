"use client";

import { startTransition, useActionState, type ReactNode } from "react";
import { cancelProvisionCycleAction, planProvisionCycleAction, realizeProvisionCycleAction } from "./actions";

type Result = { ok: boolean; message: string } | null;
function CycleForm({ action, children, label }: { action: (data: FormData) => Promise<NonNullable<Result>>; children: ReactNode; label: string }) {
  const [result, submit, pending] = useActionState(async (_: Result, data: FormData) => action(data), null);
  return <form className="grid gap-3" aria-busy={pending} onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => submit(data));
  }}>
    <fieldset disabled={pending} className="grid gap-3">{children}</fieldset>
    {result ? <p role={result.ok ? "status" : "alert"}>{result.message}</p> : null}
    <button className="justify-self-start rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={pending} type="submit">{pending ? "Salvando…" : label}</button>
  </form>;
}

export function PlanProvisionForm({ provisions }: { provisions: { id: string; name: string }[] }) {
  return <CycleForm action={planProvisionCycleAction} label="Planejar ocorrência">
    <label className="grid gap-1">Provisão<select className="fg-input" name="provisionId" aria-label="Provisão" required defaultValue=""><option value="" disabled>Selecione</option>{provisions.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
    <label className="grid gap-1">Competência<input className="fg-input" type="month" name="competence" required /></label>
    <label className="grid gap-1">Valor previsto (R$)<input className="fg-input" name="estimatedAmount" inputMode="decimal" maxLength={14} required placeholder="0,00" /></label>
    <label className="grid gap-1">Vencimento previsto<input className="fg-input" type="date" name="dueDate" required /></label>
    <p className="text-sm text-muted-foreground">Uma ocorrência por competência. Planejar novamente consulta a existente, sem alterar valores ou reabrir uma ocorrência cancelada.</p>
  </CycleForm>;
}

export function RealizeProvisionForm({ id, amount, dueDate, suppliers }: { id: string; amount: string; dueDate: string; suppliers: { id: string; name: string }[] }) {
  return <CycleForm action={realizeProvisionCycleAction} label="Gerar conta a pagar">
    <input type="hidden" name="id" value={id} />
    <label className="grid gap-1">Fornecedor<select className="fg-input" name="supplierId" aria-label="Fornecedor" required defaultValue=""><option value="" disabled>Selecione</option>{suppliers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
    <label className="grid gap-1">Valor efetivo (R$)<input className="fg-input" name="amount" inputMode="decimal" required maxLength={14} defaultValue={amount.replace(".", ",")} /></label>
    <label className="grid gap-1">Vencimento da conta<input className="fg-input" type="date" name="dueDate" required defaultValue={dueDate} /></label>
    <p className="text-sm text-muted-foreground">Confira a cobrança antes de confirmar. A previsão será substituída pela conta a pagar; o pagamento é registrado e conciliado no Financeiro.</p>
  </CycleForm>;
}

export function CancelProvisionForm({ id }: { id: string }) {
  return <CycleForm action={cancelProvisionCycleAction} label="Cancelar ocorrência">
    <input type="hidden" name="id" value={id} />
    <label className="grid gap-1">Motivo do cancelamento<textarea className="fg-input" name="reason" required minLength={5} maxLength={500} /></label>
    <p className="text-sm text-muted-foreground">Cancela somente esta competência. A recorrência dos próximos meses continua ativa.</p>
  </CycleForm>;
}

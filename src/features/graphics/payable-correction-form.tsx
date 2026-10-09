"use client";
import { useActionState } from "react";
import { correctGraphicPayableAction } from "./payable-correction-actions";

export function GraphicPayableCorrectionForm({ jobId, commitmentId, revision, amount, dueDate, competence }: { jobId: string; commitmentId: string; revision: string; amount: string; dueDate: string; competence: string }) {
  const [result, submit, pending] = useActionState(async (_state: { ok: boolean; message: string } | null, data: FormData) => correctGraphicPayableAction(data), null);
  return <form action={submit} className="mt-3 grid gap-3">
    <input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="commitmentId" value={commitmentId} /><input type="hidden" name="revision" value={revision} />
    <p>Corrija os dados financeiros conferidos com o fornecedor. A cotação e a contratação são mantidas no histórico. Estorne liquidações ou revise reservas históricas antes de corrigir.</p>
    <label className="grid gap-1">Valor da conta a pagar<input className="fg-input" name="amount" required inputMode="decimal" defaultValue={amount} /></label>
    <label className="grid gap-1">Vencimento da conta a pagar<input className="fg-input" name="dueDate" required type="date" defaultValue={dueDate} /></label>
    <label className="grid gap-1">Competência da conta a pagar<input className="fg-input" name="competence" required type="month" defaultValue={competence} /></label>
    <label className="grid gap-1">Motivo da correção financeira<textarea className="fg-input" name="reason" required minLength={5} maxLength={1000} /></label>
    <button className="fg-btn fg-btn-primary" type="submit" disabled={pending}>{pending ? "Salvando…" : "Salvar correção da conta a pagar"}</button>
    {result ? <p role="status">{result.message}</p> : null}
  </form>;
}

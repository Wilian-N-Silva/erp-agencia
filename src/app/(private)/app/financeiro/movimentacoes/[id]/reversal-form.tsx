"use client";
import { useActionState } from "react";
import { reverseFinancialTransactionAction } from "@/features/finance-transactions/reversal-actions";

export function ReversalForm({ transactionId }: { transactionId: string }) {
  const [state, action, pending] = useActionState(async (_previous: { ok: boolean; message: string } | null, data: FormData) => reverseFinancialTransactionAction(data), null);
  return <form action={action} className="grid gap-3" aria-busy={pending}>
    <input type="hidden" name="transactionId" value={transactionId} />
    <p className="text-sm">Use para corrigir uma movimentação registrada por engano. O estorno reabre os saldos conciliados e preserva os registros. Se necessário, registre a movimentação correta depois. Esta ação não transfere dinheiro no banco.</p>
    <label className="grid gap-1 text-sm">Motivo do estorno<textarea className="fg-input" name="reason" required minLength={3} maxLength={2000} /></label>
    {state ? <p role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
    <button className="fg-btn fg-btn-primary justify-self-start" type="submit" disabled={pending}>{pending ? "Estornando…" : "Confirmar estorno"}</button>
  </form>;
}

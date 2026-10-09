"use client";
import { useActionState } from "react";
import { releaseFinancialLegacyReserveAction } from "@/features/finance/legacy-review-actions";

export function LegacyReviewForm({ type, id, requestId, reserved }: { type: "receivable" | "payable"; id: string; requestId: string; reserved: string }) {
  const [state, action, pending] = useActionState(async (_previous: { ok: boolean; message: string }, data: FormData) => releaseFinancialLegacyReserveAction(data), { ok: false, message: "" });
  return <form action={action} className="grid gap-3">
    <input type="hidden" name="type" value={type} /><input type="hidden" name="id" value={id} /><input type="hidden" name="requestId" value={requestId} />
    <fieldset disabled={pending || state.ok} className="grid gap-3">
      <label className="grid gap-1">Valor da reserva a liberar (R$)<input name="amount" type="number" step="0.01" min="0.01" max={reserved} placeholder="0.00" className="fg-input" required /></label>
      <label className="grid gap-1">Motivo da revisão<textarea name="reason" minLength={10} maxLength={2000} required className="fg-input" /></label>
      <label className="grid gap-1">Evidência conferida<textarea name="evidence" minLength={10} maxLength={2000} required className="fg-input" placeholder="Identifique o extrato, comprovante ou registro que fundamenta a liberação." /></label>
      <label><input type="checkbox" name="confirmed" value="yes" required /> Conferi a evidência e confirmo que este valor deve deixar de ser reservado no histórico. Esta revisão não comprova nem cria um pagamento.</label>
      <button type="submit" className="fg-btn">{pending ? "Registrando…" : "Liberar reserva revisada"}</button>
    </fieldset>
    {state.message ? <p role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
  </form>;
}

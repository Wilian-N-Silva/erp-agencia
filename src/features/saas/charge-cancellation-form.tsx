"use client";
import { useActionState } from "react";
import { cancelSaasChargeAction } from "./charge-cancellation-actions";

export function SaasChargeCancellation({ charge, canCancel }: { charge: { id: string; subscriptionId: string; competence: string; revision: string; cancelledAt: Date | null; cancellationReason: string | null; financialExpenseId: string | null }; canCancel: boolean }) {
  if (charge.cancelledAt) return <p>Cancelamento registrado em {new Date(charge.cancelledAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Motivo: {charge.cancellationReason}</p>;
  if (!canCancel || !charge.financialExpenseId) return null;
  return <details><summary>Cancelar cobrança de {charge.competence}</summary><CancelSaasChargeForm subscriptionId={charge.subscriptionId} chargeId={charge.id} revision={charge.revision} /></details>;
}

export function CancelSaasChargeForm({ subscriptionId, chargeId, revision }: { subscriptionId: string; chargeId: string; revision: string }) {
  const [result, submit, pending] = useActionState(async (_state: { ok: boolean; message: string } | null, data: FormData) => cancelSaasChargeAction(data), null);
  return <form action={submit} className="fg-form">
    <input type="hidden" name="subscriptionId" value={subscriptionId} />
    <input type="hidden" name="chargeId" value={chargeId} />
    <input type="hidden" name="revision" value={revision} />
    <p>O cancelamento preserva esta cobrança, sua AP e documentos. Não estorna dinheiro nem cancela a assinatura. Estorne conciliações ou revise reservas históricas antes de continuar.</p>
    <label>Motivo do cancelamento<textarea className="fg-input" name="reason" required minLength={5} maxLength={1000} /></label>
    <label><input type="checkbox" name="confirmation" value="cancel" required /> Confirmo o cancelamento desta cobrança e da conta a pagar vinculada.</label>
    <button type="submit" className="fg-btn fg-btn-outline" disabled={pending}>{pending ? "Cancelando…" : "Confirmar cancelamento da cobrança"}</button>
    {result ? <p role="status">{result.message}</p> : null}
  </form>;
}

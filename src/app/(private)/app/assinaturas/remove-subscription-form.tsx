"use client";

import { useActionState } from "react";
import { removeSaasSubscriptionAction } from "@/features/saas/actions";

export function RemoveSubscriptionForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(removeSaasSubscriptionAction, null);
  return (
    <form action={action} className="fg-form" aria-busy={pending}>
      <input name="id" type="hidden" value={id} />
      <p>Use para corrigir um cadastro errado. A assinatura sairá das telas e dos totais; o registro de auditoria será preservado. Para encerrar um contrato utilizado, use Cancelar assinatura.</p>
      <label className="fg-field">
        <span className="fg-label">Motivo da remoção</span>
        <textarea className="fg-input fg-textarea" name="reason" minLength={5} maxLength={500} required />
      </label>
      <label>
        <input type="checkbox" name="confirmation" value="remove" required />{" "}
        Confirmo que esta assinatura foi cadastrada por engano.
      </label>
      {state?.error ? <p role="alert">{state.error}</p> : null}
      <button type="submit" className="fg-btn fg-btn-destructive fg-btn-default" disabled={pending}>
        {pending ? "Removendo…" : "Confirmar remoção"}
      </button>
    </form>
  );
}

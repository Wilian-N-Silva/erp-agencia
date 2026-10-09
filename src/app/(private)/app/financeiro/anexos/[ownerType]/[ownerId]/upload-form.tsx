"use client";
import { useActionState } from "react";
import { uploadFinancialAttachmentAction } from "@/features/finance/attachment-actions";
import { financialAttachmentLabels, type FinancialDocumentOwner } from "@/features/finance/attachment-rules";

export function FinancialAttachmentForm({ ownerType, ownerId }: { ownerType: FinancialDocumentOwner; ownerId: string }) {
  const [state, action, pending] = useActionState(async (_previous: { ok: boolean; message: string }, data: FormData) => uploadFinancialAttachmentAction(data), { ok: false, message: "" });
  return <form action={action} className="grid gap-3">
    <input type="hidden" name="ownerType" value={ownerType} /><input type="hidden" name="ownerId" value={ownerId} />
    <label className="grid gap-1">Tipo de documento<select name="documentType" className="fg-input">{Object.entries(financialAttachmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    <label className="grid gap-1">Arquivo financeiro<input name="file" type="file" accept="application/pdf,image/png,image/jpeg" required /></label>
    <button type="submit" disabled={pending} className="fg-btn">{pending ? "Anexando…" : "Anexar documento"}</button>
    {state.message ? <p role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
  </form>;
}

"use client";

import { useActionState, useState } from "react";
import { recordClientDecisionAction } from "@/features/graphics/client-decision-actions";
import { clientChannelLabels, clientDecisionLabels } from "@/features/graphics/client-decision-rules";

export function ClientDecisionForm({ jobId, osVersionId, osVersion, previousId, rejected }: {
  jobId: string; osVersionId: string; osVersion: number; previousId?: string; rejected: boolean;
}) {
  const [decision, setDecision] = useState(rejected ? "revision_requested" : "");
  const [fields, setFields] = useState({ contact: "", channel: "", decidedAt: "", notes: "" });
  const [result, action, pending] = useActionState(async (_: { ok: boolean; message: string } | null, data: FormData) => recordClientDecisionAction(data), null);
  return <form action={action} className="grid gap-4" aria-busy={pending}>
    <p className="text-sm text-muted-foreground">Registre a resposta recebida do cliente sobre a <strong>versão {osVersion} da OS</strong>. Esta ação não envia mensagens nem registra recebimento de dinheiro.</p>
    <input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="osVersionId" value={osVersionId} /><input type="hidden" name="expectedDecisionId" value={previousId ?? ""} />
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="grid gap-1 text-sm">Resposta do cliente<select name="decision" className={inputClass} required value={decision} onChange={event => setDecision(event.target.value)}><option value="" disabled>Selecione a resposta</option>{Object.entries(clientDecisionLabels).filter(([key]) => !rejected || key === "revision_requested").map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Contato do cliente<input name="contact" className={inputClass} required minLength={2} maxLength={160} placeholder="Nome de quem respondeu" value={fields.contact} onChange={event => setFields({ ...fields, contact: event.target.value })} /></label>
      <label className="grid gap-1 text-sm">Canal da resposta<select name="channel" className={inputClass} required value={fields.channel} onChange={event => setFields({ ...fields, channel: event.target.value })}><option value="" disabled>Selecione o canal</option>{Object.entries(clientChannelLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Data da resposta<input name="decidedAt" type="date" className={inputClass} required value={fields.decidedAt} onChange={event => setFields({ ...fields, decidedAt: event.target.value })} /></label>
    </div>
    <label className="grid gap-1 text-sm">{decision === "approved" ? "Observações (opcional)" : "Motivo ou alteração solicitada"}<textarea name="notes" className="min-h-20 rounded-md border bg-background px-3 py-2" required={decision !== "approved"} minLength={decision !== "approved" ? 3 : undefined} maxLength={2000} value={fields.notes} onChange={event => setFields({ ...fields, notes: event.target.value })} /></label>
    <div className="grid gap-1"><label className="grid gap-1 text-sm">Evidência da resposta (opcional)<input name="evidence" type="file" accept="application/pdf,image/jpeg,image/png" aria-describedby="client-evidence-help" /></label><p id="client-evidence-help" className="text-xs text-muted-foreground">PDF, JPG ou PNG, até 10 MB. Exemplo: confirmação recebida por e-mail. Se houver erro no envio, selecione o arquivo novamente.</p></div>
    {result ? <p role={result.ok ? "status" : "alert"} className="text-sm">{result.message}</p> : null}
    <div className="flex justify-end"><button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{pending ? "Registrando…" : "Registrar resposta do cliente"}</button></div>
  </form>;
}
const inputClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

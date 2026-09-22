"use client";
import { useActionState, useState } from "react";
import { advanceGraphicProductionAction } from "@/features/graphics/production-actions";
import { productionNextStatuses, waitingReasonLabels } from "@/features/graphics/production-rules";
import { graphicJobOperationalStatusLabels } from "@/features/graphics/rules";

export function ProductionForm({ jobId, status, previousId, resumeStatus, ownerId, employees }: {
  jobId: string; status: string; previousId?: string; resumeStatus?: string; ownerId: string; employees: { id: string; name: string }[];
}) {
  const choices = productionNextStatuses(status, resumeStatus);
  const [fields, setFields] = useState({ toStatus: "", responsibleEmployeeId: ownerId, dueAt: "", waitingReason: "", notes: "" });
  const [result, action, pending] = useActionState(async (_: { ok: boolean; message: string } | null, data: FormData) => advanceGraphicProductionAction(data), null);
  if (!choices.length) return null;
  return <form action={action} className="grid gap-4" aria-busy={pending}>
    <p className="text-sm text-muted-foreground">Registre a etapa real do trabalho. Em espera, indique o motivo e quem vai resolver o bloqueio. A retomada retorna à etapa anterior.</p>
    <input name="jobId" type="hidden" value={jobId} /><input name="expectedStatus" type="hidden" value={status} /><input name="expectedEventId" type="hidden" value={previousId ?? ""} />
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="grid gap-1 text-sm">Próxima etapa<select className={inputClass} name="toStatus" required value={fields.toStatus} onChange={event => setFields({ ...fields, toStatus: event.target.value })}><option disabled value="">Selecione a etapa</option>{choices.map(value => <option value={value} key={value}>{status === "waiting" ? "Retomar: " : ""}{graphicJobOperationalStatusLabels[value]}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Responsável pela etapa<select className={inputClass} name="responsibleEmployeeId" required value={fields.responsibleEmployeeId} onChange={event => setFields({ ...fields, responsibleEmployeeId: event.target.value })}>{employees.map(person => <option value={person.id} key={person.id}>{person.name}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Prazo da etapa (opcional)<input className={inputClass} name="dueAt" type="date" value={fields.dueAt} onChange={event => setFields({ ...fields, dueAt: event.target.value })} /></label>
    </div>
    {fields.toStatus === "waiting" ? <label className="grid gap-1 text-sm">Motivo da espera<select className={inputClass} name="waitingReason" required value={fields.waitingReason} onChange={event => setFields({ ...fields, waitingReason: event.target.value })}><option disabled value="">Selecione o motivo</option>{Object.entries(waitingReasonLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label> : null}
    <label className="grid gap-1 text-sm">Observações da etapa (opcional)<textarea className="min-h-20 rounded-md border bg-background px-3 py-2" name="notes" maxLength={2000} value={fields.notes} onChange={event => setFields({ ...fields, notes: event.target.value })} /></label>
    {fields.toStatus === "closed" ? <p className="text-sm">O encerramento conclui o acompanhamento operacional deste trabalho. Confira a entrega e as pendências antes de confirmar.</p> : null}
    {result ? <p role={result.ok ? "status" : "alert"} className="text-sm">{result.message}</p> : null}
    <div className="flex justify-end"><button className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={pending} type="submit">{pending ? "Registrando…" : "Registrar etapa"}</button></div>
  </form>;
}
const inputClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

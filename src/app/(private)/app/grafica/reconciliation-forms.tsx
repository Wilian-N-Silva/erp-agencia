"use client";
import { useActionState, useState } from "react";
import { suggestGraphicReconciliationAction, reviewGraphicReconciliationAction } from "@/features/graphics/reconciliation-actions";

type Result = { ok: boolean; message: string } | null;
export function GraphicSuggestionForm({ jobId, movements, installments }: { jobId: string; movements: { id: string; label: string }[]; installments: { id: string; label: string }[] }) {
  const [fields, setFields] = useState({ transactionId: "", entryId: "", amount: "", reason: "" });
  const [result, action, pending] = useActionState(async (_: Result, data: FormData) => suggestGraphicReconciliationAction(data), null);
  return <form action={action} className="grid gap-3" aria-busy={pending}>
    <p className="text-sm text-muted-foreground">Escolha um recebimento do mesmo cliente ou ainda não identificado. O Financeiro deve confirmar o vínculo. Você pode sugerir outras parcelas, inclusive de outros trabalhos, para a mesma movimentação.</p>
    <input type="hidden" name="jobId" value={jobId} />
    <label className="grid gap-1 text-sm">Recebimento a identificar<select className="fg-input" name="transactionId" value={fields.transactionId} onChange={event => setFields({ ...fields, transactionId: event.target.value })} required><option value="">Selecione</option>{movements.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
    <label className="grid gap-1 text-sm">Parcela sugerida<select className="fg-input" name="entryId" value={fields.entryId} onChange={event => setFields({ ...fields, entryId: event.target.value })} required><option value="">Selecione</option>{installments.map(row => <option key={row.id} value={row.id}>{row.label}</option>)}</select></label>
    <label className="grid gap-1 text-sm">Valor sugerido<input className="fg-input" name="amount" inputMode="decimal" value={fields.amount} onChange={event => setFields({ ...fields, amount: event.target.value })} required /></label>
    <label className="grid gap-1 text-sm">Justificativa do vínculo<textarea className="fg-input" name="reason" minLength={3} maxLength={1000} value={fields.reason} onChange={event => setFields({ ...fields, reason: event.target.value })} required /></label>
    {result ? <p role={result.ok ? "status" : "alert"}>{result.message}</p> : null}
    <button className="justify-self-end rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={pending || !movements.length || !installments.length}>Enviar sugestão ao Financeiro</button>
  </form>;
}
export function GraphicSuggestionReviewForm({ suggestionId }: { suggestionId: string }) {
  const [notes, setNotes] = useState("");
  const [decision, setDecision] = useState("accepted");
  const [confirmed, setConfirmed] = useState(false);
  const [result, action, pending] = useActionState(async (_: Result, data: FormData) => reviewGraphicReconciliationAction(data), null);
  return <form action={action} className="mt-3 grid gap-3" aria-busy={pending}>
    <input name="suggestionId" type="hidden" value={suggestionId} />
    <label className="grid gap-1 text-sm">Decisão do Financeiro<select className="fg-input" name="decision" value={decision} onChange={event => setDecision(event.target.value)}><option value="accepted">Confirmar vínculo e conciliar valor</option><option value="rejected">Rejeitar sugestão sem liquidar</option></select></label>
    <label className="grid gap-1 text-sm">Justificativa da revisão<textarea className="fg-input" name="notes" minLength={3} maxLength={1000} required value={notes} onChange={event => setNotes(event.target.value)} /></label>
    <label className="flex gap-2 text-sm"><input name="confirmed" type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Conferi o recebimento e confirmo esta decisão.</label>
    {result ? <p role={result.ok ? "status" : "alert"}>{result.message}</p> : null}
    <button className="justify-self-end rounded-md border px-4 py-2" disabled={pending}>Registrar revisão</button>
  </form>;
}

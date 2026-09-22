"use client";
import { useActionState, useState } from "react";
import { contractGraphicSupplierAction } from "@/features/graphics/commitment-actions";

type Option = { id: string; name: string };
export function CommitmentForm({ jobId, quotes, categories, centers }: { jobId: string; quotes: Option[]; categories: Option[]; centers: Option[] }) {
  const [fields, setFields] = useState({ quoteId: quotes[0]?.id ?? "", contractedAt: "", dueDate: "", competence: "", categoryId: "", costCenterId: "", notes: "" });
  const [confirmed, setConfirmed] = useState(false);
  const [result, action, pending] = useActionState(async (_: { ok: boolean; message: string } | null, data: FormData) => contractGraphicSupplierAction(data), null);
  return <form action={action} className="grid gap-4" aria-busy={pending}>
    <p className="text-sm text-muted-foreground">Confirme somente após contratar o fornecedor. O sistema usa o valor da cotação aprovada e cria uma conta a pagar, sem registrar pagamento.</p>
    <input type="hidden" name="jobId" value={jobId} />
    <label className="grid gap-1 text-sm">Cotação a contratar<select className={inputClass} name="quoteId" required value={fields.quoteId} onChange={event => setFields({ ...fields, quoteId: event.target.value })}>{quotes.map(quote => <option key={quote.id} value={quote.id}>{quote.name}</option>)}</select></label>
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="grid gap-1 text-sm">Data da contratação<input className={inputClass} name="contractedAt" type="date" required value={fields.contractedAt} onChange={event => setFields({ ...fields, contractedAt: event.target.value })} /></label>
      <label className="grid gap-1 text-sm">Vencimento do fornecedor<input className={inputClass} name="dueDate" type="date" required value={fields.dueDate} onChange={event => setFields({ ...fields, dueDate: event.target.value })} /></label>
      <label className="grid gap-1 text-sm">Competência do custo<input className={inputClass} name="competence" type="month" required value={fields.competence} onChange={event => setFields({ ...fields, competence: event.target.value })} /></label>
    </div>
    <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm">Categoria do custo<select className={inputClass} name="categoryId" required value={fields.categoryId} onChange={event => setFields({ ...fields, categoryId: event.target.value })}><option value="" disabled>Selecione a categoria</option>{categories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="grid gap-1 text-sm">Centro de custo (opcional)<select className={inputClass} name="costCenterId" value={fields.costCenterId} onChange={event => setFields({ ...fields, costCenterId: event.target.value })}><option value="">Sem centro de custo</option>{centers.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>
    <label className="grid gap-1 text-sm">Condições da contratação (opcional)<textarea className="min-h-20 rounded-md border bg-background px-3 py-2" name="notes" maxLength={1000} value={fields.notes} onChange={event => setFields({ ...fields, notes: event.target.value })} /></label>
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirmed" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Confirmo a contratação e a criação da conta a pagar.</label>
    {result ? <p role={result.ok ? "status" : "alert"} className="text-sm">{result.message}</p> : null}
    <div className="flex justify-end"><button type="submit" disabled={pending || !categories.length} className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{pending ? "Registrando…" : "Contratar fornecedor e criar conta a pagar"}</button></div>
    {!categories.length ? <p role="alert" className="text-sm">Solicite ao Financeiro uma categoria de despesa ativa para continuar.</p> : null}
  </form>;
}
const inputClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

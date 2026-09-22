"use client";
import { useActionState, useState } from "react";
import { registerGraphicSaleAction } from "@/features/graphics/sale-actions";
import { graphicSaleMoney } from "@/features/graphics/sale-rules";
import { formatMoney, moneyToCents, centsToMoney } from "@/features/finance/rules";

export function GraphicSaleForm({ jobId, osVersionId, presentedAmount }: { jobId: string; osVersionId: string; presentedAmount: string }) {
  const [fields, setFields] = useState({ amount: presentedAmount.replace(".", ","), competence: "", notes: "" });
  const [installments, setInstallments] = useState([{ key: 1, label: "Pagamento único", amount: presentedAmount.replace(".", ","), dueDate: "" }]);
  const [nextKey, setNextKey] = useState(2);
  const [confirmed, setConfirmed] = useState(false);
  const [result, action, pending] = useActionState(async (_: { ok: boolean; message: string } | null, data: FormData) => registerGraphicSaleAction(data), null);
  const total = installments.reduce((sum, item) => { const parsed = graphicSaleMoney.safeParse(item.amount); return sum + (parsed.success ? moneyToCents(parsed.data) : 0); }, 0);
  return <form action={action} className="grid gap-4" aria-busy={pending}>
    <p className="text-sm text-muted-foreground">Registre o valor contratado e os vencimentos combinados. Para sinal e saldo, adicione duas parcelas. Esta ação cria contas a receber; dinheiro recebido é registrado pelo Financeiro.</p>
    <input type="hidden" name="jobId" value={jobId} /><input type="hidden" name="osVersionId" value={osVersionId} /><input type="hidden" name="installments" value={JSON.stringify(installments.map(({ label, amount, dueDate }) => ({ label, amount, dueDate })))} />
    <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm">Valor contratado<input className={inputClass} name="amount" required inputMode="decimal" value={fields.amount} onChange={event => setFields({ ...fields, amount: event.target.value })} /></label><label className="grid gap-1 text-sm">Competência da venda<input className={inputClass} name="competence" type="month" required value={fields.competence} onChange={event => setFields({ ...fields, competence: event.target.value })} /></label></div>
    {installments.map((item, index) => <fieldset key={item.key} className="grid gap-3 rounded-md border p-3 sm:grid-cols-3"><legend className="px-1 text-sm font-semibold">Parcela {index + 1}</legend>
      <label className="grid gap-1 text-sm">Descrição da parcela {index + 1}<input className={inputClass} required maxLength={80} value={item.label} onChange={event => setInstallments(installments.map(row => row.key === item.key ? { ...row, label: event.target.value } : row))} /></label>
      <label className="grid gap-1 text-sm">Valor da parcela {index + 1}<input className={inputClass} required inputMode="decimal" value={item.amount} onChange={event => setInstallments(installments.map(row => row.key === item.key ? { ...row, amount: event.target.value } : row))} /></label>
      <label className="grid gap-1 text-sm">Vencimento da parcela {index + 1}<input className={inputClass} required type="date" value={item.dueDate} onChange={event => setInstallments(installments.map(row => row.key === item.key ? { ...row, dueDate: event.target.value } : row))} /></label>
      {installments.length > 1 ? <button type="button" className="text-left text-sm text-destructive underline" onClick={() => setInstallments(installments.filter(row => row.key !== item.key))}>Remover parcela {index + 1}</button> : null}
    </fieldset>)}
    <div className="flex flex-wrap justify-between gap-3 text-sm"><button type="button" className="text-primary underline" disabled={installments.length >= 60 || pending} onClick={() => { setInstallments([...installments, { key: nextKey, label: `Parcela ${installments.length + 1}`, amount: "", dueDate: "" }]); setNextKey(nextKey + 1); }}>Adicionar parcela</button><p aria-live="polite">Soma das parcelas: {formatMoney(centsToMoney(total))}</p></div>
    <label className="grid gap-1 text-sm">Condições da venda (opcional)<textarea className="min-h-20 rounded-md border bg-background px-3 py-2" name="notes" maxLength={1000} value={fields.notes} onChange={event => setFields({ ...fields, notes: event.target.value })} /></label>
    <label className="flex items-center gap-2 text-sm"><input name="confirmed" type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Confirmo as condições comerciais e a criação das contas a receber.</label>
    {result ? <p role={result.ok ? "status" : "alert"} className="text-sm">{result.message}</p> : null}
    <div className="flex justify-end"><button type="submit" disabled={pending} className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50">{pending ? "Registrando…" : "Registrar venda e criar contas a receber"}</button></div>
  </form>;
}
const inputClass = "h-10 w-full rounded-md border bg-background px-3 text-sm";

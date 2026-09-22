"use client";

import { useActionState, useState } from "react";
import { reconcileMovementAction } from "@/features/finance-allocations/actions";
import type { ReconciliationCandidate } from "@/features/finance-allocations/reconciliation";
import { centsToMoney, formatMoney, moneyToCents } from "@/features/finance/rules";

export function ReconciliationForm({ transactionId, remaining, candidates }: { transactionId: string; remaining: string; candidates: ReconciliationCandidate[] }) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [result, action, pending] = useActionState(async (_: { ok: boolean; message: string } | null, data: FormData) => {
    const response = await reconcileMovementAction(data);
    if (response.ok) { setAmounts({}); setConfirmed(false); }
    return response;
  }, null);
  const allocations = candidates.filter(row => amounts[row.id]?.trim()).map(row => ({ targetId: row.id, targetType: row.targetType, amount: amounts[row.id] }));
  const selected = allocations.reduce((sum, item) => /^\d+(?:[.,]\d{1,2})?$/.test(item.amount) ? sum + moneyToCents(item.amount.replace(",", ".")) : sum, 0);
  return <form action={action} className="grid gap-4" aria-busy={pending}>
    <input type="hidden" name="transactionId" value={transactionId} />
    <input type="hidden" name="expectedRemaining" value={remaining} />
    <input type="hidden" name="allocations" value={JSON.stringify(allocations)} />
    <p className="text-sm text-muted-foreground">Informe um valor apenas nos títulos que deseja conciliar. Você pode usar parte do saldo e continuar depois. Sugestões pelo cliente ou fornecedor precisam ser conferidas.</p>
    <div className="grid gap-3">{candidates.map(row => <div key={row.id} className="grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_12rem]">
      <div><p className="font-medium">{row.description}</p><p className="text-sm text-muted-foreground">{row.counterparty ?? "Sem contraparte cadastrada"} · Vencimento {row.dueDate.split("-").reverse().join("/")}</p><p className="text-sm">Saldo do título: {formatMoney(row.remaining)}</p>{row.suggested ? <p className="text-sm text-primary">Possível vínculo: mesma contraparte</p> : null}</div>
      <label className="grid gap-1 text-sm">Valor para {row.description}<input className="fg-input" inputMode="decimal" placeholder="0,00" maxLength={18} value={amounts[row.id] ?? ""} disabled={pending} onChange={event => setAmounts({ ...amounts, [row.id]: event.target.value })} /></label>
    </div>)}</div>
    <p aria-live="polite" className="text-sm">Selecionado: {formatMoney(centsToMoney(selected))} · Disponível na movimentação: {formatMoney(remaining)}</p>
    {selected > moneyToCents(remaining) ? <p role="alert" className="text-sm text-destructive">A soma excede o saldo disponível da movimentação.</p> : null}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="confirmed" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Conferi os títulos e valores e confirmo a conciliação.</label>
    {result ? <p role={result.ok ? "status" : "alert"} className="text-sm">{result.message}</p> : null}
    <button className="justify-self-end rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50" disabled={pending || !allocations.length || selected > moneyToCents(remaining) || allocations.length > 100} type="submit">{pending ? "Conciliando…" : "Confirmar conciliação"}</button>
  </form>;
}

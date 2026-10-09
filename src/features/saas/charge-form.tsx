"use client";

import { startTransition, useActionState } from "react";

import { recordSaasChargeAction } from "./actions";
import type { SaasBilling } from "./billing-rules";

type Result = { ok: boolean; message: string } | null;

export function SaasChargeForm({ subscriptionId, billing }: { subscriptionId: string; billing: SaasBilling | null }) {
  const [result, submit, pending] = useActionState(async (_state: Result, data: FormData) => recordSaasChargeAction(data), null);
  const today = new Date().toISOString().slice(0, 10);
  return <form className="fg-form" aria-busy={pending} onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => submit(data));
  }}>
    <fieldset disabled={pending} className="fg-form">
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      <div className="fg-form-row">
        <label className="fg-field">Competência<span className="fg-required">*</span><input className="fg-input" type="month" name="competence" required /></label>
        <label className="fg-field">Data da cobrança<span className="fg-required">*</span><input className="fg-input" type="date" name="chargedAt" defaultValue={today} required /></label>
        <label className="fg-field">Vencimento da saída<span className="fg-required">*</span><input className="fg-input" type="date" name="dueDate" defaultValue={today} required /></label>
      </div>
      <div className="fg-form-row">
        <label className="fg-field">Moeda original<span className="fg-required">*</span><select className="fg-input fg-select" name="originalCurrency" defaultValue={billing?.billingCurrency ?? "BRL"} required><option value="BRL">BRL</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
        <label className="fg-field">Valor original<span className="fg-required">*</span><input className="fg-input" name="originalAmount" inputMode="decimal" defaultValue={billing?.cycleAmount ?? ""} placeholder="0,00" required /></label>
        <label className="fg-field">Cotação efetiva (R$/un.)<span className="fg-required">*</span><input className="fg-input" name="effectiveExchangeRate" inputMode="decimal" defaultValue={billing?.billingCurrency === "BRL" ? "1" : billing?.estimatedExchangeRate ?? ""} placeholder="1,000000" required /></label>
      </div>
      <div className="fg-form-row">
        <label className="fg-field">IOF em BRL<input className="fg-input" name="iofAmountBrl" inputMode="decimal" defaultValue="0,00" required /></label>
        <label className="fg-field">Tarifas em BRL<input className="fg-input" name="feeAmountBrl" inputMode="decimal" defaultValue="0,00" required /></label>
        <label className="fg-field">Total da fatura em BRL<span className="fg-required">*</span><input className="fg-input" name="totalAmountBrl" inputMode="decimal" placeholder="0,00" required /></label>
      </div>
      <label className="fg-field">O total informado já inclui IOF e tarifas?<span className="fg-required">*</span><select className="fg-input fg-select" name="chargesIncludedInTotal" defaultValue="true" required><option value="true">Sim — usar exatamente o total da fatura</option><option value="false">Não — calcular principal + IOF + tarifas</option></select></label>
      <label className="fg-field">Observação<textarea className="fg-input fg-textarea" name="notes" maxLength={1000} rows={3} placeholder="Ex.: fatura do cartão, taxa efetiva do dia e comprovante." /></label>
      <p className="fg-muted">A cobrança gera uma conta a pagar única no Financeiro. O câmbio efetivo e os encargos ficam congelados nesta competência; não alteram cobranças anteriores.</p>
      <button className="fg-btn fg-btn-primary" type="submit">{pending ? "Registrando…" : "Registrar cobrança"}</button>
    </fieldset>
    {result ? <p role={result.ok ? "status" : "alert"}>{result.message}</p> : null}
  </form>;
}

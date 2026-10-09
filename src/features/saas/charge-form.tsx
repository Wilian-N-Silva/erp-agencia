"use client";

import { startTransition, useActionState } from "react";

import { recordSaasChargeAction } from "./actions";
import { correctSaasChargeAction } from "./charge-correction-actions";
import type { SaasChargeRecord } from "./charge-dal";
import type { SaasBilling } from "./billing-rules";

type Result = { ok: boolean; message: string } | null;

export function SaasChargeForm({ subscriptionId, billing, initialCharge }: { subscriptionId: string; billing: SaasBilling | null; initialCharge?: SaasChargeRecord }) {
  const [result, submit, pending] = useActionState(async (_state: Result, data: FormData) => initialCharge ? correctSaasChargeAction(data) : recordSaasChargeAction(data), null);
  const today = new Date().toISOString().slice(0, 10);
  return <form className="fg-form" aria-busy={pending} onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => submit(data));
  }}>
    <fieldset disabled={pending} className="fg-form">
      <input type="hidden" name="subscriptionId" value={subscriptionId} />
      {initialCharge ? <><input type="hidden" name="chargeId" value={initialCharge.id} /><input type="hidden" name="revision" value={initialCharge.revision} /></> : null}
      <div className="fg-form-row">
        <label className="fg-field">Competência<span className="fg-required">*</span><input className="fg-input" type="month" name="competence" defaultValue={initialCharge?.competence} readOnly={!!initialCharge} required /></label>
        <label className="fg-field">Data da cobrança<span className="fg-required">*</span><input className="fg-input" type="date" name="chargedAt" defaultValue={initialCharge?.chargedAt ?? today} required /></label>
        <label className="fg-field">Vencimento da saída<span className="fg-required">*</span><input className="fg-input" type="date" name="dueDate" defaultValue={initialCharge?.dueDate ?? today} required /></label>
      </div>
      <div className="fg-form-row">
        <label className="fg-field">Moeda original<span className="fg-required">*</span><select className="fg-input fg-select" name="originalCurrency" defaultValue={initialCharge?.originalCurrency ?? billing?.billingCurrency ?? "BRL"} required><option value="BRL">BRL</option><option value="USD">USD</option><option value="EUR">EUR</option></select></label>
        <label className="fg-field">Valor original<span className="fg-required">*</span><input className="fg-input" name="originalAmount" inputMode="decimal" defaultValue={initialCharge?.originalAmount ?? billing?.cycleAmount ?? ""} placeholder="0,00" required /></label>
        <label className="fg-field">Cotação efetiva (R$/un.)<span className="fg-required">*</span><input className="fg-input" name="effectiveExchangeRate" inputMode="decimal" defaultValue={initialCharge?.effectiveExchangeRate ?? (billing?.billingCurrency === "BRL" ? "1" : billing?.estimatedExchangeRate ?? "")} placeholder="1,000000" required /></label>
      </div>
      <div className="fg-form-row">
        <label className="fg-field">IOF em BRL<input className="fg-input" name="iofAmountBrl" inputMode="decimal" defaultValue={initialCharge?.iofAmountBrl ?? "0,00"} required /></label>
        <label className="fg-field">Tarifas em BRL<input className="fg-input" name="feeAmountBrl" inputMode="decimal" defaultValue={initialCharge?.feeAmountBrl ?? "0,00"} required /></label>
        <label className="fg-field">Total da fatura em BRL<span className="fg-required">*</span><input className="fg-input" name="totalAmountBrl" inputMode="decimal" defaultValue={initialCharge?.totalAmountBrl} placeholder="0,00" required /></label>
      </div>
      <label className="fg-field">O total informado já inclui IOF e tarifas?<span className="fg-required">*</span><select className="fg-input fg-select" name="chargesIncludedInTotal" defaultValue={initialCharge ? String(initialCharge.chargesIncludedInTotal) : "true"} required><option value="true">Sim — usar exatamente o total da fatura</option><option value="false">Não — calcular principal + IOF + tarifas</option></select></label>
      <label className="fg-field">Observação<textarea className="fg-input fg-textarea" name="notes" defaultValue={initialCharge?.notes ?? ""} maxLength={1000} rows={3} placeholder="Ex.: fatura do cartão, taxa efetiva do dia e comprovante." /></label>
      {initialCharge ? <label className="fg-field">Motivo da correção<textarea className="fg-input" name="reason" minLength={5} maxLength={1000} required /></label> : null}
      <p className="fg-muted">{initialCharge ? "A correção exige conferência e motivo. Mantém a mesma AP e competência, preserva os valores anteriores na auditoria e não altera a estimativa do contrato. Estorne a liquidação ou revise a reserva antiga antes de corrigir." : "A cobrança gera uma conta a pagar única no Financeiro. O câmbio efetivo e os encargos ficam congelados nesta competência; não alteram cobranças anteriores."}</p>
      <button className="fg-btn fg-btn-primary" type="submit">{pending ? "Salvando…" : initialCharge ? "Salvar correção da cobrança" : "Registrar cobrança"}</button>
    </fieldset>
    {result ? <p role={result.ok ? "status" : "alert"}>{result.message}</p> : null}
  </form>;
}

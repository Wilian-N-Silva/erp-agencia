import type { SaasBilling } from "./billing-rules";

export function SaasBillingFields({ billing }: { billing?: SaasBilling | null }) {
  return <fieldset className="fg-form" style={{ border: 0, padding: 0 }}>
    <legend>Valor e periodicidade</legend>
    <div className="fg-form-row">
      <label className="fg-field">Moeda
        <select aria-label="Moeda" className="fg-input" name="billingCurrency" defaultValue={billing?.billingCurrency ?? "BRL"}>
          <option value="BRL">Real (BRL)</option><option value="USD">Dólar (USD)</option><option value="EUR">Euro (EUR)</option>
        </select>
      </label>
      <label className="fg-field">Periodicidade
        <select aria-label="Periodicidade" className="fg-input" name="billingCycle" defaultValue={billing?.billingCycle ?? "monthly"}>
          <option value="monthly">Mensal</option><option value="annual">Anual</option>
        </select>
      </label>
      <label className="fg-field">Valor por ciclo na moeda selecionada
        <input className="fg-input" name="cycleAmount" inputMode="decimal" defaultValue={billing?.cycleAmount ?? ""} placeholder="Ex.: 120,00" />
      </label>
    </div>
    <details>
      <summary>Cotação estimada para USD ou EUR</summary>
      <p>Informe quantos reais equivalem a uma unidade da moeda. Para BRL, estes campos são ignorados. Sem cotação, o custo em reais fica pendente.</p>
      <label className="fg-field">Cotação estimada em reais
        <input className="fg-input" name="estimatedExchangeRate" inputMode="decimal" defaultValue={billing?.estimatedExchangeRate ?? ""} placeholder="Ex.: 5,123456" />
      </label>
      <label className="fg-field">Data da cotação
        <input className="fg-input" name="exchangeRateDate" type="date" defaultValue={billing?.exchangeRateDate ?? ""} />
      </label>
      <label className="fg-field">Fonte da cotação
        <input className="fg-input" name="exchangeRateSource" maxLength={160} defaultValue={billing?.exchangeRateSource ?? ""} placeholder="Ex.: simulação do cartão" />
      </label>
    </details>
    <p className="fg-muted">Estimativa sem IOF ou tarifas. O valor efetivo deve ser conferido na fatura. No ciclo anual, o equivalente mensal é o total anual dividido por 12; não representa doze cobranças.</p>
  </fieldset>;
}

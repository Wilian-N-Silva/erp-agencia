"use client";

import { useActionState, useState } from "react";
import { ActionSheet, Card, MoneyInput } from "@/components/fg";
import { formatMoney } from "@/features/finance/rules";
import { approvePjAction, configurePjApproverAction, rejectPjAction, requestPjAction } from "./pj-actions";
import { pjDefaultDays, suggestPjSale } from "./pj-policy-rules";
import type { getOwnPjPolicy } from "./pj-policy";

function Result({ state }: { state: { error?: string; success?: string } | null }) {
  return state?.error ? <p role="alert">{state.error}</p> : state?.success ? <p role="status">{state.success}</p> : null;
}

function availableSuggestion(base: string | null, days: number) {
  if (!base) return null;
  try { return suggestPjSale(base, days); }
  catch { return null; }
}

export function PjCalculation({ base, days }: { base: string; days: number }) {
  const valid = Number.isInteger(days) && days > 0 && days <= 3650;
  const suggestion = valid ? availableSuggestion(base, days) : null;
  return <ActionSheet title="Como calculamos a sugestão" trigger={<span className="fg-btn fg-btn-outline fg-btn-sm">Ver cálculo da sugestão</span>}>
    <p>Base: remuneração mensal atual registrada no cadastro, mesmo que o contrato ainda tenha o valor antigo.</p>
    <p><strong>{formatMoney(base)} ÷ 30 × {valid ? days : "—"} dias = {suggestion ? formatMoney(suggestion.amount) : "—"}</strong></p>
    <p>Ajuda de custo, transporte e reembolsos não entram na base. A diária não é arredondada antes da multiplicação; apenas o resultado final é arredondado para centavos.</p>
    <p>A sugestão será recalculada com a remuneração vigente na aprovação. A Jaci pode confirmar outro valor combinado, informando o motivo.</p>
  </ActionSheet>;
}

export function PjOwnPanel({ policy }: { policy: Awaited<ReturnType<typeof getOwnPjPolicy>> }) {
  const [kind, setKind] = useState<"rest" | "sale">("rest");
  const [days, setDays] = useState(pjDefaultDays);
  const [start, setStart] = useState("");
  const [state, action, pending] = useActionState(requestPjAction, null);
  const validDays = Number.isInteger(days) && days >= 1 && days <= 3650;
  const end = start && validDays ? new Date(Date.parse(`${start}T12:00:00Z`) + (days - 1) * 86_400_000).toISOString().slice(0, 10) : "";
  return <Card title="Saldo e solicitação PJ" description="30 dias por ano completo de vínculo, com acúmulo. Pedidos pendentes reservam saldo; recusa libera a reserva.">
    <p>Adquiridos: {policy.balance.acquired} · Reservados: {policy.balance.reserved} · Descanso aprovado: {policy.balance.used} · Vendidos: {policy.balance.sold} · <strong>Disponíveis: {policy.balance.available}</strong></p>
    <form action={action} className="fg-form">
      <label className="fg-field">Solicitação<select className="fg-input fg-select" name="kind" value={kind} onChange={e => setKind(e.target.value as "rest" | "sale")}><option value="rest">Descanso remunerado</option><option value="sale">Venda de dias</option></select></label>
      <label className="fg-field">Quantidade de dias<input className="fg-input" type="number" min={1} max={3650} step={1} name={kind === "sale" ? "days" : undefined} value={days} onChange={e => setDays(Number(e.target.value))} required /></label>
      {kind === "rest" ? <><label className="fg-field">Início do descanso<input className="fg-input" name="startDate" type="date" value={start} onChange={e => setStart(e.target.value)} required /></label><label className="fg-field">Fim do descanso (dias corridos)<input className="fg-input" name="endDate" type="date" value={end} readOnly required /></label></> : policy.baseAmount ? <PjCalculation base={policy.baseAmount} days={days} /> : <p>O cálculo será conferido pela responsável na aprovação.</p>}
      <label className="fg-field">Combinado / observações<textarea className="fg-input fg-textarea" name="notes" maxLength={1000} minLength={kind === "sale" || days !== 15 ? 5 : undefined} required={kind === "sale" || days !== 15} /></label>
      <Result state={state} />
      <button className="fg-btn fg-btn-primary" disabled={pending || !validDays} type="submit">{pending ? "Enviando…" : "Solicitar à Jaci"}</button>
    </form>
    {policy.sales.length ? <ul>{policy.sales.map(sale => <li key={sale.id}>Venda de {sale.days} dias · {({ requested: "Aguardando aprovação", approved: "Aprovada", rejected: "Recusada", cancelled: "Cancelada" } as Record<string, string>)[sale.status]}{sale.approvedAmount ? ` · Valor autorizado: ${formatMoney(sale.approvedAmount)}` : ""}</li>)}</ul> : null}
  </Card>;
}

export function PjReviewForm({ id, base, days, sale }: { id: string; base: string | null; days: number; sale: boolean }) {
  const [state, action, approving] = useActionState(approvePjAction, null);
  const [rejection, reject, rejecting] = useActionState(rejectPjAction, null);
  const pending = approving || rejecting;
  const suggestion = availableSuggestion(base, days);
  return <form action={action} className="fg-form">
    <input name="id" type="hidden" value={id} />
    {sale && base && suggestion ? <><PjCalculation base={base} days={days} /><label className="fg-field">Valor autorizado<MoneyInput name="amount" /></label><p>Sugestão atual: {formatMoney(suggestion.amount)}. Preencha o valor que deseja autorizar.</p></> : sale ? <p>Confira a remuneração atual e a permissão para consultá-la antes de aprovar o valor.</p> : null}
    <label className="fg-field">Observação da decisão<textarea name="note" className="fg-input fg-textarea" maxLength={1000} /></label>
    <Result state={state} />
    <Result state={rejection} />
    <button className="fg-btn fg-btn-primary" type="submit" disabled={pending || (sale && !suggestion)}>Aprovar solicitação</button>
    <button className="fg-btn fg-btn-outline" type="submit" formAction={reject} disabled={pending}>Recusar solicitação</button>
  </form>;
}

export function PjApproverForm({ users, current }: { users: { id: string; name: string }[]; current: string | null }) {
  const [state, action, pending] = useActionState(configurePjApproverAction, null);
  return <form action={action} className="fg-form"><label className="fg-field">Usuária responsável pelas aprovações PJ (Jaci)<select className="fg-input fg-select" name="userId" defaultValue={current ?? ""} required><option value="">Selecione a conta da Jaci</option>{users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label><p>A conta também precisa da permissão de alteração de férias; para aprovar valores, precisa de leitura de remuneração.</p><Result state={state} /><button className="fg-btn fg-btn-outline" disabled={pending} type="submit">Salvar responsável PJ</button></form>;
}

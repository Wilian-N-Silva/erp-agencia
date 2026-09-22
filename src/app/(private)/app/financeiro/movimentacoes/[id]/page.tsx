import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Card, Page, PageHeader } from "@/components/fg";
import { getReconciliation } from "@/features/finance-allocations/reconciliation";
import { formatMoney, moneyToCents } from "@/features/finance/rules";
import { financialTransactionStatusLabels, type FinancialTransactionStatus } from "@/features/finance-transactions/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";
import { ReconciliationForm } from "./reconciliation-form";

export const dynamic = "force-dynamic";
export default async function ReconciliationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string | string[] }> }) {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!canAny(["finance.read", "finance.write", "finance.settle"], context)) redirect("/acesso-negado");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.slice(0, 100) : "";
  const data = await getReconciliation(context, { transactionId: id, query });
  if (!data) notFound();
  return <Page>
    <PageHeader eyebrow="Financeiro" title="Conciliar movimentação" description="Relacione o dinheiro movimentado às contas a receber ou pagar." />
    <Link href="/app/financeiro/movimentacoes" className="text-sm text-primary underline">Voltar às movimentações</Link>
    <Card className="mt-5" title={data.movement.direction === "in" ? "Entrada de dinheiro" : "Saída de dinheiro"}>
      <p>{formatMoney(data.movement.amount)} · {financialTransactionStatusLabels[data.movement.status as FinancialTransactionStatus]}</p>
      <p className="text-sm">Referência: {data.movement.reference ?? "Não informada"} · {data.movement.occurredAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
      <p className="font-medium">Saldo a conciliar: {formatMoney(data.remaining)}</p>
    </Card>
    <Card className="mt-5" title="Vínculos confirmados">
      {data.allocations.length ? <ul className="space-y-2">{data.allocations.map(row => <li key={row.id}>{row.description} · {formatMoney(row.amount)}</li>)}</ul> : <p className="text-sm text-muted-foreground">Nenhum vínculo confirmado.</p>}
    </Card>
    {data.movement.status !== "reversed" && moneyToCents(data.remaining) > 0 ? <Card className="mt-5" title="Escolher títulos">
      <form className="mb-5 flex flex-wrap items-end gap-2"><label className="grid gap-1 text-sm">Buscar por descrição, código do trabalho ou contraparte<input className="fg-input" name="q" maxLength={100} defaultValue={query} /></label><button className="rounded-md border px-3 py-2" type="submit">Buscar títulos</button></form>
      {data.truncated ? <p className="mb-3 text-sm">Exibindo os primeiros 200 títulos. Refine a busca para localizar outros.</p> : null}
      {data.candidates.length ? can("finance.settle", context) ? <ReconciliationForm key={`${data.remaining}:${query}`} transactionId={id} remaining={data.remaining} candidates={data.candidates} /> : <p>Solicite a um usuário do Financeiro com permissão de liquidação para confirmar os vínculos.</p> : <p>Nenhum título aberto encontrado. Confira a busca ou cadastre a conta a receber/pagar antes de conciliar.</p>}
    </Card> : null}
  </Page>;
}

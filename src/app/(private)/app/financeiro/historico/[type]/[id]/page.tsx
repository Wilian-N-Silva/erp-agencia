import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, Page, PageHeader } from "@/components/fg";
import { getFinancialLegacyReview, legacyReviewOwnerSchema } from "@/features/finance/legacy-review";
import { formatMoney, moneyToCents } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { AccessDeniedError, can, canAny } from "@/lib/rbac";
import { LegacyReviewForm } from "./review-form";

export const dynamic = "force-dynamic";
export default async function LegacyReviewPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!canAny(["finance.read", "finance.write", "finance.settle", "finance.reverse"], context)) redirect("/acesso-negado");
  const parsed = legacyReviewOwnerSchema.safeParse(await params);
  if (!parsed.success) notFound();
  let review;
  try { review = await getFinancialLegacyReview(context, parsed.data); }
  catch (error) { if (error instanceof AccessDeniedError) notFound(); throw error; }
  const { title, history } = review;
  return <Page>
    <PageHeader eyebrow="Financeiro" title="Revisão do histórico financeiro" description={title.description} />
    <Link href={parsed.data.type === "receivable" ? "/app/financeiro/entradas" : "/app/financeiro/saidas"}>Voltar ao Financeiro</Link>
    <Card title="Reserva e movimentações confirmadas">
      <p>Reserva original preservada: {formatMoney(title.originalReserve)}</p><p>Reserva ainda disponível: {formatMoney(title.reserved)}</p><p>Conciliado em movimentos ativos: {formatMoney(title.confirmedAmount)}</p>
      <p>A reserva antiga evita pagamentos duplicados, mas não comprova dinheiro movimentado. Libere somente um valor conferido que não deve continuar reservado. Os registros originais e as revisões permanecem disponíveis.</p>
      <Link href={`/app/financeiro/anexos/${parsed.data.type === "receivable" ? "financial_entry" : "financial_expense"}/${parsed.data.id}`}>Consultar ou anexar evidências</Link>
    </Card>
    {can("finance.reverse", context) && moneyToCents(title.reserved) > 0 ? <Card title="Registrar liberação conferida"><LegacyReviewForm {...parsed.data} requestId={randomUUID()} reserved={title.reserved} /></Card> : null}
    <Card title="Histórico de revisões">{history.length ? <ul>{history.map(row => <li key={row.id} className="py-3"><p>{formatMoney(row.amount)} liberados em {row.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p><p>Motivo: {row.reason}</p><p>Evidência: {row.evidence}</p></li>)}</ul> : <p>Nenhuma revisão registrada.</p>}</Card>
  </Page>;
}

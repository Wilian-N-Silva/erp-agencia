import Link from "next/link";
import { redirect } from "next/navigation";
import { Page, PageHeader, Card } from "@/components/fg";
import { getCashReport } from "@/features/finance/cash-report";
import { formatMoney } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { can } from "@/lib/rbac";
import { isoMonthSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function FinancialReportsPage({ searchParams }: {
  searchParams: Promise<{ month?: string }>;
}) {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!can("finance.read", context)) redirect("/acesso-negado");
  const query = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const month = isoMonthSchema.safeParse(query.month);
  const report = await getCashReport(context, { month: month.success ? month.data : today.slice(0, 7) });
  return <Page>
    <PageHeader eyebrow="Financeiro" title="Relatório de caixa" description="Movimentações por data efetiva, no horário de São Paulo. Obrigações e provisões não são movimentações de dinheiro." />
    <form method="get" className="fg-form">
      <label className="fg-label">Mês do caixa<input type="month" name="month" defaultValue={report.month} required className="fg-input" /></label>
      <button type="submit" className="fg-btn fg-btn-primary fg-btn-default">Consultar caixa</button>
    </form>
    <p>Saldo registrado = saldo inicial informado na conta + entradas − saídas − estornos de entradas + estornos de saídas. O saldo inicial é a referência anterior às movimentações registradas; não é um extrato bancário.</p>
    <p>Movimentações pendentes de conciliação participam do caixa. Conciliação identifica obrigações e não soma dinheiro novamente. Estornos aparecem no mês em que foram registrados.</p>
    <Card title={`Caixa de ${report.month}`}>
      {report.accounts.length ? <div style={{ overflowX: "auto" }}><table className="fg-table">
        <thead><tr><th>Conta</th><th>Saldo anterior</th><th>Entradas</th><th>Saídas</th><th>Estornos de entradas</th><th>Estornos de saídas</th><th>Resultado do mês</th><th>Saldo registrado</th></tr></thead>
        <tbody>{report.accounts.map(account => <tr key={account.id}>
          <th scope="row">{account.name}{account.untracedReversals > 0 ? <p role="alert">Histórico exige revisão: {account.untracedReversals} estorno(s) sem evento auditável. Saldo não validado.</p> : null}</th>
          {[account.opening, account.income, account.expense, account.reversedIncome, account.reversedExpense, account.net, account.closing].map((value, index) => <td key={index}>{formatMoney(value)}</td>)}
        </tr>)}</tbody>
      </table></div> : <p>Nenhuma conta financeira cadastrada.</p>}
    </Card>
    <Link href="/app/financeiro/entradas">Consultar obrigações por competência</Link>
    <Link href="/app/financeiro/movimentacoes">Consultar movimentações e conciliação</Link>
  </Page>;
}

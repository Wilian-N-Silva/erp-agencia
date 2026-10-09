import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Page, PageHeader } from "@/components/fg";
import { getFinanceDashboard } from "@/features/finance/dal";
import { getFinanceMasterData } from "@/features/finance-master-data/dal";
import { formatCompetence, formatDate, formatMoney } from "@/features/finance/rules";
import { listProvisionCycles } from "@/features/provisions/dal";
import { CancelProvisionForm, CorrectRealizedProvisionForm, PlanProvisionForm, RealizeProvisionForm } from "@/features/provisions/forms";
import { getCurrentAccessContext } from "@/lib/dal";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function ProvisionCyclesPage() {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!can("finance.read", context)) redirect("/acesso-negado");
  const canWrite = can("finance.write", context);
  const [dashboard, cycles, master] = await Promise.all([
    getFinanceDashboard(context), listProvisionCycles(context), canWrite ? getFinanceMasterData(context) : Promise.resolve(null),
  ]);
  const names = new Map(dashboard.provisions.map(item => [item.id, item.name]));
  const active = dashboard.provisions.filter(item => item.status === "active" && (item.recurring || !cycles.some(cycle => cycle.provisionId === item.id)));
  const suppliers = master?.suppliers.filter(item => item.isActive).map(({ id, name }) => ({ id, name })) ?? [];
  return <Page>
    <PageHeader title="Ocorrências de provisões" description="Confira previsões por competência e transforme cobranças confirmadas em contas a pagar." />
    <Link className="text-primary underline" href="/app/financeiro/provisoes">Voltar às provisões</Link>
    {canWrite ? <Card title="Planejar ocorrência" className="mt-5">
      {active.length ? <PlanProvisionForm provisions={active.map(({ id, name }) => ({ id, name }))} /> : <p>Cadastre uma provisão ativa para planejar uma ocorrência.</p>}
    </Card> : null}
    <div className="mt-5 grid gap-4">
      {!cycles.length ? <p>Nenhuma ocorrência planejada. As recorrências cadastradas continuam como estimativas no Financeiro.</p> : null}
      {cycles.map(cycle => <section key={cycle.id} aria-label={`${names.get(cycle.provisionId) ?? "Provisão histórica"} · ${formatCompetence(cycle.competence)}`}>
        <Card title={`${names.get(cycle.provisionId) ?? "Provisão histórica"} · ${formatCompetence(cycle.competence)}`}>
          <p>Estado: {cycle.status === "realized" ? "Realizada" : cycle.status === "cancelled" ? "Cancelada" : "Planejada"}</p>
          <p>Estimativa original: {formatMoney(cycle.estimatedAmount)} · Vencimento previsto: {formatDate(cycle.dueDate)}</p>
          {cycle.cancellationReason ? <p>Motivo: {cycle.cancellationReason}</p> : null}
          {cycle.financialExpenseId ? <p className="mt-3"><Link className="text-primary underline" href={`/app/financeiro/saidas?q=${encodeURIComponent(`Provisão ${cycle.competence} · ${names.get(cycle.provisionId) ?? ""}`)}`}>Consultar conta a pagar</Link>. Pagamento acompanhado pelas movimentações e conciliações.</p> : null}
          {canWrite && can("finance.reverse", context) && cycle.status === "realized" && cycle.actualAmount && cycle.actualDueDate ? <details className="mt-4"><summary className="cursor-pointer font-medium">Corrigir cobrança realizada</summary><div className="mt-3"><CorrectRealizedProvisionForm id={cycle.id} amount={cycle.actualAmount} dueDate={cycle.actualDueDate} /></div></details> : null}
          {canWrite && cycle.status === "planned" ? <div className="mt-4 grid gap-4">
            <details><summary className="cursor-pointer font-medium">Realizar ocorrência</summary><div className="mt-3">{suppliers.length ? <RealizeProvisionForm id={cycle.id} amount={cycle.estimatedAmount} dueDate={cycle.dueDate} suppliers={suppliers} /> : <p>Cadastre um fornecedor ativo no Financeiro antes de realizar a ocorrência.</p>}</div></details>
            <details><summary className="cursor-pointer font-medium">Cancelar previsão</summary><div className="mt-3"><CancelProvisionForm id={cycle.id} /></div></details>
          </div> : null}
        </Card>
      </section>)}
    </div>
  </Page>;
}

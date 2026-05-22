import { redirect } from "next/navigation";

import { listClients } from "@/features/clients/dal";
import {
  canReadClientFinancialValues,
  canWriteClients,
  getClientPaymentStatus,
  normalizeClientFilters,
} from "@/features/clients/rules";
import { getFinanceDashboard } from "@/features/finance/dal";
import {
  centsToMoney,
  formatMoney,
  moneyToCents,
  toDateKey,
} from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";

import {
  ClientRowMenu,
  ClientsView,
  type ClientKpis,
  type ClientMonthlyStatus,
} from "./clients-view";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ClientsPage({ searchParams }: PageProps) {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!canAny(["clients.read", "clients.read_limited", "clients.configure"], context)) {
    redirect("/acesso-negado");
  }

  const filters = normalizeClientFilters((await searchParams) ?? {});
  const [clients, financeDashboard] = await Promise.all([
    listClients(context, filters),
    can("finance.read", context)
      ? getFinanceDashboard(context, { filters: {} })
      : Promise.resolve(null),
  ]);

  const canWrite = canWriteClients(context);
  const canReadFinance = canReadClientFinancialValues(context);

  const today = new Date();
  const todayKey = toDateKey(today);
  const currentCompetenceKey = todayKey.slice(0, 7);

  // Build per-client monthly status from finance dashboard entries
  const monthlyByClient: Record<string, ClientMonthlyStatus> = {};
  if (financeDashboard) {
    const entriesByClient = new Map<string, typeof financeDashboard.entries>();
    for (const entry of financeDashboard.entries) {
      if (!entry.clientId) continue;
      const list = entriesByClient.get(entry.clientId) ?? [];
      list.push(entry);
      entriesByClient.set(entry.clientId, list);
    }

    for (const [clientId, entries] of entriesByClient.entries()) {
      const currentMonthEntries = entries.filter((entry) => {
        const competence =
          typeof entry.competence === "string"
            ? entry.competence.slice(0, 7)
            : toDateKey(entry.competence).slice(0, 7);
        return competence === currentCompetenceKey;
      });
      const statuses = currentMonthEntries.map((e) =>
        getClientPaymentStatus(
          {
            amount: e.amount,
            receivedAmount: e.receivedAmount,
            dueDate: e.dueDate,
            receivedDate: e.receivedDate,
            status: e.status,
          },
          today,
        ),
      );
      const allStatuses = entries.map((e) =>
        getClientPaymentStatus(
          {
            amount: e.amount,
            receivedAmount: e.receivedAmount,
            dueDate: e.dueDate,
            receivedDate: e.receivedDate,
            status: e.status,
          },
          today,
        ),
      );
      const openCount = statuses.filter(
        (s) => s !== "received" && s !== "cancelled",
      ).length;
      const hasOverdue = allStatuses.includes("overdue");
      const nextDueDate =
        entries
          .map((entry, index) => ({
            dueDate: toDateKey(entry.dueDate),
            status: allStatuses[index],
          }))
          .filter(
            (entry) =>
              entry.status !== "received" && entry.status !== "cancelled",
          )
          .map((entry) => entry.dueDate)
          .sort()[0] ?? null;
      let resolved:
        | "received"
        | "overdue"
        | "due_today"
        | "partial"
        | "planned"
        | "cancelled"
        | "not_generated";
      if (currentMonthEntries.length === 0) resolved = "not_generated";
      else if (statuses.includes("partial")) resolved = "partial";
      else if (statuses.includes("overdue")) resolved = "overdue";
      else if (statuses.includes("due_today")) resolved = "due_today";
      else if (statuses.includes("planned")) resolved = "planned";
      else if (statuses.every((s) => s === "received")) resolved = "received";
      else resolved = "cancelled";

      monthlyByClient[clientId] = {
        status: resolved,
        openCount,
        hasOverdue,
        nextDueDate,
      };
    }
  }

  const feeRecorrenteCents = clients
    .filter((c) => c.status === "active" && !c.valueHidden)
    .reduce((sum, c) => sum + moneyToCents(c.monthlyFee), 0);

  const kpis: ClientKpis = {
    feeRecorrente: canReadFinance
      ? formatMoney(centsToMoney(feeRecorrenteCents))
      : "—",
    feeHidden: !canReadFinance,
    contractsActive: clients.filter((c) => c.status === "active").length,
    clientsOverdue: Object.values(monthlyByClient).filter((item) => item.hasOverdue)
      .length,
    aReceberMes: financeDashboard
      ? formatMoney(financeDashboard.totals.incomeExpected)
      : "—",
    recebidoMes: financeDashboard
      ? formatMoney(financeDashboard.totals.incomeReceived)
      : "—",
    emAtraso: financeDashboard
      ? formatMoney(financeDashboard.totals.incomeOverdue)
      : "—",
  };

  const rowActions: Record<string, React.ReactNode> = {};
  for (const client of clients) {
    rowActions[client.id] = (
      <ClientRowMenu
        clientId={client.id}
        status={client.status}
        canWrite={canWrite}
      />
    );
  }

  return (
    <ClientsView
      clients={clients}
      canWrite={canWrite}
      monthlyByClient={monthlyByClient}
      kpis={kpis}
      rowActions={rowActions}
      newClientHref="/app/clientes/novo"
    />
  );
}

import {
  AlertOctagon,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Cake,
  CalendarClock,
  ClipboardList,
  KeyRound,
  Laptop,
  Plus,
  UserMinus,
  UserPlus,
  Wallet,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { KpiCard, StatusBadge } from "@/components/fg";
import { Card, EmptyState } from "@/components/fg/atoms";
import { listAccessReviewAlerts } from "@/features/accesses/dal";
import { listClientPaymentAlerts } from "@/features/clients/dal";
import { clientReminderKindLabels } from "@/features/clients/rules";
import { listEquipmentReturnAlerts } from "@/features/equipment/dal";
import {
  getFinanceDashboard,
  type FinanceEntryListItem,
  type FinanceExpenseListItem,
} from "@/features/finance/dal";
import {
  addDaysToDateKey,
  centsToMoney,
  financialEntryStatusLabels,
  financialExpenseStatusLabels,
  formatCompetence,
  formatDate,
  formatMoney,
  moneyToCents,
  toDateKey,
} from "@/features/finance/rules";
import { listLifecycleDashboardItems } from "@/features/lifecycle/dal";
import { lifecycleTypeLabels } from "@/features/lifecycle/rules";
import { listUpcomingBirthdays } from "@/features/people/dal";
import {
  listInvoiceRequests,
  listReimbursements,
  type InvoiceRequestListItem,
  type ReimbursementListItem,
} from "@/features/portal/dal";
import {
  invoiceRequestStatusLabels,
  reimbursementStatusLabels,
} from "@/features/portal/rules";
import { listSaasRenewalAlerts } from "@/features/saas/dal";
import { getCurrentSession } from "@/lib/auth/session";
import { getCurrentAccessContext } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type BadgeTone =
  | "success"
  | "warning"
  | "warning-soft"
  | "danger"
  | "muted"
  | "brand";

const ACTION_LINK = "fg-btn fg-btn-ghost fg-btn-sm";
const OUTLINE_LINK = "fg-btn fg-btn-outline fg-btn-sm";
const PRIMARY_LINK = "fg-btn fg-btn-primary fg-btn-sm";

function greetingForHour(d: Date) {
  const h = d.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

const DAY_NAMES = [
  "domingo",
  "segunda-feira",
  "terca-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sabado",
];

const MONTH_NAMES = [
  "janeiro",
  "fevereiro",
  "marco",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

function formatLongDate(d: Date) {
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

function formatDayMonth(value: string | Date | null | undefined) {
  if (!value) return "-";
  const [, month, day] = toDateKey(value).split("-");
  return month && day ? `${day}/${month}` : "-";
}

function moneyFromCents(cents: number) {
  return formatMoney(centsToMoney(cents));
}

function obligationOutstandingCents(
  obligation: Pick<FinanceEntryListItem, "amount" | "settledAmount">,
) {
  return Math.max(
    moneyToCents(obligation.amount) - moneyToCents(obligation.settledAmount),
    0,
  );
}

function isUpcoming(dateKey: string, asOfKey: string, endKey: string) {
  return dateKey >= asOfKey && dateKey <= endKey;
}

function entryTone(status: FinanceEntryListItem["status"]): BadgeTone {
  if (status === "settled") return "success";
  if (status === "partial") return "warning-soft";
  if (status === "overdue") return "danger";
  if (status === "cancelled") return "muted";
  return "warning";
}

function expenseTone(status: FinanceExpenseListItem["status"]): BadgeTone {
  if (status === "settled") return "success";
  if (status === "partial") return "warning-soft";
  if (status === "overdue") return "danger";
  if (status === "cancelled") return "muted";
  return "warning";
}

function invoiceTone(status: InvoiceRequestListItem["status"]): BadgeTone {
  if (status === "approved" || status === "paid") return "success";
  if (status === "rejected" || status === "cancelled") return "danger";
  if (status === "published" || status === "adjustment_requested") return "brand";
  if (status === "draft") return "muted";
  return "warning";
}

function reimbursementTone(status: ReimbursementListItem["status"]): BadgeTone {
  if (status === "paid" || status === "finance_approved") return "success";
  if (status === "manager_rejected" || status === "finance_rejected" || status === "cancelled") {
    return "danger";
  }
  if (status === "draft") return "muted";
  return "warning";
}

function DashboardMiniTable({
  columns,
  rows,
  empty,
}: {
  columns: { key: string; right?: boolean }[];
  rows: { key: string; cells: Record<string, ReactNode> }[];
  empty: string;
}) {
  return (
    <table className="fg-mini-table">
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td className="fg-mini-empty" colSpan={columns.length}>
              {empty}
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.key}>
              {columns.map((column) => (
                <td key={column.key} className={column.right ? "right" : ""}>
                  {row.cells[column.key]}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

export default async function AppHomePage() {
  const [context, session] = await Promise.all([
    getCurrentAccessContext(),
    getCurrentSession(),
  ]);

  if (!context) redirect("/login");

  const canReadFinance = can("finance.read", context);
  const canWriteFinance = can("finance.write", context);
  const canReadAlerts = canAny(["alerts.read", "alerts.write"], context);
  const canReadInvoices = canAny(
    ["invoices.read", "invoices.write", "invoices.approve", "invoices.read_own"],
    context,
  );
  const canReadReimbursements = canAny(
    [
      "reimbursements.read",
      "reimbursements.write",
      "reimbursements.approve_team",
      "reimbursements.approve_finance",
      "reimbursements.read_own",
    ],
    context,
  );

  const [
    financeDashboard,
    paymentAlerts,
    equipmentAlerts,
    accessAlerts,
    saasAlerts,
    lifecycleItems,
    birthdayItems,
    invoiceRequests,
    reimbursements,
  ] = await Promise.all([
    canReadFinance ? getFinanceDashboard(context, { filters: {} }) : Promise.resolve(null),
    canReadFinance
      ? listClientPaymentAlerts(context, { limit: 8 })
      : Promise.resolve([]),
    canAny(
      ["equipment.read", "equipment.write", "equipment.configure", "equipment.read_team"],
      context,
    )
      ? listEquipmentReturnAlerts(context, { limit: 4 })
      : Promise.resolve([]),
    canAny(
      [
        "access_records.read",
        "access_records.write",
        "access_records.configure",
        "access_records.read_team",
      ],
      context,
    )
      ? listAccessReviewAlerts(context, { limit: 4 })
      : Promise.resolve([]),
    canAny(["saas.read", "saas.write", "saas.configure"], context)
      ? listSaasRenewalAlerts(context, { limit: 6 })
      : Promise.resolve([]),
    canAny(["lifecycle.read", "lifecycle.write"], context)
      ? listLifecycleDashboardItems(context, { limit: 6 })
      : Promise.resolve([]),
    canAny(
      ["people.read", "people.read_team", "people.read_own", "people.configure"],
      context,
    )
      ? listUpcomingBirthdays(context, { limit: 6 })
      : Promise.resolve([]),
    canReadInvoices ? listInvoiceRequests(context, { limit: 8 }) : Promise.resolve([]),
    canReadReimbursements ? listReimbursements(context, { limit: 8 }) : Promise.resolve([]),
  ]);

  const totalDueToday = paymentAlerts.filter((a) => a.kind === "due_today").length;
  const totalOverdue = paymentAlerts.filter((a) => a.kind === "overdue").length;
  const totalUpcoming = paymentAlerts.filter((a) => a.kind === "due_soon").length;
  const totalCriticalAlerts =
    accessAlerts.length + equipmentAlerts.length + saasAlerts.length;

  const now = new Date();
  const todayKey = toDateKey(now);
  const next7Key = addDaysToDateKey(todayKey, 7);
  const userName = session?.user?.name?.split(" ")[0] ?? "";
  const competence = financeDashboard ? formatCompetence(financeDashboard.competence) : "";
  const resultCents = financeDashboard
    ? moneyToCents(financeDashboard.totals.resultRealized)
    : 0;

  const upcomingReceivables = financeDashboard
    ? financeDashboard.entries
        .filter((entry) => entry.status !== "settled" && entry.status !== "cancelled")
        .filter((entry) => isUpcoming(toDateKey(entry.dueDate), todayKey, next7Key))
        .sort((a, b) => toDateKey(a.dueDate).localeCompare(toDateKey(b.dueDate)))
        .slice(0, 5)
    : [];
  const upcomingExpenses = financeDashboard
    ? financeDashboard.expenses
        .filter((expense) => expense.status !== "settled" && expense.status !== "cancelled")
        .filter((expense) => isUpcoming(toDateKey(expense.dueDate), todayKey, next7Key))
        .sort((a, b) => toDateKey(a.dueDate).localeCompare(toDateKey(b.dueDate)))
        .slice(0, 5)
    : [];
  const pendingInvoices = invoiceRequests
    .filter(
      (invoice) =>
        !["paid", "cancelled", "rejected"].includes(invoice.status),
    )
    .slice(0, 4);
  const pendingReimbursements = reimbursements
    .filter(
      (reimbursement) =>
        ![
          "paid",
          "cancelled",
          "manager_rejected",
          "finance_rejected",
        ].includes(reimbursement.status),
    )
    .slice(0, 4);

  const receivablesTotal = upcomingReceivables.reduce(
    (total, entry) => total + obligationOutstandingCents(entry),
    0,
  );
  const expensesTotal = upcomingExpenses.reduce(
    (total, expense) => total + obligationOutstandingCents(expense),
    0,
  );

  return (
    <div className="fg-page">
      <div className="fg-greet">
        <div>
          <h1 className="fg-greet-title">
            {greetingForHour(now)}
            {userName ? `, ${userName}` : ""}
          </h1>
          <p className="fg-greet-sub" style={{ textTransform: "capitalize" }}>
            Aqui esta o resumo de hoje, {formatLongDate(now)}.
          </p>
        </div>
        <div className="fg-greet-actions">
          {canReadAlerts ? (
            <Link className={OUTLINE_LINK} href={"/app/alertas" as Route}>
              <Bell size={14} aria-hidden />
              <span>Ver alertas</span>
            </Link>
          ) : null}
          {canWriteFinance ? (
            <Link className={PRIMARY_LINK} href={"/app/financeiro/entradas" as Route}>
              <Plus size={14} aria-hidden />
              <span>Nova conta a receber</span>
            </Link>
          ) : null}
        </div>
      </div>

      {financeDashboard ? (
        <div className="fg-grid fg-grid-kpis">
          <KpiCard
            label="Contas a receber"
            value={formatMoney(financeDashboard.totals.incomeReceived)}
              secondary={`Liquidado em ${competence}`}
            icon={<ArrowDownRight size={16} />}
          />
          <KpiCard
            label="Contas a pagar"
            value={formatMoney(financeDashboard.totals.expensesPaid)}
              secondary={`Liquidado em ${competence}`}
            icon={<ArrowUpRight size={16} />}
          />
          <KpiCard
            label="Resultado"
            value={formatMoney(financeDashboard.totals.resultRealized)}
            secondary={resultCents >= 0 ? "Superavit realizado" : "Deficit realizado"}
            icon={<Wallet size={16} />}
            accent={resultCents >= 0}
          />
          <KpiCard
            label="Prox. 30 dias"
            value={formatMoney(financeDashboard.totals.forecast30Days)}
            secondary="Recebimentos - pagamentos previstos"
            icon={<CalendarClock size={16} />}
          />
          <KpiCard
            label="Alertas governanca"
            value={String(totalCriticalAlerts)}
            secondary="Acessos, equipamentos e SaaS"
            icon={<AlertTriangle size={16} />}
          />
        </div>
      ) : (
        <div className="fg-grid fg-grid-kpis">
          <KpiCard
            label="A vencer hoje"
            value={String(totalDueToday)}
            secondary="cobrancas do dia"
            icon={<CalendarClock size={16} />}
            accent={totalDueToday > 0}
          />
          <KpiCard
            label="Em atraso"
            value={String(totalOverdue)}
            secondary="cobrancas vencidas"
            icon={<AlertOctagon size={16} />}
          />
          <KpiCard
            label="Prox. 7 dias"
            value={String(totalUpcoming)}
            secondary="lembretes pre-venc."
            icon={<ClipboardList size={16} />}
          />
          <KpiCard
            label="Aniversarios"
            value={String(birthdayItems.length)}
            secondary="nas proximas 2 semanas"
            icon={<Cake size={16} />}
          />
          <KpiCard
            label="Alertas governanca"
            value={String(totalCriticalAlerts)}
            secondary="acessos, equipamentos e SaaS"
            icon={<AlertTriangle size={16} />}
          />
        </div>
      )}

      <div className="fg-grid fg-grid-2">
        <Card
          title="Pendencias criticas"
          description="Ordenadas por severidade. Tudo o que requer acao executiva."
          action={
            canReadAlerts ? (
              <Link className={ACTION_LINK} href={"/app/alertas" as Route}>
                <span>Ver todas</span>
                <ArrowRight size={14} aria-hidden />
              </Link>
            ) : null
          }
          padding={false}
        >
          {paymentAlerts.length === 0 ? (
            <EmptyState
              icon={<ClipboardList size={20} />}
              title="Sem pendencias"
              description="Nao ha cobrancas criticas para hoje."
            />
          ) : (
            <div className="fg-alert-list">
              {paymentAlerts.map((alert) => (
                <div
                  key={`${alert.clientId}:${alert.financialEntryId ?? alert.kind}`}
                  className={`fg-alert fg-alert-${
                    alert.severity === "high"
                      ? "critico"
                      : alert.severity === "medium"
                        ? "alto"
                        : "medio"
                  }`}
                >
                  <span className="fg-alert-icon">
                    <AlertOctagon size={14} />
                  </span>
                  <div className="fg-alert-body">
                    <div className="fg-alert-title">{alert.title}</div>
                    <div className="fg-alert-sub">{alert.description}</div>
                    <div className="fg-alert-ctx">
                      Vencimento: {formatDate(alert.dueDate)}
                    </div>
                  </div>
                  <div className="fg-alert-meta">
                    <StatusBadge
                      tone={
                        alert.severity === "high"
                          ? "danger"
                          : alert.severity === "medium"
                            ? "warning"
                            : "muted"
                      }
                      label={clientReminderKindLabels[alert.kind]}
                      withDot={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card
          title="Proximos eventos"
          description="Aniversarios, admissoes, governanca e renovacoes."
          padding={false}
        >
          {lifecycleItems.length === 0 &&
          equipmentAlerts.length === 0 &&
          accessAlerts.length === 0 &&
          saasAlerts.length === 0 &&
          birthdayItems.length === 0 ? (
            <EmptyState
              icon={<CalendarClock size={20} />}
              title="Agenda tranquila"
              description="Sem eventos a destacar."
            />
          ) : (
            <div className="fg-event-list">
              {lifecycleItems.map((item) => (
                <div className="fg-event" key={`lifecycle:${item.id}`}>
                  <span className="fg-event-icon fg-event-admissao">
                    {item.type === "offboarding" ? (
                      <UserMinus size={14} />
                    ) : (
                      <UserPlus size={14} />
                    )}
                  </span>
                  <div className="fg-event-body">
                    <div className="fg-event-title">
                      {lifecycleTypeLabels[item.type]} - {item.employeeName}
                    </div>
                    <div className="fg-event-when">
                      Prazo {formatDate(item.dueDate)} -{" "}
                      {item.progress.requiredResolved}/{item.progress.requiredTotal}{" "}
                      etapas
                    </div>
                  </div>
                </div>
              ))}
              {equipmentAlerts.map((item) => (
                <div className="fg-event" key={`equipment:${item.id}`}>
                  <span className="fg-event-icon">
                    <Laptop size={14} />
                  </span>
                  <div className="fg-event-body">
                    <div className="fg-event-title">
                      {item.assetNumber}: devolucao pendente
                    </div>
                    <div className="fg-event-when">
                      {item.currentEmployeeName ?? "Sem responsavel"} - {item.type}
                    </div>
                  </div>
                </div>
              ))}
              {accessAlerts.map((item) => (
                <div className="fg-event" key={`access:${item.id}`}>
                  <span className="fg-event-icon">
                    <KeyRound size={14} />
                  </span>
                  <div className="fg-event-body">
                    <div className="fg-event-title">
                      {item.platform}: acesso critico
                    </div>
                    <div className="fg-event-when">
                      {item.employeeName} - revisao {formatDate(item.reviewDueDate)}
                    </div>
                  </div>
                </div>
              ))}
              {saasAlerts.map((item) => (
                <div className="fg-event" key={`saas:${item.id}`}>
                  <span className="fg-event-icon fg-event-renovacao">
                    <ClipboardList size={14} />
                  </span>
                  <div className="fg-event-body">
                    <div className="fg-event-title">{item.name}: renovacao</div>
                    <div className="fg-event-when">
                      Em {formatDate(item.renewalDate)}
                    </div>
                  </div>
                </div>
              ))}
              {birthdayItems.map((item) => (
                <div className="fg-event" key={`birthday:${item.employeeId}`}>
                  <span className="fg-event-icon fg-event-aniversario">
                    <Cake size={14} />
                  </span>
                  <div className="fg-event-body">
                    <div className="fg-event-title">
                      {item.employeeName} - aniversario
                    </div>
                    <div className="fg-event-when">
                      {item.daysUntil === 0
                        ? `Hoje (${formatDate(item.occursOn)})`
                        : item.daysUntil === 1
                          ? `Amanha (${formatDate(item.occursOn)})`
                          : `Em ${item.daysUntil} dias (${formatDate(item.occursOn)})`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {financeDashboard ? (
        <div className="fg-grid fg-grid-2">
          <Card
            title="A receber - proximos 7 dias"
            description={`${upcomingReceivables.length} contas pendentes - ${moneyFromCents(receivablesTotal)}`}
            action={
              <Link className={ACTION_LINK} href={"/app/financeiro/entradas" as Route}>
                <span>Ver todas</span>
                <ArrowRight size={14} aria-hidden />
              </Link>
            }
            padding={false}
          >
            <DashboardMiniTable
              columns={[
                { key: "client" },
                { key: "due" },
                { key: "value", right: true },
                { key: "status" },
              ]}
              empty="Nenhuma conta a receber vencendo nos proximos 7 dias."
              rows={upcomingReceivables.map((entry) => ({
                key: entry.id,
                cells: {
                  client: (
                    <div className="fg-cell-strong">
                      {entry.clientName ?? "Sem cliente"}
                      <div className="fg-cell-sub">{entry.description}</div>
                    </div>
                  ),
                  due: <span className="fg-tabular">{formatDayMonth(entry.dueDate)}</span>,
                  value: (
                    <span className="fg-tabular fg-cell-strong">
                      {moneyFromCents(obligationOutstandingCents(entry))}
                    </span>
                  ),
                  status: (
                    <StatusBadge
                      label={financialEntryStatusLabels[entry.status]}
                      tone={entryTone(entry.status)}
                    />
                  ),
                },
              }))}
            />
          </Card>

          <Card
            title="A pagar - proximos 7 dias"
            description={`${upcomingExpenses.length} contas pendentes - ${moneyFromCents(expensesTotal)}`}
            action={
              <Link className={ACTION_LINK} href={"/app/financeiro/saidas" as Route}>
                <span>Ver todas</span>
                <ArrowRight size={14} aria-hidden />
              </Link>
            }
            padding={false}
          >
            <DashboardMiniTable
              columns={[
                { key: "supplier" },
                { key: "due" },
                { key: "value", right: true },
                { key: "status" },
              ]}
              empty="Nenhuma conta a pagar vencendo nos proximos 7 dias."
              rows={upcomingExpenses.map((expense) => ({
                key: expense.id,
                cells: {
                  supplier: (
                    <div className="fg-cell-strong">
                      {expense.supplier}
                      <div className="fg-cell-sub">{expense.description}</div>
                    </div>
                  ),
                  due: <span className="fg-tabular">{formatDayMonth(expense.dueDate)}</span>,
                  value: (
                    <span className="fg-tabular fg-cell-strong">
                      {moneyFromCents(obligationOutstandingCents(expense))}
                    </span>
                  ),
                  status: (
                    <StatusBadge
                      label={financialExpenseStatusLabels[expense.status]}
                      tone={expenseTone(expense.status)}
                    />
                  ),
                },
              }))}
            />
          </Card>
        </div>
      ) : null}

      {canReadInvoices || canReadReimbursements ? (
        <div className="fg-grid fg-grid-2">
          {canReadInvoices ? (
            <Card
              title="NFs pendentes"
              description="Composicoes aguardando envio, conferencia ou pagamento."
              action={
                <Link className={ACTION_LINK} href={"/app/nfs" as Route}>
                  <span>Ver todas</span>
                  <ArrowRight size={14} aria-hidden />
                </Link>
              }
              padding={false}
            >
              <DashboardMiniTable
                columns={[
                  { key: "employee" },
                  { key: "competence" },
                  { key: "value", right: true },
                  { key: "status" },
                ]}
                empty="Nenhuma NF pendente."
                rows={pendingInvoices.map((invoice) => ({
                  key: invoice.id,
                  cells: {
                    employee: (
                      <div className="fg-cell-strong">
                        {invoice.employeeName}
                        <div className="fg-cell-sub">Prazo {formatDate(invoice.dueDate)}</div>
                      </div>
                    ),
                    competence: (
                      <span className="fg-tabular">{formatCompetence(invoice.competence)}</span>
                    ),
                    value: (
                      <span className="fg-tabular fg-cell-strong">
                        {formatMoney(invoice.expectedAmount)}
                      </span>
                    ),
                    status: (
                      <StatusBadge
                        label={invoiceRequestStatusLabels[invoice.status]}
                        tone={invoiceTone(invoice.status)}
                      />
                    ),
                  },
                }))}
              />
            </Card>
          ) : null}

          {canReadReimbursements ? (
            <Card
              title="Reembolsos pendentes"
              description="Aguardando aprovacao, inclusao em NF ou pagamento."
              action={
                <Link className={ACTION_LINK} href={"/app/reembolsos" as Route}>
                  <span>Ver todos</span>
                  <ArrowRight size={14} aria-hidden />
                </Link>
              }
              padding={false}
            >
              <DashboardMiniTable
                columns={[
                  { key: "employee" },
                  { key: "date" },
                  { key: "value", right: true },
                  { key: "status" },
                ]}
                empty="Nenhum reembolso pendente."
                rows={pendingReimbursements.map((reimbursement) => ({
                  key: reimbursement.id,
                  cells: {
                    employee: (
                      <div className="fg-cell-strong">
                        {reimbursement.employeeName}
                        <div className="fg-cell-sub">{reimbursement.title}</div>
                      </div>
                    ),
                    date: (
                      <span className="fg-tabular">
                        {formatDayMonth(reimbursement.expenseDate)}
                      </span>
                    ),
                    value: (
                      <span className="fg-tabular fg-cell-strong">
                        {formatMoney(reimbursement.amount)}
                      </span>
                    ),
                    status: (
                      <StatusBadge
                        label={reimbursementStatusLabels[reimbursement.status]}
                        tone={reimbursementTone(reimbursement.status)}
                      />
                    ),
                  },
                }))}
              />
            </Card>
          ) : null}
        </div>
      ) : null}

    </div>
  );
}

import {
  ArrowLeft,
  Ban,
  Bell,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  PauseCircle,
  Plus,
  ReceiptText,
  Save,
  UserRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  generateClientExpectedEntryAction,
  markClientPaymentReceivedAction,
  updateClientBillingProfileAction,
  updateClientInternalNotesAction,
  updateClientStatusAction,
} from "@/features/clients/actions";
import {
  getClientBillingProfile,
  getClientBillingSummary,
  getClientDetail,
  listClientAuditLogs,
  listClientOwnerOptions,
  listClientPaymentReminders,
  listClientPayments,
  type ClientAuditLogItem,
  type ClientBillingProfileDetail,
  type ClientBillingSummary,
  type ClientPaymentListItem,
  type ClientPaymentReminderItem,
} from "@/features/clients/dal";
import {
  canWriteClients,
  clientFinancialStatusLabels,
  clientReminderKindLabels,
  clientStatusLabels,
  type ClientFinancialStatus,
  type ClientStatus,
} from "@/features/clients/rules";
import { formatCompetence, formatDate, formatMoney } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const tabs = [
  { id: "resumo", label: "Resumo" },
  { id: "pagamentos", label: "Pagamentos" },
  { id: "cobranca", label: "Cobranca" },
  { id: "contratos", label: "Contratos e documentos" },
  { id: "historico", label: "Historico" },
  { id: "observacoes", label: "Observacoes internas" },
] as const;

type ClientTab = (typeof tabs)[number]["id"];

export default async function ClientDetailPage({ params, searchParams }: PageProps) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const client = await getClientDetail(context, id);

  if (!client) {
    notFound();
  }

  const activeTab = normalizeTab(firstValue((await searchParams)?.tab));
  const canWriteClient = canWriteClients(context);
  const canReadFinance = can("finance.read", context);
  const canWriteFinance = can("finance.write", context);
  const canEditBilling = canWriteClient && canWriteFinance;
  const [profile, summary, payments, reminders, ownerOptions, auditLogs] = await Promise.all([
    getClientBillingProfile(context, client.id),
    getClientBillingSummary(context, client.id),
    listClientPayments(context, client.id),
    listClientPaymentReminders(context, client.id, { limit: 12 }),
    canWriteClient ? listClientOwnerOptions(context) : Promise.resolve([]),
    listClientAuditLogs(context, client.id, { limit: 20 }),
  ]);

  if (!profile || !summary) {
    notFound();
  }

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link className={`${secondaryButtonClassName} w-fit`} href="/app/clientes">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{client.code}</p>
            <h1 className="truncate text-2xl font-semibold tracking-normal">{client.name}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ClientStatusBadge status={client.status} />
            {canWriteClient ? <ClientStatusActions id={client.id} status={client.status} /> : null}
          </div>
        </div>
      </div>

      <TabNav activeTab={activeTab} clientId={client.id} />

      {activeTab === "resumo" ? (
        <SummaryTab
          canReadFinance={canReadFinance}
          client={client}
          payments={payments}
          profile={profile}
          reminders={reminders}
          summary={summary}
        />
      ) : null}

      {activeTab === "pagamentos" ? (
        <PaymentsTab
          canReadFinance={canReadFinance}
          canWriteFinance={canWriteFinance}
          payments={payments}
          profile={profile}
        />
      ) : null}

      {activeTab === "cobranca" ? (
        <BillingTab
          canEditBilling={canEditBilling}
          clientId={client.id}
          ownerOptions={ownerOptions}
          profile={profile}
          summary={summary}
        />
      ) : null}

      {activeTab === "contratos" ? <ContractsTab /> : null}

      {activeTab === "historico" ? <HistoryTab auditLogs={auditLogs} /> : null}

      {activeTab === "observacoes" ? (
        <InternalNotesTab canWriteClient={canWriteClient} clientId={client.id} notes={client.notes} />
      ) : null}
    </section>
  );
}

function SummaryTab({
  canReadFinance,
  client,
  payments,
  profile,
  reminders,
  summary,
}: {
  canReadFinance: boolean;
  client: {
    status: ClientStatus;
    monthlyFee: string | null;
    internalOwnerName: string | null;
    valueHidden: boolean;
  };
  payments: ClientPaymentListItem[];
  profile: ClientBillingProfileDetail;
  reminders: ClientPaymentReminderItem[];
  summary: ClientBillingSummary;
}) {
  const cards = [
    {
      icon: WalletCards,
      label: "Status do cliente",
      value: clientStatusLabels[client.status],
    },
    {
      icon: Bell,
      label: "Status financeiro do mes",
      value: clientFinancialStatusLabels[summary.financialStatus],
    },
    {
      icon: CircleDollarSign,
      label: "Fee mensal",
      value: summary.valueHidden ? "Restrito" : formatMoney(profile.monthlyFee),
    },
    {
      icon: CalendarClock,
      label: "Proximo vencimento",
      value: formatDate(summary.nextDueDate),
    },
    {
      icon: CreditCard,
      label: "Metodo padrao",
      value: summary.defaultPaymentMethod ?? "-",
    },
    {
      icon: UserRound,
      label: "Responsavel interno",
      value: client.internalOwnerName ?? "-",
    },
    {
      icon: ReceiptText,
      label: "Ultimo pagamento",
      value: formatDate(summary.lastPaymentDate),
    },
    {
      icon: Ban,
      label: "Total em atraso",
      value: summary.valueHidden ? "Restrito" : formatMoney(summary.totalOverdue),
    },
  ];

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <SummaryCard icon={card.icon} key={card.label} label={card.label} value={card.value} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">Lembretes ativos</h2>
          </div>
          <ReminderList reminders={reminders} />
        </section>

        <section className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="text-base font-semibold">Pagamentos recentes</h2>
          </div>
          {!canReadFinance ? (
            <RestrictedMessage />
          ) : payments.length === 0 ? (
            <EmptyState label="Nenhum pagamento vinculado." />
          ) : (
            <div className="divide-y">
              {payments.slice(0, 5).map((payment) => (
                <div className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_auto]" key={payment.id}>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{payment.description}</p>
                    <p className="text-muted-foreground">
                      {formatCompetence(payment.competence)} - {formatDate(payment.dueDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 sm:justify-end">
                    <PaymentStatusBadge status={payment.status} />
                    <span className="font-medium">{formatMoney(payment.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PaymentsTab({
  canReadFinance,
  canWriteFinance,
  payments,
  profile,
}: {
  canReadFinance: boolean;
  canWriteFinance: boolean;
  payments: ClientPaymentListItem[];
  profile: ClientBillingProfileDetail;
}) {
  if (!canReadFinance) {
    return <RestrictedMessage />;
  }

  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Historico financeiro do cliente</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="border-b bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Competencia</th>
              <th className="px-4 py-3 font-medium">Vencimento</th>
              <th className="px-4 py-3 text-right font-medium">Valor previsto</th>
              <th className="px-4 py-3 text-right font-medium">Valor recebido</th>
              <th className="px-4 py-3 font-medium">Metodo</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Recebimento</th>
              {canWriteFinance ? <th className="px-4 py-3 text-right font-medium">Acao</th> : null}
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-muted-foreground" colSpan={canWriteFinance ? 8 : 7}>
                  Nenhuma entrada financeira vinculada.
                </td>
              </tr>
            ) : (
              payments.map((payment) => (
                <tr className="border-b last:border-b-0" key={payment.id}>
                  <td className="px-4 py-3 font-medium">{formatCompetence(payment.competence)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(payment.dueDate)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatMoney(payment.amount)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {formatMoney(payment.receivedAmount)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {payment.paymentMethod ?? profile.paymentMethod ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <PaymentStatusBadge status={payment.status} />
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(payment.receivedDate)}</td>
                  {canWriteFinance ? (
                    <td className="px-4 py-3">
                      {payment.status !== "received" && payment.status !== "cancelled" ? (
                        <form action={markClientPaymentReceivedAction} className="flex justify-end">
                          <input name="id" type="hidden" value={payment.id} />
                          <input
                            name="paymentMethod"
                            type="hidden"
                            value={payment.paymentMethod ?? profile.paymentMethod ?? ""}
                          />
                          <IconSubmitButton icon={CheckCircle2} label="Marcar recebido" tone="primary" />
                        </form>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BillingTab({
  canEditBilling,
  clientId,
  ownerOptions,
  profile,
  summary,
}: {
  canEditBilling: boolean;
  clientId: string;
  ownerOptions: { id: string; name: string }[];
  profile: ClientBillingProfileDetail;
  summary: ClientBillingSummary;
}) {
  if (!canEditBilling) {
    return (
      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Dados de cobranca</h2>
        </div>
        <dl className="grid gap-0 sm:grid-cols-2">
          <DetailItem label="Dia de vencimento" value={`Dia ${profile.billingDay}`} />
          <DetailItem label="Metodo padrao" value={profile.paymentMethod ?? "-"} />
          <DetailItem label="Prazo de pagamento" value={`${profile.paymentTermsDays} dia(s)`} />
          <DetailItem label="Recorrencia" value="Mensal" />
          <DetailItem label="Contato financeiro" value={profile.financialContactName ?? "-"} />
          <DetailItem label="E-mail financeiro" value={profile.financialEmail ?? "-"} />
          <DetailItem label="Telefone/WhatsApp" value={profile.financialPhone ?? "-"} />
          <DetailItem label="Lembrete antes" value={`${profile.reminderBeforeDays} dia(s)`} />
        </dl>
      </section>
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border bg-card p-4">
        <form action={generateClientExpectedEntryAction} className="grid gap-3 md:grid-cols-[minmax(10rem,0.4fr)_1fr_auto]">
          <input name="clientId" type="hidden" value={clientId} />
          <label className={fieldClassName}>
            Competencia
            <input className={inputClassName} defaultValue={currentCompetence()} name="competence" type="month" />
          </label>
          <div className="self-end text-sm text-muted-foreground">
            Proximo vencimento: {formatDate(summary.nextDueDate)}
          </div>
          <button
            className={`${primaryButtonClassName} self-end sm:w-auto`}
            disabled={!summary.canGenerateExpectedEntry}
            type="submit"
          >
            <Plus className="size-4" aria-hidden="true" />
            Gerar entrada prevista
          </button>
        </form>
      </section>

      <section className="rounded-lg border bg-card">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold">Perfil de cobranca</h2>
        </div>
        <form action={updateClientBillingProfileAction} className="grid gap-4 p-4">
          <input name="clientId" type="hidden" value={clientId} />
          <div className="grid gap-3 lg:grid-cols-[minmax(9rem,0.4fr)_minmax(7rem,0.25fr)_minmax(9rem,0.35fr)_minmax(9rem,0.35fr)]">
            <label className={fieldClassName}>
              Valor mensal fee
              <input
                className={inputClassName}
                defaultValue={profile.monthlyFee ?? ""}
                inputMode="decimal"
                name="monthlyFee"
                required
              />
            </label>
            <label className={fieldClassName}>
              Dia vencimento
              <input className={inputClassName} defaultValue={profile.billingDay} max={31} min={1} name="billingDay" required type="number" />
            </label>
            <label className={fieldClassName}>
              Metodo padrao
              <input className={inputClassName} defaultValue={profile.paymentMethod ?? ""} maxLength={80} name="paymentMethod" />
            </label>
            <label className={fieldClassName}>
              Prazo pagamento
              <input className={inputClassName} defaultValue={profile.paymentTermsDays} max={90} min={0} name="paymentTermsDays" type="number" />
            </label>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <label className={fieldClassName}>
              Recorrencia
              <select className={inputClassName} defaultValue={profile.recurrence} name="recurrence">
                <option value="monthly">Mensal</option>
              </select>
            </label>
            <label className={fieldClassName}>
              Responsavel pela cobranca
              <select className={inputClassName} defaultValue={profile.billingOwnerEmployeeId ?? ""} name="billingOwnerEmployeeId">
                <option value="">Sem responsavel</option>
                {ownerOptions.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 self-end text-sm text-muted-foreground">
              <input className="size-4 accent-primary" defaultChecked={profile.autoGenerateEntries} name="autoGenerateEntries" type="checkbox" />
              Gerar entrada prevista automaticamente
            </label>
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <label className={fieldClassName}>
              Contato financeiro
              <input className={inputClassName} defaultValue={profile.financialContactName ?? ""} maxLength={160} name="financialContactName" />
            </label>
            <label className={fieldClassName}>
              E-mail financeiro
              <input className={inputClassName} defaultValue={profile.financialEmail ?? ""} maxLength={160} name="financialEmail" type="email" />
            </label>
            <label className={fieldClassName}>
              Telefone/WhatsApp
              <input className={inputClassName} defaultValue={profile.financialPhone ?? ""} maxLength={40} name="financialPhone" />
            </label>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <label className={fieldClassName}>
              Lembrete antes do vencimento
              <input className={inputClassName} defaultValue={profile.reminderBeforeDays} max={30} min={0} name="reminderBeforeDays" type="number" />
            </label>
            <label className={fieldClassName}>
              Lembrete apos vencimento
              <input className={inputClassName} defaultValue={profile.reminderAfterDays} max={30} min={0} name="reminderAfterDays" type="number" />
            </label>
          </div>

          <label className={fieldClassName}>
            Observacoes de cobranca
            <textarea className={textareaClassName} defaultValue={profile.notes ?? ""} maxLength={1200} name="notes" rows={5} />
          </label>

          <div className="flex justify-end">
            <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
              <Save className="size-4" aria-hidden="true" />
              Salvar cobranca
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function ContractsTab() {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Contratos e documentos</h2>
      </div>
      <EmptyState label="Nenhum contrato ou documento vinculado." />
    </section>
  );
}

function HistoryTab({ auditLogs }: { auditLogs: ClientAuditLogItem[] }) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Historico</h2>
      </div>
      <div className="divide-y">
        {auditLogs.length === 0 ? (
          <EmptyState label="Sem logs recentes." />
        ) : (
          auditLogs.map((log) => (
            <div className="grid gap-1 px-4 py-3 text-sm md:grid-cols-[12rem_1fr_14rem]" key={log.id}>
              <p className="font-medium">{formatAuditAction(log.action)}</p>
              <p className="text-muted-foreground">
                {log.actorName ?? log.actorEmail ?? "Sistema"}
                {formatAuditMetadata(log.metadata) ? ` - ${formatAuditMetadata(log.metadata)}` : ""}
              </p>
              <p className="text-muted-foreground md:text-right">{formatDateTime(log.createdAt)}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function InternalNotesTab({
  canWriteClient,
  clientId,
  notes,
}: {
  canWriteClient: boolean;
  clientId: string;
  notes: string | null;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h2 className="text-base font-semibold">Observacoes internas</h2>
      </div>
      {canWriteClient ? (
        <form action={updateClientInternalNotesAction} className="grid gap-4 p-4">
          <input name="id" type="hidden" value={clientId} />
          <textarea className={textareaClassName} defaultValue={notes ?? ""} maxLength={2000} name="notes" rows={10} />
          <div className="flex justify-end">
            <button className={`${primaryButtonClassName} sm:w-auto`} type="submit">
              <Save className="size-4" aria-hidden="true" />
              Salvar observacoes
            </button>
          </div>
        </form>
      ) : (
        <p className="whitespace-pre-wrap p-4 text-sm text-muted-foreground">{notes || "-"}</p>
      )}
    </section>
  );
}

function TabNav({ activeTab, clientId }: { activeTab: ClientTab; clientId: string }) {
  return (
    <nav className="overflow-x-auto rounded-lg border bg-card p-1">
      <div className="flex min-w-max gap-1">
        {tabs.map((tab) => (
          <Link
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            href={`/app/clientes/${clientId}?tab=${tab.id}` as Route}
            key={tab.id}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function ReminderList({ reminders }: { reminders: ClientPaymentReminderItem[] }) {
  if (reminders.length === 0) {
    return <EmptyState label="Nenhum lembrete ativo." />;
  }

  return (
    <div className="divide-y">
      {reminders.map((reminder) => (
        <div className="grid gap-1 px-4 py-3 text-sm" key={`${reminder.financialEntryId ?? "client"}:${reminder.kind}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium">{reminder.title}</p>
            <ReminderBadge kind={reminder.kind} severity={reminder.severity} />
          </div>
          <p className="text-muted-foreground">{reminder.description ?? clientReminderKindLabels[reminder.kind]}</p>
          <p className="text-xs text-muted-foreground">Vencimento: {formatDate(reminder.dueDate)}</p>
        </div>
      ))}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-2 break-words text-xl font-semibold">{value}</p>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b p-4 sm:odd:border-r">
      <dt className="text-xs font-medium uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium">{value}</dd>
    </div>
  );
}

function ClientStatusActions({ id, status }: { id: string; status: ClientStatus }) {
  return (
    <div className="flex justify-end gap-2">
      {status !== "active" ? <StatusActionButton id={id} label="Ativar" status="active" tone="primary" /> : null}
      {status !== "paused" ? <StatusActionButton id={id} label="Pausar" status="paused" tone="warning" /> : null}
      {status !== "cancelled" ? <StatusActionButton id={id} label="Cancelar" status="cancelled" tone="destructive" /> : null}
    </div>
  );
}

function StatusActionButton({
  id,
  label,
  status,
  tone,
}: {
  id: string;
  label: string;
  status: ClientStatus;
  tone: "destructive" | "primary" | "warning";
}) {
  const Icon = tone === "primary" ? CheckCircle2 : tone === "warning" ? PauseCircle : Ban;
  const className =
    tone === "primary"
      ? "border-primary/30 text-primary hover:bg-primary/10"
      : tone === "warning"
        ? "border-secondary/30 text-secondary-foreground hover:bg-secondary/10"
        : "border-destructive/30 text-destructive hover:bg-destructive/10";

  return (
    <form action={updateClientStatusAction}>
      <input name="id" type="hidden" value={id} />
      <input name="status" type="hidden" value={status} />
      <button aria-label={label} className={`inline-flex size-8 items-center justify-center rounded-md border transition-colors ${className}`} title={label} type="submit">
        <Icon className="size-4" aria-hidden="true" />
      </button>
    </form>
  );
}

function IconSubmitButton({
  icon: Icon,
  label,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  tone: "primary";
}) {
  const className = tone === "primary" ? "border-primary/30 text-primary hover:bg-primary/10" : "";

  return (
    <button aria-label={label} className={`inline-flex size-8 items-center justify-center rounded-md border transition-colors ${className}`} title={label} type="submit">
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const className =
    status === "active"
      ? "border-primary/30 bg-primary/10 text-primary"
      : status === "cancelled"
        ? "border-muted bg-muted text-muted-foreground"
        : "border-secondary/30 bg-secondary/10 text-secondary-foreground";

  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>{clientStatusLabels[status]}</span>;
}

function PaymentStatusBadge({ status }: { status: ClientFinancialStatus }) {
  const className =
    status === "overdue" || status === "partial"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : status === "received"
        ? "border-primary/30 bg-primary/10 text-primary"
        : status === "cancelled" || status === "restricted"
          ? "border-muted bg-muted text-muted-foreground"
          : "border-secondary/30 bg-secondary/10 text-secondary-foreground";

  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>{clientFinancialStatusLabels[status]}</span>;
}

function ReminderBadge({
  kind,
  severity,
}: {
  kind: keyof typeof clientReminderKindLabels;
  severity: "low" | "medium" | "high";
}) {
  const className =
    severity === "high"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : severity === "medium"
        ? "border-secondary/30 bg-secondary/10 text-secondary-foreground"
        : "border-muted bg-muted text-muted-foreground";

  return <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>{clientReminderKindLabels[kind]}</span>;
}

function EmptyState({ label }: { label: string }) {
  return <p className="px-4 py-8 text-center text-sm text-muted-foreground">{label}</p>;
}

function RestrictedMessage() {
  return <p className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">Dados financeiros restritos.</p>;
}

function formatAuditAction(action: string) {
  const labels: Record<string, string> = {
    create: "Criacao",
    status_change: "Status",
    update: "Edicao",
  };

  return labels[action] ?? action;
}

function formatAuditMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const data = metadata as { section?: unknown; status?: unknown };

  if (typeof data.section === "string") {
    return data.section === "billing_profile" ? "Cobranca" : "Observacoes internas";
  }

  if (typeof data.status === "string" && data.status in clientStatusLabels) {
    return `Status: ${clientStatusLabels[data.status as ClientStatus]}`;
  }

  return null;
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function normalizeTab(value: string | undefined): ClientTab {
  return tabs.some((tab) => tab.id === value) ? (value as ClientTab) : "resumo";
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function currentCompetence() {
  return new Date().toISOString().slice(0, 7);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

const inputClassName =
  "h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const textareaClassName =
  "min-h-28 w-full min-w-0 resize-y rounded-md border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20";

const fieldClassName = "grid min-w-0 gap-1 text-sm font-medium";

const primaryButtonClassName =
  "inline-flex h-10 w-full min-w-0 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClassName =
  "inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

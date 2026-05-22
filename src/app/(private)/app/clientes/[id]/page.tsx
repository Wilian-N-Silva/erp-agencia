import {
  ArrowLeft,
  Ban,
  CalendarPlus,
  CheckCircle2,
  Pencil,
  Plus,
  Save,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";

import { ActionSheet, Button, KpiCard, MoneyInput, Page, StatusBadge } from "@/components/fg";
import { Card, InlineAlert } from "@/components/fg/atoms";
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
  { id: "cobranca", label: "Cobrança" },
  { id: "contratos", label: "Contratos" },
  { id: "historico", label: "Histórico" },
  { id: "observacoes", label: "Observações" },
] as const;

type ClientTab = (typeof tabs)[number]["id"];

const CLIENT_STATUS_TONE: Record<ClientStatus, string> = {
  active: "ativo",
  paused: "pausado",
  cancelled: "cancelado",
};

const MONTH_STATUS_TONE: Record<
  ClientFinancialStatus,
  "success" | "warning" | "warning-soft" | "danger" | "muted" | "brand"
> = {
  not_generated: "muted",
  planned: "warning",
  due_today: "brand",
  overdue: "danger",
  partial: "warning",
  received: "success",
  cancelled: "muted",
  restricted: "muted",
};

const PAYMENT_STATUS_TONE: Record<
  ClientFinancialStatus,
  "success" | "warning" | "warning-soft" | "danger" | "muted" | "brand"
> = MONTH_STATUS_TONE;

const REMINDER_TONE: Record<"low" | "medium" | "high", "muted" | "warning" | "danger"> = {
  low: "muted",
  medium: "warning",
  high: "danger",
};

export default async function ClientDetailPage({ params, searchParams }: PageProps) {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");

  const { id } = await params;
  if (!isUuid(id)) notFound();

  const client = await getClientDetail(context, id);
  if (!client) notFound();

  const sp = (await searchParams) ?? {};
  const activeTab = normalizeTab(firstValue(sp.tab));
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

  if (!profile || !summary) notFound();

  const startedDateLabel = client.startDate
    ? `Cliente desde ${formatDate(client.startDate)}`
    : "Cliente novo";

  return (
    <Page>
      <Link href={"/app/clientes" as Route} className="fg-back">
        <ArrowLeft size={14} />
        <span>Voltar para Clientes</span>
      </Link>

      <div className="fg-detail-head">
        <div
          className="fg-avatar fg-avatar-brand"
          style={{ width: 64, height: 64, fontSize: 22 }}
        >
          {client.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="fg-detail-head-meta">
          <div className="fg-detail-eyebrow">
            <span className="fg-mono">{client.code}</span>
            <span>·</span>
            <span>{startedDateLabel}</span>
            {client.internalOwnerName ? (
              <>
                <span>·</span>
                <span>Resp. {client.internalOwnerName}</span>
              </>
            ) : null}
          </div>
          <h1 className="fg-detail-title">{client.name}</h1>
          <div className="fg-detail-badges">
            <StatusBadge
              status={CLIENT_STATUS_TONE[client.status]}
              label={clientStatusLabels[client.status]}
            />
            {!summary.valueHidden ? (
              <StatusBadge tone="muted" label={`Fee ${formatMoney(profile.monthlyFee)}`} withDot={false} />
            ) : null}
            <StatusBadge tone="muted" label={`Cobrança dia ${profile.billingDay}`} withDot={false} />
          </div>
        </div>
        <div className="fg-detail-head-actions">
          {canWriteClient ? <ClientStatusActions id={client.id} status={client.status} /> : null}
          {canEditBilling ? (
            <ActionSheet
              title="Gerar entrada prevista"
              description="Cria a próxima cobrança para este cliente."
              trigger={
                <Button
                  variant="primary"
                  size="sm"
                  icon={<CalendarPlus size={14} />}
                  disabled={!summary.canGenerateExpectedEntry}
                >
                  Gerar entrada
                </Button>
              }
            >
              <GenerateExpectedEntryForm clientId={client.id} />
            </ActionSheet>
          ) : null}
        </div>
      </div>

      <div className="fg-detail-tabs">
        <div className="fg-tabs" role="tablist">
          {tabs.map((t) => {
            const active = activeTab === t.id;
            return (
              <Link
                key={t.id}
                role="tab"
                aria-selected={active}
                className={`fg-tab ${active ? "active" : ""}`.trim()}
                href={`/app/clientes/${client.id}?tab=${t.id}` as Route}
              >
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="fg-detail-body">
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
          />
        ) : null}

        {activeTab === "contratos" ? <ContractsTab /> : null}

        {activeTab === "historico" ? <HistoryTab auditLogs={auditLogs} /> : null}

        {activeTab === "observacoes" ? (
          <NotesTab
            canWrite={canWriteClient}
            clientId={client.id}
            notes={client.notes}
          />
        ) : null}
      </div>
    </Page>
  );
}

/* Tabs override Link to navigate via ?tab=  */
// The Tabs atom is stateless and emits onChange; for full SSR navigation we
// render real <Link> tabs separately.

/* ───────────────────────── Resumo ───────────────────────────── */
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
    internalOwnerName: string | null;
  };
  payments: ClientPaymentListItem[];
  profile: ClientBillingProfileDetail;
  reminders: ClientPaymentReminderItem[];
  summary: ClientBillingSummary;
}) {
  const lastPayment = payments
    .filter((p) => p.receivedDate)
    .sort((a, b) =>
      (b.receivedDate ?? "").localeCompare(a.receivedDate ?? ""),
    )[0];

  return (
    <>
      {summary.financialStatus === "overdue" ? (
        <InlineAlert
          tone="danger"
          title={`Cobrança em atraso · ${
            summary.totalOverdue ? formatMoney(summary.totalOverdue) : ""
          }`}
          description="Há ao menos uma cobrança vencida deste cliente. Verifique a aba Pagamentos."
        />
      ) : null}

      <div className="fg-grid fg-grid-kpis">
        <KpiCard
          label="Status do cliente"
          value={clientStatusLabels[client.status]}
          secondary={
            summary.openChargesCount > 0
              ? `${summary.openChargesCount} cobranças em aberto`
              : "sem pendências"
          }
        />
        <KpiCard
          label="Status do mês"
          value={clientFinancialStatusLabels[summary.financialStatus]}
          secondary={`próx. vencimento ${formatDate(summary.nextDueDate)}`}
          accent={summary.financialStatus === "overdue"}
        />
        <KpiCard
          label="Fee mensal"
          value={summary.valueHidden ? "Restrito" : formatMoney(profile.monthlyFee)}
          secondary={`dia ${profile.billingDay} · ${profile.paymentMethod ?? "—"}`}
        />
        <KpiCard
          label="Último pagamento"
          value={formatDate(lastPayment?.receivedDate ?? summary.lastPaymentDate)}
          secondary={
            lastPayment ? formatMoney(lastPayment.receivedAmount) : "sem registros"
          }
        />
      </div>

      <div className="fg-grid fg-grid-2">
        <Card title="Lembretes ativos" padding={false}>
          {reminders.length === 0 ? (
            <p className="fg-empty-desc" style={{ padding: 20 }}>
              Nenhum lembrete ativo.
            </p>
          ) : (
            <div className="fg-alert-list">
              {reminders.map((r) => (
                <div
                  key={`${r.financialEntryId ?? "client"}:${r.kind}`}
                  className={`fg-alert fg-alert-${
                    r.severity === "high"
                      ? "critico"
                      : r.severity === "medium"
                        ? "alto"
                        : "medio"
                  }`}
                >
                  <div className="fg-alert-body">
                    <div className="fg-alert-title">{r.title}</div>
                    <div className="fg-alert-sub">
                      {r.description ?? clientReminderKindLabels[r.kind]}
                    </div>
                    <div className="fg-alert-ctx">
                      Vencimento: {formatDate(r.dueDate)}
                    </div>
                  </div>
                  <div className="fg-alert-meta">
                    <StatusBadge
                      tone={REMINDER_TONE[r.severity]}
                      label={clientReminderKindLabels[r.kind]}
                      withDot={false}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Pagamentos recentes" padding={false}>
          {!canReadFinance ? (
            <p className="fg-empty-desc" style={{ padding: 20 }}>
              Dados financeiros restritos.
            </p>
          ) : payments.length === 0 ? (
            <p className="fg-empty-desc" style={{ padding: 20 }}>
              Nenhum pagamento vinculado.
            </p>
          ) : (
            <table className="fg-mini-table">
              <tbody>
                {payments.slice(0, 5).map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="fg-cell-strong">{p.description}</div>
                      <div className="fg-cell-sub">
                        {formatCompetence(p.competence)} ·{" "}
                        {formatDate(p.dueDate)}
                      </div>
                    </td>
                    <td className="right">
                      <StatusBadge
                        tone={PAYMENT_STATUS_TONE[p.status]}
                        label={clientFinancialStatusLabels[p.status]}
                        withDot={false}
                      />
                      <div className="fg-cell-sub fg-tabular">
                        {formatMoney(p.amount)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}

/* ───────────────────────── Pagamentos ───────────────────────── */
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
    return (
      <Card padding={false}>
        <p className="fg-empty-desc" style={{ padding: 32, textAlign: "center" }}>
          Dados financeiros restritos.
        </p>
      </Card>
    );
  }

  return (
    <Card title="Histórico financeiro" padding={false}>
      <div className="fg-table-wrap" style={{ border: 0, borderRadius: 0 }}>
        <table className="fg-table fg-table-regular">
          <thead>
            <tr>
              <th>Competência</th>
              <th>Vencimento</th>
              <th className="right">Valor previsto</th>
              <th className="right">Valor recebido</th>
              <th>Método</th>
              <th>Status</th>
              <th>Recebimento</th>
              {canWriteFinance ? <th className="right">Ação</th> : null}
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td
                  className="fg-mini-empty"
                  colSpan={canWriteFinance ? 8 : 7}
                >
                  Nenhuma entrada financeira vinculada.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr
                  key={p.id}
                  className={p.status === "overdue" ? "attn-danger" : ""}
                >
                  <td className="fg-cell-strong fg-tabular">
                    {formatCompetence(p.competence)}
                  </td>
                  <td className="fg-tabular">{formatDate(p.dueDate)}</td>
                  <td className="right fg-tabular">{formatMoney(p.amount)}</td>
                  <td className="right fg-tabular fg-muted">
                    {formatMoney(p.receivedAmount)}
                  </td>
                  <td className="fg-muted">
                    {p.paymentMethod ?? profile.paymentMethod ?? "—"}
                  </td>
                  <td>
                    <StatusBadge
                      tone={PAYMENT_STATUS_TONE[p.status]}
                      label={clientFinancialStatusLabels[p.status]}
                    />
                  </td>
                  <td className="fg-tabular fg-muted">
                    {formatDate(p.receivedDate)}
                  </td>
                  {canWriteFinance ? (
                    <td className="right">
                      {p.status !== "received" && p.status !== "cancelled" ? (
                        <form
                          action={markClientPaymentReceivedAction}
                          style={{ display: "inline-flex", justifyContent: "flex-end" }}
                        >
                          <input name="id" type="hidden" value={p.id} />
                          <input
                            name="paymentMethod"
                            type="hidden"
                            value={p.paymentMethod ?? profile.paymentMethod ?? ""}
                          />
                          <button
                            type="submit"
                            className="fg-icon-btn sm"
                            aria-label="Marcar como recebido"
                            title="Marcar como recebido"
                          >
                            <CheckCircle2 size={14} />
                          </button>
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
    </Card>
  );
}

/* ───────────────────────── Cobrança ─────────────────────────── */
function BillingTab({
  canEditBilling,
  clientId,
  ownerOptions,
  profile,
}: {
  canEditBilling: boolean;
  clientId: string;
  ownerOptions: { id: string; name: string }[];
  profile: ClientBillingProfileDetail;
}) {
  if (!canEditBilling) {
    return (
      <Card title="Dados de cobrança">
        <dl className="fg-deflist">
          <div>
            <dt>Dia de vencimento</dt>
            <dd>Dia {profile.billingDay}</dd>
          </div>
          <div>
            <dt>Método padrão</dt>
            <dd>{profile.paymentMethod ?? "—"}</dd>
          </div>
          <div>
            <dt>Prazo de pagamento</dt>
            <dd>{profile.paymentTermsDays} dia(s)</dd>
          </div>
          <div>
            <dt>Recorrência</dt>
            <dd>Mensal</dd>
          </div>
          <div>
            <dt>Contato financeiro</dt>
            <dd>{profile.financialContactName ?? "—"}</dd>
          </div>
          <div>
            <dt>E-mail financeiro</dt>
            <dd>{profile.financialEmail ?? "—"}</dd>
          </div>
        </dl>
      </Card>
    );
  }

  return (
    <Card title="Perfil de cobrança">
      <form action={updateClientBillingProfileAction} className="fg-form">
        <input name="clientId" type="hidden" value={clientId} />

        <div className="fg-form-row">
          <div className="fg-field">
            <label className="fg-label">
              Fee mensal<span className="fg-required">*</span>
            </label>
            <MoneyInput name="monthlyFee" required defaultValue={profile.monthlyFee ?? null} />
          </div>
          <div className="fg-field">
            <label className="fg-label">
              Dia vencimento<span className="fg-required">*</span>
            </label>
            <div className="fg-input-wrap">
              <input
                className="fg-input fg-tabular"
                defaultValue={profile.billingDay}
                max={31}
                min={1}
                name="billingDay"
                required
                type="number"
              />
            </div>
          </div>
        </div>

        <div className="fg-form-row">
          <div className="fg-field">
            <label className="fg-label">Método padrão</label>
            <div className="fg-input-wrap">
              <input
                className="fg-input"
                defaultValue={profile.paymentMethod ?? ""}
                maxLength={80}
                name="paymentMethod"
              />
            </div>
          </div>
          <div className="fg-field">
            <label className="fg-label">Prazo pagamento (dias)</label>
            <div className="fg-input-wrap">
              <input
                className="fg-input fg-tabular"
                defaultValue={profile.paymentTermsDays}
                max={90}
                min={0}
                name="paymentTermsDays"
                type="number"
              />
            </div>
          </div>
        </div>

        <div className="fg-form-section-label">Responsável e geração</div>

        <div className="fg-form-row">
          <div className="fg-field">
            <label className="fg-label">Recorrência</label>
            <div className="fg-input-wrap">
              <select
                className="fg-input fg-select"
                defaultValue={profile.recurrence}
                name="recurrence"
              >
                <option value="monthly">Mensal</option>
              </select>
            </div>
          </div>
          <div className="fg-field">
            <label className="fg-label">Responsável pela cobrança</label>
            <div className="fg-input-wrap">
              <select
                className="fg-input fg-select"
                defaultValue={profile.billingOwnerEmployeeId ?? ""}
                name="billingOwnerEmployeeId"
              >
                <option value="">Sem responsável</option>
                {ownerOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <label className="fg-checkbox">
          <input
            defaultChecked={profile.autoGenerateEntries}
            name="autoGenerateEntries"
            type="checkbox"
          />
          <span className="fg-checkbox-box" />
          <span className="fg-checkbox-label">
            Gerar entrada prevista automaticamente todo mês
          </span>
        </label>

        <div className="fg-form-section-label">Contato financeiro</div>

        <div className="fg-form-row">
          <div className="fg-field">
            <label className="fg-label">Nome</label>
            <div className="fg-input-wrap">
              <input
                className="fg-input"
                defaultValue={profile.financialContactName ?? ""}
                maxLength={160}
                name="financialContactName"
              />
            </div>
          </div>
          <div className="fg-field">
            <label className="fg-label">E-mail</label>
            <div className="fg-input-wrap">
              <input
                className="fg-input"
                defaultValue={profile.financialEmail ?? ""}
                maxLength={160}
                name="financialEmail"
                type="email"
              />
            </div>
          </div>
        </div>
        <div className="fg-field">
          <label className="fg-label">Telefone / WhatsApp</label>
          <div className="fg-input-wrap">
            <input
              className="fg-input"
              defaultValue={profile.financialPhone ?? ""}
              maxLength={40}
              name="financialPhone"
            />
          </div>
        </div>

        <div className="fg-form-section-label">Lembretes</div>

        <div className="fg-form-row">
          <div className="fg-field">
            <label className="fg-label">Antes do vencimento (dias)</label>
            <div className="fg-input-wrap">
              <input
                className="fg-input fg-tabular"
                defaultValue={profile.reminderBeforeDays}
                max={30}
                min={0}
                name="reminderBeforeDays"
                type="number"
              />
            </div>
          </div>
          <div className="fg-field">
            <label className="fg-label">Após vencimento (dias)</label>
            <div className="fg-input-wrap">
              <input
                className="fg-input fg-tabular"
                defaultValue={profile.reminderAfterDays}
                max={30}
                min={0}
                name="reminderAfterDays"
                type="number"
              />
            </div>
          </div>
        </div>

        <div className="fg-field">
          <label className="fg-label">Observações de cobrança</label>
          <textarea
            className="fg-input fg-textarea"
            defaultValue={profile.notes ?? ""}
            maxLength={1200}
            name="notes"
            rows={4}
          />
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button
            className="fg-btn fg-btn-primary fg-btn-default"
            type="submit"
          >
            <Save size={14} aria-hidden />
            <span>Salvar cobrança</span>
          </button>
        </div>
      </form>
    </Card>
  );
}

function GenerateExpectedEntryForm({ clientId }: { clientId: string }) {
  return (
    <form action={generateClientExpectedEntryAction} className="fg-form">
      <input name="clientId" type="hidden" value={clientId} />
      <div className="fg-field">
        <label className="fg-label">
          Competência<span className="fg-required">*</span>
        </label>
        <div className="fg-input-wrap">
          <input
            className="fg-input fg-tabular"
            defaultValue={new Date().toISOString().slice(0, 7)}
            name="competence"
            required
            type="month"
          />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="fg-btn fg-btn-primary fg-btn-default" type="submit">
          <Plus size={14} aria-hidden />
          <span>Gerar entrada prevista</span>
        </button>
      </div>
    </form>
  );
}

/* ───────────────────────── Contratos ────────────────────────── */
function ContractsTab() {
  return (
    <Card title="Contratos e documentos">
      <p className="fg-empty-desc">
        Nenhum contrato ou documento vinculado.
      </p>
    </Card>
  );
}

/* ───────────────────────── Histórico ────────────────────────── */
function HistoryTab({ auditLogs }: { auditLogs: ClientAuditLogItem[] }) {
  if (auditLogs.length === 0) {
    return (
      <Card title="Histórico">
        <p className="fg-empty-desc">Sem logs recentes.</p>
      </Card>
    );
  }

  return (
    <Card title="Histórico" padding={false}>
      <ul
        className="fg-timeline fg-timeline-vertical"
        style={{ padding: 20 }}
      >
        {auditLogs.map((log) => (
          <li key={log.id} className="fg-tl-step fg-tl-done">
            <span className="fg-tl-dot" />
            <div>
              <div className="fg-tl-label">{formatAuditAction(log.action)}</div>
              <div className="fg-tl-meta">
                {log.actorName ?? log.actorEmail ?? "Sistema"}
                {formatAuditMetadata(log.metadata)
                  ? ` · ${formatAuditMetadata(log.metadata)}`
                  : ""}
                {" · "}
                {formatDateTime(log.createdAt)}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ───────────────────────── Observações ──────────────────────── */
function NotesTab({
  canWrite,
  clientId,
  notes,
}: {
  canWrite: boolean;
  clientId: string;
  notes: string | null;
}) {
  return (
    <Card
      title="Observações internas"
      action={
        canWrite ? (
          <ActionSheet
            title="Editar observações"
            description="Notas internas, visíveis apenas para a equipe."
            trigger={
              <Button variant="outline" size="sm" icon={<Pencil size={14} />}>
                Editar
              </Button>
            }
          >
            <form action={updateClientInternalNotesAction} className="fg-form">
              <input name="id" type="hidden" value={clientId} />
              <textarea
                className="fg-input fg-textarea"
                defaultValue={notes ?? ""}
                maxLength={2000}
                name="notes"
                rows={10}
              />
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="fg-btn fg-btn-primary fg-btn-default"
                  type="submit"
                >
                  <Save size={14} aria-hidden />
                  <span>Salvar observações</span>
                </button>
              </div>
            </form>
          </ActionSheet>
        ) : null
      }
    >
      <p
        style={{
          whiteSpace: "pre-wrap",
          color: "var(--ink-700)",
          margin: 0,
        }}
      >
        {notes?.trim() ? notes : "Sem observações internas."}
      </p>
    </Card>
  );
}

/* ───────────────────────── Helpers ──────────────────────────── */

function ClientStatusActions({
  id,
  status,
}: {
  id: string;
  status: ClientStatus;
}) {
  return (
    <>
      {status !== "active" ? (
        <StatusButton id={id} target="active" title="Ativar" tone="primary">
          <CheckCircle2 size={14} />
        </StatusButton>
      ) : null}
      {status !== "paused" ? (
        <StatusButton id={id} target="paused" title="Pausar" tone="warning">
          <CheckCircle2 size={14} />
        </StatusButton>
      ) : null}
      {status !== "cancelled" ? (
        <StatusButton id={id} target="cancelled" title="Cancelar" tone="destructive">
          <Ban size={14} />
        </StatusButton>
      ) : null}
    </>
  );
}

function StatusButton({
  id,
  target,
  title,
  tone,
  children,
}: {
  id: string;
  target: ClientStatus;
  title: string;
  tone: "primary" | "warning" | "destructive";
  children: React.ReactNode;
}) {
  const color =
    tone === "destructive"
      ? "var(--status-danger-text)"
      : tone === "warning"
        ? "var(--status-warning-text)"
        : undefined;
  return (
    <form action={updateClientStatusAction} style={{ display: "inline" }}>
      <input name="id" type="hidden" value={id} />
      <input name="status" type="hidden" value={target} />
      <button
        type="submit"
        className="fg-icon-btn"
        aria-label={title}
        title={title}
        style={color ? { color } : undefined}
      >
        {children}
      </button>
    </form>
  );
}

function formatAuditAction(action: string) {
  const labels: Record<string, string> = {
    create: "Criação",
    status_change: "Mudança de status",
    update: "Edição",
  };
  return labels[action] ?? action;
}

function formatAuditMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const data = metadata as { section?: unknown; status?: unknown };
  if (typeof data.section === "string") {
    return data.section === "billing_profile" ? "Cobrança" : "Observações internas";
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
  return tabs.some((t) => t.id === value) ? (value as ClientTab) : "resumo";
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

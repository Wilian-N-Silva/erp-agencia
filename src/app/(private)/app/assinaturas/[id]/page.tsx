import {
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  Link2,
  RefreshCw,
  Unlink,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";

import { ActionSheet, Button, KpiCard, Page, StatusBadge } from "@/components/fg";
import { Card, InlineAlert } from "@/components/fg/atoms";
import {
  cancelSaasSubscriptionAction,
  linkEmployeeToSaasSubscriptionAction,
  markSaasSubscriptionRenewedAction,
  unlinkEmployeeFromSaasSubscriptionAction,
} from "@/features/saas/actions";
import {
  listSaasEmployeeOptions,
  listSaasSubscriptions,
  type SaasEmployeeOption,
  type SaasSubscriptionListItem,
} from "@/features/saas/dal";
import {
  canReadSaasCost,
  canWriteSaasSubscriptions,
  saasSubscriptionStatusLabels,
  saasUserStatusLabels,
  type SaasSubscriptionStatus,
} from "@/features/saas/rules";
import { formatDate, formatMoney } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<SaasSubscriptionStatus, string> = {
  active: "ativo",
  trial: "previsto",
  suspended: "pausado",
  cancelled: "cancelado",
  renewing: "aguardando_envio",
  cancel_scheduled: "atrasado",
};

const RENEWAL_TONE: Record<
  SaasSubscriptionListItem["renewalState"],
  { label: string; tone: "danger" | "warning" | "success" | "muted" }
> = {
  overdue: { label: "Vencida", tone: "danger" },
  due_soon: { label: "Próxima", tone: "warning" },
  ok: { label: "Em dia", tone: "success" },
  none: { label: "Sem data", tone: "muted" },
};

const tabs = [
  { id: "resumo", label: "Resumo" },
  { id: "usuarios", label: "Usuários vinculados" },
  { id: "renovacoes", label: "Renovações" },
  { id: "contrato", label: "Contrato" },
] as const;

type SaasTab = (typeof tabs)[number]["id"];

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SaasDetailPage({ params, searchParams }: PageProps) {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!canAny(["saas.read", "saas.write", "saas.configure"], context)) {
    redirect("/acesso-negado");
  }

  const { id } = await params;
  if (!isUuid(id)) notFound();

  const sp = (await searchParams) ?? {};
  const activeTab = normalizeTab(firstValue(sp.tab));

  const [subscriptions, employeeOptions] = await Promise.all([
    listSaasSubscriptions(context),
    canWriteSaasSubscriptions(context)
      ? listSaasEmployeeOptions(context)
      : Promise.resolve([]),
  ]);

  const subscription = subscriptions.find((s) => s.id === id);
  if (!subscription) notFound();

  const canWrite = canWriteSaasSubscriptions(context);
  const canSeeCosts = canReadSaasCost(context);

  const activeLicenses = subscription.linkedUsers.filter((u) => u.status === "active");
  const terminatedHoldingLicense = activeLicenses.filter(
    (u) => u.employeeStatus === "terminated",
  );
  const monthlyCostNum = subscription.costHidden
    ? null
    : Number.parseFloat(subscription.monthlyCost ?? "0");
  const annualNum = monthlyCostNum !== null ? monthlyCostNum * 12 : null;
  const renewal = RENEWAL_TONE[subscription.renewalState];

  return (
    <Page>
      <Link href={"/app/assinaturas" as Route} className="fg-back">
        <ArrowLeft size={14} />
        <span>Voltar para Assinaturas</span>
      </Link>

      <div className="fg-detail-head">
        <div
          className="fg-saas-logo lg"
          style={{ background: `oklch(0.62 0.13 ${(subscription.name.charCodeAt(0) * 47) % 360})` }}
        >
          {subscription.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="fg-detail-head-meta">
          <div className="fg-detail-eyebrow">
            <span>{subscription.provider ?? "—"}</span>
            <span>·</span>
            <span>{subscription.category}</span>
            {subscription.responsibleUserName ? (
              <>
                <span>·</span>
                <span>Resp. {subscription.responsibleUserName}</span>
              </>
            ) : null}
          </div>
          <h1 className="fg-detail-title">{subscription.name}</h1>
          <div className="fg-detail-badges">
            <StatusBadge
              status={STATUS_TONE[subscription.status]}
              label={saasSubscriptionStatusLabels[subscription.status]}
            />
            <StatusBadge
              tone={renewal.tone}
              label={`Renovação ${renewal.label}`}
              withDot={false}
            />
            <StatusBadge
              tone="muted"
              label={
                subscription.costHidden
                  ? "Custo restrito"
                  : `${formatMoney(subscription.monthlyCost)}/mês`
              }
              withDot={false}
            />
            <StatusBadge
              tone="muted"
              label={`${activeLicenses.length} licenças ativas`}
              withDot={false}
            />
          </div>
        </div>
        <div className="fg-detail-head-actions">
          {canWrite ? (
            <>
              <ActionSheet
                title="Vincular colaborador"
                description={`Adicionar acesso à ${subscription.name}.`}
                trigger={
                  <Button variant="outline" size="sm" icon={<Link2 size={14} />}>
                    Vincular
                  </Button>
                }
              >
                <LinkSubscriptionForm
                  employeeOptions={employeeOptions}
                  subscriptionId={subscription.id}
                />
              </ActionSheet>
              <ActionSheet
                title="Renovar assinatura"
                description="Defina a nova data de renovação."
                trigger={
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<RefreshCw size={14} />}
                  >
                    Renovar
                  </Button>
                }
              >
                <RenewSubscriptionForm
                  id={subscription.id}
                  renewalDate={subscription.renewalDate}
                />
              </ActionSheet>
            </>
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
                href={`/app/assinaturas/${subscription.id}?tab=${t.id}` as Route}
              >
                <span>{t.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="fg-detail-body">
        {terminatedHoldingLicense.length > 0 ? (
          <InlineAlert
            tone="danger"
            icon={<AlertTriangle size={14} />}
            title={`${terminatedHoldingLicense.length} colaborador${
              terminatedHoldingLicense.length > 1 ? "es" : ""
            } desligado${
              terminatedHoldingLicense.length > 1 ? "s" : ""
            } com licença ativa`}
            description={`Revogar acesso: ${terminatedHoldingLicense
              .map((u) => u.employeeName)
              .join(", ")}.`}
          />
        ) : null}

        {activeTab === "resumo" ? (
          <ResumoTab
            subscription={subscription}
            activeLicenses={activeLicenses.length}
            monthlyCostNum={monthlyCostNum}
            annualNum={annualNum}
            canSeeCosts={canSeeCosts}
          />
        ) : null}

        {activeTab === "usuarios" ? (
          <UsuariosTab subscription={subscription} canWrite={canWrite} />
        ) : null}

        {activeTab === "renovacoes" ? (
          <RenovacoesTab subscription={subscription} />
        ) : null}

        {activeTab === "contrato" ? (
          <ContratoTab subscription={subscription} canWrite={canWrite} />
        ) : null}
      </div>
    </Page>
  );
}

/* ──────────────────── Resumo ──────────────────── */
function ResumoTab({
  subscription,
  activeLicenses,
  monthlyCostNum,
  annualNum,
}: {
  subscription: SaasSubscriptionListItem;
  activeLicenses: number;
  monthlyCostNum: number | null;
  annualNum: number | null;
  canSeeCosts: boolean;
}) {
  const costPerLicense =
    monthlyCostNum !== null && activeLicenses > 0
      ? monthlyCostNum / activeLicenses
      : null;

  return (
    <>
      <div className="fg-grid fg-grid-kpis" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <KpiCard
          label="Custo mensal"
          value={
            monthlyCostNum !== null
              ? formatMoney(String(monthlyCostNum.toFixed(2)))
              : "Restrito"
          }
          secondary="por mês"
          accent
        />
        <KpiCard
          label="Custo anualizado"
          value={
            annualNum !== null ? formatMoney(String(annualNum.toFixed(2))) : "Restrito"
          }
          secondary="estimativa 12m"
        />
        <KpiCard
          label="Licenças"
          value={String(activeLicenses)}
          secondary="ativas"
        />
        <KpiCard
          label="Próx. renovação"
          value={formatDate(subscription.renewalDate)}
          secondary={
            costPerLicense !== null
              ? `${formatMoney(String(costPerLicense.toFixed(2)))} / licença`
              : "—"
          }
        />
      </div>

      <div className="fg-grid fg-grid-2">
        <Card title="Dados da assinatura">
          <dl className="fg-deflist">
            <div>
              <dt>Fornecedor</dt>
              <dd>{subscription.provider ?? "—"}</dd>
            </div>
            <div>
              <dt>Categoria</dt>
              <dd>{subscription.category}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{saasSubscriptionStatusLabels[subscription.status]}</dd>
            </div>
            <div>
              <dt>Responsável</dt>
              <dd>{subscription.responsibleUserName ?? "—"}</dd>
            </div>
            <div className="full">
              <dt>Observações</dt>
              <dd>{subscription.notes ?? "Sem observações."}</dd>
            </div>
          </dl>
        </Card>

        <Card
          title="Conexão com financeiro"
          description="Esta assinatura aparece em Saídas / Provisões do módulo financeiro."
        >
          <dl className="fg-deflist">
            <div>
              <dt>Categoria em Saídas</dt>
              <dd>SaaS</dd>
            </div>
            <div>
              <dt>Periodicidade</dt>
              <dd>Mensal</dd>
            </div>
          </dl>
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <Link href={"/app/financeiro/saidas" as Route} className="fg-btn fg-btn-outline fg-btn-sm">
              <ExternalLink size={14} aria-hidden />
              <span>Abrir em Saídas</span>
            </Link>
            <Link href={"/app/financeiro/provisoes" as Route} className="fg-btn fg-btn-outline fg-btn-sm">
              <ExternalLink size={14} aria-hidden />
              <span>Ver provisão</span>
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}

/* ──────────────────── Usuários vinculados ──────────────────── */
function UsuariosTab({
  subscription,
  canWrite,
}: {
  subscription: SaasSubscriptionListItem;
  canWrite: boolean;
}) {
  if (subscription.linkedUsers.length === 0) {
    return (
      <Card>
        <p className="fg-empty-desc">Nenhum colaborador vinculado.</p>
      </Card>
    );
  }

  return (
    <Card title={`Usuários (${subscription.linkedUsers.length})`} padding={false}>
      <div className="fg-table-wrap" style={{ border: 0, borderRadius: 0 }}>
        <table className="fg-table fg-table-regular">
          <thead>
            <tr>
              <th>Colaborador</th>
              <th>Status emprego</th>
              <th>Status licença</th>
              <th>Concedido</th>
              {canWrite ? <th className="right">Ação</th> : null}
            </tr>
          </thead>
          <tbody>
            {subscription.linkedUsers.map((u) => {
              const isCritical =
                u.status === "active" && u.employeeStatus === "terminated";
              const statusLabel =
                u.status in saasUserStatusLabels
                  ? saasUserStatusLabels[u.status as keyof typeof saasUserStatusLabels]
                  : u.status;
              return (
                <tr key={u.employeeId} className={isCritical ? "attn-danger" : ""}>
                  <td className="fg-cell-strong">{u.employeeName}</td>
                  <td>
                    {u.employeeStatus === "terminated" ? (
                      <StatusBadge tone="danger" label="Desligado" />
                    ) : (
                      <StatusBadge tone="muted" label={u.employeeStatus} withDot={false} />
                    )}
                  </td>
                  <td>
                    <StatusBadge
                      tone={u.status === "active" ? "success" : "muted"}
                      label={statusLabel}
                    />
                  </td>
                  <td className="fg-tabular fg-muted">
                    {u.linkedAt instanceof Date
                      ? u.linkedAt.toLocaleDateString("pt-BR")
                      : "—"}
                  </td>
                  {canWrite ? (
                    <td className="right">
                      {u.status === "active" ? (
                        <form
                          action={unlinkEmployeeFromSaasSubscriptionAction}
                          style={{ display: "inline" }}
                        >
                          <input
                            name="subscriptionId"
                            type="hidden"
                            value={subscription.id}
                          />
                          <input name="employeeId" type="hidden" value={u.employeeId} />
                          <button
                            type="submit"
                            className={`fg-btn fg-btn-sm ${
                              isCritical ? "fg-btn-destructive" : "fg-btn-outline"
                            }`}
                          >
                            <Unlink size={12} aria-hidden />
                            <span>{isCritical ? "Revogar acesso" : "Desvincular"}</span>
                          </button>
                        </form>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ──────────────────── Renovações ──────────────────── */
function RenovacoesTab({ subscription }: { subscription: SaasSubscriptionListItem }) {
  const renewal = RENEWAL_TONE[subscription.renewalState];
  return (
    <Card title="Renovações" padding={false}>
      <ul className="fg-timeline fg-timeline-vertical" style={{ padding: 20 }}>
        <li
          className={`fg-tl-step ${
            subscription.renewalState === "overdue" ? "fg-tl-rejected" : "fg-tl-current"
          }`}
        >
          <span className="fg-tl-dot" />
          <div>
            <div className="fg-tl-label">
              Próxima renovação · {formatDate(subscription.renewalDate)}
            </div>
            <div className="fg-tl-meta">Estado: {renewal.label}</div>
          </div>
        </li>
        <li className="fg-tl-step fg-tl-done">
          <span className="fg-tl-dot" />
          <div>
            <div className="fg-tl-label">Renovação anterior</div>
            <div className="fg-tl-meta">
              Histórico de renovações ainda não rastreado no sistema.
            </div>
          </div>
        </li>
      </ul>
    </Card>
  );
}

/* ──────────────────── Contrato ──────────────────── */
function ContratoTab({
  subscription,
  canWrite,
}: {
  subscription: SaasSubscriptionListItem;
  canWrite: boolean;
}) {
  return (
    <Card
      title="Contrato"
      action={
        canWrite ? (
          <form action={cancelSaasSubscriptionAction} style={{ display: "inline" }}>
            <input name="id" type="hidden" value={subscription.id} />
            <button
              type="submit"
              className="fg-btn fg-btn-outline fg-btn-sm"
              style={{ color: "var(--status-danger-text)" }}
            >
              Cancelar assinatura
            </button>
          </form>
        ) : null
      }
    >
      <p className="fg-empty-desc">
        Documento de contrato ainda não vinculado a esta assinatura.
      </p>
    </Card>
  );
}

/* ──────────────────── Forms ──────────────────── */
function LinkSubscriptionForm({
  employeeOptions,
  subscriptionId,
}: {
  employeeOptions: SaasEmployeeOption[];
  subscriptionId: string;
}) {
  return (
    <form action={linkEmployeeToSaasSubscriptionAction} className="fg-form">
      <input name="subscriptionId" type="hidden" value={subscriptionId} />
      <div className="fg-field">
        <label className="fg-label">
          Colaborador<span className="fg-required">*</span>
        </label>
        <div className="fg-input-wrap">
          <select className="fg-input fg-select" name="employeeId" required>
            <option value="">Selecionar colaborador</option>
            {employeeOptions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="fg-btn fg-btn-primary fg-btn-default" type="submit">
          <Link2 size={14} aria-hidden />
          <span>Vincular</span>
        </button>
      </div>
    </form>
  );
}

function RenewSubscriptionForm({
  id,
  renewalDate,
}: {
  id: string;
  renewalDate: string | null;
}) {
  return (
    <form action={markSaasSubscriptionRenewedAction} className="fg-form">
      <input name="id" type="hidden" value={id} />
      <div className="fg-field">
        <label className="fg-label">
          Nova renovação<span className="fg-required">*</span>
        </label>
        <div className="fg-input-wrap">
          <input
            className="fg-input fg-tabular"
            defaultValue={renewalDate ?? ""}
            name="renewalDate"
            required
            type="date"
          />
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="fg-btn fg-btn-primary fg-btn-default" type="submit">
          <RefreshCw size={14} aria-hidden />
          <span>Renovar</span>
        </button>
      </div>
    </form>
  );
}

function normalizeTab(value: string | undefined): SaasTab {
  return tabs.some((t) => t.id === value) ? (value as SaasTab) : "resumo";
}

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

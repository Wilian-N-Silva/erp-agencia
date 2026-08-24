import { AlertCircle, Plus, Umbrella } from "lucide-react";

import { ActionSheet, Button, Card, EmptyState, StatusBadge } from "@/components/fg";
import { getCurrentPortalEmployeeAccess } from "@/features/portal/access";
import { PortalEmployeeLinkRequired } from "@/features/portal/employee-link-required";
import { createTimeOffRequestAction } from "@/features/timeoff/actions";
import {
  listTimeOffRequests,
  listVacationBalances,
  type TimeOffListItem,
  type VacationBalanceListItem,
} from "@/features/timeoff/dal";
import {
  getTimeOffDisplayType,
  timeOffStatusLabels,
  timeOffTypeLabels,
  type TimeOffStatus,
  type TimeOffType,
} from "@/features/timeoff/rules";
import { formatDate } from "@/features/finance/rules";

export const dynamic = "force-dynamic";

export default async function PortalTimeOffPage() {
  const access = await getCurrentPortalEmployeeAccess();
  if (!access) {
    return <PortalEmployeeLinkRequired />;
  }

  const { context, employee } = access;
  const isCLT = employee.employmentType === "clt";

  const [requests, balances] = await Promise.all([
    listTimeOffRequests(context, { ownOnly: true }),
    isCLT && context.employeeId
      ? listVacationBalances(context, { employeeId: context.employeeId })
      : Promise.resolve([]),
  ]);

  const activeBalance = balances.find((b) => b.status === "active") ?? null;

  return (
    <>
      <div className="fg-portal-page-head">
        <h1 className="fg-portal-h1">{isCLT ? "Minhas férias" : "Minhas pausas"}</h1>
        <NewTimeOffSheet employmentType={employee.employmentType} />
      </div>

      {activeBalance ? <VacationHero balance={activeBalance} /> : null}

      {requests.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Umbrella size={32} />}
            title="Nenhuma solicitação registrada"
            description="Programe suas férias ou pausas com antecedência para facilitar a aprovação."
          />
        </Card>
      ) : (
        <Card title="Histórico de solicitações" padding={false}>
          <ul className="fg-portal-list" style={{ padding: 12 }}>
            {requests.map((request) => (
              <TimeOffRow
                key={request.id}
                request={request}
                employmentType={employee.employmentType}
              />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function VacationHero({ balance }: { balance: VacationBalanceListItem }) {
  return (
    <div className="fg-portal-ferias-hero">
      <div className="fg-portal-ferias-big">
        <div className="fg-portal-ferias-num fg-tabular">{balance.daysAvailable}</div>
        <div className="fg-portal-ferias-unit">dias disponíveis</div>
      </div>
      <div className="fg-portal-ferias-side">
        <div className="fg-portal-ferias-row">
          <span>Período aquisitivo</span>
          <strong className="fg-tabular">
            {formatDate(balance.periodStart)} → {formatDate(balance.periodEnd)}
          </strong>
        </div>
        <div className="fg-portal-ferias-row">
          <span>Limite de concessão</span>
          <strong className="fg-tabular">{formatDate(balance.concessionDeadline)}</strong>
        </div>
        <div className="fg-portal-ferias-row">
          <span>Dias adquiridos</span>
          <strong className="fg-tabular">{balance.daysAcquired}</strong>
        </div>
        <div className="fg-portal-ferias-row">
          <span>Dias tirados</span>
          <strong className="fg-tabular">{balance.daysTaken}</strong>
        </div>
        <div className="fg-portal-ferias-row">
          <span>Dias vendidos</span>
          <strong className="fg-tabular">{balance.daysSold}</strong>
        </div>
        {balance.expiring ? (
          <div className="fg-portal-ferias-warn">
            <AlertCircle size={13} />
            Saldo perto do limite — programe antes de {formatDate(balance.concessionDeadline)}.
          </div>
        ) : null}
        {balance.expired ? (
          <div className="fg-portal-ferias-warn">
            <AlertCircle size={13} />
            Saldo vencido — entre em contato com o RH.
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TimeOffRow({
  request,
  employmentType,
}: {
  request: TimeOffListItem;
  employmentType: string;
}) {
  return (
    <article className="fg-portal-item">
      <div className="fg-portal-item-icon">
        <Umbrella size={18} />
      </div>
      <div className="fg-portal-item-body">
        <div className="fg-portal-item-title">
          {labelForType(request.type, employmentType)} · {request.businessDays} dias úteis
        </div>
        <div className="fg-portal-item-sub">
          {formatDate(request.startDate)} → {formatDate(request.endDate)}
        </div>
        {request.notes ? (
          <div className="fg-portal-item-meta">{request.notes}</div>
        ) : null}
      </div>
      <div className="fg-portal-item-status">
        <StatusBadge status={mapStatus(request.status)} label={timeOffStatusLabels[request.status]} />
      </div>
    </article>
  );
}

function NewTimeOffSheet({ employmentType }: { employmentType: string }) {
  const isCLT = employmentType === "clt";

  return (
    <ActionSheet
      title={isCLT ? "Solicitar férias" : "Solicitar pausa"}
      description="Sua solicitação será encaminhada para aprovação do gestor."
      width={520}
      trigger={
        <Button type="button" variant="primary" icon={<Plus size={14} />}>
          {isCLT ? "Solicitar férias" : "Programar ausência"}
        </Button>
      }
    >
      <form
        action={createTimeOffRequestAction}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div className="fg-field">
          <label className="fg-label">
            Tipo<span className="fg-required">*</span>
          </label>
          <div className="fg-input-wrap">
            <select className="fg-input fg-select" name="type" required defaultValue="">
              <option value="" disabled>
                Selecionar
              </option>
              {Object.entries(timeOffTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="fg-form-row">
          <div className="fg-field">
            <label className="fg-label">
              Início<span className="fg-required">*</span>
            </label>
            <div className="fg-input-wrap">
              <input className="fg-input fg-tabular" name="startDate" type="date" required />
            </div>
          </div>
          <div className="fg-field">
            <label className="fg-label">
              Fim<span className="fg-required">*</span>
            </label>
            <div className="fg-input-wrap">
              <input className="fg-input fg-tabular" name="endDate" type="date" required />
            </div>
          </div>
        </div>
        <div className="fg-field">
          <label className="fg-label">Observações</label>
          <textarea
            className="fg-input fg-textarea"
            name="notes"
            maxLength={1000}
            rows={3}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button type="submit" variant="primary" icon={<Plus size={14} />}>
            Enviar solicitação
          </Button>
        </div>
      </form>
    </ActionSheet>
  );
}

function labelForType(type: string, employmentType: string) {
  if (type === "vacation" || type === "planned_pause" || type === "absence") {
    return getTimeOffDisplayType(employmentType, type as TimeOffType);
  }
  return timeOffTypeLabels[type as keyof typeof timeOffTypeLabels] ?? type;
}

function mapStatus(status: TimeOffStatus) {
  switch (status) {
    case "approved":
      return "aprovada";
    case "rejected":
      return "recusada";
    case "cancelled":
      return "cancelado";
    default:
      return "aguardando_envio";
  }
}

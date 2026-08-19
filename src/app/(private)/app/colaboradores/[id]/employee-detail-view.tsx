"use client";

import {
  BadgeDollarSign,
  CalendarDays,
  ChevronLeft,
  Download,
  Eye,
  EyeOff,
  FileUp,
  FileText,
  KeyRound,
  Laptop,
  MoreHorizontal,
  Pencil,
  ReceiptText,
  Save,
  ShieldAlert,
  Umbrella,
  UserMinus,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  ActionSheet,
  Avatar,
  Card,
  Dropdown,
  EmptyState,
  KpiCard,
  MoneyInput,
  RateLimitedActionForm,
  Sheet,
  StatusBadge,
  Tabs,
  Tag,
  useToast,
} from "@/components/fg";
import { registerDocumentAction } from "@/features/documents/actions";
import {
  documentTypeLabels,
  documentVisibilityLabels,
  fileSensitivityLabels,
  type DocumentOwnerType,
  type DocumentType,
  type DocumentVisibility,
  type FileSensitivity,
} from "@/features/documents/rules";
import { assignEquipmentAction } from "@/features/equipment/actions";
import { formatCompetence, formatDate, formatMoney } from "@/features/finance/rules";
import { createLifecycleChecklistAction } from "@/features/lifecycle/actions";
import { updateEmployeeAction } from "@/features/people/actions";
import { createReimbursementAction } from "@/features/portal/actions";
import type { EmployeeStatus, EmploymentType } from "@/features/people/rules";
import type {
  InvoiceRequestStatus,
  ReimbursementStatus,
} from "@/features/portal/rules";
import { createTimeOffRequestAction } from "@/features/timeoff/actions";
import type {
  TimeOffStatus,
  VacationBalanceStatus,
} from "@/features/timeoff/rules";
import type {
  AccessRecordStatus,
  AccessReviewState,
} from "@/features/accesses/rules";
import type { EquipmentStatus } from "@/features/equipment/rules";
import {
  downloadFile,
  fileDownloadErrorFeedback,
} from "@/lib/client-file-download";

type BadgeTone =
  | "success"
  | "warning"
  | "warning-soft"
  | "danger"
  | "muted"
  | "brand";

type EmployeeView = {
  id: string;
  registrationNumber: string;
  fullName: string;
  socialName: string | null;
  corporateEmail: string | null;
  personalEmail: string | null;
  phone: string | null;
  cpf: string | null;
  rg: string | null;
  birthDate: string | null;
  address: string | null;
  pix: string | null;
  emergencyContact: string | null;
  positionId: string;
  positionName: string;
  areaId: string;
  areaName: string;
  managerEmployeeId: string | null;
  managerName: string | null;
  employmentType: EmploymentType;
  startDate: string;
  endDate: string | null;
  status: EmployeeStatus;
  workModel: string | null;
  location: string | null;
  currentCompensation: string | null;
  recurringCostAllowance: string | null;
  recurringTransport: string | null;
  internalNotes: string | null;
  sensitiveProfileHidden: boolean;
  compensationHidden: boolean;
  tenureMonths: number;
  updatedAt: string;
};

type PeopleOptions = {
  areas: { id: string; name: string }[];
  managers: { id: string; name: string }[];
  positions: { id: string; name: string }[];
};

type CompensationHistoryView = {
  id: string;
  previousAmount: string | null;
  newAmount: string | null;
  differenceAmount: string | null;
  effectiveDate: string;
  reason: string;
  approvedByName: string | null;
  createdByName: string | null;
  createdAt: string;
  compensationHidden: boolean;
};

type BenefitView = {
  id: string;
  benefitType: string;
  name: string;
  amount: string | null;
  recurring: boolean;
  startDate: string;
  endDate: string | null;
  status: string;
  notes: string | null;
  activeForComposition: boolean;
  compensationHidden: boolean;
};

type VacationBalanceView = {
  id: string;
  periodStart: string;
  periodEnd: string;
  concessionDeadline: string;
  daysAcquired: number;
  daysSold: number;
  daysTaken: number;
  daysAvailable: number;
  status: VacationBalanceStatus;
  expiring: boolean;
  expired: boolean;
  notes: string | null;
};

type TimeOffView = {
  id: string;
  type: string;
  startDate: string;
  endDate: string;
  businessDays: number;
  soldDays: number;
  status: TimeOffStatus;
  notes: string | null;
};

type EquipmentView = {
  id: string;
  assetNumber: string;
  type: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  status: EquipmentStatus;
  notes: string | null;
  returnAlert: boolean;
};

type AssignableEquipmentView = {
  id: string;
  assetNumber: string;
  type: string;
  brand: string | null;
  model: string | null;
  status: EquipmentStatus;
  currentEmployeeName: string | null;
};

type DocumentView = {
  id: string;
  ownerType: DocumentOwnerType | string;
  documentType: DocumentType | string;
  originalName: string;
  extension: string;
  byteSize: number;
  sensitivity: FileSensitivity;
  visibility: DocumentVisibility;
  version: number;
  status: string;
  createdAt: string;
};

type AccessRecordView = {
  id: string;
  platform: string;
  accountIdentifier: string | null;
  accessLevel: string;
  critical: boolean;
  status: AccessRecordStatus;
  reviewDueDate: string | null;
  responsibleUserName: string | null;
  reviewState: AccessReviewState;
  alert: boolean;
};

type InvoiceView = {
  id: string;
  competence: string;
  dueDate: string;
  expectedAmount: string;
  issuedAmount: string | null;
  status: InvoiceRequestStatus;
  divergence: boolean;
};

type ReimbursementView = {
  id: string;
  title: string;
  category: string;
  amount: string;
  expenseDate: string;
  status: ReimbursementStatus;
  includedInvoiceRequestId: string | null;
  paidAt: string | null;
};

type AuditLogView = {
  id: string;
  action: string;
  actorName: string | null;
  actorEmail: string | null;
  createdAt: string;
};

type EmployeeDetailActions = {
  canAssignEquipment: boolean;
  canEdit: boolean;
  canExportProfile: boolean;
  canRegisterReimbursement: boolean;
  canRequestTimeOff: boolean;
  canStartOffboarding: boolean;
  canUploadDocument: boolean;
};

interface EmployeeDetailViewProps {
  employee: EmployeeView;
  options: PeopleOptions | null;
  actions: EmployeeDetailActions;
  auditLogs: AuditLogView[];
  compensationHistory: CompensationHistoryView[];
  benefits: BenefitView[];
  vacationSummary: {
    current: VacationBalanceView | null;
    history: VacationBalanceView[];
  };
  timeOffRequests: TimeOffView[];
  equipmentItems: EquipmentView[];
  assignableEquipmentItems: AssignableEquipmentView[];
  documents: DocumentView[];
  accessRecords: AccessRecordView[];
  invoiceRequests: InvoiceView[];
  reimbursements: ReimbursementView[];
}

const BASE_TABS = [
  { value: "resumo", label: "Resumo" },
  { value: "dados", label: "Dados pessoais" },
  { value: "vinculo", label: "Vinculo e cargo" },
  { value: "remuneracao", label: "Remuneracao" },
  { value: "ferias", label: "Ferias / Pausas" },
  { value: "documentos", label: "Documentos" },
  { value: "equipamentos", label: "Equipamentos" },
  { value: "acessos", label: "Acessos" },
  { value: "nfs", label: "NFs" },
  { value: "reembolsos", label: "Reembolsos" },
  { value: "historico", label: "Historico" },
];

const employeeStatusLabels: Record<EmployeeStatus, string> = {
  active: "Ativo",
  on_vacation: "Em ferias",
  away: "Afastado",
  notice: "Em aviso",
  terminated: "Desligado",
  paused: "Pausado",
  occasional_freelancer: "Freelancer eventual",
};

const employmentTypeLabels: Record<EmploymentType, string> = {
  clt: "CLT",
  pj: "PJ",
  intern: "Estagio",
  freelancer: "Freelancer",
  partner: "Socio",
  temporary: "Temporario",
  other: "Outro",
};

const invoiceRequestStatusLabels: Record<InvoiceRequestStatus, string> = {
  draft: "Rascunho",
  published: "Aguardando envio",
  submitted: "Enviada",
  under_review: "Em conferencia",
  adjustment_requested: "Aguardando ajuste",
  approved: "Aprovada",
  rejected: "Recusada",
  paid: "Paga",
  cancelled: "Cancelada",
};

const reimbursementStatusLabels: Record<ReimbursementStatus, string> = {
  draft: "Rascunho",
  submitted: "Enviado",
  manager_approved: "Aprovado pelo gestor",
  manager_rejected: "Recusado pelo gestor",
  finance_approved: "Aprovado pelo financeiro",
  finance_rejected: "Recusado pelo financeiro",
  included_in_invoice: "Incluido na NF",
  paid: "Pago",
  cancelled: "Cancelado",
};

const timeOffStatusLabels: Record<TimeOffStatus, string> = {
  requested: "Solicitada",
  approved: "Aprovada",
  rejected: "Recusada",
  cancelled: "Cancelada",
};

const timeOffTypeLabels = {
  vacation: "Ferias",
  planned_pause: "Pausa programada",
  absence: "Ausencia programada",
} as const;

const reimbursementCategoryOptions = [
  "Transporte por aplicativo",
  "Estacionamento",
  "Combustivel/deslocamento",
  "Alimentacao",
  "Viagem",
  "Hospedagem",
  "Producao/eventos",
  "Materiais",
  "Ferramenta digital pontual",
  "Internet/home office",
  "Outros",
] as const;

const uploadAccept =
  "application/pdf,image/jpeg,image/png,application/xml,text/xml,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const vacationBalanceStatusLabels: Record<VacationBalanceStatus, string> = {
  active: "Em vigencia",
  closed: "Encerrado",
};

const accessRecordStatusLabels: Record<AccessRecordStatus, string> = {
  pending: "Pendente",
  active: "Ativo",
  suspended: "Suspenso",
  removed: "Removido",
  in_review: "Em revisao",
};

const accessReviewStateLabels: Record<AccessReviewState, string> = {
  none: "Sem revisao",
  missing: "Sem data",
  ok: "Em dia",
  due_soon: "Proxima revisao",
  overdue: "Revisao vencida",
};

const equipmentStatusLabels: Record<EquipmentStatus, string> = {
  available: "Disponivel",
  in_use: "Em uso",
  reserved: "Reservado",
  maintenance: "Manutencao",
  lost: "Perdido",
  damaged: "Danificado",
  retired: "Descartado",
  pending_return: "Pendente de devolucao",
};

export function EmployeeDetailView({
  employee,
  options,
  actions,
  auditLogs,
  compensationHistory,
  benefits,
  vacationSummary,
  timeOffRequests,
  equipmentItems,
  assignableEquipmentItems,
  documents,
  accessRecords,
  invoiceRequests,
  reimbursements,
}: EmployeeDetailViewProps) {
  const pushToast = useToast();
  const [tab, setTab] = useState("resumo");
  const [exportingProfile, setExportingProfile] = useState(false);
  const [activeAction, setActiveAction] = useState<
    "timeoff" | "reimbursement" | "equipment" | null
  >(null);
  const displayName = employee.socialName || employee.fullName;
  const managerName = employee.managerName;
  const tabs = useMemo(
    () =>
      BASE_TABS.filter((item) => {
        if (item.value === "nfs") {
          return employee.employmentType === "pj" || invoiceRequests.length > 0;
        }

        return true;
      }),
    [employee.employmentType, invoiceRequests.length],
  );
  const canAssignEquipment =
    actions.canAssignEquipment && assignableEquipmentItems.length > 0;

  const exportEmployeeProfile = async () => {
    setExportingProfile(true);
    try {
      await downloadFile(
        `/app/colaboradores/${employee.id}/exportar`,
        `ficha-${employee.registrationNumber}.txt`,
      );
    } catch (error) {
      pushToast({
        ...fileDownloadErrorFeedback(error),
        tone: "error",
      });
    } finally {
      setExportingProfile(false);
    }
  };

  return (
    <div className="fg-page">
      <Link className="fg-back" href="/app/colaboradores">
        <ChevronLeft size={14} aria-hidden />
        <span>Colaboradores</span>
      </Link>

      <div className="fg-detail-head">
        <Avatar
          name={displayName}
          size={64}
          dimmed={employee.status === "terminated"}
        />
        <div className="fg-detail-head-meta">
          <div className="fg-detail-eyebrow">
            <span className="fg-tabular">{employee.registrationNumber}</span>
            <span>-</span>
            <span>{employee.positionName}</span>
            <span>-</span>
            <span>{employee.areaName}</span>
          </div>
          <h1 className="fg-detail-title">{displayName}</h1>
          <div className="fg-detail-badges">
            <EmployeeStatusBadge status={employee.status} />
            <Tag>{employmentTypeLabels[employee.employmentType]}</Tag>
            {employee.workModel ? <Tag>{employee.workModel}</Tag> : null}
            {employee.location ? <Tag>{employee.location}</Tag> : null}
            {managerName ? (
              <span className="fg-detail-gestor">
                <span className="fg-muted">Gestor</span>
                <Avatar name={managerName} size={18} />
                <span>{managerName}</span>
              </span>
            ) : null}
          </div>
        </div>
        <div className="fg-detail-head-actions">
          {actions.canEdit && options ? (
            <ActionSheet
              title="Editar colaborador"
              description="Atualize dados pessoais, vinculo e contato."
              trigger={
                <button className="fg-btn fg-btn-primary fg-btn-sm" type="button">
                  <Pencil size={14} aria-hidden />
                  <span>Editar</span>
                </button>
              }
              width={760}
            >
              <EmployeeEditForm employee={employee} options={options} />
            </ActionSheet>
          ) : (
            <button className="fg-btn fg-btn-outline fg-btn-sm" type="button" disabled>
              <Pencil size={14} aria-hidden />
              <span>Editar</span>
            </button>
          )}
          {actions.canStartOffboarding ? (
            <ActionSheet
              title="Iniciar desligamento"
              description="Abra o checklist de desligamento deste colaborador."
              trigger={
                <button className="fg-btn fg-btn-destructive fg-btn-sm" type="button">
                  <UserMinus size={14} aria-hidden />
                  <span>Iniciar desligamento</span>
                </button>
              }
            >
              <OffboardingForm employee={employee} />
            </ActionSheet>
          ) : (
            <button className="fg-btn fg-btn-destructive fg-btn-sm" type="button" disabled>
              <UserMinus size={14} aria-hidden />
              <span>Iniciar desligamento</span>
            </button>
          )}
          <Dropdown
            align="right"
            trigger={
              <button className="fg-icon-btn" type="button" aria-label="Mais acoes">
                <MoreHorizontal size={16} aria-hidden />
              </button>
            }
            items={[
              {
                label: "Solicitar ferias",
                icon: <Umbrella size={13} />,
                disabled: !actions.canRequestTimeOff,
                onClick: () => setActiveAction("timeoff"),
              },
              {
                label: "Registrar reembolso",
                icon: <ReceiptText size={13} />,
                disabled: !actions.canRegisterReimbursement,
                onClick: () => setActiveAction("reimbursement"),
              },
              {
                label: "Atribuir equipamento",
                icon: <Laptop size={13} />,
                disabled: !canAssignEquipment,
                onClick: () => setActiveAction("equipment"),
              },
              { separator: true },
              {
                label: exportingProfile ? "Exportando ficha..." : "Exportar ficha",
                icon: <Download size={13} />,
                disabled: !actions.canExportProfile || exportingProfile,
                onClick: exportEmployeeProfile,
              },
            ]}
          />
        </div>
      </div>

      <Sheet
        open={activeAction === "timeoff"}
        onClose={() => setActiveAction(null)}
        title="Solicitar ferias"
        description="Registre uma solicitacao de ferias ou pausa para o seu proprio cadastro."
      >
        <TimeOffRequestForm employee={employee} />
      </Sheet>
      <Sheet
        open={activeAction === "reimbursement"}
        onClose={() => setActiveAction(null)}
        title="Registrar reembolso"
        description="Envie um pedido de reembolso para o seu proprio cadastro."
      >
        <ReimbursementRequestForm />
      </Sheet>
      <Sheet
        open={activeAction === "equipment"}
        onClose={() => setActiveAction(null)}
        title="Atribuir equipamento"
        description={`Vincule um equipamento a ${displayName}.`}
      >
        <AssignEquipmentForm
          employee={employee}
          equipmentItems={assignableEquipmentItems}
        />
      </Sheet>

      <div className="fg-detail-tabs">
        <Tabs value={tab} onChange={setTab} items={tabs} />
      </div>

      <div className="fg-detail-body">
        {tab === "resumo" ? (
          <SummaryTab
            employee={employee}
            auditLogs={auditLogs}
            vacation={vacationSummary.current}
            timeOffRequests={timeOffRequests}
            accessRecords={accessRecords}
            invoiceRequests={invoiceRequests}
            reimbursements={reimbursements}
          />
        ) : null}
        {tab === "dados" ? <PersonalDataTab employee={employee} /> : null}
        {tab === "vinculo" ? <EmploymentTab employee={employee} managerName={managerName} /> : null}
        {tab === "remuneracao" ? (
          <CompensationTab
            employee={employee}
            compensationHistory={compensationHistory}
            benefits={benefits}
          />
        ) : null}
        {tab === "ferias" ? (
          <VacationTab
            employee={employee}
            vacation={vacationSummary.current}
            vacationHistory={vacationSummary.history}
            timeOffRequests={timeOffRequests}
          />
        ) : null}
        {tab === "documentos" ? (
          <DocumentsTab
            documents={documents}
            employee={employee}
            canUploadDocument={actions.canUploadDocument}
          />
        ) : null}
        {tab === "equipamentos" ? <EquipmentTab equipmentItems={equipmentItems} /> : null}
        {tab === "acessos" ? <AccessTab accessRecords={accessRecords} /> : null}
        {tab === "nfs" ? <InvoicesTab invoiceRequests={invoiceRequests} /> : null}
        {tab === "reembolsos" ? <ReimbursementsTab reimbursements={reimbursements} /> : null}
        {tab === "historico" ? <HistoryTab auditLogs={auditLogs} /> : null}
      </div>
    </div>
  );
}

function SummaryTab({
  employee,
  auditLogs,
  vacation,
  timeOffRequests,
  accessRecords,
  invoiceRequests,
  reimbursements,
}: {
  employee: EmployeeView;
  auditLogs: AuditLogView[];
  vacation: VacationBalanceView | null;
  timeOffRequests: TimeOffView[];
  accessRecords: AccessRecordView[];
  invoiceRequests: InvoiceView[];
  reimbursements: ReimbursementView[];
}) {
  const criticalAccess = accessRecords.filter(
    (record) => record.critical && record.status !== "removed",
  );
  const nextPause = timeOffRequests
    .filter((request) => request.startDate >= todayKey())
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];

  return (
    <div className="fg-grid fg-grid-2">
      <Card title="Tempo de casa" description="Em vigencia desde o inicio do vinculo">
        <div className="fg-resumo-big">
          <div className="fg-resumo-val fg-tabular">
            {formatTenure(employee.tenureMonths)}
          </div>
          <div className="fg-resumo-sub">
            Desde {formatDate(employee.startDate)}
          </div>
        </div>
      </Card>

      <Card
        title={
          employee.employmentType === "clt"
            ? "Ferias disponiveis"
            : "Proxima pausa programada"
        }
      >
        {employee.employmentType === "clt" && vacation ? (
          <div className="fg-resumo-big">
            <div className="fg-resumo-val fg-tabular">
              {vacation.daysAvailable}{" "}
              <span className="fg-resumo-unit">dias</span>
            </div>
            <div
              className={`fg-resumo-sub ${
                vacation.expiring || vacation.expired ? "fg-bad" : ""
              }`.trim()}
            >
              Vencimento {formatDate(vacation.concessionDeadline)}
            </div>
          </div>
        ) : nextPause ? (
          <div className="fg-resumo-big">
            <div className="fg-resumo-val fg-tabular">
              {formatDate(nextPause.startDate)}
            </div>
            <div className="fg-resumo-sub">
              {timeOffTypeLabel(nextPause.type)} - {nextPause.businessDays} dias
            </div>
          </div>
        ) : (
          <div className="fg-muted">Nenhuma pausa programada.</div>
        )}
      </Card>

      <Card title="Atividade recente" description="Fluxos vinculados ao colaborador">
        <div className="fg-resumo-stats">
          <div>
            <strong className="fg-tabular">{invoiceRequests.length}</strong>
            <span>NFs</span>
          </div>
          <div>
            <strong className="fg-tabular">{reimbursements.length}</strong>
            <span>Reembolsos</span>
          </div>
          <div>
            <strong className="fg-tabular">{auditLogs.length}</strong>
            <span>Eventos</span>
          </div>
        </div>
      </Card>

      <Card title="Acessos criticos" description="Sistemas com privilegios elevados">
        {criticalAccess.length === 0 ? (
          <div className="fg-muted">Nenhum acesso critico ativo.</div>
        ) : (
          <ul className="fg-list-inline">
            {criticalAccess.slice(0, 4).map((record) => (
              <li key={record.id}>
                <KeyRound size={13} />
                {record.platform}
                <span className="fg-muted">- {record.accessLevel}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function PersonalDataTab({ employee }: { employee: EmployeeView }) {
  const [revealSensitive, setRevealSensitive] = useState(false);
  const canRevealSensitive = !employee.sensitiveProfileHidden;

  return (
    <div className="fg-grid fg-grid-2">
      <Card title="Identificacao">
        <dl className="fg-deflist">
          <div>
            <dt>Nome completo</dt>
            <dd>{employee.fullName}</dd>
          </div>
          <div>
            <dt>CPF</dt>
            <dd className="fg-tabular">
              {sensitiveValue(employee, employee.cpf, revealSensitive)}
            </dd>
          </div>
          <div>
            <dt>RG</dt>
            <dd className="fg-tabular">
              {sensitiveValue(employee, employee.rg, revealSensitive)}
            </dd>
          </div>
          <div>
            <dt>Data de nascimento</dt>
            <dd className="fg-tabular">
              {sensitiveValue(
                employee,
                employee.birthDate ? formatDate(employee.birthDate) : null,
                revealSensitive,
              )}
            </dd>
          </div>
          <div className="full">
            <dt>Endereco</dt>
            <dd>{sensitiveValue(employee, employee.address, revealSensitive)}</dd>
          </div>
        </dl>
        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="fg-btn fg-btn-outline fg-btn-sm"
            type="button"
            disabled={!canRevealSensitive}
            onClick={() => setRevealSensitive((value) => !value)}
          >
            {revealSensitive ? (
              <EyeOff size={13} aria-hidden />
            ) : (
              <Eye size={13} aria-hidden />
            )}
            <span>
              {canRevealSensitive
                ? revealSensitive
                  ? "Ocultar dados sensiveis"
                  : "Revelar dados sensiveis"
                : "Dados sensiveis restritos"}
            </span>
          </button>
          <span className="fg-field-helper" style={{ alignSelf: "center" }}>
            Visibilidade limitada pelas permissoes do perfil.
          </span>
        </div>
      </Card>

      <Card title="Contatos">
        <dl className="fg-deflist">
          <div>
            <dt>Email pessoal</dt>
            <dd>{sensitiveValue(employee, employee.personalEmail, revealSensitive)}</dd>
          </div>
          <div>
            <dt>Email corporativo</dt>
            <dd>{employee.corporateEmail ?? "-"}</dd>
          </div>
          <div>
            <dt>Telefone</dt>
            <dd className="fg-tabular">
              {sensitiveValue(employee, employee.phone, revealSensitive)}
            </dd>
          </div>
          <div className="full">
            <dt>Contato de emergencia</dt>
            <dd>
              {sensitiveValue(employee, employee.emergencyContact, revealSensitive)}
            </dd>
          </div>
        </dl>
      </Card>

      <Card title="Pagamento">
        <dl className="fg-deflist">
          <div className="full">
            <dt>PIX</dt>
            <dd>{sensitiveValue(employee, employee.pix, revealSensitive)}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Observacoes internas">
        <p className="fg-muted" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
          {sensitiveValue(employee, employee.internalNotes, revealSensitive)}
        </p>
      </Card>
    </div>
  );
}

function EmploymentTab({
  employee,
  managerName,
}: {
  employee: EmployeeView;
  managerName: string | null;
}) {
  return (
    <div className="fg-grid fg-grid-2">
      <Card title="Vinculo e cargo">
        <dl className="fg-deflist">
          <div>
            <dt>Area</dt>
            <dd>{employee.areaName}</dd>
          </div>
          <div>
            <dt>Cargo</dt>
            <dd>{employee.positionName}</dd>
          </div>
          <div>
            <dt>Vinculo</dt>
            <dd>{employmentTypeLabels[employee.employmentType]}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <EmployeeStatusBadge status={employee.status} />
            </dd>
          </div>
          <div>
            <dt>Entrada</dt>
            <dd className="fg-tabular">{formatDate(employee.startDate)}</dd>
          </div>
          <div>
            <dt>Saida</dt>
            <dd className="fg-tabular">{formatDate(employee.endDate)}</dd>
          </div>
          <div>
            <dt>Modelo</dt>
            <dd>{employee.workModel ?? "-"}</dd>
          </div>
          <div>
            <dt>Localizacao</dt>
            <dd>{employee.location ?? "-"}</dd>
          </div>
          <div className="full">
            <dt>Gestor</dt>
            <dd>{managerName ?? "-"}</dd>
          </div>
        </dl>
      </Card>

      <Card title="Custo mensal">
        <dl className="fg-deflist">
          <div>
            <dt>Remuneracao base</dt>
            <dd className="fg-tabular">
              {employee.compensationHidden
                ? "Restrito"
                : formatMoney(employee.currentCompensation)}
            </dd>
          </div>
          <div>
            <dt>Ajuda de custo</dt>
            <dd className="fg-tabular">
              {employee.compensationHidden
                ? "Restrito"
                : formatMoney(employee.recurringCostAllowance)}
            </dd>
          </div>
          <div>
            <dt>Transporte</dt>
            <dd className="fg-tabular">
              {employee.compensationHidden
                ? "Restrito"
                : formatMoney(employee.recurringTransport)}
            </dd>
          </div>
          <div>
            <dt>Atualizado em</dt>
            <dd className="fg-tabular">{formatDateTime(employee.updatedAt)}</dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

function CompensationTab({
  employee,
  compensationHistory,
  benefits,
}: {
  employee: EmployeeView;
  compensationHistory: CompensationHistoryView[];
  benefits: BenefitView[];
}) {
  const activeBenefits = benefits.filter((benefit) => benefit.activeForComposition);

  return (
    <>
      <div className="fg-grid fg-grid-4">
        <KpiCard
          label="Base atual"
          value={
            employee.compensationHidden
              ? "Restrito"
              : formatMoney(employee.currentCompensation)
          }
          icon={<BadgeDollarSign size={16} />}
        />
        <KpiCard
          label="Ajuda de custo"
          value={
            employee.compensationHidden
              ? "Restrito"
              : formatMoney(employee.recurringCostAllowance)
          }
          icon={<ReceiptText size={16} />}
        />
        <KpiCard
          label="Transporte"
          value={
            employee.compensationHidden
              ? "Restrito"
              : formatMoney(employee.recurringTransport)
          }
          icon={<CalendarDays size={16} />}
        />
        <KpiCard
          label="Beneficios ativos"
          value={String(activeBenefits.length)}
          icon={<UserRound size={16} />}
        />
      </div>

      <Card title="Historico de remuneracao" padding={false}>
        {compensationHistory.length === 0 ? (
          <EmptyState
            icon={<BadgeDollarSign size={28} />}
            title="Sem historico visivel"
            description="Alteracoes de remuneracao aparecem aqui quando disponiveis."
          />
        ) : (
          <table className="fg-aumento-table">
            <thead>
              <tr>
                <th>Vigencia</th>
                <th>Anterior</th>
                <th>Novo</th>
                <th>Diferenca</th>
                <th>Motivo</th>
                <th>Aprovado por</th>
              </tr>
            </thead>
            <tbody>
              {compensationHistory.map((item) => (
                <tr key={item.id}>
                  <td className="fg-tabular">{formatDate(item.effectiveDate)}</td>
                  <td className="fg-tabular">{formatMoney(item.previousAmount)}</td>
                  <td className="fg-tabular">{formatMoney(item.newAmount)}</td>
                  <td className="fg-tabular">{formatMoney(item.differenceAmount)}</td>
                  <td>{item.reason}</td>
                  <td>{item.approvedByName ?? item.createdByName ?? "Sistema"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Beneficios" padding={false}>
        {benefits.length === 0 ? (
          <EmptyState
            icon={<ReceiptText size={28} />}
            title="Nenhum beneficio registrado"
            description="Beneficios recorrentes aparecem na composicao mensal."
          />
        ) : (
          <table className="fg-aumento-table">
            <thead>
              <tr>
                <th>Beneficio</th>
                <th>Tipo</th>
                <th>Valor</th>
                <th>Inicio</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {benefits.map((benefit) => (
                <tr key={benefit.id}>
                  <td>
                    <div className="fg-cell-strong">{benefit.name}</div>
                    <div className="fg-cell-sub">
                      {benefit.recurring ? "Recorrente" : "Pontual"}
                    </div>
                  </td>
                  <td><Tag>{benefit.benefitType}</Tag></td>
                  <td className="fg-tabular">{formatMoney(benefit.amount)}</td>
                  <td className="fg-tabular">{formatDate(benefit.startDate)}</td>
                  <td>
                    <StatusBadge
                      status={benefit.status === "active" ? "ativo" : "pausado"}
                      label={benefit.status === "active" ? "Ativo" : "Encerrado"}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}

function VacationTab({
  employee,
  vacation,
  vacationHistory,
  timeOffRequests,
}: {
  employee: EmployeeView;
  vacation: VacationBalanceView | null;
  vacationHistory: VacationBalanceView[];
  timeOffRequests: TimeOffView[];
}) {
  return (
    <>
      {employee.employmentType === "clt" && vacation ? (
        <div className="fg-grid fg-grid-4">
          <KpiCard label="Disponiveis" value={`${vacation.daysAvailable} dias`} mono={false} />
          <KpiCard label="Tirados" value={`${vacation.daysTaken} dias`} mono={false} />
          <KpiCard label="Vendidos" value={`${vacation.daysSold} dias`} mono={false} />
          <KpiCard
            label="Vencimento"
            value={formatDayMonth(vacation.concessionDeadline)}
            secondary={vacation.expiring || vacation.expired ? "Atencao" : "Em dia"}
            accent={!vacation.expiring && !vacation.expired}
          />
        </div>
      ) : null}

      <Card
        title={employee.employmentType === "clt" ? "Historico de ferias" : "Pausas programadas"}
        description={
          employee.employmentType === "clt"
            ? "Solicitacoes e periodos de descanso"
            : "Pausas informadas para alinhamento operacional"
        }
        padding={false}
      >
        {timeOffRequests.length === 0 ? (
          <EmptyState
            icon={<Umbrella size={28} />}
            title="Nada registrado ainda"
            description="Quando houver solicitacoes, elas aparecem aqui."
          />
        ) : (
          <table className="fg-aumento-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Inicio</th>
                <th>Fim</th>
                <th>Dias uteis</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {timeOffRequests.map((request) => (
                <tr key={request.id}>
                  <td><Tag>{timeOffTypeLabel(request.type)}</Tag></td>
                  <td className="fg-tabular">{formatDate(request.startDate)}</td>
                  <td className="fg-tabular">{formatDate(request.endDate)}</td>
                  <td className="fg-tabular">{request.businessDays}</td>
                  <td>
                    <StatusBadge
                      tone={timeOffTone(request.status)}
                      label={timeOffStatusLabels[request.status]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {vacationHistory.length > 0 ? (
        <Card title="Saldos anteriores" padding={false}>
          <table className="fg-aumento-table">
            <thead>
              <tr>
                <th>Periodo</th>
                <th>Disponivel</th>
                <th>Status</th>
                <th>Limite</th>
              </tr>
            </thead>
            <tbody>
              {vacationHistory.map((balance) => (
                <tr key={balance.id}>
                  <td className="fg-tabular">
                    {formatDate(balance.periodStart)} - {formatDate(balance.periodEnd)}
                  </td>
                  <td className="fg-tabular">{balance.daysAvailable} dias</td>
                  <td>
                    <StatusBadge
                      tone={balance.status === "active" ? "success" : "muted"}
                      label={vacationBalanceStatusLabels[balance.status]}
                    />
                  </td>
                  <td className="fg-tabular">{formatDate(balance.concessionDeadline)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </>
  );
}

function DocumentsTab({
  canUploadDocument,
  documents,
  employee,
}: {
  canUploadDocument: boolean;
  documents: DocumentView[];
  employee: EmployeeView;
}) {
  return (
    <Card
      title="Documentos"
      description="Contratos, recibos, comprovantes e documentos vinculados."
      action={
        canUploadDocument ? (
          <ActionSheet
            title="Enviar documento"
            description={`Anexe um documento ao cadastro de ${employee.fullName}.`}
            trigger={
              <button className="fg-btn fg-btn-primary fg-btn-sm" type="button">
                <FileUp size={14} aria-hidden />
                <span>Enviar documento</span>
              </button>
            }
          >
            <DocumentRegistrationForm employee={employee} />
          </ActionSheet>
        ) : null
      }
      padding={false}
    >
      {documents.length === 0 ? (
        <EmptyState
          icon={<FileText size={28} />}
          title="Nenhum documento vinculado"
          description="Documentos do colaborador aparecem aqui quando disponiveis."
        />
      ) : (
        <table className="fg-aumento-table">
          <thead>
            <tr>
              <th>Arquivo</th>
              <th>Tipo</th>
              <th>Sensibilidade</th>
              <th>Visibilidade</th>
              <th>Versao</th>
              <th>Criado em</th>
              <th className="right">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => (
              <tr key={document.id}>
                <td>
                  <div className="fg-cell-strong">{document.originalName}</div>
                  <div className="fg-cell-sub">
                    {document.extension.toUpperCase()} - {formatBytes(document.byteSize)}
                  </div>
                </td>
                <td>{documentTypeLabel(document.documentType)}</td>
                <td>
                  <StatusBadge
                    tone={documentSensitivityTone(document.sensitivity)}
                    label={fileSensitivityLabels[document.sensitivity]}
                  />
                </td>
                <td>{documentVisibilityLabels[document.visibility]}</td>
                <td className="fg-tabular">v{document.version}</td>
                <td className="fg-tabular">{formatDate(document.createdAt)}</td>
                <td className="right">
                  <a
                    aria-label="Baixar documento"
                    className="fg-icon-btn sm"
                    href={`/app/documentos/${document.id}/download`}
                    title="Baixar documento"
                  >
                    <Download size={14} aria-hidden />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function DocumentRegistrationForm({ employee }: { employee: EmployeeView }) {
  return (
    <RateLimitedActionForm
      action={registerDocumentAction}
      className="fg-form"
    >
      <input name="ownerType" type="hidden" value="employee" />
      <input name="ownerId" type="hidden" value={employee.id} />
      <Field label="Colaborador">
        <input
          className="fg-input"
          value={`${employee.registrationNumber} - ${employee.fullName}`}
          disabled
          readOnly
        />
      </Field>
      <div className="fg-form-row">
        <Field label="Tipo" required>
          <select className="fg-input fg-select" name="documentType" required>
            {Object.entries(documentTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Arquivo" required>
          <input
            accept={uploadAccept}
            className="fg-input"
            name="file"
            required
            type="file"
          />
        </Field>
      </div>
      <div className="fg-form-row">
        <Field label="Sensibilidade">
          <select
            className="fg-input fg-select"
            defaultValue="restricted"
            name="sensitivity"
          >
            {Object.entries(fileSensitivityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Visibilidade">
          <select
            className="fg-input fg-select"
            defaultValue="restricted"
            name="visibility"
          >
            {Object.entries(documentVisibilityLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="fg-btn fg-btn-primary fg-btn-default" type="submit">
          <FileUp size={14} aria-hidden />
          <span>Enviar documento</span>
        </button>
      </div>
    </RateLimitedActionForm>
  );
}

function EquipmentTab({ equipmentItems }: { equipmentItems: EquipmentView[] }) {
  return (
    <Card title="Equipamentos atribuidos" padding={false}>
      {equipmentItems.length === 0 ? (
        <EmptyState
          icon={<Laptop size={28} />}
          title="Nenhum equipamento atribuido"
          description="Equipamentos vinculados ao colaborador aparecem aqui."
        />
      ) : (
        <table className="fg-aumento-table">
          <thead>
            <tr>
              <th>Patrimonio</th>
              <th>Tipo</th>
              <th>Modelo</th>
              <th>Status</th>
              <th>Serie</th>
            </tr>
          </thead>
          <tbody>
            {equipmentItems.map((item) => (
              <tr key={item.id}>
                <td className="fg-tabular">{item.assetNumber}</td>
                <td>{item.type}</td>
                <td>{[item.brand, item.model].filter(Boolean).join(" ") || "-"}</td>
                <td>
                  <StatusBadge
                    tone={item.returnAlert ? "danger" : "success"}
                    label={equipmentStatusLabels[item.status]}
                  />
                </td>
                <td className="fg-tabular">{item.serialNumber ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function AccessTab({ accessRecords }: { accessRecords: AccessRecordView[] }) {
  return (
    <Card title="Acessos concedidos" padding={false}>
      {accessRecords.length === 0 ? (
        <EmptyState
          icon={<KeyRound size={28} />}
          title="Nenhum acesso registrado"
          description="Contas e permissoes vinculadas aparecem aqui."
        />
      ) : (
        <table className="fg-aumento-table">
          <thead>
            <tr>
              <th>Sistema</th>
              <th>Conta</th>
              <th>Nivel</th>
              <th>Criticidade</th>
              <th>Status</th>
              <th>Revisao</th>
            </tr>
          </thead>
          <tbody>
            {accessRecords.map((record) => (
              <tr key={record.id}>
                <td>{record.platform}</td>
                <td>{record.accountIdentifier ?? "-"}</td>
                <td>{record.accessLevel}</td>
                <td>
                  <StatusBadge
                    tone={record.critical ? "danger" : "muted"}
                    label={record.critical ? "Critica" : "Padrao"}
                    icon={record.critical ? <ShieldAlert size={12} /> : undefined}
                  />
                </td>
                <td>
                  <StatusBadge
                    tone={accessStatusTone(record.status)}
                    label={accessRecordStatusLabels[record.status]}
                  />
                </td>
                <td>
                  <div className="fg-cell-strong fg-tabular">
                    {formatDate(record.reviewDueDate)}
                    <div className="fg-cell-sub">
                      {accessReviewStateLabels[record.reviewState]}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function InvoicesTab({ invoiceRequests }: { invoiceRequests: InvoiceView[] }) {
  return (
    <Card title="NFs deste PJ" padding={false}>
      {invoiceRequests.length === 0 ? (
        <EmptyState
          icon={<FileText size={28} />}
          title="Nenhuma NF registrada"
          description="Solicitacoes de nota fiscal aparecem aqui."
        />
      ) : (
        <table className="fg-aumento-table">
          <thead>
            <tr>
              <th>Competencia</th>
              <th>Esperado</th>
              <th>Emitido</th>
              <th>Status</th>
              <th>Prazo</th>
            </tr>
          </thead>
          <tbody>
            {invoiceRequests.map((invoice) => (
              <tr key={invoice.id}>
                <td className="fg-tabular">{formatCompetence(invoice.competence)}</td>
                <td className="fg-tabular">{formatMoney(invoice.expectedAmount)}</td>
                <td className="fg-tabular">{formatMoney(invoice.issuedAmount)}</td>
                <td>
                  <StatusBadge
                    tone={invoiceTone(invoice.status)}
                    label={invoiceRequestStatusLabels[invoice.status]}
                  />
                </td>
                <td className="fg-tabular">{formatDate(invoice.dueDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function ReimbursementsTab({
  reimbursements,
}: {
  reimbursements: ReimbursementView[];
}) {
  return (
    <Card title="Reembolsos solicitados" padding={false}>
      {reimbursements.length === 0 ? (
        <EmptyState
          icon={<ReceiptText size={28} />}
          title="Nenhum reembolso solicitado"
          description="Pedidos do colaborador aparecem aqui."
        />
      ) : (
        <table className="fg-aumento-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descricao</th>
              <th>Categoria</th>
              <th>Valor</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {reimbursements.map((item) => (
              <tr key={item.id}>
                <td className="fg-tabular">{formatDate(item.expenseDate)}</td>
                <td>{item.title}</td>
                <td><Tag>{item.category}</Tag></td>
                <td className="fg-tabular">{formatMoney(item.amount)}</td>
                <td>
                  <StatusBadge
                    tone={reimbursementTone(item.status)}
                    label={reimbursementStatusLabels[item.status]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

function HistoryTab({ auditLogs }: { auditLogs: AuditLogView[] }) {
  return (
    <Card title="Historico de eventos" description="Linha do tempo auditada">
      {auditLogs.length === 0 ? (
        <EmptyState
          icon={<Eye size={28} />}
          title="Sem logs recentes"
          description="Eventos auditados aparecem aqui quando disponiveis."
        />
      ) : (
        <ol className="fg-timeline fg-timeline-vertical">
          {auditLogs.map((log) => (
            <li className="fg-tl-step fg-tl-done" key={log.id}>
              <div className="fg-tl-dot">
                <Eye size={10} strokeWidth={2.5} />
              </div>
              <div className="fg-tl-body">
                <div className="fg-tl-label">{formatAuditAction(log.action)}</div>
                <div className="fg-tl-meta">
                  {log.actorName ?? log.actorEmail ?? "Sistema"} -{" "}
                  {formatDateTime(log.createdAt)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

function OffboardingForm({ employee }: { employee: EmployeeView }) {
  return (
    <form action={createLifecycleChecklistAction} className="fg-form">
      <input name="employeeId" type="hidden" value={employee.id} />
      <input name="type" type="hidden" value="offboarding" />
      <Field label="Data final / prazo">
        <input
          className="fg-input fg-tabular"
          defaultValue={employee.endDate ?? todayKey()}
          name="dueDate"
          type="date"
        />
      </Field>
      <Field label="Motivo e observacoes">
        <textarea
          className="fg-input fg-textarea"
          maxLength={1200}
          name="notes"
          rows={5}
        />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="fg-btn fg-btn-destructive fg-btn-default" type="submit">
          <UserMinus size={14} aria-hidden />
          <span>Abrir desligamento</span>
        </button>
      </div>
    </form>
  );
}

function TimeOffRequestForm({ employee }: { employee: EmployeeView }) {
  const defaultType = employee.employmentType === "clt" ? "vacation" : "planned_pause";

  return (
    <form action={createTimeOffRequestAction} className="fg-form">
      <div className="fg-form-row">
        <Field label="Tipo" required>
          <select className="fg-input fg-select" defaultValue={defaultType} name="type">
            {Object.entries(timeOffTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Inicio" required>
          <input className="fg-input fg-tabular" name="startDate" required type="date" />
        </Field>
      </div>
      <div className="fg-form-row">
        <Field label="Fim" required>
          <input className="fg-input fg-tabular" name="endDate" required type="date" />
        </Field>
        {employee.employmentType === "clt" ? (
          <Field label="Dias vendidos">
            <input
              className="fg-input fg-tabular"
              defaultValue="0"
              max={30}
              min={0}
              name="soldDays"
              type="number"
            />
          </Field>
        ) : null}
      </div>
      <Field label="Observacao">
        <textarea
          className="fg-input fg-textarea"
          maxLength={1000}
          name="notes"
          rows={4}
        />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="fg-btn fg-btn-primary fg-btn-default" type="submit">
          <Umbrella size={14} aria-hidden />
          <span>Enviar solicitacao</span>
        </button>
      </div>
    </form>
  );
}

function ReimbursementRequestForm() {
  return (
    <RateLimitedActionForm
      action={createReimbursementAction}
      className="fg-form"
    >
      <Field label="Descricao" required>
        <input className="fg-input" maxLength={180} name="title" required />
      </Field>
      <div className="fg-form-row">
        <Field label="Categoria" required>
          <select className="fg-input fg-select" name="category" required>
            {reimbursementCategoryOptions.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Valor" required>
          <MoneyInput name="amount" required />
        </Field>
      </div>
      <Field label="Data" required>
        <input className="fg-input fg-tabular" name="expenseDate" required type="date" />
      </Field>
      <Field label="Comprovante">
        <input className="fg-input" name="file" type="file" accept={uploadAccept} />
      </Field>
      <Field label="Observacao">
        <textarea
          className="fg-input fg-textarea"
          maxLength={1000}
          name="notes"
          rows={4}
        />
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="fg-btn fg-btn-primary fg-btn-default" type="submit">
          <ReceiptText size={14} aria-hidden />
          <span>Enviar reembolso</span>
        </button>
      </div>
    </RateLimitedActionForm>
  );
}

function AssignEquipmentForm({
  employee,
  equipmentItems,
}: {
  employee: EmployeeView;
  equipmentItems: AssignableEquipmentView[];
}) {
  return (
    <form action={assignEquipmentAction} className="fg-form">
      <input name="employeeId" type="hidden" value={employee.id} />
      <Field label="Equipamento" required>
        <select className="fg-input fg-select" name="id" required>
          <option value="">Selecionar equipamento</option>
          {equipmentItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.assetNumber} - {[item.type, item.brand, item.model]
                .filter(Boolean)
                .join(" ")}
              {item.currentEmployeeName ? ` - atual: ${item.currentEmployeeName}` : ""}
            </option>
          ))}
        </select>
      </Field>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button
          className="fg-btn fg-btn-primary fg-btn-default"
          type="submit"
          disabled={equipmentItems.length === 0}
        >
          <Laptop size={14} aria-hidden />
          <span>Atribuir equipamento</span>
        </button>
      </div>
    </form>
  );
}

function EmployeeEditForm({
  employee,
  options,
}: {
  employee: EmployeeView;
  options: PeopleOptions;
}) {
  return (
    <form action={updateEmployeeAction} className="fg-form">
      <input name="id" type="hidden" value={employee.id} />

      <div className="fg-form-row">
        <Field label="Nome completo" required>
          <input className="fg-input" defaultValue={employee.fullName} maxLength={180} name="fullName" required />
        </Field>
        <Field label="Nome social">
          <input className="fg-input" defaultValue={employee.socialName ?? ""} maxLength={120} name="socialName" />
        </Field>
      </div>

      <div className="fg-form-row">
        <Field label="Email corporativo">
          <input className="fg-input" defaultValue={employee.corporateEmail ?? ""} maxLength={160} name="corporateEmail" type="email" />
        </Field>
        <Field label="Email pessoal">
          <input className="fg-input" defaultValue={employee.personalEmail ?? ""} maxLength={160} name="personalEmail" type="email" />
        </Field>
      </div>

      <div className="fg-form-row">
        <Field label="Area" required>
          <select className="fg-input fg-select" defaultValue={employee.areaId} name="areaId">
            {options.areas.map((area) => (
              <option key={area.id} value={area.id}>{area.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Cargo" required>
          <select className="fg-input fg-select" defaultValue={employee.positionId} name="positionId">
            {options.positions.map((position) => (
              <option key={position.id} value={position.id}>{position.name}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="fg-form-row">
        <Field label="Gestor">
          <select className="fg-input fg-select" defaultValue={employee.managerEmployeeId ?? ""} name="managerEmployeeId">
            <option value="">Sem gestor</option>
            {options.managers
              .filter((manager) => manager.id !== employee.id)
              .map((manager) => (
                <option key={manager.id} value={manager.id}>{manager.name}</option>
              ))}
          </select>
        </Field>
        <Field label="Vinculo" required>
          <select className="fg-input fg-select" defaultValue={employee.employmentType} name="employmentType">
            {Object.entries(employmentTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
      </div>

      <div className="fg-form-row">
        <Field label="Status" required>
          <select className="fg-input fg-select" defaultValue={employee.status} name="status">
            {Object.entries(employeeStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="Entrada" required>
          <input className="fg-input fg-tabular" defaultValue={employee.startDate} name="startDate" required type="date" />
        </Field>
      </div>

      <div className="fg-form-row">
        <Field label="Saida">
          <input className="fg-input fg-tabular" defaultValue={employee.endDate ?? ""} name="endDate" type="date" />
        </Field>
        <Field label="Nascimento">
          <input className="fg-input fg-tabular" defaultValue={employee.birthDate ?? ""} name="birthDate" type="date" />
        </Field>
      </div>

      <div className="fg-form-row">
        <Field label="Telefone">
          <input className="fg-input" defaultValue={employee.phone ?? ""} maxLength={40} name="phone" />
        </Field>
        <Field label="Localizacao">
          <input className="fg-input" defaultValue={employee.location ?? ""} maxLength={120} name="location" />
        </Field>
      </div>

      <div className="fg-form-row">
        <Field label="CPF">
          <input className="fg-input" defaultValue={employee.cpf ?? ""} maxLength={20} name="cpf" />
        </Field>
        <Field label="RG">
          <input className="fg-input" defaultValue={employee.rg ?? ""} maxLength={30} name="rg" />
        </Field>
      </div>

      <div className="fg-form-row">
        <Field label="Modelo de trabalho">
          <input className="fg-input" defaultValue={employee.workModel ?? ""} maxLength={80} name="workModel" />
        </Field>
        <Field label="Pix">
          <input className="fg-input" defaultValue={employee.pix ?? ""} maxLength={160} name="pix" />
        </Field>
      </div>

      <Field label="Endereco">
        <input className="fg-input" defaultValue={employee.address ?? ""} maxLength={300} name="address" />
      </Field>
      <Field label="Contato de emergencia">
        <input className="fg-input" defaultValue={employee.emergencyContact ?? ""} maxLength={200} name="emergencyContact" />
      </Field>
      <Field label="Observacoes internas">
        <textarea className="fg-input fg-textarea" defaultValue={employee.internalNotes ?? ""} maxLength={2000} name="internalNotes" rows={4} />
      </Field>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button className="fg-btn fg-btn-primary fg-btn-default" type="submit">
          <Save size={14} aria-hidden />
          <span>Salvar cadastro</span>
        </button>
      </div>
    </form>
  );
}

function Field({
  children,
  label,
  required,
}: {
  children: ReactNode;
  label: string;
  required?: boolean;
}) {
  return (
    <div className="fg-field">
      <label className="fg-label">
        {label}
        {required ? <span className="fg-required">*</span> : null}
      </label>
      <div className="fg-input-wrap">{children}</div>
    </div>
  );
}

function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  if (status === "active") {
    return <StatusBadge status="ativo" label={employeeStatusLabels[status]} />;
  }

  if (status === "terminated") {
    return <StatusBadge status="desligado" label={employeeStatusLabels[status]} />;
  }

  if (status === "paused") {
    return <StatusBadge status="pausado" label={employeeStatusLabels[status]} />;
  }

  if (status === "occasional_freelancer") {
    return <StatusBadge tone="brand" label={employeeStatusLabels[status]} />;
  }

  return <StatusBadge tone="warning" label={employeeStatusLabels[status]} />;
}

function sensitiveValue(
  employee: EmployeeView,
  value: string | null | undefined,
  reveal: boolean,
) {
  if (employee.sensitiveProfileHidden) {
    return "Restrito";
  }

  if (!value) {
    return "-";
  }

  return reveal ? value : "Oculto";
}

function formatTenure(months: number) {
  if (months < 12) {
    return `${months}m`;
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  return remainingMonths === 0 ? `${years}a` : `${years}a ${remainingMonths}m`;
}

function formatDayMonth(value: string | null | undefined) {
  if (!value) return "-";
  const [, month, day] = value.split("-");
  return month && day ? `${day}/${month}` : formatDate(value);
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1).replace(".", ",")} KB`;
  }

  return `${(value / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

function documentTypeLabel(value: string) {
  return value in documentTypeLabels
    ? documentTypeLabels[value as DocumentType]
    : value;
}

function documentSensitivityTone(sensitivity: FileSensitivity): BadgeTone {
  if (sensitivity === "highly_sensitive" || sensitivity === "sensitive") {
    return "danger";
  }

  if (sensitivity === "restricted") {
    return "warning";
  }

  return "muted";
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function timeOffTypeLabel(type: string) {
  return type in timeOffTypeLabels
    ? timeOffTypeLabels[type as keyof typeof timeOffTypeLabels]
    : type;
}

function timeOffTone(status: TimeOffStatus): BadgeTone {
  if (status === "approved") return "success";
  if (status === "rejected" || status === "cancelled") return "muted";
  return "warning";
}

function accessStatusTone(status: AccessRecordStatus): BadgeTone {
  if (status === "active") return "success";
  if (status === "pending" || status === "in_review") return "warning";
  return "muted";
}

function invoiceTone(status: InvoiceRequestStatus): BadgeTone {
  if (status === "approved" || status === "paid") return "success";
  if (status === "rejected" || status === "cancelled") return "danger";
  if (status === "published" || status === "adjustment_requested") return "brand";
  if (status === "draft") return "muted";
  return "warning";
}

function reimbursementTone(status: ReimbursementStatus): BadgeTone {
  if (status === "paid" || status === "finance_approved") return "success";
  if (status === "manager_rejected" || status === "finance_rejected" || status === "cancelled") {
    return "danger";
  }
  if (status === "draft") return "muted";
  return "warning";
}

function formatAuditAction(action: string) {
  const labels: Record<string, string> = {
    create: "Criacao",
    status_change: "Status",
    update: "Edicao",
  };

  return labels[action] ?? action;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

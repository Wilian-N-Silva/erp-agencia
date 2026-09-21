import { AlertCircle, ArrowRight, ChevronRight, Laptop, Receipt, Umbrella } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

import { Card, EmptyState } from "@/components/fg";
import { listEquipment } from "@/features/equipment/dal";
import { getCurrentPortalEmployeeAccess } from "@/features/portal/access";
import {
  listInvoiceRequests,
  listReimbursements,
  type InvoiceRequestListItem,
} from "@/features/portal/dal";
import { PortalEmployeeLinkRequired } from "@/features/portal/employee-link-required";
import { canSubmitInvoice } from "@/features/portal/rules";
import { formatCompetence, formatDate, formatMoney } from "@/features/finance/rules";
import { listTimeOffRequests, listVacationBalances } from "@/features/timeoff/dal";

export const dynamic = "force-dynamic";

export default async function PortalHomePage() {
  const access = await getCurrentPortalEmployeeAccess();
  if (!access) {
    return <PortalEmployeeLinkRequired />;
  }

  const { context, employee } = access;
  const isPJ = employee.employmentType === "pj";

  const [invoices, reimbursements, timeOff, equipment] = await Promise.all([
    isPJ ? listInvoiceRequests(context, { ownOnly: true, limit: 6 }) : Promise.resolve([]),
    listReimbursements(context, { ownOnly: true, limit: 6 }),
    listTimeOffRequests(context, { ownOnly: true, limit: 6 }),
    listEquipment(context, {}, { ownOnly: true, limit: 6 }),
  ]);

  const pendingInvoice = invoices.find((invoice) => canSubmitInvoice(invoice.status)) ?? null;

  const reimbursementsInFlight = reimbursements.filter((r) =>
    ["draft", "submitted", "manager_approved", "finance_approved"].includes(r.status),
  );

  const upcomingTimeOff = timeOff.find(
    (request) =>
      request.status === "approved" && new Date(request.startDate) >= startOfToday(),
  );

  let vacationDaysAvailable: number | null = null;
  if (employee.employmentType === "clt" && context.employeeId) {
    const balances = await listVacationBalances(context, { employeeId: context.employeeId });
    const active = balances.find((b) => b.status === "active");
    if (active) {
      vacationDaysAvailable = active.daysAvailable;
    }
  }

  const greeting = getGreeting();
  const firstName = employee.fullName.split(/\s+/)[0];
  const today = new Date();
  const todayLabel = today.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <>
      <div className="fg-portal-greet">
        <h1>
          {greeting}, {firstName}.
        </h1>
        <p>Hoje é {todayLabel}.</p>
      </div>

      {pendingInvoice ? <NfCallout invoice={pendingInvoice} /> : null}

      <div className="fg-portal-quick">
        <QuickCard
          href={"/portal/reembolsos" as Route}
          icon={<Receipt size={20} />}
          number={String(reimbursementsInFlight.length)}
          label="Reembolsos em andamento"
        />
        <QuickCard
          href={"/portal/ferias" as Route}
          icon={<Umbrella size={20} />}
          number={
            vacationDaysAvailable !== null
              ? `${vacationDaysAvailable} dias`
              : upcomingTimeOff
              ? formatDayMonth(upcomingTimeOff.startDate)
              : "—"
          }
          label={
            vacationDaysAvailable !== null
              ? "Férias disponíveis"
              : upcomingTimeOff
              ? "Próxima ausência"
              : "Sem pausas programadas"
          }
        />
        <QuickCard
          href={"/portal/equipamentos" as Route}
          icon={<Laptop size={20} />}
          number={String(equipment.length)}
          label={equipment.length === 1 ? "Equipamento atribuído" : "Equipamentos atribuídos"}
        />
      </div>

      <section className="fg-portal-section">
        <h3 className="fg-portal-section-title">Avisos recentes</h3>
        {buildAvisos({ invoices, reimbursements }).length === 0 ? (
          <Card>
            <EmptyState
              title="Nenhum aviso recente"
              description="Quando houver novidades sobre seus processos, elas aparecem aqui."
            />
          </Card>
        ) : (
          <ul className="fg-portal-avisos">
            {buildAvisos({ invoices, reimbursements }).map((aviso, index) => (
              <li key={index}>
                <span className={`fg-portal-aviso-dot ${aviso.tone ?? ""}`} />
                <span>{aviso.text}</span>
                {aviso.when ? <span className="fg-portal-aviso-when">· {aviso.when}</span> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function NfCallout({ invoice }: { invoice: InvoiceRequestListItem }) {
  const dueDate = new Date(invoice.dueDate);
  const today = new Date();
  const diffDays = Math.round(
    (dueDate.getTime() - new Date(today.toISOString().slice(0, 10)).getTime()) / 86_400_000,
  );
  const relative =
    diffDays === 0
      ? "Hoje"
      : diffDays === 1
      ? "Amanhã"
      : diffDays > 0
      ? `faltam ${diffDays} dias`
      : `${Math.abs(diffDays)} dia${Math.abs(diffDays) > 1 ? "s" : ""} atrás`;

  return (
    <div className="fg-portal-nf-card">
      <div className="fg-portal-nf-icon">
        <AlertCircle size={20} strokeWidth={2} />
      </div>
      <div className="fg-portal-nf-body">
        <div className="fg-portal-nf-eyebrow">Ação requerida</div>
        <h2 className="fg-portal-nf-title">
          Você precisa emitir sua NF de {formatCompetence(invoice.competence)}
        </h2>
        <div className="fg-portal-nf-meta">
          <div>
            <span className="fg-portal-nf-label">Competência</span>
            <span className="fg-portal-nf-val">{formatCompetence(invoice.competence)}</span>
          </div>
          <div>
            <span className="fg-portal-nf-label">Prazo</span>
            <span className="fg-portal-nf-val fg-tabular">
              {formatDate(invoice.dueDate)}{" "}
              <span className="fg-portal-nf-rel">· {relative}</span>
            </span>
          </div>
          <div>
            <span className="fg-portal-nf-label">Valor esperado</span>
            <span className="fg-portal-nf-val big fg-tabular">
              {formatMoney(invoice.expectedAmount)}
            </span>
          </div>
        </div>
      </div>
      <div className="fg-portal-nf-cta">
        <Link href={"/portal/nfs" as Route} className="fg-portal-nf-btn">
          <span>Ver composição e enviar NF</span>
          <ArrowRight size={16} strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}

function QuickCard({
  href,
  icon,
  number,
  label,
}: {
  href: Route;
  icon: React.ReactNode;
  number: string;
  label: string;
}) {
  return (
    <Link href={href} className="fg-portal-qcard">
      <div className="fg-portal-qcard-icon">{icon}</div>
      <div>
        <div className="fg-portal-qcard-num fg-tabular">{number}</div>
        <div className="fg-portal-qcard-label">{label}</div>
      </div>
      <ChevronRight size={14} style={{ color: "var(--ink-400)" }} />
    </Link>
  );
}

interface Aviso {
  text: string;
  when: string | null;
  tone?: "good" | "warn" | "";
}

function buildAvisos({
  invoices,
  reimbursements,
}: {
  invoices: InvoiceRequestListItem[];
  reimbursements: Awaited<ReturnType<typeof listReimbursements>>;
}): Aviso[] {
  const avisos: Aviso[] = [];

  const approvedInvoice = invoices.find((invoice) => invoice.status === "approved" || invoice.status === "paid");
  if (approvedInvoice) {
    avisos.push({
      text: `Sua NF de ${formatCompetence(approvedInvoice.competence)} foi ${
        approvedInvoice.status === "paid" ? "paga" : "aprovada"
      }`,
      when: approvedInvoice.approvedAt ? formatDate(approvedInvoice.approvedAt) : null,
      tone: "good",
    });
  }

  const lastReimbursement = reimbursements[0];
  if (lastReimbursement) {
    const stateLabel =
      lastReimbursement.status === "manager_approved"
        ? "aprovado pelo gestor"
        : lastReimbursement.status === "finance_approved"
        ? "aprovado para pagamento"
        : lastReimbursement.status === "paid"
        ? "pago"
        : lastReimbursement.status === "submitted"
        ? "encaminhado"
        : null;
    if (stateLabel) {
      avisos.push({
        text: `Reembolso de ${formatMoney(lastReimbursement.amount)} foi ${stateLabel}`,
        when: formatDate(lastReimbursement.createdAt),
        tone: stateLabel === "pago" || stateLabel.includes("aprovado") ? "good" : "",
      });
    }
  }

  return avisos;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function startOfToday() {
  const t = new Date();
  t.setHours(0, 0, 0, 0);
  return t;
}

function formatDayMonth(value: string | Date) {
  const date = typeof value === "string" ? new Date(`${value}T00:00:00.000Z`) : value;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}`;
}

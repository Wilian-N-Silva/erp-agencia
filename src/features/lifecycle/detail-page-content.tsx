import {
  AlertCircle,
  Ban,
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  MinusCircle,
  X,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Avatar, Button, Card, InlineAlert, Page, PageHeader, StatusBadge } from "@/components/fg";
import {
  cancelLifecycleChecklistAction,
  completeLifecycleChecklistAction,
  updateLifecycleChecklistItemStatusAction,
} from "@/features/lifecycle/actions";
import {
  listLifecycleChecklists,
  type LifecycleChecklistItem,
} from "@/features/lifecycle/dal";
import {
  canWriteLifecycle,
  lifecycleChecklistItemStatusLabels,
  lifecycleChecklistStatusLabels,
  type LifecycleChecklistItemStatus,
  type LifecycleChecklistStatus,
  type LifecycleType,
} from "@/features/lifecycle/rules";
import { formatDate } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";
import { employmentTypeLabels } from "@/features/people/rules";

export async function LifecycleChecklistDetailPage({
  id,
  type,
}: {
  id: string;
  type: LifecycleType;
}) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canAny(["lifecycle.read", "lifecycle.write"], context)) {
    redirect("/acesso-negado");
  }

  const all = await listLifecycleChecklists(context, type);
  const checklist = all.find((row) => row.id === id);
  if (!checklist) notFound();

  const canWrite = canWriteLifecycle(context);
  const isOnboarding = type === "onboarding";
  const total = checklist.progress.total || 1;
  const pct = Math.round((checklist.progress.resolved / total) * 100);
  const blocked = checklist.items.filter((item) => item.status === "blocked").length;

  const subtitle = isOnboarding
    ? `${checklist.employeePositionName} · ${checklist.employeeAreaName} · ${formatEmploymentType(checklist.employeeEmploymentType)} · entrada prevista ${formatDate(checklist.employeeStartDate)}`
    : `${checklist.employeeRegistrationNumber} · ${checklist.employeePositionName} · ${checklist.employeeAreaName} · prevista ${formatDate(checklist.employeeEndDate ?? checklist.dueDate ?? checklist.employeeStartDate)}`;

  const backHref = (isOnboarding
    ? "/app/colaboradores/admissoes"
    : "/app/colaboradores/desligamentos") as Route;

  const isOpen = checklist.status === "open";
  const completionLabel = isOnboarding ? "Concluir admissão" : "Concluir desligamento";

  return (
    <Page>
      <Link href={backHref} className="fg-back">
        <ChevronLeft size={14} />
        <span>{isOnboarding ? "Admissões" : "Desligamentos"}</span>
      </Link>

      <PageHeader
        eyebrow={isOnboarding ? "Admissão" : "Desligamento"}
        title={checklist.employeeName}
        description={subtitle}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              icon={<Bell size={14} />}
              disabled
              title="Notificar responsáveis (em breve)"
            >
              Notificar responsáveis
            </Button>
            {canWrite && isOpen ? (
              <form action={cancelLifecycleChecklistAction} style={{ display: "inline" }}>
                <input name="id" type="hidden" value={checklist.id} />
                <Button type="submit" variant="destructive" size="sm" icon={<Ban size={14} />}>
                  Cancelar
                </Button>
              </form>
            ) : null}
            {canWrite && isOpen ? (
              <form
                action={completeLifecycleChecklistAction}
                style={{ display: "inline" }}
              >
                <input name="id" type="hidden" value={checklist.id} />
                <Button
                  type="submit"
                  variant={checklist.progress.canComplete ? "primary" : "outline"}
                  size="sm"
                  icon={<CheckCircle2 size={14} />}
                  disabled={!checklist.progress.canComplete}
                  title={
                    checklist.progress.canComplete
                      ? completionLabel
                      : "Conclua todos os itens obrigatórios antes de finalizar"
                  }
                >
                  {completionLabel}
                </Button>
              </form>
            ) : (
              <ChecklistStatusBadge status={checklist.status} />
            )}
          </>
        }
      />

      {!isOnboarding && (blocked > 0 || checklist.state === "overdue") ? (
        <InlineAlert
          tone="danger"
          icon={<AlertCircle size={16} />}
          title="Alertas associados a este desligamento"
        >
          <ul
            style={{
              margin: 0,
              paddingLeft: 18,
              display: "flex",
              flexDirection: "column",
              gap: 4,
              fontSize: 12.5,
              color: "var(--ink-700)",
            }}
          >
            {blocked > 0 ? (
              <li>
                {blocked} item{blocked > 1 ? "s" : ""} bloqueado{blocked > 1 ? "s" : ""} aguardando resolução antes do encerramento.
              </li>
            ) : null}
            {checklist.state === "overdue" ? (
              <li>Checklist passou do prazo previsto — revise os responsáveis e prazos.</li>
            ) : null}
          </ul>
        </InlineAlert>
      ) : null}

      <Card
        title={`Progresso · ${pct}%`}
        description={
          `${checklist.progress.resolved} de ${checklist.progress.total} concluídos` +
          (checklist.progress.requiredTotal > 0
            ? ` · ${checklist.progress.requiredResolved}/${checklist.progress.requiredTotal} obrigatórios`
            : "") +
          (blocked > 0 ? ` · ${blocked} bloqueado${blocked > 1 ? "s" : ""}` : "")
        }
        padding={false}
      >
        <div className="fg-check-progress" style={{ padding: "0 20px 18px" }}>
          <div className="fg-check-bar">
            <div className="fg-check-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <ul className="fg-check-items">
          {checklist.items.map((item) => (
            <ChecklistItemRow
              canWrite={canWrite && isOpen}
              item={item}
              key={item.id}
            />
          ))}
        </ul>
      </Card>

      {checklist.notes ? (
        <Card title="Observações">
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-800)", whiteSpace: "pre-wrap" }}>
            {checklist.notes}
          </p>
        </Card>
      ) : null}
    </Page>
  );
}

function ChecklistItemRow({
  canWrite,
  item,
}: {
  canWrite: boolean;
  item: LifecycleChecklistItem;
}) {
  const statusClass = mapStatusClass(item.status);
  const markIcon =
    item.status === "done" ? <Check size={12} strokeWidth={3} /> :
    item.status === "blocked" ? <X size={11} strokeWidth={3} /> :
    item.status === "not_applicable" ? <MinusCircle size={11} /> :
    item.status === "pending" ? <Clock size={11} /> :
    null;

  return (
    <li className={`fg-check-item ${statusClass}`}>
      <div className="fg-check-item-mark">{markIcon}</div>
      <div className="fg-check-item-body" style={{ minWidth: 0 }}>
        <div className="fg-check-item-title">{item.title}</div>
        <div className="fg-check-item-meta">
          {item.required ? "Obrigatório" : "Opcional"}
          {item.dueDate ? ` · prazo ${formatDate(item.dueDate)}` : ""}
          {" · "}
          {lifecycleChecklistItemStatusLabels[item.status]}
        </div>
      </div>
      <div className="fg-check-item-meta">
        {item.responsibleUserName ? (
          <div className="fg-cell-user">
            <Avatar name={item.responsibleUserName} size={20} />
            <span>{item.responsibleUserName}</span>
          </div>
        ) : (
          <span className="fg-muted">Sem responsável</span>
        )}
      </div>
      {canWrite ? (
        <div className="fg-check-item-actions">
          {item.status !== "done" ? (
            <ItemActionButton
              id={item.id}
              status="done"
              label="Marcar concluído"
              variant="outline"
              icon={<Check size={12} />}
            />
          ) : null}
          {item.status === "blocked" ? (
            <ItemActionButton
              id={item.id}
              status="pending"
              label="Desbloquear"
              variant="ghost"
              icon={<Clock size={12} />}
            />
          ) : null}
          {item.status !== "blocked" && item.status !== "done" ? (
            <ItemActionButton
              id={item.id}
              status="blocked"
              label="Bloquear"
              variant="ghost"
              icon={<Ban size={12} />}
            />
          ) : null}
          {item.status !== "not_applicable" && item.status !== "done" ? (
            <ItemActionButton
              id={item.id}
              status="not_applicable"
              label="N/A"
              variant="ghost"
              icon={<MinusCircle size={12} />}
            />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function ItemActionButton({
  id,
  status,
  label,
  variant,
  icon,
}: {
  id: string;
  status: LifecycleChecklistItemStatus;
  label: string;
  variant: "outline" | "ghost";
  icon: React.ReactNode;
}) {
  return (
    <form action={updateLifecycleChecklistItemStatusAction} style={{ display: "inline" }}>
      <input name="id" type="hidden" value={id} />
      <input name="status" type="hidden" value={status} />
      <Button type="submit" variant={variant} size="sm" icon={icon}>
        {label}
      </Button>
    </form>
  );
}

function ChecklistStatusBadge({ status }: { status: LifecycleChecklistStatus }) {
  if (status === "completed") {
    return <StatusBadge tone="success" label={lifecycleChecklistStatusLabels[status]} />;
  }
  if (status === "cancelled") {
    return <StatusBadge tone="muted" label={lifecycleChecklistStatusLabels[status]} />;
  }
  return <StatusBadge tone="brand" label={lifecycleChecklistStatusLabels[status]} />;
}

function mapStatusClass(status: LifecycleChecklistItemStatus): string {
  switch (status) {
    case "done":
      return "fg-check-done";
    case "blocked":
      return "fg-check-blocked";
    case "not_applicable":
      return "fg-check-na";
    case "pending":
    default:
      return "fg-check-in_progress";
  }
}

function formatEmploymentType(type: string) {
  return employmentTypeLabels[type as keyof typeof employmentTypeLabels] ?? type;
}

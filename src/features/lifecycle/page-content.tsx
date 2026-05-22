import { Bell, ChevronRight, ClipboardCheck, Download, Plus, UserPlus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ActionSheet, Avatar, Button, Card, EmptyState, Page, PageHeader } from "@/components/fg";
import { createEmployeeAction } from "@/features/people/actions";
import { listPeopleOptions } from "@/features/people/dal";
import { EmployeeCreateFields, type EmployeeFormOptions } from "@/features/people/employee-form-fields";
import {
  canWriteCompensation,
  canWritePeople,
  employeeStatusLabels,
  employmentTypeLabels,
} from "@/features/people/rules";
import { createLifecycleChecklistAction } from "@/features/lifecycle/actions";
import {
  listLifecycleChecklists,
  listLifecycleEmployeeOptions,
  type LifecycleChecklistListItem,
  type LifecycleEmployeeOption,
} from "@/features/lifecycle/dal";
import {
  canWriteLifecycle,
  lifecycleTypeLabels,
  type LifecycleType,
} from "@/features/lifecycle/rules";
import { formatDate } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";

export async function LifecycleChecklistPageContent({ type }: { type: LifecycleType }) {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  if (!canAny(["lifecycle.read", "lifecycle.write"], context)) {
    redirect("/acesso-negado");
  }

  const canWrite = canWriteLifecycle(context);
  const canCreateEmployee = type === "onboarding" && canWritePeople(context) && canWriteCompensation(context);
  const [checklists, employeeOptions, peopleOptions] = await Promise.all([
    listLifecycleChecklists(context, type),
    canWrite ? listLifecycleEmployeeOptions(context) : Promise.resolve([]),
    canCreateEmployee ? listPeopleOptions(context) : Promise.resolve(null),
  ]);

  const isOnboarding = type === "onboarding";
  const totalBlocked = checklists.reduce(
    (total, checklist) =>
      total + checklist.items.filter((item) => item.status === "blocked").length,
    0,
  );

  const description = isOnboarding
    ? `${checklists.length} admissão${checklists.length === 1 ? "" : "es"} em andamento`
    : `${checklists.length} processo${checklists.length === 1 ? "" : "s"}${
        totalBlocked > 0
          ? ` · ${totalBlocked} com pendência${totalBlocked > 1 ? "s" : ""}`
          : ""
      }`;

  return (
    <Page>
      <PageHeader
        eyebrow="Pessoas"
        title={lifecycleTypeLabels[type]}
        description={description}
        actions={
          <>
            {!isOnboarding ? (
              <Button type="button" variant="outline" size="sm" icon={<Download size={14} />} disabled>
                Exportar
              </Button>
            ) : null}
            {canWrite && isOnboarding && canCreateEmployee && peopleOptions ? (
              <ActionSheet
                title="Iniciar admissão"
                description="Cadastre o colaborador e o checklist de admissão será criado automaticamente."
                width={760}
                trigger={
                  <Button type="button" variant="primary" size="sm" icon={<UserPlus size={14} />}>
                    Iniciar admissão
                  </Button>
                }
              >
                <OnboardingForm options={peopleOptions} />
              </ActionSheet>
            ) : null}
            {canWrite && isOnboarding ? (
              <ActionSheet
                title="Criar checklist para colaborador existente"
                description="Use quando o colaborador já está cadastrado e precisa de um novo checklist."
                width={560}
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<ClipboardCheck size={14} />}
                  >
                    Checklist existente
                  </Button>
                }
              >
                <ExistingEmployeeForm employeeOptions={employeeOptions} type={type} />
              </ActionSheet>
            ) : null}
            {canWrite && !isOnboarding ? (
              <ActionSheet
                title="Abrir desligamento"
                description="Inicie o processo com a lista padrão de itens."
                width={560}
                trigger={
                  <Button type="button" variant="primary" size="sm" icon={<UserPlus size={14} />}>
                    Abrir desligamento
                  </Button>
                }
              >
                <ExistingEmployeeForm employeeOptions={employeeOptions} type={type} />
              </ActionSheet>
            ) : null}
          </>
        }
      />

      {checklists.length === 0 ? (
        <Card>
          <EmptyState
            icon={<UserPlus size={32} />}
            title={
              isOnboarding ? "Nenhuma admissão em andamento" : "Nenhum desligamento aberto"
            }
            description={
              isOnboarding
                ? "Inicie uma admissão pelo botão acima."
                : "Use o botão acima para abrir um desligamento."
            }
          />
        </Card>
      ) : (
        <div className="fg-checklist-list">
          {checklists.map((checklist) => (
            <CompactChecklistCard checklist={checklist} key={checklist.id} />
          ))}
        </div>
      )}
    </Page>
  );
}

function CompactChecklistCard({ checklist }: { checklist: LifecycleChecklistListItem }) {
  const isOnboarding = checklist.type === "onboarding";
  const eyebrow = isOnboarding ? "Admissão" : "Desligamento";
  const subtitle = `${checklist.employeePositionName} · ${checklist.employeeAreaName} · ${formatEmploymentType(checklist.employeeEmploymentType)}`;
  const when = isOnboarding
    ? `Entrada prevista ${formatDate(checklist.employeeStartDate)}`
    : checklist.employeeEndDate
    ? `Prevista ${formatDate(checklist.employeeEndDate)}`
    : checklist.dueDate
    ? `Prazo ${formatDate(checklist.dueDate)}`
    : "Sem prazo definido";

  const total = checklist.progress.total || 1;
  const pct = Math.round((checklist.progress.resolved / total) * 100);
  const blocked = checklist.items.filter((item) => item.status === "blocked").length;
  const responsible = pickResponsible(checklist);
  const tone = blocked > 0 || checklist.state === "overdue" ? "warn" : "default";
  const detailHref = (isOnboarding
    ? `/app/colaboradores/admissoes/${checklist.id}`
    : `/app/colaboradores/desligamentos/${checklist.id}`) as Route;

  return (
    <article className={`fg-check-card ${tone === "warn" ? "warn" : ""}`.trim()}>
      <div className="fg-check-head">
        <div style={{ minWidth: 0 }}>
          <div className="fg-check-eyebrow">{eyebrow}</div>
          <div className="fg-check-title">{checklist.employeeName}</div>
          <div className="fg-check-sub">{subtitle}</div>
        </div>
        <div className="fg-check-meta">
          <div className="fg-check-when fg-tabular">{when}</div>
          {responsible ? (
            <div className="fg-check-resp">
              <span className="fg-muted">Responsável</span>
              <Avatar name={responsible} size={20} />
              <span>{responsible}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="fg-check-progress">
        <div className="fg-check-bar">
          <div className="fg-check-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="fg-check-bar-label fg-tabular">
          <strong>{checklist.progress.resolved}</strong> de {checklist.progress.total} concluídos
          {blocked > 0 ? (
            <span className="fg-bad">
              {" "}
              · {blocked} bloqueado{blocked > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
      </div>

      <div className="fg-check-actions">
        <Link href={detailHref} className="fg-btn fg-btn-outline fg-btn-sm">
          <span>Abrir checklist</span>
        </Link>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          iconRight={<ChevronRight size={13} />}
          icon={<Bell size={13} />}
          disabled
          title="Notificar responsáveis (em breve)"
        >
          Notificar responsáveis
        </Button>
      </div>
    </article>
  );
}

function OnboardingForm({ options }: { options: EmployeeFormOptions }) {
  return (
    <form action={createEmployeeAction} style={{ display: "grid", gap: 18 }}>
      <input name="createOnboardingChecklist" type="hidden" value="on" />
      <input name="redirectTo" type="hidden" value="/app/colaboradores/admissoes" />
      <EmployeeCreateFields defaultStatus="active" options={options} />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button type="submit" variant="primary" icon={<Plus size={14} />}>
          Criar colaborador e checklist
        </Button>
      </div>
    </form>
  );
}

function ExistingEmployeeForm({
  employeeOptions,
  type,
}: {
  employeeOptions: LifecycleEmployeeOption[];
  type: LifecycleType;
}) {
  const isOnboarding = type === "onboarding";
  return (
    <form
      action={createLifecycleChecklistAction}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <input name="type" type="hidden" value={type} />
      <div className="fg-form-row">
        <div className="fg-field">
          <label className="fg-label">
            Colaborador<span className="fg-required">*</span>
          </label>
          <div className="fg-input-wrap">
            <select className="fg-input fg-select" name="employeeId" required defaultValue="">
              <option value="" disabled>
                Selecione
              </option>
              {employeeOptions.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.registrationNumber} — {employee.name} ({formatEmployeeStatus(employee.status)})
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="fg-field">
          <label className="fg-label">
            {isOnboarding ? "Data de entrada / prazo" : "Data final / prazo"}
          </label>
          <div className="fg-input-wrap">
            <input className="fg-input fg-tabular" name="dueDate" type="date" />
          </div>
        </div>
      </div>
      <div className="fg-field">
        <label className="fg-label">
          {isOnboarding ? "Observações" : "Motivo e observações"}
        </label>
        <textarea className="fg-input fg-textarea" maxLength={1200} name="notes" rows={4} />
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button type="submit" variant="primary" icon={<ClipboardCheck size={14} />}>
          {isOnboarding ? "Criar checklist" : "Abrir desligamento"}
        </Button>
      </div>
    </form>
  );
}

function pickResponsible(checklist: LifecycleChecklistListItem): string | null {
  const counts = new Map<string, number>();
  for (const item of checklist.items) {
    if (item.responsibleUserName) {
      counts.set(
        item.responsibleUserName,
        (counts.get(item.responsibleUserName) ?? 0) + 1,
      );
    }
  }
  if (counts.size === 0) return null;
  let top: string | null = null;
  let topCount = 0;
  for (const [name, count] of counts.entries()) {
    if (count > topCount) {
      top = name;
      topCount = count;
    }
  }
  return top;
}

function formatEmployeeStatus(status: string) {
  return employeeStatusLabels[status as keyof typeof employeeStatusLabels] ?? status;
}

function formatEmploymentType(type: string) {
  return employmentTypeLabels[type as keyof typeof employmentTypeLabels] ?? type;
}

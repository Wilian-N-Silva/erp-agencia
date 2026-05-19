import type { AccessContext } from "@/lib/dal";
import { can, canAny } from "@/lib/rbac";

import { toDateKey } from "@/features/finance/rules";

export const lifecycleTypeLabels = {
  onboarding: "Admissao",
  offboarding: "Desligamento",
} as const;

export const lifecycleChecklistStatusLabels = {
  open: "Aberto",
  completed: "Concluido",
  cancelled: "Cancelado",
} as const;

export const lifecycleChecklistItemStatusLabels = {
  pending: "Pendente",
  done: "Concluido",
  blocked: "Bloqueado",
  not_applicable: "Nao aplicavel",
} as const;

export type LifecycleType = keyof typeof lifecycleTypeLabels;
export type LifecycleChecklistStatus = keyof typeof lifecycleChecklistStatusLabels;
export type LifecycleChecklistItemStatus = keyof typeof lifecycleChecklistItemStatusLabels;
export type LifecycleChecklistState = "ok" | "overdue" | "completed" | "cancelled";

export type LifecycleChecklistItemDefinition = {
  key: string;
  required: boolean;
  title: string;
};

export type LifecycleChecklistProgressTarget = {
  items: readonly {
    required: boolean;
    status: LifecycleChecklistItemStatus;
  }[];
  status: LifecycleChecklistStatus;
};

export type LifecycleChecklistStateTarget = {
  dueDate?: string | Date | null;
  status: LifecycleChecklistStatus;
};

export const defaultLifecycleChecklistItems: Record<
  LifecycleType,
  readonly LifecycleChecklistItemDefinition[]
> = {
  onboarding: [
    { key: "employee_created", required: true, title: "Cadastro criado" },
    { key: "required_data", required: true, title: "Dados obrigatorios preenchidos" },
    { key: "contract_sent", required: true, title: "Contrato enviado" },
    { key: "contract_signed", required: true, title: "Contrato assinado ou registrado" },
    { key: "documents_received", required: true, title: "Documentos recebidos" },
    { key: "corporate_email", required: true, title: "E-mail corporativo solicitado/criado" },
    { key: "access_groups", required: true, title: "Grupos e acessos definidos" },
    { key: "equipment_prepared", required: true, title: "Equipamento preparado" },
    { key: "equipment_delivered", required: true, title: "Equipamento entregue" },
    { key: "benefits_configured", required: false, title: "Beneficios configurados" },
    { key: "owner_validated", required: true, title: "Responsavel validou inicio" },
    { key: "onboarding_completed", required: true, title: "Admissao concluida" },
  ],
  offboarding: [
    { key: "final_date", required: true, title: "Data final definida" },
    { key: "reason_registered", required: true, title: "Motivo registrado" },
    { key: "finance_reviewed", required: true, title: "Pendencias financeiras revisadas" },
    { key: "reimbursements_reviewed", required: true, title: "Reembolsos pendentes revisados" },
    { key: "invoices_reviewed", required: false, title: "NFs pendentes revisadas, se PJ" },
    { key: "benefits_ended", required: true, title: "Beneficios encerrados" },
    { key: "equipment_returned", required: true, title: "Equipamentos devolvidos" },
    { key: "accesses_removed", required: true, title: "Acessos removidos" },
    { key: "handoff_done", required: true, title: "Arquivos e responsabilidades transferidos" },
    { key: "email_suspended", required: true, title: "E-mail suspenso, redirecionado ou tratado" },
    { key: "saas_reviewed", required: true, title: "SaaS/licencas revisados" },
    { key: "final_documents", required: true, title: "Documentos finais anexados" },
    { key: "offboarding_completed", required: true, title: "Desligamento concluido" },
  ],
};

export function canReadLifecycle(context: AccessContext) {
  return canAny(["lifecycle.read", "lifecycle.write"], context);
}

export function canWriteLifecycle(context: AccessContext) {
  return can("lifecycle.write", context);
}

export function getLifecycleChecklistProgress(target: LifecycleChecklistProgressTarget) {
  const total = target.items.length;
  const resolved = target.items.filter((item) => isLifecycleItemResolved(item.status)).length;
  const requiredItems = target.items.filter((item) => item.required);
  const requiredResolved = requiredItems.filter((item) =>
    isLifecycleItemResolved(item.status),
  ).length;

  return {
    canComplete:
      target.status === "open" &&
      requiredItems.length > 0 &&
      requiredItems.every((item) => isLifecycleItemResolved(item.status)),
    requiredResolved,
    requiredTotal: requiredItems.length,
    resolved,
    total,
  };
}

export function getLifecycleChecklistState(
  target: LifecycleChecklistStateTarget,
  asOf: string | Date = new Date(),
): LifecycleChecklistState {
  if (target.status === "completed") {
    return "completed";
  }

  if (target.status === "cancelled") {
    return "cancelled";
  }

  if (target.dueDate && toDateKey(target.dueDate) < toDateKey(asOf)) {
    return "overdue";
  }

  return "ok";
}

export function isLifecycleItemResolved(status: LifecycleChecklistItemStatus) {
  return status === "done" || status === "not_applicable";
}

export function canTransitionLifecycleItem(
  checklistStatus: LifecycleChecklistStatus,
  itemStatus: LifecycleChecklistItemStatus,
) {
  return checklistStatus === "open" && itemStatus !== "done";
}

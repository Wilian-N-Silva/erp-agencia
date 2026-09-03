import { z } from "zod";

import type { AccessContext } from "@/lib/dal";
import { isIsoDate } from "@/lib/validation";

export const graphicJobOperationalStatuses = [
  "supplier_sourcing",
  "supplier_approval_pending",
  "os_pending",
  "client_approval_pending",
  "client_revision",
  "client_rejected",
  "approved",
  "in_production",
  "waiting",
  "ready",
  "delivered",
  "closed",
  "cancelled",
] as const;

export const graphicJobOperationalStatusSchema = z.enum(
  graphicJobOperationalStatuses,
);

export type GraphicJobOperationalStatus = z.infer<
  typeof graphicJobOperationalStatusSchema
>;

export const initialGraphicJobOperationalStatus = "supplier_sourcing" as const;

export const graphicJobOperationalStatusLabels: Record<
  GraphicJobOperationalStatus,
  string
> = {
  supplier_sourcing: "Buscando fornecedor",
  supplier_approval_pending: "Aguardando aprovação interna",
  os_pending: "Aguardando OS",
  client_approval_pending: "Aguardando cliente",
  client_revision: "Revisão solicitada",
  client_rejected: "Recusado pelo cliente",
  approved: "Aprovado",
  in_production: "Em produção",
  waiting: "Em espera",
  ready: "Pronto",
  delivered: "Entregue",
  closed: "Encerrado",
  cancelled: "Cancelado",
};

export const graphicJobFinancialStatusLabels = {
  not_started: "Não iniciado",
  pending: "Pendente",
  partial: "Parcial",
  settled: "Liquidado",
  overdue: "Em atraso",
} as const;

export type GraphicJobFinancialStatus = keyof typeof graphicJobFinancialStatusLabels;

const nextActionByStatus: Record<GraphicJobOperationalStatus, string> = {
  supplier_sourcing: "Buscar fornecedor",
  supplier_approval_pending: "Aprovar cotação",
  os_pending: "Registrar OS",
  client_approval_pending: "Obter aprovação do cliente",
  client_revision: "Revisar proposta do cliente",
  client_rejected: "Reavaliar demanda com o cliente",
  approved: "Liberar produção",
  in_production: "Acompanhar produção",
  waiting: "Resolver bloqueio",
  ready: "Entregar ao cliente",
  delivered: "Encerrar trabalho",
  closed: "Nenhuma ação pendente",
  cancelled: "Nenhuma ação pendente",
};

export function getGraphicJobNextAction(status: GraphicJobOperationalStatus) {
  return nextActionByStatus[status];
}

export function canReadGraphicJobs(context: AccessContext) {
  return context.permissions.includes("graphics.read") || canWriteGraphicJobs(context);
}

export function canWriteGraphicJobs(context: AccessContext) {
  return context.permissions.includes("graphics.write");
}

export const graphicJobFiltersSchema = z.strictObject({
  clientId: optionalUuidFilter(),
  projectId: optionalUuidFilter(),
  responsibleEmployeeId: optionalUuidFilter(),
  search: z.string().trim().max(120).optional().catch(undefined),
  status: graphicJobOperationalStatusSchema.optional().catch(undefined),
});

export type GraphicJobFilters = z.infer<typeof graphicJobFiltersSchema>;

export function normalizeGraphicJobFilters(
  input: Record<string, string | string[] | undefined>,
): GraphicJobFilters {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  return graphicJobFiltersSchema.parse({
    clientId: first(input.clientId),
    projectId: first(input.projectId),
    responsibleEmployeeId: first(input.responsibleEmployeeId),
    search: first(input.search),
    status: first(input.status),
  });
}

const nullableText = (max: number) =>
  z.string().trim().max(max).optional().transform((value) => value || null);

const nullableDate = z
  .string()
  .trim()
  .optional()
  .transform((value, context) => {
    if (!value) return null;
    if (!isIsoDate(value)) {
      context.addIssue({ code: "custom", message: "Data inválida." });
      return z.NEVER;
    }
    return new Date(`${value}T12:00:00.000Z`);
  });

export const graphicJobInputSchema = z.strictObject({
  clientId: z.string().uuid(),
  description: z.string().trim().min(1).max(4000),
  desiredDeliveryAt: nullableDate,
  internalCode: z.string().trim().min(1).max(80),
  notes: nullableText(2000),
  projectId: z.string().optional().transform((value) => value || null).pipe(z.string().uuid().nullable()),
  requestedAt: nullableDate.transform((value) => value ?? new Date()),
  responsibleEmployeeId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
});

export const graphicJobUpdateSchema = z.strictObject({
  ...graphicJobInputSchema.shape,
  id: z.string().uuid(),
});

export const graphicJobDeleteSchema = z.strictObject({
  id: z.string().uuid(),
});

function optionalUuidFilter() {
  return z.string().uuid().optional().catch(undefined);
}

const allowedTransitions = {
  supplier_sourcing: ["supplier_approval_pending", "cancelled"],
  supplier_approval_pending: ["supplier_sourcing", "os_pending", "cancelled"],
  os_pending: ["client_approval_pending", "cancelled"],
  client_approval_pending: [
    "client_revision",
    "client_rejected",
    "approved",
    "cancelled",
  ],
  client_revision: ["client_approval_pending", "client_rejected", "approved", "cancelled"],
  client_rejected: ["client_revision", "client_approval_pending", "cancelled"],
  approved: ["in_production", "waiting", "cancelled"],
  in_production: ["waiting", "ready", "cancelled"],
  waiting: ["approved", "in_production", "ready", "cancelled"],
  ready: ["in_production", "waiting", "delivered", "cancelled"],
  delivered: ["waiting", "closed"],
  closed: [],
  cancelled: [],
} satisfies Record<GraphicJobOperationalStatus, readonly GraphicJobOperationalStatus[]>;

export const graphicJobTransitionSchema = z.strictObject({
  from: graphicJobOperationalStatusSchema,
  to: graphicJobOperationalStatusSchema,
});

export function canTransitionGraphicJob(
  from: GraphicJobOperationalStatus,
  to: GraphicJobOperationalStatus,
) {
  return allowedTransitions[from].some((candidate) => candidate === to);
}

export function assertGraphicJobTransition(input: unknown) {
  const transition = graphicJobTransitionSchema.parse(input);

  if (!canTransitionGraphicJob(transition.from, transition.to)) {
    throw new Error(
      `Invalid graphic job transition: ${transition.from} -> ${transition.to}.`,
    );
  }

  return transition;
}

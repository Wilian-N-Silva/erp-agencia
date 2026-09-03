import { z } from "zod";

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

import { z } from "zod";
import { isoDateSchema } from "@/lib/validation";

export const waitingReasonLabels = { client: "Cliente", art: "Arte", internal: "Equipe interna", supplier: "Fornecedor", material: "Material", payment: "Pagamento", other: "Outro" } as const;
export const productionStatuses = ["approved", "in_production", "waiting", "ready", "delivered", "closed"] as const;
export type ProductionStatus = typeof productionStatuses[number];
export const productionInputSchema = z.strictObject({
  jobId: z.string().uuid(),
  expectedStatus: z.enum(productionStatuses),
  expectedEventId: z.union([z.string().uuid(), z.literal("")]).default(""),
  toStatus: z.enum(productionStatuses),
  responsibleEmployeeId: z.string().uuid(),
  dueAt: z.union([isoDateSchema, z.literal("")]).default(""),
  waitingReason: z.union([z.enum(["client", "art", "internal", "supplier", "material", "payment", "other"]), z.literal("")]).default(""),
  notes: z.string().trim().max(2000).default(""),
}).refine(value => value.toStatus !== "waiting" || Boolean(value.waitingReason), { path: ["waitingReason"], message: "Informe o motivo da espera." });

export function productionNextStatuses(status: string, resumeStatus?: string): ProductionStatus[] {
  switch (status) {
    case "approved": return ["in_production", "waiting"];
    case "in_production": return ["ready", "waiting"];
    case "ready": return ["delivered", "in_production", "waiting"];
    case "delivered": return ["closed"];
    case "waiting": return ["approved", "in_production", "ready"].includes(resumeStatus ?? "") ? [resumeStatus as ProductionStatus] : [];
    default: return [];
  }
}

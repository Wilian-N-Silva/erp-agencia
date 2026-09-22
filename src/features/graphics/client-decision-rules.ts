import { z } from "zod";
import { isoDateSchema } from "@/lib/validation";

export const clientDecisionLabels = { approved: "Aprovado", rejected: "Recusado", revision_requested: "Alteração solicitada" } as const;
export const clientChannelLabels = { whatsapp: "WhatsApp", email: "E-mail", signed: "Documento assinado", phone: "Telefone", in_person: "Presencial", other: "Outro" } as const;
export const clientDecisionSchema = z.strictObject({
  jobId: z.string().uuid(),
  osVersionId: z.string().uuid(),
  expectedDecisionId: z.union([z.string().uuid(), z.literal("")]).default(""),
  decision: z.enum(["approved", "rejected", "revision_requested"]),
  contact: z.string().trim().min(2, "Informe quem respondeu pelo cliente.").max(160),
  channel: z.enum(["whatsapp", "email", "signed", "phone", "in_person", "other"]),
  decidedAt: isoDateSchema,
  notes: z.string().trim().max(2000).default(""),
}).refine(value => value.decision === "approved" || value.notes.length >= 3, {
  path: ["notes"], message: "Descreva o motivo da recusa ou a alteração solicitada.",
});

export class GraphicFlowError extends Error {}

export function clientDecisionStatus(decision: z.infer<typeof clientDecisionSchema>["decision"]) {
  return { approved: "approved", rejected: "client_rejected", revision_requested: "client_revision" }[decision] as "approved" | "client_rejected" | "client_revision";
}

export function canRecordClientDecision(status: string) {
  return ["client_approval_pending", "client_revision", "client_rejected"].includes(status);
}

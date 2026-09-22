import { expect, it } from "vitest";
import { canRecordClientDecision, clientDecisionSchema, clientDecisionStatus } from "@/features/graphics/client-decision-rules";

const valid = { jobId: "10000000-0000-4000-8000-000000000001", osVersionId: "10000000-0000-4000-8000-000000000002", contact: "Cliente QA", channel: "email", decision: "approved", decidedAt: "2026-09-21" };
it("validates responses and requires an explanation for refusal or revision", () => {
  expect(clientDecisionSchema.parse(valid).expectedDecisionId).toBe("");
  for (const decision of ["rejected", "revision_requested"]) {
    expect(clientDecisionSchema.safeParse({ ...valid, decision }).success).toBe(false);
    expect(clientDecisionSchema.safeParse({ ...valid, decision, notes: "Trocar a arte" }).success).toBe(true);
  }
});
it("rejects invalid dates, channels and client-owned authority fields", () => {
  for (const extra of [{ decidedAt: "2026-02-30" }, { channel: "unknown" }, { organizationId: valid.jobId }, { createdByUserId: "tampered" }, { fileId: valid.jobId }]) {
    expect(clientDecisionSchema.safeParse({ ...valid, ...extra }).success).toBe(false);
  }
});
it("limits decisions to client response stages and maps operational outcomes", () => {
  expect(clientDecisionStatus("approved")).toBe("approved");
  expect(clientDecisionStatus("rejected")).toBe("client_rejected");
  expect(clientDecisionStatus("revision_requested")).toBe("client_revision");
  for (const status of ["supplier_sourcing", "os_pending", "approved", "in_production", "delivered", "closed"]) expect(canRecordClientDecision(status)).toBe(false);
  expect(canRecordClientDecision("client_approval_pending")).toBe(true);
});

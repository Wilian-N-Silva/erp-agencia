import { expect, it } from "vitest";
import { productionInputSchema, productionNextStatuses } from "@/features/graphics/production-rules";

it("does not skip production or delivery and resumes only the blocked stage", () => {
  expect(productionNextStatuses("approved")).toEqual(["in_production", "waiting"]);
  expect(productionNextStatuses("in_production")).toEqual(["ready", "waiting"]);
  expect(productionNextStatuses("delivered")).toEqual(["closed"]);
  expect(productionNextStatuses("waiting", "in_production")).toEqual(["in_production"]);
  expect(productionNextStatuses("waiting", "closed")).toEqual([]);
  expect(productionNextStatuses("closed")).toEqual([]);
  expect(productionNextStatuses("client_approval_pending")).toEqual([]);
});
it("requires an owner and waiting reason and rejects authority fields", () => {
  const input = { jobId: "10000000-0000-4000-8000-000000000001", expectedStatus: "approved", toStatus: "waiting", responsibleEmployeeId: "10000000-0000-4000-8000-000000000002" };
  expect(productionInputSchema.safeParse(input).success).toBe(false);
  expect(productionInputSchema.safeParse({ ...input, waitingReason: "supplier" }).success).toBe(true);
  expect(productionInputSchema.safeParse({ ...input, waitingReason: "supplier", responsibleEmployeeId: "" }).success).toBe(false);
  expect(productionInputSchema.safeParse({ ...input, waitingReason: "supplier", organizationId: input.jobId }).success).toBe(false);
});

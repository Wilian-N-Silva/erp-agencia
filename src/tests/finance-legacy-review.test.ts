import { expect, it } from "vitest";
import { legacyReleaseSchema } from "@/features/finance/legacy-review";

const request = { type: "receivable", id: "d1f6ba68-abf9-45c8-b0ba-c29a6c16b641", requestId: "72e37ae0-394a-4232-820d-91e42a7e9a19", amount: "40,5", reason: "Histórico duplicado", evidence: "Extrato conferido pela gestão", confirmed: "yes" };
it("normalizes cents and requires explicit documented review without extra fields", () => {
  expect(legacyReleaseSchema.parse(request).amount).toBe("40.50");
  for (const change of [{ amount: "0" }, { amount: "1.001" }, { amount: "1e3" }, { confirmed: "no" }, { evidence: "ok" }, { organizationId: request.id }]) expect(legacyReleaseSchema.safeParse({ ...request, ...change }).success).toBe(false);
});

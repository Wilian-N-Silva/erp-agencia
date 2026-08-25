import { describe, expect, it } from "vitest";

import { buildAccessReviewWorkItemCandidates } from "@/features/work-items/access-review-pilot";
import {
  canResolveWorkItem,
  generateWorkItemInputSchema,
  getWorkItemDedupeKey,
  resolveWorkItemInputSchema,
} from "@/features/work-items/rules";

const source = {
  accessCreatedAt: new Date("2026-08-20T10:00:00.000Z"),
  critical: true,
  employeeEndDate: "2026-08-19",
  employeeId: "70000000-0000-4000-8000-000000000001",
  employeeName: "Pessoa Piloto",
  employeeStatus: "terminated",
  id: "70000000-0000-4000-8000-000000000002",
  platform: "Email",
  responsibleUserId: "work-item-owner",
  reviewDueDate: null,
  status: "active" as const,
};

describe("work item contract", () => {
  it("deduplicates by occurrence instead of an eternal source key", () => {
    const base = {
      kind: "access_review",
      sourceType: "access_record",
      sourceId: source.id,
      occurrenceKey: "review_due:2026-08-20",
    };

    expect(getWorkItemDedupeKey(base)).not.toBe(
      getWorkItemDedupeKey({
        ...base,
        occurrenceKey: "review_due:2026-09-20",
      }),
    );
  });

  it("rejects server-owned state and tenant fields from generation payloads", () => {
    const payload = {
      kind: "access_review",
      sourceType: "access_record",
      sourceId: source.id,
      occurrenceKey: "review_due:2026-08-20",
      title: "Revisar acesso",
      description: "Acesso precisa de revisao.",
      organizationId: "70000000-0000-4000-8000-000000000009",
      status: "resolved",
    };

    expect(generateWorkItemInputSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects ambiguous ownership", () => {
    const result = generateWorkItemInputSchema.safeParse({
      kind: "access_review",
      sourceType: "access_record",
      sourceId: source.id,
      occurrenceKey: "review_due:2026-08-20",
      title: "Revisar acesso",
      description: "Acesso precisa de revisao.",
      assignedUserId: "work-item-owner",
      assignedEmployeeId: source.employeeId,
    });

    expect(result.success).toBe(false);
  });

  it("requires a resolution reason and does not accept a client status", () => {
    expect(
      resolveWorkItemInputSchema.safeParse({
        id: source.id,
        resolution: "ok",
      }).success,
    ).toBe(false);
    expect(
      resolveWorkItemInputSchema.safeParse({
        id: source.id,
        resolution: "Acesso removido no provedor.",
        status: "dismissed",
      }).success,
    ).toBe(false);
    expect(canResolveWorkItem("open")).toBe(true);
    expect(canResolveWorkItem("in_progress")).toBe(true);
    expect(canResolveWorkItem("resolved")).toBe(false);
  });

  it("maps the access-review pilot to actionable, cycle-aware work items", () => {
    const first = buildAccessReviewWorkItemCandidates([source], "2026-08-24");
    const repeated = buildAccessReviewWorkItemCandidates(
      [source],
      "2026-08-25",
    );
    const unrelatedEdit = buildAccessReviewWorkItemCandidates(
      [
        {
          ...source,
          employeeName: "Pessoa Piloto Atualizada",
          platform: "Email Corporativo",
        },
      ],
      "2026-09-01",
    );
    const nextTerminationCycle = buildAccessReviewWorkItemCandidates(
      [{ ...source, employeeEndDate: "2026-09-01" }],
      "2026-09-01",
    );
    const nextReviewCycle = buildAccessReviewWorkItemCandidates(
      [{ ...source, reviewDueDate: "2026-09-30" }],
      "2026-09-20",
    );

    expect(first).toHaveLength(2);
    expect(first.map((item) => item.kind)).toEqual([
      "access_revocation",
      "access_review",
    ]);
    expect(first.map((item) => item.priority)).toEqual(["critical", "high"]);
    expect(first.every((item) => item.assignedUserId === source.responsibleUserId)).toBe(true);
    expect(repeated.map((item) => item.occurrenceKey)).toEqual(
      first.map((item) => item.occurrenceKey),
    );
    expect(unrelatedEdit.map((item) => item.occurrenceKey)).toEqual(
      first.map((item) => item.occurrenceKey),
    );
    expect(
      nextTerminationCycle.find((item) => item.kind === "access_revocation")
        ?.occurrenceKey,
    ).not.toBe(
      first.find((item) => item.kind === "access_revocation")?.occurrenceKey,
    );
    expect(
      nextReviewCycle.find((item) => item.kind === "access_review")
        ?.occurrenceKey,
    ).not.toBe(
      first.find((item) => item.kind === "access_review")?.occurrenceKey,
    );
  });
});

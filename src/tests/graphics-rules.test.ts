import { describe, expect, it } from "vitest";

import {
  assertGraphicJobTransition,
  canTransitionGraphicJob,
  graphicJobOperationalStatuses,
  getGraphicJobNextAction,
  graphicJobInputSchema,
  graphicSupplierQuoteInputSchema,
  graphicSupplierQuoteApproveSchema,
  graphicSupplierQuoteRejectSchema,
  getGraphicJobStatusAfterQuoteRejection,
  initialGraphicJobOperationalStatus,
  normalizeGraphicJobFilters,
  validateGraphicQuoteAttachmentContent,
} from "@/features/graphics/rules";

describe("graphic job state machine", () => {
  it("starts sourcing a supplier and exposes every PRD status", () => {
    expect(initialGraphicJobOperationalStatus).toBe("supplier_sourcing");
    expect(graphicJobOperationalStatuses).toEqual([
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
    ]);
  });

  it("derives the operational next action without client-owned state", () => {
    expect(getGraphicJobNextAction("supplier_sourcing")).toBe("Buscar fornecedor");
    expect(getGraphicJobNextAction("os_pending")).toBe("Registrar OS");
    expect(getGraphicJobNextAction("waiting")).toBe("Resolver bloqueio");
    expect(getGraphicJobNextAction("closed")).toBe("Nenhuma ação pendente");
  });

  it("normalizes allowlisted filters and discards invalid enum and UUID values", () => {
    expect(normalizeGraphicJobFilters({
      search: "  banner  ",
      status: "not-a-status",
      clientId: "another-tenant",
    })).toEqual({
      search: "banner",
      status: undefined,
      clientId: undefined,
      projectId: undefined,
      responsibleEmployeeId: undefined,
    });
  });

  it("accepts creation without an OS and rejects server-owned fields", () => {
    const valid = {
      clientId: "10000000-0000-4000-8000-000000000001",
      description: "Material promocional",
      desiredDeliveryAt: "",
      internalCode: "GRF-42",
      notes: "",
      projectId: "",
      requestedAt: "2026-09-02",
      responsibleEmployeeId: "20000000-0000-4000-8000-000000000001",
      title: "Banner",
    };

    expect(graphicJobInputSchema.parse(valid)).toMatchObject({
      internalCode: "GRF-42",
      projectId: null,
    });
    expect(() => graphicJobInputSchema.parse({
      ...valid,
      operationalStatus: "closed",
      organizationId: "30000000-0000-4000-8000-000000000001",
    })).toThrow();
  });

  it("returns to sourcing after a supplier quote is rejected", () => {
    expect(
      canTransitionGraphicJob("supplier_approval_pending", "supplier_sourcing"),
    ).toBe(true);
  });

  it("allows the initial happy path without skipping gates", () => {
    expect(canTransitionGraphicJob("supplier_sourcing", "supplier_approval_pending")).toBe(true);
    expect(canTransitionGraphicJob("supplier_approval_pending", "os_pending")).toBe(true);
    expect(canTransitionGraphicJob("os_pending", "client_approval_pending")).toBe(true);
    expect(canTransitionGraphicJob("supplier_sourcing", "in_production")).toBe(false);
  });

  it("rejects terminal transitions and mass-assignment fields", () => {
    expect(() =>
      assertGraphicJobTransition({ from: "closed", to: "in_production" }),
    ).toThrow("Invalid graphic job transition");
    expect(() =>
      assertGraphicJobTransition({
        from: "supplier_sourcing",
        to: "supplier_approval_pending",
        organizationId: "00000000-0000-4000-8000-000000000001",
      }),
    ).toThrow();
  });

  it("normalizes supplier quote money, dates, and optional terms", () => {
    expect(graphicSupplierQuoteInputSchema.parse({
      jobId: "40000000-0000-4000-8000-000000000001",
      supplierId: "50000000-0000-4000-8000-000000000001",
      description: "Impressão e acabamento",
      quotedAmount: "1234,50",
      quotedAt: "2026-09-03",
      estimatedDeliveryAt: "2026-09-10",
      conditions: "50% na entrada",
    })).toMatchObject({
      quotedAmount: "1234.50",
      conditions: "50% na entrada",
    });
  });

  it("rejects quote approval and tenant fields as mass assignment", () => {
    const quote = {
      jobId: "40000000-0000-4000-8000-000000000001",
      supplierId: "50000000-0000-4000-8000-000000000001",
      description: "Impressão",
      quotedAmount: "100.00",
      quotedAt: "2026-09-03",
      estimatedDeliveryAt: "",
      conditions: "",
    };
    expect(() => graphicSupplierQuoteInputSchema.parse({
      ...quote,
      organizationId: "90000000-0000-4000-8000-000000000009",
      status: "approved",
      reviewerUserId: "attacker",
    })).toThrow();
    expect(() => graphicSupplierQuoteInputSchema.parse({
      ...quote,
      quotedAmount: "0",
    })).toThrow();
  });

  it("validates internal approval decisions as strict server inputs", () => {
    const identifiers = {
      id: "60000000-0000-4000-8000-000000000001",
      jobId: "40000000-0000-4000-8000-000000000001",
    };
    expect(graphicSupplierQuoteApproveSchema.parse(identifiers)).toEqual(identifiers);
    expect(() => graphicSupplierQuoteApproveSchema.parse({
      ...identifiers,
      reviewerUserId: "attacker",
    })).toThrow();
    expect(() => graphicSupplierQuoteRejectSchema.parse({
      ...identifiers,
      rejectionReason: "  ",
    })).toThrow();
    expect(graphicSupplierQuoteRejectSchema.parse({
      ...identifiers,
      rejectionReason: "  Prazo incompatível  ",
    }).rejectionReason).toBe("Prazo incompatível");
  });

  it("derives the job state after rejection from remaining quote options", () => {
    expect(getGraphicJobStatusAfterQuoteRejection([])).toBe("supplier_sourcing");
    expect(getGraphicJobStatusAfterQuoteRejection(["rejected", "cancelled"]))
      .toBe("supplier_sourcing");
    expect(getGraphicJobStatusAfterQuoteRejection(["pending", "rejected"]))
      .toBe("supplier_approval_pending");
    expect(getGraphicJobStatusAfterQuoteRejection(["pending", "approved"]))
      .toBe("os_pending");
  });

  it("validates attachment signatures instead of trusting browser MIME metadata", () => {
    expect(() => validateGraphicQuoteAttachmentContent(
      new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]),
      "pdf",
    )).not.toThrow();
    expect(() => validateGraphicQuoteAttachmentContent(
      new TextEncoder().encode("not a pdf"),
      "pdf",
    )).toThrow(/conteúdo/);
  });
});

import { describe, expect, it } from "vitest";

import {
  assertGraphicJobTransition,
  canTransitionGraphicJob,
  graphicJobOperationalStatuses,
  initialGraphicJobOperationalStatus,
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
});

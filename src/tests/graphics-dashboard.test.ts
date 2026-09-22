import { expect, it } from "vitest";
import { summarizeGraphicOperations, summarizeGraphicPortfolio } from "@/features/graphics/dashboard-rules";
import { summarizeGraphicFinance } from "@/features/graphics/finance-summary-rules";
it("counts stages and overdue delivery without treating completed or cancelled work as late", () => {
  const past = new Date("2026-09-01T12:00:00Z");
  expect(summarizeGraphicOperations([
    { operationalStatus: "in_production", desiredDeliveryAt: past },
    { operationalStatus: "waiting", desiredDeliveryAt: past },
    { operationalStatus: "closed", desiredDeliveryAt: past },
    { operationalStatus: "cancelled", desiredDeliveryAt: past },
    { operationalStatus: "client_revision", desiredDeliveryAt: null },
    { operationalStatus: "supplier_approval_pending", desiredDeliveryAt: null },
  ], "2026-09-21")).toMatchObject({ total: 6, late: 2, production: 1, waiting: 1, clientApproval: 1, internalApproval: 1 });
});
it("sums monetary totals exactly and marks an incomplete portfolio as unreliable", () => {
  const row = summarizeGraphicFinance({ contracted: "0.30", receivables: [], payables: [], pendingMovements: 0, today: "2026-09-21" });
  expect(summarizeGraphicPortfolio([row, row])).toMatchObject({ contracted: "0.60", unreliable: 2, reliable: false, count: 2 });
  expect(summarizeGraphicPortfolio([])).toMatchObject({ contracted: "0.00", reliable: false, count: 0 });
});

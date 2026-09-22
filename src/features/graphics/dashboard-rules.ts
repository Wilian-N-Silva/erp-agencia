import { centsToMoney, moneyToCents } from "@/features/finance/rules";
import type { GraphicJobListItem } from "./dal";
import type { summarizeGraphicFinance } from "./finance-summary-rules";
import { graphicJobOperationalStatuses } from "./rules";

export function summarizeGraphicOperations(jobs: Pick<GraphicJobListItem, "operationalStatus" | "desiredDeliveryAt">[], today: string) {
  const byStatus = Object.fromEntries(graphicJobOperationalStatuses.map(status => [status, 0])) as Record<(typeof graphicJobOperationalStatuses)[number], number>;
  let late = 0;
  for (const job of jobs) {
    byStatus[job.operationalStatus]++;
    const due = job.desiredDeliveryAt?.toISOString().slice(0, 10);
    if (due && due < today && !["delivered", "closed", "cancelled"].includes(job.operationalStatus)) late++;
  }
  return { total: jobs.length, byStatus, late, internalApproval: byStatus.supplier_approval_pending, clientApproval: byStatus.client_approval_pending + byStatus.client_revision, production: byStatus.in_production, waiting: byStatus.waiting };
}

export function summarizeGraphicPortfolio(rows: ReturnType<typeof summarizeGraphicFinance>[]) {
  const keys = ["contracted", "receivableOpen", "received", "payableTotal", "payableOpen", "paid", "contractedMargin", "cashResult"] as const;
  const totals = Object.fromEntries(keys.map(key => [key, centsToMoney(rows.reduce((sum, row) => sum + moneyToCents(row[key]), 0))])) as Record<(typeof keys)[number], string>;
  const unreliable = rows.filter(row => !row.reliable).length;
  return { ...totals, unreliable, reliable: rows.length > 0 && unreliable === 0, count: rows.length };
}

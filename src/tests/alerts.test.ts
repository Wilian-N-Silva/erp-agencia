import { describe, expect, it } from "vitest";

import {
  applyAlertFilters,
  canReadAlerts,
  canWriteAlerts,
  dedupeAlertCandidates,
  getAlertKey,
  sortAlertCandidates,
  type AlertCandidate,
} from "@/features/alerts/rules";
import { createAccessContext } from "@/lib/dal";

const baseAlert: AlertCandidate = {
  kind: "access_review",
  title: "Acesso critico",
  description: "Revisar acesso",
  severity: "high",
  entityType: "access_record",
  entityId: "access_1",
  dueDate: "2026-05-20",
};

describe("alert center rules", () => {
  it("allows configured roles to read and write alerts", () => {
    const director = createAccessContext({
      userId: "director_1",
      roles: ["director"],
    });
    const finance = createAccessContext({
      userId: "finance_1",
      roles: ["finance"],
    });
    const employee = createAccessContext({
      userId: "employee_1",
      roles: ["employee"],
    });

    expect(canReadAlerts(director)).toBe(true);
    expect(canWriteAlerts(director)).toBe(true);
    expect(canReadAlerts(finance)).toBe(true);
    expect(canWriteAlerts(finance)).toBe(false);
    expect(canReadAlerts(employee)).toBe(false);
  });

  it("builds stable keys and deduplicates candidates", () => {
    expect(getAlertKey(baseAlert)).toBe("access_record:access_1:Acesso critico");
    expect(dedupeAlertCandidates([baseAlert, { ...baseAlert }])).toHaveLength(1);
  });

  it("sorts critical alerts first and then by due date", () => {
    const sorted = sortAlertCandidates([
      { ...baseAlert, severity: "low", title: "Baixa", dueDate: "2026-05-10" },
      { ...baseAlert, severity: "critical", title: "Critica", dueDate: "2026-05-30" },
      { ...baseAlert, severity: "high", title: "Alta cedo", dueDate: "2026-05-01" },
    ]);

    expect(sorted.map((alert) => alert.title)).toEqual(["Critica", "Alta cedo", "Baixa"]);
  });

  it("filters alerts by status, severity and search text", () => {
    const alerts = [
      { ...baseAlert, status: "open" as const },
      {
        ...baseAlert,
        title: "Assinatura vencida",
        description: "Renovacao",
        severity: "medium" as const,
        status: "resolved" as const,
      },
    ];

    expect(applyAlertFilters(alerts, { status: "open" })).toHaveLength(1);
    expect(applyAlertFilters(alerts, { severity: "medium", status: "all" })).toHaveLength(1);
    expect(applyAlertFilters(alerts, { query: "assinatura", status: "all" })).toHaveLength(1);
  });
});

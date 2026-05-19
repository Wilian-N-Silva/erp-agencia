import { describe, expect, it } from "vitest";

import {
  applyClientFilters,
  buildClientBillingDueDate,
  buildClientExpectedEntryDescription,
  buildClientReminderCandidates,
  canReadClientFinancialValues,
  canGenerateClientExpectedEntry,
  generateClientCode,
  getClientMonthlyFinancialStatus,
  getClientListScope,
  getClientPaymentStatus,
  getNextClientBillingDueDate,
  normalizeClientFilters,
  toClientListItem,
} from "@/features/clients/rules";
import { buildFinanceCsv, escapeCsvCell } from "@/features/finance/export";
import {
  applyFinanceEntryFilters,
  applyFinanceExpenseFilters,
  computeFinanceDashboard,
  formatCompetence,
  formatDate,
  getFinancialEntryEffectiveStatus,
  getFinancialExpenseEffectiveStatus,
  normalizeFinanceFilters,
  normalizeMoneyInput,
} from "@/features/finance/rules";
import { createAccessContext } from "@/lib/dal";

describe("finance status rules", () => {
  it("formats dates and competences for Brazilian display", () => {
    expect(formatDate("2026-05-12")).toBe("12/05/2026");
    expect(formatCompetence("2026-05")).toBe("05/2026");
  });

  it("normalizes positive money inputs without using floating point math", () => {
    expect(normalizeMoneyInput("1200")).toBe("1200.00");
    expect(normalizeMoneyInput("1200,5")).toBe("1200.50");
    expect(() => normalizeMoneyInput("0")).toThrow("greater than zero");
    expect(() => normalizeMoneyInput("-1.00")).toThrow("positive decimal");
  });

  it("marks planned unpaid entries and expenses as overdue after due date", () => {
    expect(
      getFinancialEntryEffectiveStatus(
        {
          dueDate: "2026-05-11",
          receivedDate: null,
          status: "planned",
        },
        "2026-05-12",
      ),
    ).toBe("overdue");
    expect(
      getFinancialExpenseEffectiveStatus(
        {
          dueDate: "2026-05-11",
          paidDate: null,
          status: "planned",
        },
        "2026-05-12",
      ),
    ).toBe("overdue");
  });

  it("keeps settled and cancelled records out of automatic overdue status", () => {
    expect(
      getFinancialEntryEffectiveStatus(
        {
          dueDate: "2026-05-01",
          receivedDate: "2026-05-03",
          status: "planned",
        },
        "2026-05-12",
      ),
    ).toBe("received");
    expect(
      getFinancialExpenseEffectiveStatus(
        {
          dueDate: "2026-05-01",
          paidDate: null,
          status: "cancelled",
        },
        "2026-05-12",
      ),
    ).toBe("cancelled");
  });

  it("computes monthly totals and 30-day forecast with integer cents", () => {
    const dashboard = computeFinanceDashboard({
      asOf: "2026-05-12",
      entries: [
        {
          amount: "1000.00",
          competence: "2026-05",
          dueDate: "2026-05-08",
          receivedDate: "2026-05-08",
          status: "received",
        },
        {
          amount: "500.00",
          competence: "2026-05",
          dueDate: "2026-05-10",
          receivedDate: null,
          status: "planned",
        },
      ],
      expenses: [
        {
          amount: "300.00",
          competence: "2026-05",
          dueDate: "2026-05-07",
          paidDate: "2026-05-07",
          status: "paid",
        },
        {
          amount: "200.00",
          competence: "2026-05",
          dueDate: "2026-05-20",
          paidDate: null,
          status: "planned",
        },
      ],
      provisions: [
        {
          estimatedMonthlyAmount: "100.00",
          expectedDay: 25,
          recurring: true,
          status: "active",
        },
      ],
    });

    expect(dashboard.competence).toBe("2026-05");
    expect(dashboard.totals.incomeExpected).toBe("1500.00");
    expect(dashboard.totals.incomeReceived).toBe("1000.00");
    expect(dashboard.totals.incomeOverdue).toBe("500.00");
    expect(dashboard.totals.expensesExpected).toBe("500.00");
    expect(dashboard.totals.expensesPaid).toBe("300.00");
    expect(dashboard.totals.provisionsExpected).toBe("100.00");
    expect(dashboard.totals.resultRealized).toBe("700.00");
    expect(dashboard.totals.forecast30Days).toBe("-300.00");
  });

  it("normalizes and applies finance filters", () => {
    const filters = normalizeFinanceFilters({
      competence: "2026-05",
      entryStatus: "overdue",
      expenseStatus: "paid",
      q: "acme",
    });

    expect(filters).toEqual({
      competence: "2026-05",
      entryStatus: "overdue",
      expenseStatus: "paid",
      query: "acme",
    });

    expect(
      applyFinanceEntryFilters(
        [
          {
            amount: "100.00",
            clientName: "Acme",
            competence: "2026-05",
            description: "Fee",
            dueDate: "2026-05-01",
            receivedDate: null,
            status: "planned",
          },
          {
            amount: "100.00",
            clientName: "Other",
            competence: "2026-05",
            description: "Fee",
            dueDate: "2026-05-01",
            receivedDate: null,
            status: "planned",
          },
        ],
        filters,
        "2026-05-12",
      ),
    ).toHaveLength(1);

    expect(
      applyFinanceExpenseFilters(
        [
          {
            amount: "50.00",
            category: "software",
            competence: "2026-05",
            description: "Acme tool",
            dueDate: "2026-05-01",
            paidDate: "2026-05-02",
            status: "planned",
            supplier: "Vendor",
          },
          {
            amount: "50.00",
            category: "software",
            competence: "2026-05",
            description: "Other tool",
            dueDate: "2026-05-01",
            paidDate: null,
            status: "planned",
            supplier: "Vendor",
          },
        ],
        filters,
        "2026-05-12",
      ),
    ).toHaveLength(1);
  });

  it("builds finance CSV with escaped cells and localized dates", () => {
    const csv = buildFinanceCsv({
      competence: "2026-05",
      filters: {},
      totals: {
        expensesExpected: "50.00",
        expensesOverdue: "0.00",
        expensesPaid: "50.00",
        forecast30Days: "0.00",
        incomeExpected: "100.00",
        incomeOverdue: "0.00",
        incomeReceived: "100.00",
        provisionsExpected: "25.00",
        resultRealized: "50.00",
      },
      entries: [
        {
          amount: "100.00",
          clientId: "client_1",
          clientName: 'Acme "BR"',
          competence: "2026-05",
          description: "Fee; mensal",
          dueDate: "2026-05-12",
          id: "entry_1",
          notes: null,
          paymentMethod: "Pix",
          receivedAmount: "100.00",
          receivedDate: "2026-05-12",
          recurring: true,
          status: "received",
        },
      ],
      expenses: [],
      provisions: [
        {
          category: "folha",
          estimatedMonthlyAmount: "25.00",
          expectedDay: 30,
          id: "provision_1",
          name: "Folha",
          recurring: true,
          status: "active",
        },
      ],
    });

    expect(csv).toContain("Tipo;Descricao;Contraparte;Categoria");
    expect(csv).toContain('"Fee; mensal";"Acme ""BR"""');
    expect(csv).toContain("05/2026;12/05/2026;Recebido;");
    expect(csv).toContain("Provisao;Folha;;folha;;Dia 30;active;");
  });

  it("escapes CSV cells with separators, quotes, or line breaks", () => {
    expect(escapeCsvCell("plain")).toBe("plain");
    expect(escapeCsvCell('a;"b"')).toBe('"a;""b"""');
    expect(escapeCsvCell("line\nbreak")).toBe('"line\nbreak"');
  });
});

describe("client access rules", () => {
  const client = {
    id: "client_1",
    name: "Acme",
    code: "CLI-0001",
    status: "active" as const,
    monthlyFee: "1200.00",
    billingDay: 10,
    internalOwnerEmployeeId: "employee_1",
    internalOwnerName: "Owner",
    billingMethod: "pix",
    startDate: "2026-05-01",
    cancellationDate: null,
  };

  it("redacts client values from partial client readers", () => {
    const financeContext = createAccessContext({
      userId: "finance_1",
      roles: ["finance"],
    });
    const hrContext = createAccessContext({
      userId: "hr_1",
      roles: ["hr_admin"],
    });

    expect(canReadClientFinancialValues(financeContext)).toBe(true);
    expect(toClientListItem(client, financeContext).monthlyFee).toBe("1200.00");
    expect(canReadClientFinancialValues(hrContext)).toBe(false);
    expect(toClientListItem(client, hrContext)).toMatchObject({
      monthlyFee: null,
      valueHidden: true,
    });
  });

  it("generates stable client codes from organization sequence", () => {
    expect(generateClientCode(1)).toBe("CLI-00001");
    expect(generateClientCode(42)).toBe("CLI-00042");
  });

  it("normalizes and applies client filters", () => {
    const filters = normalizeClientFilters({
      q: "acme",
      status: "active",
    });

    expect(filters).toEqual({
      query: "acme",
      status: "active",
    });

    expect(
      applyClientFilters(
        [
          toClientListItem(client, createAccessContext({ userId: "finance_1", roles: ["finance"] })),
          toClientListItem(
            {
              ...client,
              code: "CLI-0002",
              id: "client_2",
              name: "Other",
              status: "paused",
            },
            createAccessContext({ userId: "finance_1", roles: ["finance"] }),
          ),
        ],
        filters,
      ),
    ).toHaveLength(1);
  });

  it("scopes leadership client reads to owned clients", () => {
    const leaderContext = createAccessContext({
      userId: "leader_1",
      employeeId: "employee_1",
      roles: ["leadership"],
    });
    const directorContext = createAccessContext({
      userId: "director_1",
      roles: ["director"],
    });
    const employeeContext = createAccessContext({
      userId: "employee_1",
      roles: ["employee"],
    });

    expect(getClientListScope(leaderContext)).toBe("owned");
    expect(getClientListScope(directorContext)).toBe("all");
    expect(getClientListScope(employeeContext)).toBe("none");
  });

  it("builds billing due dates with payment terms and month clamping", () => {
    expect(buildClientBillingDueDate("2026-02", 31, 2)).toBe("2026-03-02");
    expect(
      getNextClientBillingDueDate(
        {
          billingDay: 10,
          paymentTermsDays: 0,
        },
        "2026-05-11",
      ),
    ).toBe("2026-06-10");
  });

  it("allows expected entry generation only for active billable clients", () => {
    expect(
      canGenerateClientExpectedEntry({
        billingDay: 10,
        clientStatus: "active",
        monthlyFee: "1200.00",
      }),
    ).toBe(true);
    expect(
      canGenerateClientExpectedEntry({
        billingDay: 10,
        clientStatus: "cancelled",
        monthlyFee: "1200.00",
      }),
    ).toBe(false);
    expect(buildClientExpectedEntryDescription("Acme", "2026-05")).toBe(
      "Fee 05/2026 - Acme",
    );
  });

  it("classifies client payment and monthly financial status", () => {
    const payments = [
      {
        amount: "1000.00",
        dueDate: "2026-05-10",
        receivedAmount: null,
        receivedDate: null,
        status: "planned" as const,
      },
      {
        amount: "500.00",
        dueDate: "2026-05-15",
        receivedAmount: "100.00",
        receivedDate: null,
        status: "planned" as const,
      },
    ];

    expect(getClientPaymentStatus(payments[0], "2026-05-12")).toBe("overdue");
    expect(getClientPaymentStatus(payments[1], "2026-05-12")).toBe("partial");
    expect(getClientMonthlyFinancialStatus(payments, "2026-05-12")).toBe("partial");
  });

  it("generates reminder candidates for due, overdue, partial, and multiple open charges", () => {
    const reminders = buildClientReminderCandidates({
      asOf: "2026-05-12",
      reminderBeforeDays: 3,
      payments: [
        {
          id: "entry_due_today",
          clientName: "Acme",
          amount: "100.00",
          dueDate: "2026-05-12",
          receivedAmount: null,
          receivedDate: null,
          status: "planned",
        },
        {
          id: "entry_overdue",
          clientName: "Acme",
          amount: "100.00",
          dueDate: "2026-05-10",
          receivedAmount: null,
          receivedDate: null,
          status: "planned",
        },
        {
          id: "entry_partial",
          clientName: "Acme",
          amount: "100.00",
          dueDate: "2026-05-20",
          receivedAmount: "25.00",
          receivedDate: null,
          status: "planned",
        },
      ],
    });

    expect(reminders.map((reminder) => reminder.kind).sort()).toEqual([
      "due_today",
      "multiple_open",
      "overdue",
      "partial_payment",
    ]);
  });
});

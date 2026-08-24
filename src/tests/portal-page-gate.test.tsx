import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentPortalEmployeeAccess: vi.fn(),
  listAccessRecords: vi.fn(),
  listDocuments: vi.fn(),
  listEquipment: vi.fn(),
  listInvoiceRequests: vi.fn(),
  listReimbursements: vi.fn(),
  listTimeOffRequests: vi.fn(),
  listVacationBalances: vi.fn(),
}));

vi.mock("@/features/portal/access", () => ({
  getCurrentPortalEmployeeAccess: mocks.getCurrentPortalEmployeeAccess,
}));
vi.mock("@/features/portal/actions", () => ({
  createReimbursementAction: vi.fn(),
  submitInvoiceRequestAction: vi.fn(),
}));
vi.mock("@/features/portal/dal", () => ({
  listInvoiceRequests: mocks.listInvoiceRequests,
  listReimbursements: mocks.listReimbursements,
}));
vi.mock("@/features/timeoff/actions", () => ({
  createTimeOffRequestAction: vi.fn(),
}));
vi.mock("@/features/timeoff/dal", () => ({
  listTimeOffRequests: mocks.listTimeOffRequests,
  listVacationBalances: mocks.listVacationBalances,
}));
vi.mock("@/features/equipment/dal", () => ({
  listEquipment: mocks.listEquipment,
}));
vi.mock("@/features/documents/dal", () => ({
  listDocuments: mocks.listDocuments,
}));
vi.mock("@/features/accesses/dal", () => ({
  listAccessRecords: mocks.listAccessRecords,
}));

import PortalAccessesPage from "@/app/(portal)/portal/acessos/page";
import PortalDataPage from "@/app/(portal)/portal/dados/page";
import PortalDocumentsPage from "@/app/(portal)/portal/documentos/page";
import PortalEquipmentPage from "@/app/(portal)/portal/equipamentos/page";
import PortalTimeOffPage from "@/app/(portal)/portal/ferias/page";
import PortalNFsPage from "@/app/(portal)/portal/nfs/page";
import PortalHomePage from "@/app/(portal)/portal/page";
import PortalReimbursementsPage from "@/app/(portal)/portal/reembolsos/page";
import { ToastProvider } from "@/components/fg/toast";

const linkedAccess = {
  context: {
    employeeId: "30000000-0000-4000-8000-000000000001",
    organizationId: "10000000-0000-4000-8000-000000000001",
    permissions: [],
    roles: ["employee"],
    userId: "user-1",
  },
  employee: {
    areaName: "Operations",
    employmentType: "clt",
    fullName: "Maria Silva",
    id: "30000000-0000-4000-8000-000000000001",
    positionName: "Analyst",
    registrationNumber: "FG-001",
  },
};

const portalEntries = [
  ["home", PortalHomePage],
  ["invoices", PortalNFsPage],
  ["reimbursements", PortalReimbursementsPage],
  ["time off", PortalTimeOffPage],
  ["documents", PortalDocumentsPage],
  ["equipment", PortalEquipmentPage],
  ["accesses", PortalAccessesPage],
  ["personal data", PortalDataPage],
] as const;

describe("portal page employee gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentPortalEmployeeAccess.mockResolvedValue(null);
    mocks.listAccessRecords.mockResolvedValue([]);
    mocks.listDocuments.mockResolvedValue([]);
    mocks.listEquipment.mockResolvedValue([]);
    mocks.listInvoiceRequests.mockResolvedValue([]);
    mocks.listReimbursements.mockResolvedValue([]);
    mocks.listTimeOffRequests.mockResolvedValue([]);
    mocks.listVacationBalances.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it.each(portalEntries)(
    "blocks the %s entry before loading business data when the link is absent",
    async (_name, page) => {
      render(await page());

      expect(screen.getByText(/v.nculo de colaborador pendente/i)).toBeTruthy();
      expect(mocks.getCurrentPortalEmployeeAccess).toHaveBeenCalledTimes(1);
      expectNoBusinessReads();
    },
  );

  it("revalidates on page navigation and blocks a previously linked session after unlink", async () => {
    mocks.getCurrentPortalEmployeeAccess
      .mockResolvedValueOnce(linkedAccess)
      .mockResolvedValueOnce(null);

    const linkedPage = await PortalReimbursementsPage();
    const view = render(<ToastProvider>{linkedPage}</ToastProvider>);

    expect(
      screen.getByRole("heading", { name: "Meus reembolsos" }),
    ).toBeTruthy();
    expect(mocks.listReimbursements).toHaveBeenCalledTimes(1);

    const blockedPage = await PortalReimbursementsPage();
    view.rerender(<ToastProvider>{blockedPage}</ToastProvider>);

    expect(screen.getByText(/v.nculo de colaborador pendente/i)).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Solicitar reembolso" }),
    ).toBeNull();
    expect(mocks.getCurrentPortalEmployeeAccess).toHaveBeenCalledTimes(2);
    expect(mocks.listReimbursements).toHaveBeenCalledTimes(1);
  });
});

function expectNoBusinessReads() {
  expect(mocks.listAccessRecords).not.toHaveBeenCalled();
  expect(mocks.listDocuments).not.toHaveBeenCalled();
  expect(mocks.listEquipment).not.toHaveBeenCalled();
  expect(mocks.listInvoiceRequests).not.toHaveBeenCalled();
  expect(mocks.listReimbursements).not.toHaveBeenCalled();
  expect(mocks.listTimeOffRequests).not.toHaveBeenCalled();
  expect(mocks.listVacationBalances).not.toHaveBeenCalled();
}

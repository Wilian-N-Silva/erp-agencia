import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentAccessContext: vi.fn(),
  listAlertCandidates: vi.fn(),
  listStoredAlerts: vi.fn(),
  listActionableWorkItems: vi.fn(),
  resolveWorkItemAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("@/features/alerts/actions", () => ({
  dismissAlertAction: vi.fn(),
  generateAlertsAction: vi.fn(),
  resolveAlertAction: vi.fn(),
}));

vi.mock("@/features/alerts/dal", () => ({
  listAlertCandidates: mocks.listAlertCandidates,
  listStoredAlerts: mocks.listStoredAlerts,
}));

vi.mock("@/features/work-items/actions", () => ({
  resolveWorkItemAction: mocks.resolveWorkItemAction,
}));

vi.mock("@/features/work-items/dal", () => ({
  listActionableWorkItems: mocks.listActionableWorkItems,
}));

vi.mock("@/lib/dal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dal")>();

  return {
    ...actual,
    getCurrentAccessContext: mocks.getCurrentAccessContext,
  };
});

import AlertsPage from "@/app/(private)/app/alertas/page";
import { ToastProvider } from "@/components/fg";
import { createAccessContext } from "@/tests/helpers/access-context";

describe("alerts work items surface", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAccessContext.mockResolvedValue(
      createAccessContext({
        roles: ["director"],
        userId: "user-1",
      }),
    );
    mocks.listAlertCandidates.mockResolvedValue([]);
    mocks.listStoredAlerts.mockResolvedValue([]);
    mocks.listActionableWorkItems.mockResolvedValue([
      {
        id: "70000000-0000-4000-8000-000000000002",
        title: "Maria: acesso ativo apos desligamento",
        description: "Email continua ativo para colaborador desligado.",
        kind: "access_revocation",
        sourceType: "access_record",
        sourceId: "70000000-0000-4000-8000-000000000003",
        assignedUserId: "user-1",
        assignedEmployeeId: null,
        ownerName: "Gestora de acessos",
        dueAt: null,
        priority: "critical",
        status: "open",
        createdAt: new Date("2026-08-24T12:00:00.000Z"),
      },
    ]);
  });

  afterEach(() => {
    cleanup();
  });

  it("lists the pilot work item and exposes a resolution form with a required reason", async () => {
    render(<ToastProvider>{await AlertsPage({})}</ToastProvider>);

    expect(screen.getByRole("heading", { name: "Pendencias acionaveis" })).toBeTruthy();
    expect(screen.getByText("Maria: acesso ativo apos desligamento")).toBeTruthy();
    expect(screen.getByText("Gestora de acessos")).toBeTruthy();
    expect(mocks.listActionableWorkItems).toHaveBeenCalledOnce();

    const resolution = screen.getByLabelText(
      "Motivo da resolucao de Maria: acesso ativo apos desligamento",
    );
    expect(resolution.getAttribute("name")).toBe("resolution");
    expect(resolution.hasAttribute("required")).toBe(true);
    expect(resolution.getAttribute("minlength")).toBe("3");
    expect(screen.getByRole("button", { name: "Resolver" })).toBeTruthy();
  });
});

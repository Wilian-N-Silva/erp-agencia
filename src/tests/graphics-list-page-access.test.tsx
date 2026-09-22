import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentAccessContext: vi.fn(),
  getGraphicJobFormOptions: vi.fn(),
  getGraphicDashboard: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/features/graphics/dal", () => ({
  getGraphicJobFormOptions: mocks.getGraphicJobFormOptions,
}));
vi.mock("@/features/graphics/dashboard", () => ({ getGraphicDashboard: mocks.getGraphicDashboard }));

vi.mock("@/lib/dal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dal")>();

  return {
    ...actual,
    getCurrentAccessContext: mocks.getCurrentAccessContext,
  };
});

import GraphicJobsPage from "@/app/(private)/app/grafica/page";
import { createAccessContext } from "@/tests/helpers/access-context";
import { summarizeGraphicOperations } from "@/features/graphics/dashboard-rules";

describe("graphics list page access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCurrentAccessContext.mockResolvedValue(
      createAccessContext({
        organizationId: "10000000-0000-4000-8000-000000000001",
        permissions: ["graphics.supplier_quote_approve"],
        roles: [],
        userId: "quote-approver",
      }),
    );
    mocks.getGraphicDashboard.mockResolvedValue({ jobs: [], operations: summarizeGraphicOperations([], "2026-09-22"), finance: null, pending: 0 });
    mocks.getGraphicJobFormOptions.mockResolvedValue({
      clients: [],
      employees: [],
      projects: [],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the list and loads its data for an approver-only user", async () => {
    render(await GraphicJobsPage({}));

    expect(screen.getByRole("heading", { name: /Trabalhos da Gr.fica/i })).toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(mocks.getGraphicDashboard).toHaveBeenCalledOnce();
    expect(mocks.getGraphicJobFormOptions).toHaveBeenCalledOnce();
    expect(screen.queryByRole("link", { name: /Novo trabalho/i })).toBeNull();
    expect(screen.queryByText("Visão financeira")).toBeNull();
    expect(screen.getByRole("combobox", { name: "Etapa" })).toBeTruthy();
  });
});

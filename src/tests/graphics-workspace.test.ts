import { describe, expect, it } from "vitest";
import {
  graphicWorkspaceNextTab,
  graphicWorkspaceStage,
  parseGraphicWorkspaceTab,
} from "@/features/graphics/workspace-rules";

describe("graphics workspace navigation", () => {
  it("returns to the OS when a customer requests revision", () => {
    expect(graphicWorkspaceStage("client_revision")).toBe(2);
    expect(graphicWorkspaceNextTab("client_revision")).toBe("os");
    expect(graphicWorkspaceNextTab("client_rejected")).toBe("cliente");
  });
  it("keeps waiting at its original stage but directs the operator to resolve the wait", () => {
    expect(graphicWorkspaceStage("waiting", "ready")).toBe(5);
    expect(graphicWorkspaceStage("waiting", "in_production")).toBe(4);
    expect(graphicWorkspaceStage("waiting", "waiting")).toBe(4);
    expect(graphicWorkspaceNextTab("waiting")).toBe("producao");
  });
  it("keeps financial follow-up available after operational closure", () => {
    expect(graphicWorkspaceNextTab("closed", true)).toBe("financeiro");
    expect(graphicWorkspaceNextTab("closed", false)).toBe("historico");
    expect(graphicWorkspaceStage("cancelled")).toBe(-1);
    expect(graphicWorkspaceNextTab("cancelled", true)).toBe("historico");
  });
  it("uses overview for missing or unknown URL tabs", () => {
    expect(parseGraphicWorkspaceTab(null)).toBe("resumo");
    expect(parseGraphicWorkspaceTab("invalid")).toBe("resumo");
    expect(parseGraphicWorkspaceTab("cotacoes")).toBe("cotacoes");
  });
});

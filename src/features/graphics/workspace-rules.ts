import type { GraphicJobOperationalStatus } from "./rules";

export const graphicWorkspaceTabs = [
  { id: "resumo", label: "Visão geral" },
  { id: "pedido", label: "1. Pedido" },
  { id: "cotacoes", label: "2. Cotações" },
  { id: "os", label: "3. OS" },
  { id: "cliente", label: "4. Cliente" },
  { id: "producao", label: "5. Produção e entrega" },
  { id: "financeiro", label: "Financeiro" },
  { id: "historico", label: "Documentos e histórico" },
] as const;
export type GraphicWorkspaceTab = (typeof graphicWorkspaceTabs)[number]["id"];

export function parseGraphicWorkspaceTab(
  value: string | null,
): GraphicWorkspaceTab {
  return graphicWorkspaceTabs.find((tab) => tab.id === value)?.id ?? "resumo";
}

export function graphicWorkspaceStage(
  status: GraphicJobOperationalStatus,
  resumeStatus?: GraphicJobOperationalStatus | null,
): number {
  if (status === "waiting" && resumeStatus && resumeStatus !== "waiting")
    return graphicWorkspaceStage(resumeStatus);
  switch (status) {
    case "supplier_sourcing":
    case "supplier_approval_pending":
      return 1;
    case "os_pending":
    case "client_revision":
      return 2;
    case "client_approval_pending":
    case "client_rejected":
      return 3;
    case "approved":
    case "in_production":
    case "waiting":
      return 4;
    case "ready":
    case "delivered":
    case "closed":
      return 5;
    case "cancelled":
      return -1;
  }
}

export function graphicWorkspaceNextTab(
  status: GraphicJobOperationalStatus,
  financialPending = false,
): GraphicWorkspaceTab {
  if (status === "closed") return financialPending ? "financeiro" : "historico";
  if (status === "cancelled") return "historico";
  if (status === "waiting") return "producao";
  return (
    ["pedido", "cotacoes", "os", "cliente", "producao", "producao"] as const
  )[graphicWorkspaceStage(status)];
}

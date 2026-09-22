import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/features/graphics/import-actions", () => ({ commitGraphicImportAction: vi.fn(), ignoreGraphicImportAction: vi.fn(), reviewGraphicImportAction: vi.fn() }));
import { ImportRowReviewForm } from "@/app/(private)/app/grafica/importar/[id]/review-form";
const row = { id: "line", revision: 2, kind: "sales", normalized: { amount: "123.45", date: "2026-09-22", description: "Impressão", osNumber: "OS123", client: "Cliente da planilha", supplier: "", project: "", reference: "" }, resolution: null };
const options = { clients: [{ id: "client", name: "Cliente cadastrado" }], employees: [{ id: "employee", name: "Responsável" }], projects: [], accounts: [], suppliers: [], canImportCash: false };
afterEach(cleanup);
describe("revisão de linhas históricas", () => {
  it("não escolhe cliente por texto e preserva correções no payload", () => {
    const { container } = render(<ImportRowReviewForm row={row} options={options} />);
    expect((screen.getByLabelText("Cliente") as HTMLSelectElement).value).toBe("");
    fireEvent.change(screen.getByLabelText("Cliente"), { target: { value: "client" } });
    fireEvent.change(screen.getByLabelText("Valor confirmado (R$)"), { target: { value: "120,00" } });
    const payload = JSON.parse((container.querySelector('input[name="resolution"]') as HTMLInputElement).value);
    expect(payload).toMatchObject({ kind: "sales", clientId: "client", amount: "120,00", projectId: null });
    expect(payload).not.toHaveProperty("accountId");
  });
  it("exige permissão financeira para revisar caixa mas permite justificar exclusão", () => {
    render(<ImportRowReviewForm row={{ ...row, kind: "incoming" }} options={options} />);
    expect(screen.queryByRole("button", { name: "Salvar revisão da linha" })).toBeNull();
    expect(screen.getByRole("button", { name: "Ignorar linha com justificativa" })).toBeTruthy();
  });
  it("separa fornecedor de cliente no payload de saída", () => {
    const { container } = render(<ImportRowReviewForm row={{ ...row, kind: "outgoing" }} options={{ ...options, canImportCash: true, suppliers: [{ id: "supplier", name: "Fornecedor" }] }} />);
    fireEvent.change(screen.getByLabelText("Fornecedor identificado"), { target: { value: "supplier" } });
    const payload = JSON.parse((container.querySelector('input[name="resolution"]') as HTMLInputElement).value);
    expect(payload).toMatchObject({ kind: "outgoing", clientId: null, supplierId: "supplier" });
    expect(payload).not.toHaveProperty("operationalStatus");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAccessContext } from "@/tests/helpers/access-context";
const mocks = vi.hoisted(() => ({ context: vi.fn(), insert: vi.fn(), audit: vi.fn(), limit: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("redirect"); } }));
vi.mock("@/lib/dal", async original => ({ ...await original<typeof import("@/lib/dal")>(), getCurrentAccessContext: mocks.context, bindCurrentTenantContext: (fn: unknown) => fn }));
vi.mock("@/lib/db", () => ({ db: { insert: mocks.insert } }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.audit }));
vi.mock("@/lib/rate-limit", () => ({ enforceAuthenticatedRateLimit: mocks.limit, withRateLimitActionResult: (fn: unknown) => fn }));
import { createSupplierAction, createFinancialAccountAction, setCostCenterStatusAction } from "@/features/finance-master-data/actions";
const organizationId = "10000000-0000-4000-8000-000000000001";
function data(extra: Record<string, string> = {}) { const form = new FormData(); for (const [key, value] of Object.entries({ name: "Fornecedor teste", taxId: "", contactName: "", email: "", phone: "", ...extra })) form.set(key, value); return form; }
beforeEach(() => { vi.clearAllMocks(); mocks.context.mockResolvedValue(createAccessContext({ userId: "supplier-editor", organizationId, permissions: ["graphics.supplier_write"], roles: [] })); });
describe("permissão de fornecedores compartilhados", () => {
  it("permite cadastrar com organização do contexto e auditoria", async () => {
    const values = vi.fn().mockReturnValue({ returning: async () => [{ id: "supplier-id", organizationId, name: "Fornecedor teste" }] });
    mocks.insert.mockReturnValue({ values });
    await createSupplierAction(data());
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ organizationId, name: "Fornecedor teste" }));
    expect(mocks.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ entityType: "supplier", action: "create" }));
    expect(mocks.limit).toHaveBeenCalledWith("common_mutation", expect.anything());
  });
  it("não permite configurar contas ou centros de custo", async () => {
    await expect(createFinancialAccountAction(new FormData())).rejects.toThrow();
    await expect(setCostCenterStatusAction(new FormData())).rejects.toThrow();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("nega consulta de cotação como autorização para cadastrar fornecedor", async () => {
    mocks.context.mockResolvedValue(createAccessContext({ userId: "supplier-editor", organizationId, permissions: ["graphics.supplier_quote_write"], roles: [] }));
    await expect(createSupplierAction(data())).rejects.toThrow();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("recusa adulteração de organização", async () => {
    await expect(createSupplierAction(data({ organizationId }))).rejects.toThrow();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});


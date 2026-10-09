import { beforeEach, expect, it, vi } from "vitest";
import type { AccessContext } from "@/lib/dal";
const mocks = vi.hoisted(() => ({ context: vi.fn(), rate: vi.fn(), create: vi.fn(), refresh: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
vi.mock("@/lib/dal", () => ({ getCurrentAccessContext: mocks.context }));
vi.mock("@/lib/rate-limit", async original => ({ ...await original<typeof import("@/lib/rate-limit")>(), enforceAuthenticatedRateLimit: mocks.rate }));
vi.mock("@/features/portal/reimbursement-payable", () => ({ createReimbursementPayable: mocks.create, ReimbursementPayableError: class ReimbursementPayableError extends Error {} }));
import { createReimbursementPayableAction } from "@/features/portal/reimbursement-payable-actions";
const id = "00100000-0000-4000-8000-000000000001";
const context: AccessContext = { userId: "user", organizationId: id, employeeId: null, roles: [], permissions: ["finance.write", "reimbursements.approve_finance"] };
const form = () => { const data = new FormData(); data.set("reimbursementId", id); data.set("categoryId", id); data.set("dueDate", "2026-10-15"); data.set("competence", "2026-10"); return data; };
beforeEach(() => { vi.resetAllMocks(); mocks.context.mockResolvedValue(context); });
it("requires tenant, session and both permissions before the ledger", async () => {
  for (const denied of [null, { ...context, organizationId: null }, { ...context, permissions: ["finance.write"] }, { ...context, permissions: ["reimbursements.approve_finance"] }]) {
    mocks.context.mockResolvedValue(denied);
    expect((await createReimbursementPayableAction(form())).ok).toBe(false);
  }
  expect(mocks.create).not.toHaveBeenCalled(); expect(mocks.rate).not.toHaveBeenCalled();
});
it("enforces rate before the ledger and does not leak unexpected errors", async () => {
  mocks.rate.mockRejectedValue(new Error("database secret"));
  expect(await createReimbursementPayableAction(form())).toMatchObject({ ok: false, message: expect.not.stringContaining("secret") });
  expect(mocks.create).not.toHaveBeenCalled();
  mocks.rate.mockResolvedValue(undefined); mocks.create.mockRejectedValue(new Error("database secret"));
  expect(await createReimbursementPayableAction(form())).toMatchObject({ ok: false, message: expect.not.stringContaining("secret") });
  expect(mocks.refresh).not.toHaveBeenCalled();
});
it("revalidates consumers only after successful creation", async () => {
  expect((await createReimbursementPayableAction(form())).ok).toBe(true);
  expect(mocks.rate).toHaveBeenCalledWith("reconciliation", context);
  expect(mocks.create).toHaveBeenCalledWith(context, expect.objectContaining({ reimbursementId: id, costCenterId: null }));
  expect(mocks.refresh).toHaveBeenCalledWith("/app", "layout");
  expect(mocks.refresh).toHaveBeenCalledWith("/portal", "layout");
});

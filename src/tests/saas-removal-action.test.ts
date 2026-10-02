import { beforeEach, expect, it, vi } from "vitest";
import { createAccessContext } from "@/tests/helpers/access-context";
const mocks = vi.hoisted(() => ({ context: vi.fn(), remove: vi.fn(), limit: vi.fn(), redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/dal", async original => ({ ...await original<typeof import("@/lib/dal")>(), getCurrentAccessContext: mocks.context }));
vi.mock("@/features/saas/removal", async original => ({ ...await original<typeof import("@/features/saas/removal")>(), removeMistakenSaasSubscription: mocks.remove }));
vi.mock("@/lib/rate-limit", async original => ({ ...await original<typeof import("@/lib/rate-limit")>(), enforceAuthenticatedRateLimit: mocks.limit }));
import { removeSaasSubscriptionAction } from "@/features/saas/actions";
import { SaasRemovalError } from "@/features/saas/removal";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.context.mockResolvedValue(createAccessContext({ userId: "saas-writer", organizationId: "10000000-0000-4000-8000-000000000001", permissions: ["saas.write"], roles: [] }));
});
it("limits attempts and redirects after removal completes", async () => {
  await removeSaasSubscriptionAction(null, new FormData());
  expect(mocks.limit).toHaveBeenCalledWith("common_mutation", expect.anything());
  expect(mocks.remove).toHaveBeenCalledOnce();
  expect(mocks.redirect).toHaveBeenCalledWith("/app/assinaturas");
  expect(mocks.remove.mock.invocationCallOrder[0]).toBeLessThan(mocks.redirect.mock.invocationCallOrder[0]);
});
it("denies readers before mutation", async () => {
  mocks.context.mockResolvedValue(createAccessContext({ userId: "reader", permissions: ["saas.read"], roles: [] }));
  expect(await removeSaasSubscriptionAction(null, new FormData())).toEqual({ error: "Assinatura indisponível ou acesso não permitido." });
  expect(mocks.remove).not.toHaveBeenCalled();
});
it("returns a business error without redirect", async () => {
  mocks.remove.mockRejectedValue(new SaasRemovalError("Use o cancelamento."));
  expect(await removeSaasSubscriptionAction(null, new FormData())).toEqual({ error: "Use o cancelamento." });
  expect(mocks.redirect).not.toHaveBeenCalled();
});

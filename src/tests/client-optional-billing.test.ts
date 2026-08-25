import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  assertCanAny: vi.fn(),
  getCurrentAccessContext: vi.fn(),
  insertValues: [] as unknown[],
  redirect: vi.fn(),
  runWithCurrentTenantDb: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/audit", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        mocks.insertValues.push(values);

        return {
          returning: vi.fn().mockResolvedValue([
            {
              id: "30000000-0000-4000-8000-000000000001",
              name: "Cliente teste",
            },
          ]),
        };
      }),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{ total: 0 }]),
      })),
    })),
  },
}));
vi.mock("@/lib/dal", () => ({
  bindCurrentTenantContext: (operation: unknown) => operation,
  getCurrentAccessContext: mocks.getCurrentAccessContext,
  runWithCurrentTenantDb: mocks.runWithCurrentTenantDb,
}));
vi.mock("@/lib/rate-limit", () => ({
  enforceAuthenticatedRateLimit: vi.fn(),
  withRateLimitActionResult: (operation: unknown) => operation,
}));
vi.mock("@/lib/rbac", () => ({
  AccessDeniedError: class AccessDeniedError extends Error {},
  assertCan: mocks.assertCan,
  assertCanAny: mocks.assertCanAny,
}));

import { createClientAction } from "@/features/clients/actions";

const context = {
  employeeId: null,
  organizationId: "10000000-0000-4000-8000-000000000001",
  permissions: ["clients.write"],
  roles: [],
  userId: "user-1",
};

describe("CORE-002 optional client billing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertValues.length = 0;
    mocks.getCurrentAccessContext.mockResolvedValue(context);
    mocks.runWithCurrentTenantDb.mockImplementation(
      async (operation: () => Promise<unknown>) => operation(),
    );
  });

  it("creates a client without a billing profile or finance permission", async () => {
    await createClientAction(createClientForm());

    expect(mocks.runWithCurrentTenantDb).toHaveBeenCalledOnce();
    expect(mocks.assertCanAny).toHaveBeenCalledWith(
      ["clients.write", "clients.configure"],
      context,
    );
    expect(mocks.assertCan).not.toHaveBeenCalled();
    expect(mocks.insertValues).toEqual([
      expect.objectContaining({
        billingDay: null,
        billingMethod: null,
        monthlyFee: null,
        name: "Cliente teste",
        organizationId: context.organizationId,
      }),
    ]);
  });

  it("creates client and billing profile together when billing is configured", async () => {
    const formData = createClientForm();
    formData.set("monthlyFee", "1250,50");
    formData.set("billingDay", "12");
    formData.set("billingMethod", "Pix");

    await createClientAction(formData);

    expect(mocks.assertCan).toHaveBeenCalledWith("finance.write", context);
    expect(mocks.insertValues).toEqual([
      expect.objectContaining({
        billingDay: 12,
        billingMethod: "Pix",
        monthlyFee: "1250.50",
      }),
      expect.objectContaining({
        billingDay: 12,
        clientId: "30000000-0000-4000-8000-000000000001",
        monthlyFee: "1250.50",
        organizationId: context.organizationId,
        paymentMethod: "Pix",
      }),
    ]);
  });

  it("rejects incomplete billing and server-owned fields before writing", async () => {
    const incomplete = createClientForm();
    incomplete.set("monthlyFee", "1250.00");

    await expect(createClientAction(incomplete)).rejects.toBeInstanceOf(ZodError);
    expect(mocks.insertValues).toHaveLength(0);

    const tampered = createClientForm();
    tampered.set("organizationId", "20000000-0000-4000-8000-000000000001");

    await expect(createClientAction(tampered)).rejects.toBeInstanceOf(ZodError);
    expect(mocks.insertValues).toHaveLength(0);
  });
});

function createClientForm() {
  const formData = new FormData();
  formData.set("name", "Cliente teste");
  formData.set("monthlyFee", "");
  formData.set("billingDay", "");
  formData.set("internalOwnerEmployeeId", "");
  formData.set("billingMethod", "");
  formData.set("notes", "");
  formData.set("startDate", "");
  return formData;
}

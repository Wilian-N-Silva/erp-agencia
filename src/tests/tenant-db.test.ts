import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { db, type Database } from "@/lib/db";
import { createWithTenantDb, type TenantTransaction } from "@/lib/db/tenant";
import type { AccessContext } from "@/lib/dal";
import { createAccessContext } from "@/tests/helpers/access-context";
import { AccessDeniedError } from "@/lib/rbac";

const organizationId = "00000000-0000-4000-8000-000000000001";

describe("withTenantDb", () => {
  it("denies missing or malformed tenant identities before opening a transaction", async () => {
    const transaction = vi.fn();
    const withTenantDb = createWithTenantDb({
      transaction: transaction as unknown as Database["transaction"],
    });
    const callback = vi.fn(async () => undefined);
    const invalidContexts = [
      null,
      undefined,
      createAccessContext({ userId: "user-1", roles: [] }),
      createAccessContext({
        userId: "user-1",
        organizationId: "not-a-uuid",
        roles: [],
      }),
      createAccessContext({ userId: " ", organizationId, roles: [] }),
    ];

    for (const context of invalidContexts) {
      await expect(
        withTenantDb(context as AccessContext, callback),
      ).rejects.toBeInstanceOf(AccessDeniedError);
    }

    expect(transaction).not.toHaveBeenCalled();
    expect(callback).not.toHaveBeenCalled();
  });

  it("sets the database context before invoking the callback", async () => {
    const events: string[] = [];
    const execute = vi.fn(async () => {
      events.push("context");
    });
    const transaction = vi.fn(
      async (callback: (transaction: TenantTransaction) => Promise<unknown>) =>
        callback({ execute } as unknown as TenantTransaction),
    );
    const withTenantDb = createWithTenantDb({
      transaction: transaction as unknown as Database["transaction"],
    });
    const context = createAccessContext({
      userId: "user-1",
      organizationId,
      roles: [],
    });

    const result = await withTenantDb(context, async () => {
      events.push("callback");
      return "result";
    });

    expect(result).toBe("result");
    expect(execute).toHaveBeenCalledOnce();
    expect(events).toEqual(["context", "callback"]);
  });

  it("requires an AccessContext in the public contract", () => {
    type ConfiguredTenantDb = ReturnType<typeof createWithTenantDb>;

    expectTypeOf<
      Parameters<ConfiguredTenantDb>[0]
    >().toEqualTypeOf<AccessContext>();
  });

  it("propagates operation failures to the transaction boundary", async () => {
    const operationError = new Error("force rollback");
    const transaction = vi.fn(
      async (operation: (transaction: TenantTransaction) => Promise<unknown>) =>
        operation({ execute: vi.fn() } as unknown as TenantTransaction),
    );
    const withTenantDb = createWithTenantDb({
      transaction: transaction as unknown as Database["transaction"],
    });
    const context = createAccessContext({
      userId: "user-1",
      organizationId,
      roles: [],
    });

    await expect(
      withTenantDb(context, async () => {
        throw operationError;
      }),
    ).rejects.toBe(operationError);
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("routes unrestricted db imports to the active tenant transaction", async () => {
    const execute = vi.fn(async () => undefined);
    const select = vi.fn(() => "tenant-select");
    const transaction = vi.fn(
      async (callback: (transaction: TenantTransaction) => Promise<unknown>) =>
        callback({ execute, select } as unknown as TenantTransaction),
    );
    const withTenantDb = createWithTenantDb({
      transaction: transaction as unknown as Database["transaction"],
    });
    const context = createAccessContext({
      userId: "user-1",
      organizationId,
      roles: [],
    });

    const result = await withTenantDb(context, async () => db.select());

    expect(result).toBe("tenant-select");
    expect(select).toHaveBeenCalledOnce();
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("reuses the active transaction and rejects a nested tenant switch", async () => {
    const execute = vi.fn(async () => undefined);
    const tenantTransaction = { execute } as unknown as TenantTransaction;
    const transaction = vi.fn(
      async (callback: (transaction: TenantTransaction) => Promise<unknown>) =>
        callback(tenantTransaction),
    );
    const withTenantDb = createWithTenantDb({
      transaction: transaction as unknown as Database["transaction"],
    });
    const context = createAccessContext({
      userId: "user-1",
      organizationId,
      roles: [],
    });
    const otherContext = createAccessContext({
      userId: "user-2",
      organizationId: "00000000-0000-4000-8000-000000000002",
      roles: [],
    });

    await withTenantDb(context, async (outerTransaction) => {
      const nestedResult = await withTenantDb(
        context,
        async (nestedTransaction) => nestedTransaction,
      );

      expect(nestedResult).toBe(outerTransaction);
      await expect(
        withTenantDb(otherContext, async () => undefined),
      ).rejects.toBeInstanceOf(AccessDeniedError);
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
  });
});

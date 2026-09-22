import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createDatabase,
  createWithTenantDb,
  type Database,
} from "@/lib/db";
import { clientBillingProfiles, clients } from "@/lib/db/schema";
import type { AccessContext } from "@/lib/dal";

const runtimeUrl = process.env.DATABASE_TEST_URL;
const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;

if (!runtimeUrl || !adminUrl) {
  throw new Error(
    "DATABASE_TEST_URL and DATABASE_TEST_ADMIN_URL are required for the client billing suite.",
  );
}

const organizationId = "52000000-0000-4000-8000-000000000001";
const context: AccessContext = {
  employeeId: null,
  organizationId,
  permissions: ["clients.write", "finance.write"],
  roles: [],
  userId: "core-002-user",
};
const ids = {
  withoutBilling: "52000000-0000-4000-8000-000000000011",
  withBilling: "52000000-0000-4000-8000-000000000012",
  rollback: "52000000-0000-4000-8000-000000000013",
} as const;

let runtimeDb: Database;
let adminDb: Database;

beforeAll(async () => {
  runtimeDb = createDatabase(runtimeUrl, { allowExitOnIdle: true, max: 2 });
  adminDb = createDatabase(adminUrl, { allowExitOnIdle: true, max: 1 });
  await removeFixtures();
  await adminDb.execute(sql`
    insert into organizations (id, name, slug)
    values (${organizationId}, 'CORE-002 Organization', 'core-002-organization')
  `);
});

afterAll(async () => {
  if (adminDb) await removeFixtures();
  await Promise.all([runtimeDb?.$client.end(), adminDb?.$client.end()]);
});

describe("CORE-002 optional billing persistence", () => {
  it("keeps the legacy billing columns nullable after migration", async () => {
    const result = await adminDb.execute(sql<{ columnName: string; nullable: string }>`
      select column_name as "columnName", is_nullable as "nullable"
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'clients'
        and column_name in ('monthly_fee', 'billing_day')
      order by column_name
    `);

    expect(result.rows).toEqual([
      { columnName: "billing_day", nullable: "YES" },
      { columnName: "monthly_fee", nullable: "YES" },
    ]);
  });

  it("commits clients with and without a billing profile", async () => {
    const withTenantDb = createWithTenantDb(runtimeDb);

    await withTenantDb(context, async (transaction) => {
      await transaction.insert(clients).values([
        {
          billingDay: null,
          code: "CORE-002-NONE",
          id: ids.withoutBilling,
          monthlyFee: null,
          name: "Cliente sem billing",
          organizationId,
        },
        {
          billingDay: 15,
          billingMethod: "Pix",
          code: "CORE-002-WITH",
          id: ids.withBilling,
          monthlyFee: "950.00",
          name: "Cliente com billing",
          organizationId,
        },
      ]);
      await transaction.insert(clientBillingProfiles).values({
        billingDay: 15,
        clientId: ids.withBilling,
        monthlyFee: "950.00",
        organizationId,
        paymentMethod: "Pix",
      });
    });

    const result = await adminDb.execute(sql<{
      billingDay: number | null;
      clientId: string;
      monthlyFee: string | null;
      profileId: string | null;
    }>`
      select
        c.id as "clientId",
        c.monthly_fee as "monthlyFee",
        c.billing_day as "billingDay",
        p.id as "profileId"
      from clients c
      left join client_billing_profiles p on p.client_id = c.id
      where c.id in (${ids.withoutBilling}, ${ids.withBilling})
      order by c.id
    `);

    expect(result.rows).toEqual([
      {
        billingDay: null,
        clientId: ids.withoutBilling,
        monthlyFee: null,
        profileId: null,
      },
      {
        billingDay: 15,
        clientId: ids.withBilling,
        monthlyFee: "950.00",
        profileId: expect.any(String),
      },
    ]);
  });

  it("rolls back client and billing writes together", async () => {
    const withTenantDb = createWithTenantDb(runtimeDb);

    await expect(
      withTenantDb(context, async (transaction) => {
        await transaction.insert(clients).values({
          billingDay: 8,
          code: "CORE-002-ROLLBACK",
          id: ids.rollback,
          monthlyFee: "800.00",
          name: "Cliente rollback",
          organizationId,
        });
        await transaction.insert(clientBillingProfiles).values({
          billingDay: 8,
          clientId: ids.rollback,
          monthlyFee: "800.00",
          organizationId,
        });

        throw new Error("force CORE-002 rollback");
      }),
    ).rejects.toThrow("force CORE-002 rollback");

    const result = await adminDb.execute(sql<{ total: number }>`
      select count(*)::int as total
      from clients
      where id = ${ids.rollback}
    `);

    expect(result.rows[0]?.total).toBe(0);
  });

  it("rolls back client and billing edits together", async () => {
    const withTenantDb = createWithTenantDb(runtimeDb);

    await expect(
      withTenantDb(context, async (transaction) => {
        await transaction
          .update(clients)
          .set({ monthlyFee: "1100.00" })
          .where(
            and(
              eq(clients.id, ids.withBilling),
              eq(clients.organizationId, organizationId),
            ),
          );
        await transaction
          .update(clientBillingProfiles)
          .set({ monthlyFee: "1100.00" })
          .where(
            and(
              eq(clientBillingProfiles.clientId, ids.withBilling),
              eq(clientBillingProfiles.organizationId, organizationId),
            ),
          );

        throw new Error("force CORE-002 edit rollback");
      }),
    ).rejects.toThrow("force CORE-002 edit rollback");

    const result = await adminDb.execute(sql<{
      clientFee: string;
      profileFee: string;
    }>`
      select
        c.monthly_fee as "clientFee",
        p.monthly_fee as "profileFee"
      from clients c
      join client_billing_profiles p on p.client_id = c.id
      where c.id = ${ids.withBilling}
    `);

    expect(result.rows[0]).toEqual({
      clientFee: "950.00",
      profileFee: "950.00",
    });
  });
});

async function removeFixtures() {
  await adminDb?.execute(sql`
    delete from client_billing_profiles
    where client_id in (
      ${ids.withoutBilling},
      ${ids.withBilling},
      ${ids.rollback}
    )
  `);
  await adminDb?.execute(sql`
    delete from clients
    where id in (
      ${ids.withoutBilling},
      ${ids.withBilling},
      ${ids.rollback}
    )
  `);
  await adminDb?.execute(sql`
    delete from organizations where id = ${organizationId}
  `);
}

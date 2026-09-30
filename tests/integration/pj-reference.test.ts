import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createDatabase, getDb } from "@/lib/db";
import type { AccessContext } from "@/lib/dal";
import { listPjTenureReferences } from "@/features/timeoff/pj-reference-dal";

const admin = createDatabase(process.env.DATABASE_TEST_ADMIN_URL!, { allowExitOnIdle: true });
const orgs = [randomUUID(), randomUUID()];
const ids = Array.from({ length: 6 }, () => randomUUID());
const context: AccessContext = { organizationId: orgs[0], userId: "pj-reference-qa", employeeId: ids[0], permissions: ["timeoff.read"], roles: [] };
beforeAll(async () => {
  for (const org of orgs) {
    await admin.execute(sql`insert into organizations (id,name,slug) values (${org},'PJ reference',${org})`);
    const area = randomUUID(), position = randomUUID();
    await admin.execute(sql`insert into areas (id,organization_id,name) values (${area},${org},'QA')`);
    await admin.execute(sql`insert into positions (id,organization_id,name) values (${position},${org},'QA')`);
    for (const [index, id] of ids.entries()) {
      if ((org === orgs[1]) !== (index === 5)) continue;
      await admin.execute(sql`insert into employees (id,organization_id,registration_number,full_name,position_id,area_id,employment_type,start_date,current_compensation,manager_employee_id,deleted_at) values (${id},${org},${id},${`PJ ${index}`},${position},${area},${index === 3 ? "clt" : "pj"},'2024-10-10',3900,${index === 1 ? ids[0] : null},${index === 4 ? new Date() : null})`);
    }
  }
});
afterAll(async () => {
  for (const org of orgs) {
    for (const table of ["employees", "positions", "areas"])
      await admin.execute(sql`delete from ${sql.identifier(table)} where organization_id=${org}`);
    await admin.execute(sql`delete from organizations where id=${org}`);
  }
  await admin.$client.end();
  await getDb().$client.end();
});
it("lists only non-deleted PJ employees from the organization, without compensation", async () => {
  const rows = await listPjTenureReferences(context);
  expect(rows.map(row => row.id).sort()).toEqual(ids.slice(0, 3).sort());
  expect(rows[0]).not.toHaveProperty("currentCompensation");
});
it("limits leaders to themselves and direct team members", async () => {
  const rows = await listPjTenureReferences({ ...context, permissions: ["timeoff.read_team"] });
  expect(rows.map(row => row.id).sort()).toEqual(ids.slice(0, 2).sort());
});
it("limits portal and own-only readers even when they hold global permissions", async () => {
  expect((await listPjTenureReferences(context, true)).map(row => row.id)).toEqual([ids[0]]);
  expect((await listPjTenureReferences({ ...context, permissions: ["timeoff.read_own"] })).map(row => row.id)).toEqual([ids[0]]);
});
it("denies missing permissions or organization and returns no rows without employee binding", async () => {
  await expect(listPjTenureReferences({ ...context, permissions: [] })).rejects.toThrow();
  await expect(listPjTenureReferences({ ...context, organizationId: null })).rejects.toThrow();
  expect(await listPjTenureReferences({ ...context, employeeId: null }, true)).toEqual([]);
});

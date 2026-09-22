import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { loadEnvFile } from "node:process";
import { Client } from "pg";

loadEnvFile(".env.test.local");
const adminUrl = process.env.DATABASE_TEST_ADMIN_URL;
assert.ok(adminUrl, "DATABASE_TEST_ADMIN_URL is required");
assert.match(new URL(adminUrl).pathname, /_test$/, "Use an isolated test database");

const env = {
  ...process.env,
  DATABASE_DIRECT_URL: adminUrl,
  SEED_DEMO_DATA: "true",
  INITIAL_ADMIN_EMAIL: "seed-smoke@formula.local",
  INITIAL_ADMIN_NAME: "Seed Smoke",
  INITIAL_ADMIN_PASSWORD: "SeedSmoke!Test2026",
  DEMO_USER_PASSWORD: "SeedSmoke!Test2026",
  STORAGE_BUCKET: "",
  STORAGE_ACCESS_KEY_ID: "",
  STORAGE_SECRET_ACCESS_KEY: "",
};
const db = new Client({ connectionString: adminUrl });
await db.connect();
try {
  const snapshot = async () => (await db.query(`
    SELECT e.id, e.registration_number, e.user_id, e.manager_employee_id
    FROM employees e JOIN organizations o ON o.id = e.organization_id
    WHERE o.slug = 'formula-group' ORDER BY e.registration_number
  `)).rows;
  const seed = () => execFileSync(process.execPath,
    ["--import", "tsx", "src/lib/db/seed.ts"], { env, stdio: "pipe", timeout: 60_000 });

  seed();
  const before = await snapshot();
  seed();
  assert.deepEqual(await snapshot(), before, "Repeated seed must preserve employee identities and links");
  assert.equal(before.length, 4);
  assert.equal(before.find(e => e.registration_number === "FG-00003")?.user_id, "demo-leadership");
  assert.equal(before.find(e => e.registration_number === "FG-00004")?.user_id, null);
  assert.ok(before.every(e => e.manager_employee_id !== e.id), "No employee manages themselves");
  const clients = await db.query(`
    SELECT c.code, b.id AS billing_id FROM clients c
    JOIN organizations o ON o.id = c.organization_id
    LEFT JOIN client_billing_profiles b ON b.client_id = c.id
    WHERE o.slug = 'formula-group' ORDER BY c.code
  `);
  assert.equal(clients.rowCount, 5);
  assert.equal(clients.rows.filter(c => c.billing_id === null).length, 3);
  console.log("Demo seed passed: repeatable identities, distinct employees, five clients and three without billing.");
} finally {
  await db.end();
}

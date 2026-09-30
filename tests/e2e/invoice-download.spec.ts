import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";

test("Financeiro baixa PDF de uma NF existente pela tela de detalhes", async ({ page }) => {
  loadEnvFile(".env");
  const connectionString = process.env.DATABASE_DIRECT_URL!;
  if (!["localhost", "127.0.0.1"].includes(new URL(connectionString).hostname)) throw new Error("Validação permitida apenas na base local.");
  const db = new Client({ connectionString });
  await db.connect();
  let invoice: { id: string; name: string; filename: string };
  try {
    const result = await db.query("select d.id,e.full_name name,f.original_name filename,f.storage_key from invoice_requests i join employees e on e.id=i.employee_id join documents d on d.file_id=i.file_id join files f on f.id=i.file_id where e.full_name like 'QA-PJ-%' and i.deleted_at is null and d.deleted_at is null and f.deleted_at is null order by i.created_at desc");
    const available = result.rows.find(row => existsSync(path.resolve(process.env.STORAGE_LOCAL_DIR ?? "uploads", row.storage_key)));
    expect(available, "Precisa de uma NF anterior com PDF disponível nesta instalação").toBeTruthy();
    invoice = available;
  } finally { await db.end(); }
  const login = await page.request.post("/api/auth/sign-in/email", { data: { email: "financeiro@formula.local", password: process.env.DEMO_USER_PASSWORD } });
  expect(login.ok()).toBe(true);
  await page.goto("/app/nfs");
  await page.getByRole("tab", { name: /^Todas/ }).click();
  await page.getByPlaceholder("Buscar PJ, matricula ou area...").fill(invoice.name);
  await page.getByRole("row").filter({ hasText: invoice.name }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar PDF", exact: true }).click();
  const download = await downloading;
  expect(await download.failure()).toBeNull();
  expect(download.suggestedFilename()).toBe(invoice.filename);
  const response = await page.request.get(`/app/documentos/${invoice.id}/download`);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
  expect((await page.request.get(`/app/documentos/${randomUUID()}/download`)).status()).toBe(404);
});


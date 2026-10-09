import { createInvoiceDownloadFixture } from "./helpers/invoice";
import { expect, test } from "@playwright/test";
import { loadEnvFile } from "node:process";
import { randomUUID } from "node:crypto";
import { signInWithRetry } from "./helpers/auth";

test("Financeiro baixa PDF de uma NF existente pela tela de detalhes", async ({ page }) => {
  test.setTimeout(150_000);
  loadEnvFile(".env");
  const invoice = await createInvoiceDownloadFixture();
  await signInWithRetry(page, "financeiro@formula.local", process.env.DEMO_USER_PASSWORD!);
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

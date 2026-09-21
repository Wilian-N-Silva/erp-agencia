import { expect, test } from "@playwright/test";

test("OS external PDF registration, version history and download", async ({ page }) => {
  test.setTimeout(60_000);
  const password = process.env.DEMO_USER_PASSWORD;
  expect(password, "Set DEMO_USER_PASSWORD for the local demo account").toBeTruthy();
  const signIn = () => page.request.post("/api/auth/sign-in/email", { data: { email: "todos.perfis@formula.local", password } });
  let login = await signIn();
  if (login.status() === 429) {
    // Honor the real auth limiter when running after the other demo login tests.
    const seconds = Number(login.headers()["retry-after"] ?? 10);
    await new Promise(resolve => setTimeout(resolve, (Math.min(Math.max(seconds, 1), 30) + 1) * 1000));
    login = await signIn();
  }
  expect(login.ok()).toBe(true);
  const code = `OS-E2E-${Date.now()}`;
  await page.goto("/app/grafica/novo");
  await page.getByRole("textbox", { name: "Código interno", exact: true }).fill(code);
  await page.getByRole("textbox", { name: "Título", exact: true }).fill("QA - Registro de OS externa");
  await page.getByRole("combobox", { name: "Cliente", exact: true }).selectOption({ label: "Horizonte Eventos - Grafica" });
  await page.getByRole("combobox", { name: "Responsável", exact: true }).selectOption({ label: "Lideranca Demo" });
  await page.getByRole("textbox", { name: "Data da solicitação", exact: true }).fill("2026-09-21");
  await page.getByRole("textbox", { name: "Descrição", exact: true }).fill("Trabalho fictício para validar GRF-005.");
  await page.getByRole("button", { name: "Criar trabalho", exact: true }).click();
  await expect(page.getByRole("heading", { name: "QA - Registro de OS externa" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Registrar OS", exact: true })).toHaveCount(0);
  await page.getByRole("combobox", { name: "Fornecedor", exact: true }).selectOption({ label: "Fornecedor QA Grafica B" });
  await page.getByRole("textbox", { name: "Valor cotado", exact: true }).fill("1200,00");
  await page.getByRole("textbox", { name: "Descrição", exact: true }).fill("Cotação de teste para OS");
  await page.getByRole("button", { name: "Adicionar cotação", exact: true }).click();
  await page.getByRole("button", { name: "Aprovar cotação", exact: true }).click();
  await expect(page.getByRole("button", { name: "Registrar OS", exact: true })).toBeVisible();
  // Minimal PDF fixture for transport and version-preservation assertions.
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
  await page.getByLabel("Número da OS", { exact: true }).fill("QA-OS-COMPARTILHADA");
  await page.getByLabel("Data da OS", { exact: true }).fill("2026-09-21");
  await page.getByLabel("Valor apresentado ao cliente", { exact: true }).fill("1.800,00");
  await page.getByLabel("PDF da OS", { exact: true }).setInputFiles({ name: "os-qa-v1.pdf", mimeType: "application/pdf", buffer: pdf });
  await page.getByRole("button", { name: "Registrar OS", exact: true }).click();
  await expect(page.getByText("Aguardando cliente", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Baixar PDF da versão 1" })).toBeVisible();
  const originalUrl = await page.getByRole("link", { name: "Baixar PDF da versão 1" }).getAttribute("href");
  const first = await page.request.get(originalUrl!);
  expect(first.status()).toBe(200);
  expect(await first.body()).toEqual(pdf);
  expect(first.headers()["cache-control"]).toContain("no-store");
  await page.getByLabel("Valor apresentado ao cliente", { exact: true }).fill("1950,00");
  await page.getByLabel("Motivo da nova versão", { exact: true }).fill("Alteração da arte e do valor");
  await page.getByLabel("PDF da OS", { exact: true }).setInputFiles({ name: "os-qa-v2.pdf", mimeType: "application/pdf", buffer: pdf });
  await page.getByRole("button", { name: "Registrar nova versão da OS", exact: true }).click();
  await expect(page.getByRole("link", { name: "Baixar PDF da versão 2" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Baixar PDF da versão 1" })).toBeVisible();
  expect(await (await page.request.get(originalUrl!)).body()).toEqual(pdf);
});

import { expect, test } from "@playwright/test";

test("cancelamento retira custo dos indicadores e preserva o contrato", async ({ page }) => {
  test.setTimeout(90_000);
  const password = process.env.DEMO_USER_PASSWORD;
  expect(password).toBeTruthy();
  const login = () => page.request.post("/api/auth/sign-in/email", {
    data: { email: "todos.perfis@formula.local", password },
  });
  let response = await login();
  if (response.status() === 429) {
    await new Promise(resolve => setTimeout(resolve, 31_000));
    response = await login();
  }
  expect(response.ok()).toBe(true);
  await page.goto("/app/assinaturas");
  const kpi = (label: string) => page.locator(".fg-kpi")
    .filter({ has: page.getByText(label, { exact: true }) }).locator(".fg-kpi-value");
  const cents = (text: string) => Number(text.replace(/\D/g, ""));
  const monthlyBefore = cents(await kpi("Custo mensal").innerText());
  const annualBefore = cents(await kpi("Custo anualizado").innerText());
  const marker = `QA-custo-cancelamento-${Date.now()}`;
  await page.locator("button:not([type=submit])").filter({ hasText: /^Cadastrar assinatura$/ }).click();
  const form = page.locator("form").filter({ has: page.locator('[name="cycleAmount"]') });
  await form.locator('[name="name"]').fill(marker);
  await form.locator('[name="category"]').fill("Validação fictícia");
  await form.locator('[name="provider"]').fill("Fornecedor QA");
  await form.locator('[name="cycleAmount"]').fill("87,65");
  await form.getByRole("button", { name: "Cadastrar assinatura", exact: true }).click();
  await expect.poll(async () => cents(await kpi("Custo mensal").innerText())).toBe(monthlyBefore + 8765);
  await expect.poll(async () => cents(await kpi("Custo anualizado").innerText())).toBe(annualBefore + 8765 * 12);
  await page.getByPlaceholder("Nome, fornecedor, categoria...").fill(marker);
  const href = await page.getByRole("link").filter({ hasText: marker }).getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);
  await page.getByRole("tab", { name: "Contrato", exact: true }).click();
  await page.getByRole("button", { name: /Cancelar assinatura/ }).click();
  await expect(page.getByText("Cancelada", { exact: true }).first()).toBeVisible();
  await page.goto("/app/assinaturas");
  await expect.poll(async () => cents(await kpi("Custo mensal").innerText())).toBe(monthlyBefore);
  await expect.poll(async () => cents(await kpi("Custo anualizado").innerText())).toBe(annualBefore);
  await page.reload();
  expect(cents(await kpi("Custo mensal").innerText())).toBe(monthlyBefore);
  expect(cents(await kpi("Custo anualizado").innerText())).toBe(annualBefore);
  await page.goto(href!);
  await expect(page.getByRole("heading", { name: marker, exact: true })).toBeVisible();
  await expect(page.getByText("Cancelada", { exact: true }).first()).toBeVisible();
  await expect(page.locator("body")).toContainText("87,65");
});

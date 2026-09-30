import { expect, test } from "@playwright/test";

test("cadastra cliente recorrente e gera cobrança; cadastra e cancela assinatura", async ({ page }) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(10_000);
  const password = process.env.DEMO_USER_PASSWORD;
  expect(password).toBeTruthy();
  const login = () => page.request.post("/api/auth/sign-in/email", { data: { email: "todos.perfis@formula.local", password } });
  let response = await login();
  if (response.status() === 429) {
    await new Promise(resolve => setTimeout(resolve, 31_000));
    response = await login();
  }
  expect(response.ok()).toBe(true);
  const marker = `QA-SET30-${Date.now()}`;
  await page.goto("/app/clientes/novo");
  await page.locator('[name="name"]').fill(marker);
  await page.locator(".fg-input-wrap").filter({ has: page.locator('[name="monthlyFee"]') }).locator('input[type="text"]').fill("321,45");
  await page.locator('[name="billingDay"]').fill("15");
  await page.getByRole("button", { name: "Criar cliente", exact: true }).click();
  await expect(page.getByRole("heading", { name: marker, exact: true })).toBeVisible();
  const clientUrl = page.url();
  await page.locator("button").filter({ hasText: /^Gerar entrada$/ }).click();
  const generateForm = page.locator("form").filter({ has: page.locator('[name="competence"]') });
  await generateForm.locator('[name="competence"]').fill("2026-10");
  await Promise.all([
    page.waitForResponse(response => response.request().method() === "POST" && response.url().includes("/app/clientes/")),
    generateForm.locator('button[type="submit"]').click(),
  ]);
  await page.goto(`${clientUrl}?tab=pagamentos`);
  await expect(page.locator("body")).toContainText("321,45");
  await expect(page.locator("body")).toContainText("10/2026");
  await page.goto("/app/financeiro/movimentacoes");
  await page.getByRole("combobox", { name: /^Conta financeira/ }).selectOption({ label: "Conta Gráfica QA" });
  await page.getByRole("textbox", { name: /^Valor/ }).fill("321,45");
  await page.getByLabel("Cliente", { exact: true }).selectOption({ label: marker });
  await page.getByLabel("Referência", { exact: true }).fill(marker);
  await page.getByRole("button", { name: "Registrar movimentação", exact: true }).click();
  await page.getByRole("row").filter({ has: page.getByRole("cell", { name: marker, exact: true }) }).getByRole("link", { name: "Conciliar", exact: true }).click();
  await page.getByLabel("Buscar por descrição, código do trabalho ou contraparte", { exact: true }).fill(marker);
  await page.getByRole("button", { name: "Buscar títulos", exact: true }).click();
  await page.getByLabel(`Valor para Fee 10/2026 - ${marker}`, { exact: true }).fill("321,45");
  await page.getByRole("checkbox", { name: "Conferi os títulos e valores e confirmo a conciliação.", exact: true }).check();
  await page.getByRole("button", { name: "Confirmar conciliação", exact: true }).click();
  await expect(page.getByText("Saldo a conciliar: R$ 0,00", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Saldo a conciliar: R$ 0,00", { exact: true })).toBeVisible();

  await page.goto("/app/assinaturas");
  await page.locator("button:not([type=submit])").filter({ hasText: /^Cadastrar assinatura$/ }).click();
  const form = page.locator("form").filter({ has: page.locator('[name="monthlyCost"]') });
  await form.locator('[name="name"]').fill(marker);
  await form.locator('[name="category"]').fill("Validação fictícia");
  await form.locator('[name="provider"]').fill("Fornecedor QA");
  await form.locator(".fg-input-wrap").filter({ has: page.locator('[name="monthlyCost"]') }).locator('input[type="text"]').fill("87,65");
  await form.getByRole("button", { name: "Cadastrar assinatura", exact: true }).click();
  await expect(page.getByRole("link").filter({ hasText: marker })).toBeVisible();
  await page.reload();
  const link = page.getByRole("link").filter({ hasText: marker });
  const href = await link.getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(href!);
  await expect(page.getByRole("heading", { name: marker, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Excluir|Remover assinatura/ })).toHaveCount(0);
  test.info().annotations.push({ type: "pendência", description: "Sem ação de exclusão de assinatura na interface; não foi apagada via SQL." });
  await page.getByRole("tab", { name: "Contrato", exact: true }).click();
  await page.getByRole("button", { name: /Cancelar assinatura/ }).click();
  await expect(page.getByText("Cancelada", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Cancelada", { exact: true }).first()).toBeVisible();
});

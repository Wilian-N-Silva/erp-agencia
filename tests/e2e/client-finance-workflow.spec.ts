import { expect, test } from "@playwright/test";

test("cadastra cliente recorrente, gera conta a receber e concilia recebimento", async ({ page }) => {
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
  const marker = `QA-cliente-financeiro-${Date.now()}`;
  const now = new Date();
  const competence = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const competenceLabel = `${competence.slice(5)}/${competence.slice(0, 4)}`;
  await page.goto("/app/clientes/novo");
  await page.locator('[name="name"]').fill(marker);
  await page.locator(".fg-input-wrap").filter({ has: page.locator('[name="monthlyFee"]') }).locator('input[type="text"]').fill("321,45");
  await page.locator('[name="billingDay"]').fill("15");
  await page.getByRole("button", { name: "Criar cliente", exact: true }).click();
  await expect(page.getByRole("heading", { name: marker, exact: true })).toBeVisible();
  const clientUrl = page.url();
  await page.locator("button").filter({ hasText: /^Gerar entrada$/ }).click();
  const generateForm = page.locator("form").filter({ has: page.locator('[name="competence"]') });
  await generateForm.locator('[name="competence"]').fill(competence);
  await Promise.all([
    page.waitForResponse(response => response.request().method() === "POST" && response.url().includes("/app/clientes/")),
    generateForm.locator('button[type="submit"]').click(),
  ]);
  await page.goto(`${clientUrl}?tab=pagamentos`);
  await expect(page.locator("body")).toContainText("321,45");
  await expect(page.locator("body")).toContainText(competenceLabel);
  await page.goto("/app/financeiro/movimentacoes");
  await page.getByRole("combobox", { name: /^Conta financeira/ }).selectOption({ label: "Conta Gráfica QA" });
  await page.getByRole("textbox", { name: /^Valor/ }).fill("321,45");
  await page.getByLabel("Cliente", { exact: true }).selectOption({ label: marker });
  await page.getByLabel("Referência", { exact: true }).fill(marker);
  await page.getByRole("button", { name: "Registrar movimentação", exact: true }).click();
  await page.getByRole("row").filter({ has: page.getByRole("cell", { name: marker, exact: true }) }).getByRole("link", { name: "Conciliar", exact: true }).click();
  await page.getByLabel("Buscar por descrição, código do trabalho ou contraparte", { exact: true }).fill(marker);
  await page.getByRole("button", { name: "Buscar títulos", exact: true }).click();
  await page.getByLabel(`Valor para Fee ${competenceLabel} - ${marker}`, { exact: true }).fill("321,45");
  await page.getByRole("checkbox", { name: "Conferi os títulos e valores e confirmo a conciliação.", exact: true }).check();
  await page.getByRole("button", { name: "Confirmar conciliação", exact: true }).click();
  await expect(page.getByText("Saldo a conciliar: R$ 0,00", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Saldo a conciliar: R$ 0,00", { exact: true })).toBeVisible();
  await page.goto(`${clientUrl}?tab=pagamentos`);
  const payment = page.getByRole("row").filter({ has: page.getByRole("cell", { name: competenceLabel, exact: true }) });
  await expect(payment).toHaveCount(1);
  await expect(payment.getByRole("cell").nth(2)).toHaveText("R$ 321,45");
  await expect(payment.getByRole("cell").nth(3)).toHaveText("R$ 321,45");
  await expect(payment).toContainText("Recebido");
  await expect(payment.getByRole("button", { name: "Marcar como recebido" })).toHaveCount(0);
});

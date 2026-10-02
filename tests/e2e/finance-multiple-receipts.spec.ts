import { expect, test } from "@playwright/test";
import { signInWithRetry } from "./helpers/auth";

test("um recebimento concilia dois títulos e outro quita o saldo parcial do cliente", async ({ page }) => {
  test.setTimeout(150_000);
  await signInWithRetry(page, "todos.perfis@formula.local", process.env.DEMO_USER_PASSWORD!);
  const marker = `QA-multiplos-${Date.now()}`;
  const now = new Date();
  const competences = [0, 1].map(offset => {
    const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { value, label: `${value.slice(5)}/${value.slice(0, 4)}` };
  });
  await page.goto("/app/clientes/novo");
  await page.locator('[name="name"]').fill(marker);
  await page.locator(".fg-input-wrap").filter({ has: page.locator('[name="monthlyFee"]') }).locator('input[type="text"]').fill("100,00");
  await page.locator('[name="billingDay"]').fill("15");
  await page.getByRole("button", { name: "Criar cliente", exact: true }).click();
  await expect(page.getByRole("heading", { name: marker, exact: true })).toBeVisible();
  const clientUrl = page.url();
  for (const competence of competences) {
    await page.goto(clientUrl);
    await page.locator("button").filter({ hasText: /^Gerar entrada$/ }).click();
    const form = page.locator("form").filter({ has: page.locator('[name="competence"]') });
    await form.locator('[name="competence"]').fill(competence.value);
    await Promise.all([
      page.waitForResponse(response => response.request().method() === "POST" && response.url().includes("/app/clientes/")),
      form.locator('button[type="submit"]').click(),
    ]);
  }

  async function createReceipt(amount: string, suffix: string) {
    await page.goto("/app/financeiro/movimentacoes");
    await page.getByRole("combobox", { name: /^Conta financeira/ }).selectOption({ label: "Conta Gráfica QA" });
    await page.getByRole("textbox", { name: /^Valor/ }).fill(amount);
    await page.getByLabel("Cliente", { exact: true }).selectOption({ label: marker });
    await page.getByLabel("Referência", { exact: true }).fill(`${marker}-${suffix}`);
    await page.getByRole("button", { name: "Registrar movimentação", exact: true }).click();
    await page.getByRole("row").filter({ has: page.getByRole("cell", { name: `${marker}-${suffix}`, exact: true }) }).getByRole("link", { name: "Conciliar", exact: true }).click();
    await page.getByLabel("Buscar por descrição, código do trabalho ou contraparte", { exact: true }).fill(marker);
    await page.getByRole("button", { name: "Buscar títulos", exact: true }).click();
  }
  const title = (index: number) => `Fee ${competences[index].label} - ${marker}`;
  const allocation = (index: number) => page.getByLabel(`Valor para ${title(index)}`, { exact: true });
  async function confirm() {
    await page.getByRole("checkbox", { name: "Conferi os títulos e valores e confirmo a conciliação.", exact: true }).check();
    await page.getByRole("button", { name: "Confirmar conciliação", exact: true }).click();
    await expect(page.getByText("Saldo a conciliar: R$ 0,00", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Saldo a conciliar: R$ 0,00", { exact: true })).toBeVisible();
  }
  async function checkPayment(index: number, received: string, status: string) {
    const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: competences[index].label, exact: true }) });
    await expect(row).toHaveCount(1);
    await expect(row.getByRole("cell").nth(2)).toHaveText("R$ 100,00");
    await expect(row.getByRole("cell").nth(3)).toHaveText(received);
    await expect(row).toContainText(status);
  }

  await createReceipt("150,00", "primeiro");
  // Suggestions must require explicit allocation and confirmation.
  await expect(allocation(0)).toHaveValue("");
  await expect(allocation(1)).toHaveValue("");
  await allocation(0).fill("100,00");
  await allocation(1).fill("50,00");
  await confirm();
  const firstReceiptUrl = page.url();
  await expect(page.getByRole("listitem").filter({ hasText: title(0) })).toContainText("R$ 100,00");
  await expect(page.getByRole("listitem").filter({ hasText: title(1) })).toContainText("R$ 50,00");
  await page.goto(`${clientUrl}?tab=pagamentos`);
  await checkPayment(0, "R$ 100,00", "Recebido");
  await checkPayment(1, "R$ 50,00", "Parcial");

  await createReceipt("50,00", "segundo");
  await expect(allocation(0)).toHaveCount(0);
  await allocation(1).fill("50,00");
  await confirm();
  await expect(page.getByRole("listitem").filter({ hasText: title(1) })).toHaveCount(1);
  await page.goto(`${clientUrl}?tab=pagamentos`);
  await checkPayment(0, "R$ 100,00", "Recebido");
  await checkPayment(1, "R$ 100,00", "Recebido");
  await page.reload();
  await checkPayment(1, "R$ 100,00", "Recebido");
  await page.goto(firstReceiptUrl);
  await expect(page.getByRole("listitem").filter({ hasText: marker })).toHaveCount(2);
  await expect(page.getByText("Saldo a conciliar: R$ 0,00", { exact: true })).toBeVisible();
});

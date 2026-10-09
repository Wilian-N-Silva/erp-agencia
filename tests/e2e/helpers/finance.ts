import { expect, type Page } from "@playwright/test";

export async function ensureTestFinancialAccount(page: Page) {
  await page.goto("/app/financeiro/cadastros");
  const accounts = page.locator(".fg-card").filter({ has: page.getByText("Contas financeiras", { exact: true }) });
  if (await accounts.getByText("Conta Gráfica QA", { exact: true }).count()) return;
  await accounts.getByText("Novo cadastro", { exact: true }).click();
  const form = accounts.locator("form").filter({ has: page.getByRole("button", { name: "Adicionar conta", exact: true }) });
  await form.locator('[name="name"]').fill("Conta Gráfica QA");
  await form.getByRole("button", { name: "Adicionar conta", exact: true }).click();
  await expect(accounts.getByText("Conta Gráfica QA", { exact: true })).toBeVisible();
}

export async function createTestSupplier(page: Page, name: string) {
  await page.goto("/app/grafica");
  await page.getByRole("link", { name: "Consultar e cadastrar fornecedores" }).click();
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Adicionar fornecedor", exact: true }) });
  await form.getByLabel("Nome", { exact: false }).fill(name);
  await form.getByRole("button", { name: "Adicionar fornecedor", exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
}

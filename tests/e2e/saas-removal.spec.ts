import { expect, test } from "@playwright/test";

test("remove cadastro errado e mantém cancelamento como operação distinta", async ({ page }) => {
  test.setTimeout(90_000);
  const login = () => page.request.post("/api/auth/sign-in/email", {
    data: { email: "todos.perfis@formula.local", password: process.env.DEMO_USER_PASSWORD },
  });
  let response = await login();
  if (response.status() === 429) {
    await new Promise(resolve => setTimeout(resolve, 31_000));
    response = await login();
  }
  expect(response.ok()).toBe(true);
  await page.goto("/app/assinaturas");
  const marker = `QA-remover-erro-${Date.now()}`;
  await page.locator("button:not([type=submit])").filter({ hasText: /^Cadastrar assinatura$/ }).click();
  const form = page.locator("form").filter({ has: page.locator('[name="cycleAmount"]') });
  await form.locator('[name="name"]').fill(marker);
  await form.locator('[name="category"]').fill("Validação fictícia");
  await form.getByRole("button", { name: "Cadastrar assinatura", exact: true }).click();
  await page.getByPlaceholder("Nome, fornecedor, categoria...").fill(marker);
  const link = page.getByRole("link").filter({ hasText: marker });
  await expect(link).toBeVisible();
  const href = await link.getAttribute("href");
  await page.goto(`${href}?tab=contrato`);
  await page.getByRole("button", { name: "Remover cadastro incorreto", exact: true }).click();
  await page.getByLabel("Motivo da remoção").fill("Cadastro fictício duplicado para validar remoção");
  await page.getByLabel("Confirmo que esta assinatura foi cadastrada por engano.").check();
  await page.getByRole("button", { name: "Confirmar remoção", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/assinaturas$/);
  await page.getByPlaceholder("Nome, fornecedor, categoria...").fill(marker);
  await expect(page.getByRole("link").filter({ hasText: marker })).toHaveCount(0);
  await page.reload();
  await page.getByPlaceholder("Nome, fornecedor, categoria...").fill(marker);
  await expect(page.getByRole("link").filter({ hasText: marker })).toHaveCount(0);
  const removedResponse = await page.goto(href!);
  expect(removedResponse?.status()).toBe(404);

  await page.goto("/app/assinaturas");
  await page.getByPlaceholder("Nome, fornecedor, categoria...").fill("Google Workspace");
  const workspace = await page.getByRole("link").filter({ hasText: "Google Workspace" }).getAttribute("href");
  await page.goto(`${workspace}?tab=contrato`);
  await page.getByRole("button", { name: "Remover cadastro incorreto", exact: true }).click();
  await page.getByLabel("Motivo da remoção").fill("Teste de proteção de assinatura com histórico");
  await page.getByLabel("Confirmo que esta assinatura foi cadastrada por engano.").check();
  await page.getByRole("button", { name: "Confirmar remoção", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "histórico de colaboradores" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Google Workspace", exact: true })).toBeVisible();
});

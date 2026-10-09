import { expect, test } from "@playwright/test";
import { signInWithRetry } from "./helpers/auth";

test("registra cobrança SaaS efetiva com câmbio/IOF e cria AP uma única vez", async ({ page }) => {
  test.setTimeout(90_000);
  page.setDefaultTimeout(15_000);
  await signInWithRetry(page, "todos.perfis@formula.local", process.env.DEMO_USER_PASSWORD!);
  const marker = `QA-cobranca-${Date.now()}`;
  await page.goto("/app/assinaturas");
  await page.locator("button:not([type=submit])").filter({ hasText: /^Cadastrar assinatura$/ }).click();
  const create = page.locator("form").filter({ has: page.locator('[name="cycleAmount"]') });
  await create.locator('[name="name"]').fill(marker);
  await create.locator('[name="category"]').fill("Validação financeira");
  await create.getByLabel("Moeda", { exact: true }).selectOption("EUR");
  await create.getByLabel("Periodicidade", { exact: true }).selectOption("monthly");
  await create.getByLabel("Valor por ciclo na moeda selecionada").fill("50,00");
  await create.getByText("Cotação estimada para USD ou EUR", { exact: true }).click();
  await create.getByLabel("Cotação estimada em reais").fill("6");
  await create.getByLabel("Data da cotação").fill("2026-10-01");
  await create.getByLabel("Fonte da cotação").fill("Fatura QA");
  await create.getByRole("button", { name: "Cadastrar assinatura", exact: true }).click();
  const href = await page.getByRole("link").filter({ hasText: marker }).getAttribute("href");
  expect(href).toBeTruthy();
  await page.goto(`${href}?tab=cobrancas`);
  const chargeForm = page.locator("form").filter({ has: page.locator('[name="originalAmount"]') });
  await chargeForm.locator('[name="competence"]').fill("2026-12");
  await chargeForm.locator('[name="chargedAt"]').fill("2026-12-02");
  await chargeForm.locator('[name="dueDate"]').fill("2026-12-10");
  await chargeForm.locator('[name="originalAmount"]').fill("50,00");
  await chargeForm.locator('[name="effectiveExchangeRate"]').fill("6,20");
  await chargeForm.locator('[name="iofAmountBrl"]').fill("5,00");
  await chargeForm.locator('[name="feeAmountBrl"]').fill("2,00");
  await chargeForm.locator('[name="totalAmountBrl"]').fill("317,00");
  await chargeForm.getByRole("button", { name: "Registrar cobrança", exact: true }).click();
  await expect(chargeForm.getByRole("status")).toContainText("conta a pagar criada");
  await expect(page.locator("td").filter({ hasText: "R$ 317,00" })).toBeVisible();
  await expect(page.getByText("Em aberto", { exact: true })).toBeVisible();

  // Reenviar a mesma competência é idempotente e não cria uma segunda AP.
  await chargeForm.locator('[name="totalAmountBrl"]').fill("400,00");
  await chargeForm.getByRole("button", { name: "Registrar cobrança", exact: true }).click();
  await page.reload();
  await expect(page.locator("td").filter({ hasText: "R$ 317,00" })).toHaveCount(1);
  await expect(page.locator("td").filter({ hasText: "R$ 400,00" })).toHaveCount(0);
});

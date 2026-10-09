import { expect, test, type Page } from "@playwright/test";
import { retryDelay, signInWithRetry } from "./helpers/auth";

test.setTimeout(150_000);

const demoPassword = process.env.DEMO_USER_PASSWORD ?? "Formula@123";

test("employee login sees portal scope without back-office finance", async ({ page }) => {
  await signIn(page, "pj.exemplo@formula.local", demoPassword, "/portal");

  await expect(page.getByRole("heading", { level: 1, name: /Colaborador/ })).toBeVisible();
  await expect(page.getByRole("banner").getByRole("link", { name: "Início" })).toBeVisible();
  await expect(page.locator('a[href^="/app/financeiro"]')).toHaveCount(0);
  await expect(page.getByRole("banner").getByRole("link", { name: "NFs", exact: true })).toBeVisible();
});

test("all-roles login exposes audit and settings navigation", async ({ page }) => {
  await signIn(page, "todos.perfis@formula.local", demoPassword, "/app");

  await expect(page.getByRole("heading", { level: 1, name: /Todos/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Auditoria" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Configurações" })).toBeVisible();
});

test("demo user signs in through the form and opens a client without billing", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email", { exact: true }).fill("todos.perfis@formula.local");
  await page.getByLabel("Senha", { exact: true }).fill(demoPassword);
  for (let attempt = 0; attempt < 3; attempt++) {
    const pending = page.waitForResponse(response => response.url().includes("/api/auth/sign-in/email") && response.request().method() === "POST");
    await page.getByRole("button", { name: "Entrar", exact: true }).click();
    const response = await pending;
    if (response.status() !== 429 || attempt === 2) {
      expect(response.ok()).toBe(true);
      break;
    }
    await page.waitForTimeout(retryDelay(response.headers()["retry-after"]));
  }
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("link", { name: "Clientes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Clientes", exact: true })).toBeVisible();
  await page.getByPlaceholder("Nome, código, responsável...").fill("CLI-0000");
  await expect(page.getByRole("link", { name: /CLI-0000[1-5]/ })).toHaveCount(5);
  await page.getByPlaceholder("Nome, código, responsável...").fill("Aurora Cafe - Projeto Avulso");
  await page.getByRole("link", { name: /Aurora Cafe - Projeto Avulso/ }).click();
  await expect(page.getByRole("heading", { name: "Aurora Cafe - Projeto Avulso" })).toBeVisible();
  await expect(page.getByText("Sem cobrança recorrente", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Gerar entrada", exact: true }).filter({ hasNot: page.getByRole("button") })).toBeDisabled();
});

async function signIn(page: Page, email: string, password: string, callbackURL: string) {
  await signInWithRetry(page, email, password);
  await page.goto(callbackURL);
}

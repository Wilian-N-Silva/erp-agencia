import { expect, test, type Page } from "@playwright/test";

const demoPassword = process.env.DEMO_USER_PASSWORD ?? "Formula@123";

test("employee login sees portal scope without back-office finance", async ({ page }) => {
  await signIn(page, "pj.exemplo@formula.local", demoPassword, "/portal");

  await expect(page.getByRole("heading", { name: "Portal" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Portal" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Financeiro" })).toHaveCount(0);
  await expect(page.getByText("Minhas NFs")).toBeVisible();
});

test("all-roles login exposes audit and settings navigation", async ({ page }) => {
  await signIn(page, "todos.perfis@formula.local", demoPassword, "/app");

  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Auditoria" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Configuracoes" })).toBeVisible();
});

async function signIn(page: Page, email: string, password: string, callbackURL: string) {
  const response = await page.request.post("/api/auth/sign-in/email", {
    data: {
      email,
      password,
      rememberMe: true,
    },
  });

  expect(response.ok(), `${response.status()} ${await response.text()}`).toBe(true);
  await page.goto(callbackURL);
}

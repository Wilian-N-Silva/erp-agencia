import { expect, test, type Page, type BrowserContext } from "@playwright/test";

async function loginDemo(page: Page, email: string, password: string | undefined) {
  const request = () => page.request.post("/api/auth/sign-in/email", { data: { email, password } });
  let response = await request();
  if (response.status() === 429) {
    const seconds = Number(response.headers()["retry-after"] ?? 10);
    await new Promise(resolve => setTimeout(resolve, (Math.min(Math.max(seconds, 1), 30) + 1) * 1000));
    response = await request();
  }
  expect(response.ok(), `Login ${email}: HTTP ${response.status()}`).toBe(true);
}

test("reembolso com PDF passa pelo gestor e financeiro; perfis de gestão acessam suas rotinas", async ({ browser }) => {
  test.setTimeout(90_000);
  const password = process.env.DEMO_USER_PASSWORD;
  expect(password).toBeTruthy();
  const marker = `QA-MANUAL-REI-${Date.now()}`;
  const contexts: BrowserContext[] = [];
  const signIn = async (email: string) => {
    const context = await browser.newContext();
    contexts.push(context);
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    await loginDemo(page, email, password);
    return page;
  };
  try {
    const employee = await signIn("pj.exemplo@formula.local");
    await employee.goto("/portal/reembolsos");
    await employee.locator("button").filter({ hasText: "Solicitar reembolso" }).first().click();
    const form = employee.locator("form").filter({ has: employee.getByRole("button", { name: "Enviar para aprovação" }) });
    await form.locator('[name="title"]').fill(marker);
    await form.locator('[name="category"]').selectOption("Materiais");
    await form.locator(".fg-input-wrap").filter({ has: employee.locator('[name="amount"]') }).locator('input[type="text"]').fill("25,00");
    await form.locator('[name="expenseDate"]').fill("2026-09-22");
    await form.locator('[name="file"]').setInputFiles({ name: "comprovante-qa.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
    await form.getByRole("button", { name: "Enviar para aprovação" }).click();
    await expect(employee.locator("article").filter({ hasText: marker })).toBeVisible();

    const manager = await signIn("lideranca@formula.local");
    await manager.goto("/app/reembolsos");
    await manager.getByPlaceholder("Buscar colaborador, descrição ou área...").fill(marker);
    await manager.locator("tbody tr").filter({ hasText: marker }).getByRole("button", { name: "Aprovar (gestor)", exact: true }).click();
    await expect(manager.locator("tbody tr").filter({ hasText: marker })).toHaveCount(0);
    await employee.reload();
    await expect(employee.locator("article").filter({ hasText: marker }).getByText("Aprovado pelo gestor", { exact: true })).toBeVisible();

    const finance = await signIn("financeiro@formula.local");
    await finance.goto("/app/reembolsos");
    await finance.getByRole("tab", { name: /^Todos/ }).click();
    await finance.getByPlaceholder("Buscar colaborador, descrição ou área...").fill(marker);
    const row = finance.locator("tbody tr").filter({ hasText: marker });
    await row.getByRole("button", { name: "Aprovar (financeiro)", exact: true }).click();
    await expect(row.getByRole("button", { name: "Marcar pago", exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Marcar pago", exact: true }).click();
    await expect(row.getByText("Pago", { exact: true })).toBeVisible();
    await employee.reload();
    await expect(employee.locator("article").filter({ hasText: marker }).getByText("Pago", { exact: true })).toBeVisible();

    for (const [email, routes] of [
      ["rh@formula.local", ["/app/colaboradores", "/app/ferias", "/app/documentos", "/app/nfs"]],
      ["diretoria@formula.local", ["/app", "/app/financeiro/entradas", "/app/financeiro/saidas", "/app/colaboradores", "/app/grafica"]],
    ] as const) {
      const page = await signIn(email);
      for (const route of routes) {
        await page.goto(route);
        await expect(page.locator("h1")).toBeVisible();
        await expect(page).toHaveURL(new RegExp(`${route}$`));
        await expect(page.getByText("Application error", { exact: false })).toHaveCount(0);
      }
    }
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});

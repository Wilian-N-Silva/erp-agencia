import { expect, test } from "@playwright/test";

test("gestão vê referências PJ e portal mostra somente o vínculo próprio", async ({ browser }) => {
  test.setTimeout(90_000);
  for (const email of ["rh@formula.local", "pj.exemplo@formula.local"]) {
    const session = await browser.newContext();
    const page = await session.newPage();
    const login = () => page.request.post("/api/auth/sign-in/email", { data: { email, password: process.env.DEMO_USER_PASSWORD } });
    let response = await login();
    if (response.status() === 429) {
      await new Promise(resolve => setTimeout(resolve, 31_000));
      response = await login();
    }
    expect(response.ok()).toBe(true);
    const own = email.startsWith("pj.");
    await page.goto(own ? "/portal/ferias" : "/app/ferias");
    const table = page.getByRole("table", { name: "Referências anuais dos PJs" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Tempo de vínculo", exact: true })).toBeVisible();
    await expect(table.getByRole("columnheader", { name: "Próxima referência", exact: true })).toBeVisible();
    await expect(page.getByText(/O descanso pode ser combinado para outra data/)).toBeVisible();
    if (own) {
      await expect(table.getByRole("row")).toHaveCount(2);
      await expect(table).toContainText("Colaborador PJ Exemplo");
    }
    await page.reload();
    await expect(table).toBeVisible();
    await session.close();
  }
});

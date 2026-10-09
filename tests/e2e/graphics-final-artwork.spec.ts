import { expect, test } from "@playwright/test";

test("uploads final artwork in production tab and retains downloadable versions", async ({ page }) => {
  test.setTimeout(90_000);
  const login = () => page.request.post("/api/auth/sign-in/email", { data: { email: "todos.perfis@formula.local", password: process.env.DEMO_USER_PASSWORD } });
  let response = await login();
  if (response.status() === 429) {
    await new Promise(resolve => setTimeout(resolve, 31_000));
    response = await login();
  }
  expect(response.ok()).toBe(true);
  await page.goto("/app/grafica");
  await page.locator('a[href^="/app/grafica/"]').filter({ hasText: /^OS-E2E-/ }).first().click();
  await page.getByRole("tab", { name: "5. Produção e entrega", exact: true }).click();
  const section = page.getByRole("region", { name: "Arquivos finais para produção" });
  const name = `arte-final-${Date.now()}.pdf`;
  const buffer = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF");
  await section.getByLabel("Arquivo final para produção").setInputFiles({ name, mimeType: "application/pdf", buffer });
  await section.getByRole("button", { name: "Anexar arquivo final", exact: true }).click();
  await expect(section.getByRole("status")).toContainText("Arquivo final anexado");
  await page.reload();
  const first = section.getByRole("link", { name, exact: true });
  const download = await page.request.get((await first.getAttribute("href"))!);
  expect(download.status()).toBe(200);
  expect(download.headers()["content-type"]).toBe("application/pdf");
  expect(await download.body()).toEqual(buffer);
  const revision = name.replace(".pdf", "-revisao.pdf");
  await section.getByLabel("Arquivo final para produção").setInputFiles({ name: revision, mimeType: "application/pdf", buffer });
  await section.getByRole("button", { name: "Anexar arquivo final", exact: true }).click();
  await expect(section.getByRole("status")).toContainText("Arquivo final anexado");
  await page.reload();
  await expect(first).toBeVisible();
  await expect(section.getByRole("link", { name: revision, exact: true })).toBeVisible();
  expect((await page.request.get((await first.getAttribute("href"))!)).status()).toBe(200);
});

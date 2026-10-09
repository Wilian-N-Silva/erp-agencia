import { expect, test } from "@playwright/test";
import { signInWithRetry } from "./helpers/auth";
import { createTestSupplier, ensureTestFinancialAccount } from "./helpers/finance";

test("financial receipts retain versions and enforce finance access", async ({ page, browser }) => {
  test.setTimeout(150_000);
  await signInWithRetry(page, "todos.perfis@formula.local", process.env.DEMO_USER_PASSWORD!);
  await ensureTestFinancialAccount(page);
  const marker = `HML-doc-${Date.now()}`;
  await page.goto("/app/financeiro/entradas");
  await page.getByRole("button", { name: "Nova conta a receber", exact: true }).last().click();
  const sheet = page.locator(".fg-sheet-root.open");
  await sheet.locator('[name="description"]').fill(marker);
  await sheet.locator(".fg-input-wrap").filter({ has: page.locator('[name="amount"]') }).locator('input[type="text"]').fill("100,00");
  await sheet.locator('[name="dueDate"]').fill("2026-10-15");
  await sheet.locator('[name="competence"]').fill("2026-10");
  await sheet.getByRole("button", { name: "Criar conta a receber", exact: true }).click();
  await expect(sheet.getByRole("status")).toHaveText("Alteração registrada.");
  await page.goto(`/app/financeiro/entradas?q=${marker}&competence=2026-10`);
  await page.getByRole("row").filter({ hasText: marker }).getByRole("link", { name: "Documentos", exact: true }).click();
  const attachmentUrl = page.url();
  const body = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF");
  const links: string[] = [];
  for (const version of [1,2]) {
    await page.getByLabel("Tipo de documento").selectOption("receipt");
    await page.getByLabel("Arquivo financeiro").setInputFiles({ name: `${marker}-v${version}.pdf`, mimeType: "application/pdf", buffer: body });
    await page.getByRole("button", { name: "Anexar documento", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Documento anexado");
    await page.reload();
    const link = page.getByRole("link", { name: `${marker}-v${version}.pdf`, exact: true });
    links.push((await link.getAttribute("href"))!);
  }
  for (const href of links) {
    const response = await page.request.get(href);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.body()).toEqual(body);
  }
  const restricted = await browser.newContext();
  try {
    const employee = await restricted.newPage();
    await signInWithRetry(employee, "pj.exemplo@formula.local", process.env.DEMO_USER_PASSWORD!);
    expect((await employee.request.get(links[0])).status()).toBe(404);
  } finally { await restricted.close(); }
  const readerContext = await browser.newContext();
  try {
    const reader = await readerContext.newPage();
    await signInWithRetry(reader, "financeiro@formula.local", process.env.DEMO_USER_PASSWORD!);
    await reader.goto(attachmentUrl);
    expect((await reader.request.get(links[1])).status()).toBe(200);
  } finally { await readerContext.close(); }
  await page.goto("/app/financeiro/movimentacoes");
  await page.getByRole("combobox", { name: /^Conta financeira/ }).selectOption({ label: "Conta Gráfica QA" });
  await page.getByRole("textbox", { name: /^Valor/ }).fill("100,00");
  await page.getByLabel("Referência", { exact: true }).fill(marker);
  await page.getByRole("button", { name: "Registrar movimentação", exact: true }).click();
  await page.getByRole("row").filter({ has: page.getByRole("cell", { name: marker, exact: true }) }).getByRole("link", { name: "Conciliar", exact: true }).click();
  await page.getByRole("link", { name: "Documentos e comprovantes", exact: true }).click();
  await page.getByLabel("Arquivo financeiro").setInputFiles({ name: `${marker}-movement.pdf`, mimeType: "application/pdf", buffer: body });
  await page.getByRole("button", { name: "Anexar documento", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Documento anexado");
  await page.reload();
  await expect(page.getByRole("link", { name: `${marker}-movement.pdf`, exact: true })).toBeVisible();
  await createTestSupplier(page, marker);
  await page.goto("/app/financeiro/cadastros");
  const categories = page.locator(".fg-card").filter({ has: page.getByText("Categorias financeiras", { exact: true }) });
  await categories.getByText("Novo cadastro", { exact: true }).click();
  const category = categories.locator("form").filter({ has: page.getByRole("button", { name: "Adicionar categoria", exact: true }) });
  await category.locator('[name="name"]').fill(marker);
  await category.locator('[name="nature"]').selectOption("expense");
  await category.getByRole("button", { name: "Adicionar categoria", exact: true }).click();
  await expect(categories.getByText(marker, { exact: true })).toBeVisible();
  await page.goto("/app/financeiro/saidas");
  await page.getByRole("button", { name: "Nova conta a pagar", exact: true }).last().click();
  await sheet.locator('[name="supplierId"]').selectOption({ label: marker });
  await sheet.locator('[name="categoryId"]').selectOption({ label: marker });
  await sheet.locator('[name="description"]').fill(marker);
  await sheet.locator(".fg-input-wrap").filter({ has: page.locator('[name="amount"]') }).locator('input[type="text"]').fill("100,00");
  await sheet.locator('[name="dueDate"]').fill("2026-10-15");
  await sheet.locator('[name="competence"]').fill("2026-10");
  await sheet.getByRole("button", { name: "Criar conta a pagar", exact: true }).click();
  await expect(sheet.getByRole("status")).toHaveText("Alteração registrada.");
  await page.goto(`/app/financeiro/saidas?q=${marker}&competence=2026-10`);
  await page.getByRole("row").filter({ hasText: marker }).getByRole("link", { name: "Documentos", exact: true }).click();
  await page.getByLabel("Arquivo financeiro").setInputFiles({ name: `${marker}-payable.pdf`, mimeType: "application/pdf", buffer: body });
  await page.getByRole("button", { name: "Anexar documento", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Documento anexado");
  await page.reload();
  const payableLink = page.getByRole("link", { name: `${marker}-payable.pdf`, exact: true });
  expect(await (await page.request.get((await payableLink.getAttribute("href"))!)).body()).toEqual(body);
});

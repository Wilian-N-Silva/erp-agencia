import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

// Each test owns its job: no dependence on execution order or prior test runs.
export async function createGraphicTestJob(page: Page, code = `HML-E2E-${randomUUID()}`) {
  await page.goto("/app/grafica/novo");
  await page.getByRole("textbox", { name: "Código interno", exact: true }).fill(code);
  await page.getByRole("textbox", { name: "Título", exact: true }).fill(code);
  await page.getByRole("combobox", { name: "Cliente", exact: true }).selectOption({ label: "Horizonte Eventos - Grafica" });
  await page.getByRole("combobox", { name: "Responsável", exact: true }).selectOption({ label: "Lideranca Demo" });
  await page.getByRole("textbox", { name: "Data da solicitação", exact: true }).fill("2026-10-01");
  await page.getByRole("textbox", { name: "Descrição", exact: true }).fill("Trabalho fictício exclusivo deste teste.");
  await page.getByRole("button", { name: "Criar trabalho", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Visão geral", exact: true })).toBeVisible();
  return page.url();
}

export async function uploadTestArtworkVersions(page: Page) {
  const section = page.getByRole("region", { name: "Arquivos finais para produção" });
  const body = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF");
  const name = `HML-arte-${randomUUID()}`;
  const links: string[] = [];
  for (const version of [1, 2]) {
    const filename = `${name}-v${version}.pdf`;
    await section.getByLabel("Arquivo final para produção").setInputFiles({ name: filename, mimeType: "application/pdf", buffer: body });
    await section.getByRole("button", { name: "Anexar arquivo final", exact: true }).click();
    await expect(section.getByRole("status")).toContainText("Arquivo final anexado");
    await page.reload();
    const link = section.getByRole("link", { name: filename, exact: true });
    await expect(link).toBeVisible();
    links.push((await link.getAttribute("href"))!);
  }
  for (const url of links) {
    const response = await page.request.get(url);
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.body()).toEqual(body);
  }
}

import { randomUUID } from "node:crypto";
import { expect, type Page } from "@playwright/test";

// Each test owns its job: no dependence on execution order or prior test runs.
export async function createGraphicTestJob(page: Page) {
  const code = `HML-E2E-${randomUUID()}`;
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

import { createGraphicTestJob } from "./helpers/graphics";
import { signInWithRetry } from "./helpers/auth";
import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string) {
  await signInWithRetry(page, email, process.env.DEMO_USER_PASSWORD!);
}

test("graphics tabs preserve navigation, drafts and mobile layout", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signIn(page, "todos.perfis@formula.local");
  await createGraphicTestJob(page);
  await expect(
    page.getByRole("tab", { name: "Visão geral", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  const jobUrl = page.url();
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await page.getByRole("tab", { name: "1. Pedido", exact: true }).click();
  await page
    .getByRole("button", { name: "Editar pedido", exact: true })
    .click();
  const title = page.getByRole("textbox", { name: "Título", exact: true });
  await title.fill("Rascunho local sem salvar");
  await page.keyboard.press("Escape");
  await page.getByRole("tab", { name: "2. Cotações", exact: true }).click();
  await expect(page).toHaveURL(/tab=cotacoes/);
  await page.goBack();
  await expect(
    page.getByRole("tab", { name: "1. Pedido", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("button", { name: "Editar pedido", exact: true })
    .click();
  await expect(title).toHaveValue("Rascunho local sem salvar");
  await page
    .getByRole("button", { name: "Fechar painel", exact: true })
    .click();
  await page.getByRole("tab", { name: "1. Pedido", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "2. Cotações", exact: true }),
  ).toBeFocused();
  await page.reload();
  await expect(
    page.getByRole("tab", { name: "2. Cotações", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page
    .getByRole("tab", { name: "Documentos e histórico", exact: true })
    .click();
  await expect(
    page.getByText("Documentos do trabalho", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "storage-local/manual-validation/graphics-workspace-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Visão geral", exact: true }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "storage-local/manual-validation/graphics-workspace-mobile.png",
    fullPage: true,
  });
  await page.goto(`${jobUrl}?tab=desconhecida`);
  await expect(
    page.getByRole("tab", { name: "Visão geral", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tab", { name: "1. Pedido", exact: true }).click();
  await page.getByRole("button", { name: "Editar pedido", exact: true }).click();
  const drawer = await page.getByRole("dialog").boundingBox();
  expect(drawer!.width).toBeLessThanOrEqual(390);
  await page.keyboard.press("Escape");
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Arquivar", exact: true }).click();
  await expect(page.getByRole("tab", { name: "1. Pedido", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("tab", { name: "1. Pedido", exact: true })).toBeVisible();
});

test("finance consultation does not grant operational editing", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await signIn(page, "todos.perfis@formula.local");
  const jobUrl = await createGraphicTestJob(page);
  await page.request.post("/api/auth/sign-out", { data: {} });
  await signIn(page, "financeiro@formula.local");
  await page.goto(jobUrl);
  await page.getByRole("tab", { name: "1. Pedido", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Editar pedido", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Arquivar", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("tab", { name: "Financeiro", exact: true }).click();
  await expect(
    page.getByText("Resumo financeiro do trabalho", { exact: true }),
  ).toBeVisible();
});

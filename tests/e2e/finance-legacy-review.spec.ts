import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { expect, test } from "@playwright/test";
import { isolatedE2eDatabaseUrl } from "./helpers/isolated-database";
import { signInWithRetry } from "./helpers/auth";

test("legacy reviews preserve original amounts, reopen obligations and restrict portal access", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await signInWithRetry(page, "todos.perfis@formula.local", process.env.DEMO_USER_PASSWORD!);
  const pool = new Pool({ connectionString: isolatedE2eDatabaseUrl() });
  const id = randomUUID(), marker = `HML-review-${Date.now()}`;
  try {
    const { rows: [user] } = await pool.query('select id, organization_id from "user" where email=$1', ["todos.perfis@formula.local"]);
    if (!user?.organization_id) throw new Error("Missing isolated demo identity");
    await pool.query("insert into financial_entries (id,organization_id,description,amount,legacy_settled_amount,due_date,competence,responsible_user_id) values ($1,$2,$3,100,40,'2026-10-10','2026-10',$4)", [id, user.organization_id, marker, user.id]);
  } finally { await pool.end(); }
  await page.goto(`/app/financeiro/entradas?q=${marker}&competence=2026-10`);
  const row = page.getByRole("row").filter({ hasText: marker });
  await expect(row).toContainText("Histórico a conferir");
  await row.getByRole("link", { name: "Histórico", exact: true }).click();
  const url = page.url();
  await expect(page.getByText("Reserva original preservada: R$ 40,00", { exact: true })).toBeVisible();
  await page.getByLabel("Valor da reserva a liberar (R$)", { exact: true }).fill("10");
  await page.getByLabel("Motivo da revisão", { exact: true }).fill("Baixa duplicada no sistema antigo");
  await page.getByLabel("Evidência conferida", { exact: true }).fill("Extrato conferido: registro antigo duplicado");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Liberar reserva revisada", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("sem criar movimentação de caixa");
  await page.reload();
  await expect(page.getByText("Reserva ainda disponível: R$ 30,00", { exact: true })).toBeVisible();
  await expect(page.getByText("Reserva original preservada: R$ 40,00", { exact: true })).toBeVisible();
  await expect(page.getByText("Motivo: Baixa duplicada no sistema antigo", { exact: true })).toBeVisible();
  await page.goto(`/app/financeiro/entradas?q=${marker}&competence=2026-10`);
  await expect(row).toContainText("Histórico reservado: R$ 30,00");
  const restricted = await browser.newContext();
  try {
    const portal = await restricted.newPage();
    await signInWithRetry(portal, "pj.exemplo@formula.local", process.env.DEMO_USER_PASSWORD!);
    await portal.goto(url);
    await expect(portal).toHaveURL(/\/portal$/);
    await expect(portal.getByText(marker, { exact: true })).toHaveCount(0);
    await expect(portal.getByRole("button", { name: "Liberar reserva revisada", exact: true })).toHaveCount(0);
  } finally { await restricted.close(); }
});

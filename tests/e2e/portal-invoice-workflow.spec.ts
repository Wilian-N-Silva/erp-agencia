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

test("PJ solicita pausa e RH aprova sem conceder acesso administrativo ao colaborador", async ({ browser }) => {
  test.setTimeout(90_000);
  const password = process.env.DEMO_USER_PASSWORD;
  expect(password).toBeTruthy();
  const employeeContext = await browser.newContext();
  const hrContext = await browser.newContext();
  try {
    const employee = await employeeContext.newPage();
    const hr = await hrContext.newPage();
    employee.setDefaultTimeout(10_000);
    hr.setDefaultTimeout(10_000);
    await loginDemo(employee, "pj.exemplo@formula.local", password);
    await employee.goto("/portal/ferias");
    const marker = `QA-MANUAL-PAUSA-${Date.now()}`;
    const year = 2030 + Math.floor(Date.now() / 1000) % 1000;
    await employee.locator("button").filter({ hasText: "Programar ausência" }).click();
    const form = employee.locator("form").filter({ has: employee.getByRole("button", { name: "Enviar solicitação" }) });
    await form.locator('[name="type"]').selectOption("planned_pause");
    await form.locator('[name="startDate"]').fill(`${year}-10-01`);
    await form.locator('[name="endDate"]').fill(`${year}-10-05`);
    await form.locator('[name="notes"]').fill(marker);
    await form.getByRole("button", { name: "Enviar solicitação" }).click();
    await expect(employee.locator("article").filter({ hasText: marker }).getByText("Solicitada", { exact: true })).toBeVisible();
    await loginDemo(hr, "rh@formula.local", password);
    await hr.goto("/app/ferias");
    const row = hr.locator("tbody tr").filter({ hasText: "Colaborador PJ Exemplo" }).filter({ hasText: String(year) });
    await row.getByRole("button", { name: "Aprovar", exact: true }).click();
    await expect(row.getByText("Aprovada", { exact: true })).toBeVisible();
    await employee.reload();
    await expect(employee.locator("article").filter({ hasText: marker }).getByText("Aprovada", { exact: true })).toBeVisible();
  } finally {
    await employeeContext.close();
    await hrContext.close();
  }
});

test("portal PJ envia PDF e financeiro solicita ajuste, aprova e registra pagamento legado", async ({ browser }) => {
  test.setTimeout(120_000);
  const password = process.env.DEMO_USER_PASSWORD;
  expect(password, "Configure DEMO_USER_PASSWORD para a base demo local").toBeTruthy();
  const financeContext = await browser.newContext();
  const employeeContext = await browser.newContext();
  const finance = await financeContext.newPage();
  const employee = await employeeContext.newPage();
  finance.setDefaultTimeout(10_000);
  employee.setDefaultTimeout(10_000);
  const marker = `QA-MANUAL-NF-${Date.now()}`;
  let competence = "";
  const signIn = async (page: Page, email: string) => {
    await loginDemo(page, email, password);
  };
  try {
    await signIn(finance, "financeiro@formula.local");
    await finance.goto("/app/nfs");
    await finance.getByRole("tab", { name: /^Todas/ }).click();
    const years = [...(await finance.locator("tbody").innerText()).matchAll(/\b\d{2}\/(\d{4})\b/g)].map(match => Number(match[1]));
    competence = `${Math.max(2026, ...years) + 1}-12`;
    await finance.locator("button").filter({ hasText: "Nova composição" }).click();
    const form = finance.locator("form").filter({ has: finance.getByRole("button", { name: "Publicar solicitação" }) });
    await form.locator('[name="employeeId"]').selectOption({ label: "Colaborador PJ Exemplo" });
    await form.locator('[name="competence"]').fill(competence);
    await form.locator('[name="dueDate"]').fill(`${competence}-28`);
    await form.locator('.fg-input-wrap').filter({ has: finance.locator('[name="baseAmount"]') }).locator('input[type="text"]').fill("100,00");
    await form.locator('[name="suggestedDescription"]').fill(marker);
    await form.getByRole("button", { name: "Publicar solicitação" }).click();
    await expect(form).not.toBeVisible();
    await finance.getByPlaceholder("Buscar PJ, matricula ou area...").fill(marker);
    const row = finance.locator("tbody tr").filter({ hasText: "Colaborador PJ Exemplo" });
    await expect(row).toHaveCount(1);

    await signIn(employee, "pj.exemplo@formula.local");
    for (const route of ["/portal", "/portal/dados", "/portal/documentos", "/portal/equipamentos", "/portal/acessos", "/portal/ferias", "/portal/reembolsos"]) {
      await employee.goto(route);
      await expect(employee.locator("h1")).toBeVisible();
      await expect(employee.getByText("Application error", { exact: false })).toHaveCount(0);
    }
    await employee.goto("/app/nfs");
    await expect(employee).toHaveURL(/\/portal$/);
    await employee.goto("/portal/nfs");
    await expect(employee.getByText(marker, { exact: true })).toBeVisible();
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n");
    const submit = async () => {
      await employee.locator('input[type="file"]').setInputFiles({ name: `${marker}.pdf`, mimeType: "application/pdf", buffer: pdf });
      await employee.locator('.fg-input-wrap').filter({ has: employee.locator('[name="issuedAmount"]') }).locator('input[type="text"]').fill("100,00");
      await employee.getByRole("button", { name: "Enviar NF para aprovação" }).click();
      await expect(employee.locator("tbody tr").filter({ hasText: competence.slice(0, 4) }).getByText("Enviada", { exact: true })).toBeVisible();
    };
    await submit();
    await employee.goto("/portal/documentos");
    const documentRow = employee.locator(".fg-portal-doc").filter({ hasText: `${marker}.pdf` });
    const downloadUrl = await documentRow.getByRole("link", { name: "Baixar" }).getAttribute("href");
    expect(downloadUrl).toBeTruthy();
    const downloaded = await employee.request.get(downloadUrl!);
    expect(downloaded.status()).toBe(200);
    expect(await downloaded.body()).toEqual(pdf);
    const financeDownload = await finance.request.get(downloadUrl!);
    expect(financeDownload.status()).toBeGreaterThanOrEqual(400);
    test.info().annotations.push({ type: "limitação", description: `Financeiro isolado não baixa NF: HTTP ${financeDownload.status()}; revisão exige perfil documental autorizado.` });
    const directorContext = await browser.newContext();
    try {
      const director = await directorContext.newPage();
      await loginDemo(director, "diretoria@formula.local", password);
      const reviewed = await director.request.get(downloadUrl!);
      expect(reviewed.status()).toBe(200);
      expect(await reviewed.body()).toEqual(pdf);
    } finally {
      await directorContext.close();
    }
    await employee.goto("/portal/nfs");
    await finance.reload();
    await finance.getByRole('tab', { name: /^Todas/ }).click();
    await finance.getByPlaceholder("Buscar PJ, matricula ou area...").fill(marker);
    await row.getByRole("button", { name: "Ajuste", exact: true }).click();
    await expect(row.getByText("Aguardando ajuste", { exact: true })).toBeVisible();
    await employee.reload();
    await expect(employee.getByText(marker, { exact: true })).toBeVisible();
    await submit();
    await finance.reload();
    await finance.getByRole('tab', { name: /^Todas/ }).click();
    await finance.getByPlaceholder("Buscar PJ, matricula ou area...").fill(marker);
    await row.getByRole("button", { name: "Aprovar", exact: true }).click();
    await expect(row.getByText("Aprovada", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: "Marcar pago", exact: true }).click();
    await expect(row.getByText("Paga", { exact: true })).toBeVisible();
    await employee.reload();
    const history = employee.locator("tbody tr").filter({ hasText: competence.slice(0, 4) });
    await expect(history.getByText("Paga", { exact: true })).toBeVisible();
    await employee.screenshot({ path: "storage-local/manual-validation/portal-invoice-paid.png", fullPage: true });
  } finally {
    await financeContext.close();
    await employeeContext.close();
  }
});

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

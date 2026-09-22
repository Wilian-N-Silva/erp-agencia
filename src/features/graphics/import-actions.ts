"use server";
import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import { getCurrentAccessContext } from "@/lib/dal";
import { enforceAuthenticatedRateLimit, RateLimitExceededError, reportRateLimitSecurityEvent } from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { formDataToObject } from "@/lib/validation";
import { stageGraphicImport } from "./import-staging";
import { commitGraphicImport, ignoreGraphicImportRow, reviewGraphicImportRow } from "./import-commit";
import { GraphicImportError } from "./import-rules";

export type ImportActionResult = { ok: boolean; message: string; batchId?: string };
async function run(data: FormData, operation: "stage" | "review" | "ignore" | "commit"): Promise<ImportActionResult> {
  try {
    const context = await getCurrentAccessContext();
    if (!context) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
    assertCan("graphics.import", context);
    await enforceAuthenticatedRateLimit(operation === "stage" ? "graphics_import" : "common_mutation", context);
    let batchId: string, message: string;
    if (operation === "stage") {
      const file = data.get("file");
      if (!(file instanceof File)) throw new GraphicImportError("Selecione a planilha XLSX.");
      const mapping = z.string().max(10000).parse(data.get("mapping"));
      const result = await stageGraphicImport(context, file, JSON.parse(mapping));
      batchId = result.batch.id; message = result.reused ? "Prévia existente recuperada, sem duplicação." : "Prévia criada. Revise as linhas antes de confirmar.";
    } else if (operation === "commit") {
      const result = await commitGraphicImport(context, formDataToObject(data));
      batchId = result.batchId; message = `${result.imported} linha(s) importada(s). ${result.remaining} linha(s) ainda aguardam revisão ou confirmação.`;
    } else {
      const raw = formDataToObject(data);
      const base = { ...raw, expectedRevision: z.coerce.number().int().min(0).parse(raw.expectedRevision) };
      const result = operation === "ignore" ? await ignoreGraphicImportRow(context, base) : await reviewGraphicImportRow(context, { ...base, resolution: JSON.parse(z.string().max(12000).parse(raw.resolution)) });
      batchId = result.batchId; message = operation === "ignore" ? "Linha ignorada com justificativa preservada." : "Linha revisada e pronta para confirmação.";
    }
    revalidatePath("/app/grafica", "layout"); revalidatePath("/app/financeiro", "layout"); revalidatePath("/app/alertas");
    return { ok: true, message, batchId };
  } catch (error) {
    if (error instanceof RateLimitExceededError) { await reportRateLimitSecurityEvent(error); return { ok: false, message: error.message }; }
    if (error instanceof GraphicImportError) return { ok: false, message: error.message };
    if (error instanceof ZodError || error instanceof SyntaxError) return { ok: false, message: "Confira os campos obrigatórios, datas, valores e o mapeamento da planilha." };
    if (error instanceof AccessDeniedError) return { ok: false, message: "Ação não permitida. Importar caixa também exige permissão de escrita no Financeiro." };
    return { ok: false, message: "Não foi possível processar. Aguarde e confira a prévia antes de tentar novamente; nenhum erro deve ser corrigido apagando o histórico." };
  }
}
export async function stageGraphicImportAction(data: FormData) { return run(data, "stage"); }
export async function reviewGraphicImportAction(data: FormData) { return run(data, "review"); }
export async function ignoreGraphicImportAction(data: FormData) { return run(data, "ignore"); }
export async function commitGraphicImportAction(data: FormData) { return run(data, "commit"); }

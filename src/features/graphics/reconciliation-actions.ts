"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentAccessContext } from "@/lib/dal";
import { enforceAuthenticatedRateLimit } from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { formDataToObject } from "@/lib/validation";
import { FinancialAllocationError } from "@/features/finance-allocations/rules";
import { GraphicFlowError } from "./client-decision-rules";
import { reviewGraphicReconciliation, suggestGraphicReconciliation } from "./reconciliation";

async function execute(data: FormData, review: boolean) {
  try {
    const context = await getCurrentAccessContext();
    if (!context) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
    assertCan(review ? "finance.settle" : "graphics.reconcile_suggest", context);
    await enforceAuthenticatedRateLimit("reconciliation", context);
    const result = await (review ? reviewGraphicReconciliation(context, formDataToObject(data)) : suggestGraphicReconciliation(context, formDataToObject(data)));
    revalidatePath(`/app/grafica/${result.jobId}`);
    revalidatePath(`/app/financeiro/movimentacoes/${result.transactionId}`);
    revalidatePath("/app/financeiro/movimentacoes");
    revalidatePath("/app/financeiro/entradas");
    revalidatePath("/app/alertas");
    return { ok: true, message: review ? "Revisão registrada pelo Financeiro." : "Sugestão registrada. Aguarde a confirmação do Financeiro; nenhum saldo foi liquidado." };
  } catch (error) {
    if (error instanceof GraphicFlowError || error instanceof FinancialAllocationError) return { ok: false, message: error.message };
    if (error instanceof AccessDeniedError) return { ok: false, message: "Você não tem permissão para esta ação ou vínculo." };
    if (error instanceof ZodError) return { ok: false, message: "Confira a movimentação, a parcela, o valor e a justificativa. Para revisar, confirme a decisão." };
    return { ok: false, message: "Não foi possível registrar. Aguarde e atualize a página para conferir o histórico antes de tentar novamente." };
  }
}
export async function suggestGraphicReconciliationAction(data: FormData) { return execute(data, false); }
export async function reviewGraphicReconciliationAction(data: FormData) { return execute(data, true); }

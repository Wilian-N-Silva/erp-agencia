"use server";
import { revalidatePath } from "next/cache";
import { getCurrentAccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { enforceAuthenticatedRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { formDataToObject } from "@/lib/validation";
import { FinancialLegacyReviewError, legacyReleaseSchema, releaseFinancialLegacyReserve } from "./legacy-review";

export async function releaseFinancialLegacyReserveAction(data: FormData) {
  try {
    const context = await getCurrentAccessContext();
    if (!context) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
    assertCan("finance.reverse", context);
    if (!context.organizationId) throw new AccessDeniedError();
    await enforceAuthenticatedRateLimit("reconciliation", context);
    const parsed = legacyReleaseSchema.safeParse(formDataToObject(data));
    if (!parsed.success) return { ok: false, message: "Confira o valor, motivo, evidência e confirmação da revisão." };
    await releaseFinancialLegacyReserve(context, parsed.data);
    revalidatePath(`/app/financeiro/historico/${parsed.data.type}/${parsed.data.id}`);
    revalidatePath("/app/financeiro", "layout");
    revalidatePath("/app/clientes", "layout");
    revalidatePath("/app/grafica", "layout");
    return { ok: true, message: "Revisão registrada. A reserva foi liberada sem criar movimentação de caixa." };
  } catch (error) {
    if (error instanceof FinancialLegacyReviewError) return { ok: false, message: error.message };
    if (error instanceof RateLimitExceededError) return { ok: false, message: "Muitas tentativas. Aguarde antes de reenviar." };
    return { ok: false, message: "Não foi possível revisar. Confira seu acesso e atualize os dados antes de tentar novamente." };
  }
}

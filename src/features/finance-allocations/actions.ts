"use server";

import { revalidatePath } from "next/cache";
import { z, ZodError } from "zod";
import { getCurrentAccessContext } from "@/lib/dal";
import { enforceAuthenticatedRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { formDataToObject } from "@/lib/validation";
import { confirmReconciliation } from "./reconciliation";
import { FinancialAllocationError } from "./rules";

export async function reconcileMovementAction(data: FormData) {
  try {
    const context = await getCurrentAccessContext();
    if (!context) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
    assertCan("finance.settle", context);
    await enforceAuthenticatedRateLimit("reconciliation", context);
    const input = z.strictObject({ transactionId: z.string().uuid(), expectedRemaining: z.string().max(30), allocations: z.string().max(30000), confirmed: z.literal("on") }).parse(formDataToObject(data));
    await confirmReconciliation(context, { transactionId: input.transactionId, expectedRemaining: input.expectedRemaining, allocations: JSON.parse(input.allocations) });
    revalidatePath("/app/financeiro");
    revalidatePath("/app/financeiro/movimentacoes");
    revalidatePath(`/app/financeiro/movimentacoes/${input.transactionId}`);
    revalidatePath("/app/financeiro/entradas");
    revalidatePath("/app/financeiro/saidas");
    revalidatePath("/app/grafica", "layout");
    revalidatePath("/app/alertas");
    return { ok: true, message: "Conciliação registrada. Os saldos e a pendência foram atualizados." };
  } catch (error) {
    if (error instanceof FinancialAllocationError) return { ok: false, message: error.message };
    if (error instanceof AccessDeniedError) return { ok: false, message: "Você não tem permissão para conciliar esta movimentação." };
    if (error instanceof ZodError || error instanceof SyntaxError) return { ok: false, message: "Selecione os títulos, informe valores positivos e confirme a conciliação." };
    if (error instanceof RateLimitExceededError) return { ok: false, message: "Muitas tentativas de conciliação. Aguarde alguns minutos e tente novamente." };
    return { ok: false, message: "Não foi possível conciliar. Atualize a página para conferir os saldos antes de tentar novamente." };
  }
}

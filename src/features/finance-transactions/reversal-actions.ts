"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentAccessContext } from "@/lib/dal";
import { assertCan, AccessDeniedError } from "@/lib/rbac";
import { enforceAuthenticatedRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { formDataToObject } from "@/lib/validation";
import { reverseFinancialTransaction, FinancialReversalError } from "./reversal";

export async function reverseFinancialTransactionAction(data: FormData) {
  try {
    const context = await getCurrentAccessContext();
    if (!context) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
    assertCan("finance.reverse", context);
    if (!context.organizationId) throw new AccessDeniedError();
    await enforceAuthenticatedRateLimit("reconciliation", context);
    await reverseFinancialTransaction(context, formDataToObject(data));
    revalidatePath("/app", "layout");
    revalidatePath("/portal", "layout");
    return { ok: true, message: "Movimentação estornada. Os saldos foram recalculados e o histórico preservado." };
  } catch (error) {
    if (error instanceof RateLimitExceededError) return { ok: false, message: "Muitas tentativas. Aguarde antes de tentar novamente." };
    if (error instanceof AccessDeniedError) return { ok: false, message: "Movimentação indisponível ou acesso não permitido." };
    if (error instanceof ZodError) return { ok: false, message: "Informe a movimentação e um motivo com pelo menos três caracteres." };
    if (error instanceof FinancialReversalError) return { ok: false, message: error.message };
    return { ok: false, message: "Não foi possível estornar. Atualize a página e confira o estado antes de tentar novamente." };
  }
}

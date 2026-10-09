"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentAccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { enforceAuthenticatedRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { formDataToObject } from "@/lib/validation";
import { correctGraphicPayable, GraphicPayableCorrectionError } from "./payable-correction";

export async function correctGraphicPayableAction(data: FormData) {
  try {
    const context = await getCurrentAccessContext();
    if (!context) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
    assertCan("finance.write", context); assertCan("finance.reverse", context);
    if (!context.organizationId) throw new AccessDeniedError();
    await enforceAuthenticatedRateLimit("reconciliation", context);
    await correctGraphicPayable(context, formDataToObject(data));
    revalidatePath("/app", "layout");
    return { ok: true, message: "Conta a pagar corrigida. Contratação e cotação preservadas, sem criar outro título ou movimentar dinheiro." };
  } catch (error) {
    if (error instanceof GraphicPayableCorrectionError) return { ok: false, message: error.message };
    if (error instanceof ZodError) return { ok: false, message: "Confira valor, vencimento, competência e motivo da correção." };
    if (error instanceof RateLimitExceededError) return { ok: false, message: "Muitas tentativas. Aguarde antes de reenviar." };
    return { ok: false, message: "Não foi possível corrigir. Confira seu acesso e atualize a contratação antes de tentar novamente." };
  }
}

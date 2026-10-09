"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentAccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { enforceAuthenticatedRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { formDataToObject } from "@/lib/validation";
import { cancelSaasCharge, cancelSaasChargeSchema, SaasChargeCancellationError } from "./charge-cancellation";

export async function cancelSaasChargeAction(data: FormData) {
  try {
    const context = await getCurrentAccessContext();
    if (!context) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
    assertCan("finance.write", context); assertCan("finance.reverse", context);
    if (!context.organizationId) throw new AccessDeniedError();
    await enforceAuthenticatedRateLimit("reconciliation", context);
    const input = cancelSaasChargeSchema.parse(formDataToObject(data));
    await cancelSaasCharge(context, input);
    revalidatePath("/app", "layout");
    return { ok: true, message: "Cobrança e conta a pagar canceladas. Histórico preservado, sem movimentar dinheiro." };
  } catch (error) {
    if (error instanceof SaasChargeCancellationError) return { ok: false, message: error.message };
    if (error instanceof z.ZodError) return { ok: false, message: "Confira o motivo e confirme o cancelamento da cobrança." };
    if (error instanceof RateLimitExceededError) return { ok: false, message: "Muitas tentativas. Aguarde antes de reenviar." };
    return { ok: false, message: "Não foi possível cancelar. Confira seu acesso e atualize a cobrança antes de tentar novamente." };
  }
}

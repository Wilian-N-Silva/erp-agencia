"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentAccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { enforceAuthenticatedRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { formDataToObject } from "@/lib/validation";
import { correctSaasCharge, correctSaasChargeSchema, SaasChargeCorrectionError } from "./charge-correction";

export async function correctSaasChargeAction(data: FormData) {
  try {
    const context = await getCurrentAccessContext();
    if (!context) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
    assertCan("finance.write", context); assertCan("finance.reverse", context);
    if (!context.organizationId) throw new AccessDeniedError();
    await enforceAuthenticatedRateLimit("reconciliation", context);
    const input = correctSaasChargeSchema.parse(formDataToObject(data));
    // Pass wire values: schema transforms money, booleans and notes only once in the DAL.
    await correctSaasCharge(context, formDataToObject(data));
    revalidatePath(`/app/assinaturas/${input.subscriptionId}`);
    revalidatePath("/app/financeiro", "layout");
    return { ok: true, message: "Cobrança corrigida na mesma conta a pagar. Valores anteriores preservados na auditoria." };
  } catch (error) {
    if (error instanceof SaasChargeCorrectionError) return { ok: false, message: error.message };
    if (error instanceof z.ZodError) return { ok: false, message: "Confira os valores, câmbio, encargos, motivo e vínculo da cobrança." };
    if (error instanceof RateLimitExceededError) return { ok: false, message: "Muitas tentativas. Aguarde antes de reenviar." };
    return { ok: false, message: "Não foi possível corrigir. Confira seu acesso e atualize a cobrança antes de tentar novamente." };
  }
}

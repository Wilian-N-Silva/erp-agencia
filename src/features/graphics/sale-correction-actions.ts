"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentAccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import {
  enforceAuthenticatedRateLimit,
  RateLimitExceededError,
} from "@/lib/rate-limit";
import { formDataToObject } from "@/lib/validation";
import { correctGraphicSale } from "./sale-correction";
import { GraphicSaleCorrectionError } from "./sale-correction-rules";

export async function correctGraphicSaleAction(data: FormData) {
  try {
    const context = await getCurrentAccessContext();
    if (!context)
      return { ok: false, message: "Sua sessão expirou. Entre novamente." };
    assertCan("finance.write", context);
    assertCan("finance.reverse", context);
    if (!context.organizationId) throw new AccessDeniedError();
    await enforceAuthenticatedRateLimit("reconciliation", context);
    const raw = formDataToObject(data);
    if (typeof raw.installments !== "string" || raw.installments.length > 20000)
      throw new GraphicSaleCorrectionError("Confira as parcelas desta venda.");
    await correctGraphicSale(context, {
      ...raw,
      installments: JSON.parse(raw.installments),
    });
    revalidatePath("/app", "layout");
    return {
      ok: true,
      message:
        "Venda corrigida nas mesmas contas a receber. Histórico original e revisão preservados, sem registrar dinheiro.",
    };
  } catch (error) {
    if (error instanceof GraphicSaleCorrectionError)
      return { ok: false, message: error.message };
    if (error instanceof ZodError || error instanceof SyntaxError)
      return {
        ok: false,
        message: "Confira valor, competência, motivo e soma das parcelas.",
      };
    if (error instanceof RateLimitExceededError)
      return {
        ok: false,
        message: "Muitas tentativas. Aguarde antes de reenviar.",
      };
    return {
      ok: false,
      message:
        "Não foi possível corrigir. Confira seu acesso e atualize a venda antes de tentar novamente.",
    };
  }
}

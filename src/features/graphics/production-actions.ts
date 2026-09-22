"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentAccessContext } from "@/lib/dal";
import { enforceAuthenticatedRateLimit } from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { formDataToObject } from "@/lib/validation";
import { GraphicFlowError } from "./client-decision-rules";
import { advanceGraphicProduction } from "./production";

export async function advanceGraphicProductionAction(data: FormData) {
  try {
    const context = await getCurrentAccessContext();
    if (!context) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
    assertCan("graphics.production_write", context);
    await enforceAuthenticatedRateLimit("common_mutation", context);
    const event = await advanceGraphicProduction(context, formDataToObject(data));
    revalidatePath(`/app/grafica/${event.jobId}`);
    revalidatePath("/app/grafica");
    revalidatePath("/app/alertas");
    return { ok: true, message: "Etapa registrada. Confira a próxima ação do trabalho." };
  } catch (error) {
    if (error instanceof GraphicFlowError) return { ok: false, message: error.message };
    if (error instanceof ZodError) return { ok: false, message: "Confira a etapa, o responsável, a data e o motivo da espera." };
    if (error instanceof AccessDeniedError) return { ok: false, message: "Você não tem permissão para esta mudança ou o responsável não está disponível." };
    return { ok: false, message: "Não foi possível registrar. Aguarde e tente novamente." };
  }
}

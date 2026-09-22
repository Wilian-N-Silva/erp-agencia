"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentAccessContext } from "@/lib/dal";
import { enforceAuthenticatedRateLimit } from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { formDataToObject } from "@/lib/validation";
import { recordClientDecision } from "./client-decision";
import { GraphicFlowError } from "./client-decision-rules";

export async function recordClientDecisionAction(data: FormData) {
  try {
    const context = await getCurrentAccessContext();
    if (!context) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
    assertCan("graphics.client_approval_write", context);
    const uploads = data.getAll("evidence").filter(value => !(value instanceof File) || value.size > 0);
    if (uploads.length > 1 || uploads.some(value => !(value instanceof File))) throw new GraphicFlowError("Selecione apenas um arquivo de evidência.");
    await enforceAuthenticatedRateLimit(uploads.length ? "upload" : "common_mutation", context);
    const result = await recordClientDecision(context, formDataToObject(data, ["evidence"]), uploads[0] as File | undefined);
    revalidatePath(`/app/grafica/${result.jobId}`);
    revalidatePath("/app/grafica");
    return { ok: true, message: "Resposta do cliente registrada. Confira a próxima ação do trabalho." };
  } catch (error) {
    if (error instanceof GraphicFlowError) return { ok: false, message: error.message };
    if (error instanceof ZodError) return { ok: false, message: "Confira os campos obrigatórios, a data e o motivo da resposta." };
    if (error instanceof AccessDeniedError) return { ok: false, message: "Você não tem permissão para registrar esta resposta." };
    return { ok: false, message: "Não foi possível registrar. Confira o arquivo (PDF, JPG ou PNG, até 10 MB) e tente novamente. Se atingiu o limite de tentativas, aguarde." };
  }
}

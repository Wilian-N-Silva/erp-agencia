"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentAccessContext } from "@/lib/dal";
import { AccessDeniedError } from "@/lib/rbac";
import { formDataToObject } from "@/lib/validation";
import { enforceAuthenticatedRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { configurePjApprover, requestPjTimeOff, reviewPjTimeOff } from "./pj-policy";
import { PjTimeOffError } from "./pj-policy-rules";

type State = { error?: string; success?: string };
async function run(operation: "request" | "review" | "configure", formData: FormData): Promise<State> {
  try {
    const context = await getCurrentAccessContext();
    if (!context?.organizationId) throw new AccessDeniedError();
    await enforceAuthenticatedRateLimit("common_mutation", context);
    const input = formDataToObject(formData);
    if (operation === "request") await requestPjTimeOff(context, input);
    if (operation === "review") await reviewPjTimeOff(context, input);
    if (operation === "configure") await configurePjApprover(context, input);
    for (const path of ["/portal/ferias", "/portal/nfs", "/app/ferias", "/app/nfs", "/portal"]) revalidatePath(path);
    return { success: operation === "request" ? "Solicitação registrada e dias reservados." : "Alteração salva." };
  } catch (error) {
    if (error instanceof PjTimeOffError) return { error: error.message };
    if (error instanceof z.ZodError) return { error: "Confira a quantidade, as datas e os campos obrigatórios." };
    if (error instanceof AccessDeniedError) return { error: "Acesso não permitido ou registro indisponível." };
    if (error instanceof RateLimitExceededError) { await error.reportSecurityEvent(); return { error: "Muitas tentativas. Aguarde e tente novamente." }; }
    return { error: "Não foi possível concluir. Confira os valores e tente novamente." };
  }
}
export async function requestPjAction(_state: State | null, formData: FormData) { return run("request", formData); }
export async function approvePjAction(_state: State | null, formData: FormData) {
  formData.set("decision", "approve");
  return run("review", formData);
}
export async function rejectPjAction(_state: State | null, formData: FormData) {
  formData.set("decision", "reject");
  return run("review", formData);
}
export async function configurePjApproverAction(_state: State | null, formData: FormData) { return run("configure", formData); }

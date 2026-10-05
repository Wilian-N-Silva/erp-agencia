"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentAccessContext, type AccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { enforceAuthenticatedRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { formDataToObject } from "@/lib/validation";
import { cancelProvisionCycle, planProvisionCycle, realizeProvisionCycle } from "./dal";
import { cancelCycleSchema, planCycleSchema, ProvisionCycleError, realizeCycleSchema } from "./rules";

type CycleResult = { id: string; status: string };

async function runCycleAction(data: FormData, operation: (context: AccessContext, input: Record<string, unknown>) => Promise<CycleResult>) {
  try {
    const context = await getCurrentAccessContext();
    if (!context) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
    assertCan("finance.write", context);
    if (!context.organizationId) throw new AccessDeniedError();
    await enforceAuthenticatedRateLimit("common_mutation", context);
    const result = await operation(context, formDataToObject(data));
    // The DAL has committed both the financial operation and its audit before invalidation.
    revalidatePath("/app/financeiro", "layout");
    const message = result.status === "realized"
      ? "Ocorrência realizada. A conta a pagar está disponível no Financeiro; o pagamento ainda deve ser registrado e conciliado."
      : result.status === "cancelled"
        ? "Ocorrência cancelada. O histórico foi preservado."
        : "Ocorrência planejada. Nenhuma conta a pagar ou pagamento foi criado.";
    return { ok: true, message, id: result.id, status: result.status };
  } catch (error) {
    if (error instanceof RateLimitExceededError) return { ok: false, message: "Muitas tentativas. Aguarde antes de tentar novamente." };
    if (error instanceof AccessDeniedError) return { ok: false, message: "Operação indisponível ou acesso não permitido." };
    if (error instanceof ZodError) return { ok: false, message: "Confira a competência, o vencimento, os valores e os campos obrigatórios." };
    if (error instanceof ProvisionCycleError) return { ok: false, message: error.message };
    return { ok: false, message: "Não foi possível concluir. Atualize a página para conferir a ocorrência antes de tentar novamente." };
  }
}

export async function planProvisionCycleAction(data: FormData) {
  return runCycleAction(data, (context, input) => planProvisionCycle(context, planCycleSchema.parse(input)));
}

export async function realizeProvisionCycleAction(data: FormData) {
  return runCycleAction(data, (context, input) => realizeProvisionCycle(context, realizeCycleSchema.parse(input)));
}

export async function cancelProvisionCycleAction(data: FormData) {
  return runCycleAction(data, (context, input) => cancelProvisionCycle(context, cancelCycleSchema.parse(input)));
}

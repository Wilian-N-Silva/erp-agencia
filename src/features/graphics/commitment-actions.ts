"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentAccessContext } from "@/lib/dal";
import { enforceAuthenticatedRateLimit } from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { formDataToObject } from "@/lib/validation";
import { GraphicFlowError } from "./client-decision-rules";
import { contractGraphicSupplier } from "./commitment";

export async function contractGraphicSupplierAction(data: FormData) {
  try {
    const context = await getCurrentAccessContext();
    if (!context) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
    assertCan("graphics.production_write", context);
    await enforceAuthenticatedRateLimit("common_mutation", context);
    const result = await contractGraphicSupplier(context, formDataToObject(data));
    revalidatePath(`/app/grafica/${result.jobId}`);
    revalidatePath("/app/grafica");
    revalidatePath("/app/financeiro/saidas");
    return { ok: true, message: "Contratação registrada e conta a pagar criada. O pagamento será registrado pelo Financeiro." };
  } catch (error) {
    if (error instanceof GraphicFlowError) return { ok: false, message: error.message };
    if (error instanceof ZodError) return { ok: false, message: "Confira os campos e marque a confirmação da contratação." };
    if (error instanceof AccessDeniedError) return { ok: false, message: "Confira sua permissão e os cadastros de fornecedor, categoria e centro de custo." };
    return { ok: false, message: "Não foi possível contratar. Aguarde e tente novamente; o sistema evita duplicar a conta a pagar." };
  }
}

"use server";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getCurrentAccessContext } from "@/lib/dal";
import { enforceAuthenticatedRateLimit } from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { formDataToObject } from "@/lib/validation";
import { GraphicFlowError } from "./client-decision-rules";
import { registerGraphicSale } from "./sale";

export async function registerGraphicSaleAction(data: FormData) {
  try {
    const context = await getCurrentAccessContext();
    if (!context) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
    assertCan("graphics.client_approval_write", context);
    await enforceAuthenticatedRateLimit("common_mutation", context);
    const raw = formDataToObject(data);
    if (typeof raw.installments !== "string" || raw.installments.length > 20000) throw new GraphicFlowError("Revise as parcelas informadas.");
    const result = await registerGraphicSale(context, { ...raw, installments: JSON.parse(raw.installments) });
    revalidatePath(`/app/grafica/${result.jobId}`);
    revalidatePath("/app/grafica");
    revalidatePath("/app/financeiro/entradas");
    return { ok: true, message: "Venda registrada e contas a receber criadas. O recebimento será confirmado pelo Financeiro." };
  } catch (error) {
    if (error instanceof GraphicFlowError) return { ok: false, message: error.message };
    if (error instanceof ZodError) return { ok: false, message: "Confira valores, vencimentos e competência. A soma das parcelas deve ser igual ao valor contratado; confirme a criação das contas a receber." };
    if (error instanceof AccessDeniedError) return { ok: false, message: "Você não tem permissão para registrar esta venda." };
    return { ok: false, message: "Não foi possível registrar a venda. Aguarde e tente novamente; o sistema evita duplicar as parcelas." };
  }
}

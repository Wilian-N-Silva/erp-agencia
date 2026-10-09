"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentAccessContext } from "@/lib/dal";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { enforceAuthenticatedRateLimit, withRateLimitActionResult } from "@/lib/rate-limit";
import type { ServerActionResult } from "@/lib/server-action-result";
import { formDataToObject } from "@/lib/validation";
import { createReimbursementPayable, ReimbursementPayableError } from "./reimbursement-payable";

export async function createReimbursementPayableAction(data: FormData): Promise<ServerActionResult<void>> {
  const limited = withRateLimitActionResult(async () => {
    const context = await getCurrentAccessContext();
    if (!context?.organizationId) throw new AccessDeniedError();
    assertCan("finance.write", context); assertCan("reimbursements.approve_finance", context);
    await enforceAuthenticatedRateLimit("reconciliation", context);
    const raw = formDataToObject(data);
    await createReimbursementPayable(context, { ...raw, costCenterId: raw.costCenterId || null });
    revalidatePath("/app", "layout"); revalidatePath("/portal", "layout");
  });
  try { return await limited(); }
  catch (error) {
    if (error instanceof ReimbursementPayableError) return { ok: false, code: "CONFLICT", message: error.message };
    if (error instanceof z.ZodError) return { ok: false, code: "CONFLICT", message: "Confira vencimento, competência e categoria da conta a pagar." };
    return { ok: false, code: "CONFLICT", message: "Não foi possível gerar a conta a pagar. Verifique seu acesso e tente novamente." };
  }
}

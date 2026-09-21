"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getCurrentAccessContext } from "@/lib/dal";
import {
  enforceAuthenticatedRateLimit,
  withRateLimitActionResult,
} from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { formDataToObject } from "@/lib/validation";

import { createFinancialTransactionRecord } from "./dal";
import { financialTransactionInputSchema } from "./rules";

async function createFinancialTransaction(formData: FormData) {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  assertCan("finance.write", context);
  if (!context.organizationId) throw new AccessDeniedError();

  await enforceAuthenticatedRateLimit("financial_transaction", context);
  const input = financialTransactionInputSchema.parse(formDataToObject(formData));

  await createFinancialTransactionRecord(context, input);

  revalidatePath("/app/financeiro/movimentacoes");
}

export const createFinancialTransactionAction = withRateLimitActionResult(
  createFinancialTransaction,
);

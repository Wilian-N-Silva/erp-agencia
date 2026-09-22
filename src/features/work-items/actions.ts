"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  bindCurrentTenantContext,
  getCurrentAccessContext,
  type AccessContext,
} from "@/lib/dal";
import {
  enforceAuthenticatedRateLimit,
  withRateLimitActionResult,
} from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { formDataToObject } from "@/lib/validation";

import { resolveWorkItem } from "./dal";
import { resolveWorkItemInputSchema } from "./rules";

type AuthorizedContext = AccessContext & { organizationId: string };

async function resolveWorkItemActionOperation(formData: FormData) {
  const context = await requireWorkItemWriterContext();
  await enforceAuthenticatedRateLimit("common_mutation", context);
  const input = resolveWorkItemInputSchema.parse(formDataToObject(formData));

  await resolveWorkItem(context, input);
  revalidatePath("/app");
  revalidatePath("/app/alertas");
}

async function requireWorkItemWriterContext(): Promise<AuthorizedContext> {
  const context = await getCurrentAccessContext();

  if (!context) {
    redirect("/login");
  }

  assertCan("alerts.write", context);

  if (!context.organizationId) {
    throw new AccessDeniedError();
  }

  return { ...context, organizationId: context.organizationId };
}

export const resolveWorkItemAction = withRateLimitActionResult(
  bindCurrentTenantContext(resolveWorkItemActionOperation),
);

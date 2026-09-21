"use client";

import {
  useActionState,
  useEffect,
  type FormHTMLAttributes,
  type ReactNode,
} from "react";

import type {
  FormServerAction,
  ServerActionResult,
} from "@/lib/server-action-result";

import { useToast } from "./toast";

type RateLimitedActionFormProps = Omit<
  FormHTMLAttributes<HTMLFormElement>,
  "action" | "encType" | "method" | "target"
> & {
  action: FormServerAction<unknown>;
  children: ReactNode;
};

const INITIAL_STATE: ServerActionResult<unknown> | null = null;

export function RateLimitedActionForm({
  action,
  children,
  ...formProps
}: RateLimitedActionFormProps) {
  const pushToast = useToast();
  const [state, formAction, pending] = useActionState(
    async (_previousState: ServerActionResult<unknown> | null, formData: FormData) =>
      action(formData),
    INITIAL_STATE,
  );

  useEffect(() => {
    if (state?.ok !== false || state.code !== "RATE_LIMITED") return;

    pushToast({
      description: state.message,
      duration: Math.max(
        3_800,
        Math.min((state.retryAfterSeconds ?? 0) * 1_000, 10_000),
      ),
      title: "Limite de tentativas atingido",
      tone: "error",
    });
  }, [pushToast, state]);

  return (
    <form {...formProps} action={formAction} aria-busy={pending}>
      {children}
    </form>
  );
}

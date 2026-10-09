"use client";

import { useActionState, type FormHTMLAttributes, type ReactNode } from "react";
import type { ServerActionResult } from "@/lib/server-action-result";

export function FinancialTitleForm({ action, children, ...props }: Omit<FormHTMLAttributes<HTMLFormElement>, "action"> & {
  action: (formData: FormData) => Promise<void | ServerActionResult<void>>;
  children: ReactNode;
}) {
  const [result, submit, pending] = useActionState(async (_previous: ServerActionResult<void> | null, data: FormData) => {
    return await action(data) ?? { ok: true, data: undefined };
  }, null);
  return <form {...props} action={submit} aria-busy={pending}>
    {children}
    {result?.ok === false ? <p role="alert">{result.message}</p> : null}
    {result?.ok === true ? <p role="status">Alteração registrada.</p> : null}
  </form>;
}

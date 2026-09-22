"use client";
import { useState, useTransition, type ReactNode } from "react";
import type { FormServerAction, ServerActionResult } from "@/lib/server-action-result";

export function GraphicJobActionForm({ action, children, className }: { action: FormServerAction<unknown>; children: ReactNode; className?: string }) {
  const [result, setResult] = useState<ServerActionResult<unknown> | null>(null);
  const [pending, startTransition] = useTransition();
  return <form className={className} aria-busy={pending} onSubmit={event => {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    startTransition(async () => { setResult(await action(data)); });
  }}>
    {result?.ok === false ? <p role="alert" className="mb-4 rounded-md border border-destructive p-3 text-sm">{result.message}</p> : null}
    {result?.ok === true ? <p role="status" className="mb-4 text-sm">Trabalho atualizado.</p> : null}
    <fieldset disabled={pending}>{children}</fieldset>
    {pending ? <p role="status" className="mt-3 text-sm">Salvando trabalho…</p> : null}
  </form>;
}

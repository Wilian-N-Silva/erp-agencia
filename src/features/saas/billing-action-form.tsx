"use client";
import { startTransition, useActionState, type ReactNode } from "react";
export function SaasActionForm({ action, children }: {
  action: (state: { message: string; ok: boolean } | null, data: FormData) => Promise<{ message: string; ok: boolean }>;
  children: ReactNode;
}) {
  const [state, submit, pending] = useActionState(action, null);
  return <form className="fg-form" onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(() => submit(data));
  }}>
    <fieldset disabled={pending} style={{ border: 0, padding: 0 }} className="fg-form">{children}</fieldset>
    {state ? <p role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
  </form>;
}

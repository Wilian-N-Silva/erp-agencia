"use client";

import { useActionState } from "react";
import { registerGraphicOsAction } from "@/features/graphics/actions";

export function GraphicOsForm({ jobId, current }: {
  jobId: string;
  current?: { version: number; externalNumber: string; issuedAt: string; presentedAmount: string };
}) {
  const [state, action, pending] = useActionState(
    async (_previous: { ok: boolean; message: string } | null, data: FormData) => registerGraphicOsAction(data), null,
  );
  return <form action={action} className="grid gap-4" aria-busy={pending}>
    <input type="hidden" name="jobId" value={jobId} />
    <input type="hidden" name="expectedVersion" value={current?.version ?? 0} />
    <div className="grid gap-4 sm:grid-cols-3">
      <label className="grid gap-1 text-sm">Número da OS<input className={inputClassName} name="externalNumber" required maxLength={100} defaultValue={current?.externalNumber} /></label>
      <label className="grid gap-1 text-sm">Data da OS<input className={inputClassName} name="issuedAt" type="date" required defaultValue={current?.issuedAt} /></label>
      <label className="grid gap-1 text-sm">Valor apresentado ao cliente<input className={inputClassName} name="presentedAmount" inputMode="decimal" required defaultValue={current?.presentedAmount.replace(".", ",")} /></label>
    </div>
    <label className="grid gap-1 text-sm">PDF da OS<input name="document" type="file" accept="application/pdf,.pdf" required /></label>
    {current ? <label className="grid gap-1 text-sm">Motivo da nova versão<textarea className="min-h-20 rounded-md border bg-background px-3 py-2" name="revisionReason" required minLength={3} maxLength={2000} /></label> : null}
    <p className="text-sm text-muted-foreground">Anexe a OS gerada no sistema externo. Cada envio preserva as versões anteriores. Números usados em outros trabalhos geram um aviso após o registro, sem impedir o envio.</p>
    {state ? <p role={state.ok ? "status" : "alert"} className={state.ok ? "text-sm" : "text-sm text-destructive"}>{state.message}</p> : null}
    <div className="flex justify-end"><button className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={pending} type="submit">{pending ? "Registrando…" : current ? "Registrar nova versão da OS" : "Registrar OS"}</button></div>
  </form>;
}

const inputClassName = "h-10 w-full rounded-md border bg-background px-3 text-sm";

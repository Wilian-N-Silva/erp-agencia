"use client";
import { useActionState } from "react";
import { uploadFinalArtworkAction } from "@/features/graphics/final-artwork-actions";

export function FinalArtworkForm({ jobId, maxBytes }: { jobId: string; maxBytes: number }) {
  const [state, action, pending] = useActionState(async (_previous: { ok: boolean; message: string } | null, data: FormData) => uploadFinalArtworkAction(data), null);
  return <form action={action} className="grid gap-3" aria-busy={pending}>
    <input type="hidden" name="jobId" value={jobId} />
    <label className="grid gap-1 text-sm">Arquivo final para produção<input type="file" name="file" accept="application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg" required /></label>
    <p className="text-sm text-muted-foreground">PDF, PNG ou JPG, até {Math.round(maxBytes / 1024 / 1024)} MB. Anexe o arquivo que será enviado ao fornecedor ou usado na impressão própria. Cada envio cria uma versão e preserva os arquivos anteriores.</p>
    {state ? <p role={state.ok ? "status" : "alert"}>{state.message}</p> : null}
    <button type="submit" disabled={pending} className="fg-btn fg-btn-primary justify-self-start">{pending ? "Anexando…" : "Anexar arquivo final"}</button>
  </form>;
}

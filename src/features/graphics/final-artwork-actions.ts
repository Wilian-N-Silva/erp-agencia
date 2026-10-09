"use server";
import { revalidatePath } from "next/cache";
import { getCurrentAccessContext } from "@/lib/dal";
import { assertCan, AccessDeniedError } from "@/lib/rbac";
import { enforceAuthenticatedRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { uploadFinalArtwork, validateFinalArtwork } from "./final-artwork";

export async function uploadFinalArtworkAction(data: FormData) {
  try {
    const context = await getCurrentAccessContext();
    if (!context) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
    assertCan("graphics.production_write", context);
    await enforceAuthenticatedRateLimit("upload", context);
    const file = data.get("file");
    if (!(file instanceof File)) return { ok: false, message: "Selecione o arquivo final." };
    try { validateFinalArtwork(file, new Uint8Array(await file.arrayBuffer())); }
    catch { return { ok: false, message: "Confira o arquivo: PDF, PNG ou JPG válido, dentro do limite de upload." }; }
    const document = await uploadFinalArtwork(context, { jobId: data.get("jobId") }, file);
    revalidatePath(`/app/grafica/${document.ownerId}`);
    return { ok: true, message: "Arquivo final anexado. A versão anterior permanece no histórico." };
  } catch (error) {
    if (error instanceof RateLimitExceededError) return { ok: false, message: "Muitas tentativas. Aguarde antes de reenviar." };
    if (error instanceof AccessDeniedError) return { ok: false, message: "Trabalho indisponível ou acesso não permitido." };
    return { ok: false, message: "Não foi possível anexar o arquivo. Atualize a página e tente novamente." };
  }
}

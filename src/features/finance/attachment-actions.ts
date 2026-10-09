"use server";
import { revalidatePath } from "next/cache";
import { getCurrentAccessContext } from "@/lib/dal";
import { enforceAuthenticatedRateLimit, RateLimitExceededError } from "@/lib/rate-limit";
import { AccessDeniedError, assertCan } from "@/lib/rbac";
import { formDataToObject } from "@/lib/validation";
import { financialAttachmentSchema, validateFinancialAttachment } from "./attachment-rules";
import { financialAttachmentHref, uploadFinancialAttachment } from "./attachments";

export async function uploadFinancialAttachmentAction(data: FormData) {
  try {
    const context = await getCurrentAccessContext();
    if (!context) return { ok: false, message: "Sua sessão expirou. Entre novamente." };
    assertCan("finance.write", context);
    await enforceAuthenticatedRateLimit("upload", context);
    const input = financialAttachmentSchema.safeParse(formDataToObject(data, ["file"]));
    const file = data.get("file");
    if (!input.success || !(file instanceof File)) return { ok: false, message: "Confira o vínculo, o tipo e o arquivo selecionado." };
    try {
      const metadata = { originalName: file.name, mimeType: file.type, byteSize: file.size };
      validateFinancialAttachment(metadata);
      validateFinancialAttachment(metadata, new Uint8Array(await file.arrayBuffer()));
    }
    catch { return { ok: false, message: "Use um PDF, PNG ou JPG válido dentro do limite de upload." }; }
    await uploadFinancialAttachment(context, input.data, file);
    revalidatePath(financialAttachmentHref(input.data.ownerType, input.data.ownerId));
    return { ok: true, message: "Documento anexado. As versões anteriores permanecem disponíveis." };
  } catch (error) {
    if (error instanceof RateLimitExceededError) return { ok: false, message: "Muitas tentativas. Aguarde antes de reenviar." };
    if (error instanceof AccessDeniedError) return { ok: false, message: "Registro indisponível ou acesso não permitido." };
    return { ok: false, message: "Não foi possível anexar o documento. Atualize a página e tente novamente." };
  }
}

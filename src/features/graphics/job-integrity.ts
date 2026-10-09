import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { graphicOsVersions, graphicSales, graphicSupplierCommitments } from "@/lib/db/schema";

export class GraphicJobIntegrityError extends Error {}

/** Caller holds the same job lock used by OS, sale and supplier commitment writes. */
export async function assertGraphicJobIdentityChangeAllowed(input: {
  jobId: string; organizationId: string; clientChanged?: boolean; archive?: boolean;
}) {
  if (!input.clientChanged && !input.archive) return;
  const [os, sale, commitment] = await Promise.all([
    db.select({ id: graphicOsVersions.id }).from(graphicOsVersions).where(and(eq(graphicOsVersions.jobId, input.jobId), eq(graphicOsVersions.organizationId, input.organizationId))).limit(1),
    db.select({ id: graphicSales.id }).from(graphicSales).where(and(eq(graphicSales.jobId, input.jobId), eq(graphicSales.organizationId, input.organizationId))).limit(1),
    db.select({ id: graphicSupplierCommitments.id }).from(graphicSupplierCommitments).where(and(eq(graphicSupplierCommitments.jobId, input.jobId), eq(graphicSupplierCommitments.organizationId, input.organizationId))).limit(1),
  ]);
  if (input.clientChanged && (os.length || sale.length || commitment.length)) {
    throw new GraphicJobIntegrityError("O cliente não pode ser trocado após registrar OS ou vínculo financeiro. Preserve o trabalho original e revise a operação de origem.");
  }
  if (input.archive && (sale.length || commitment.length)) {
    throw new GraphicJobIntegrityError("O trabalho possui histórico financeiro vinculado. Use o encerramento operacional para manter títulos e documentos consultáveis.");
  }
}

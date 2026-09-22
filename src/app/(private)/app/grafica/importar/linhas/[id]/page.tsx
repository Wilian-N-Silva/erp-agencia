import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getGraphicImportRowLocation } from "@/features/graphics/import-staging";
import { getCurrentAccessContext } from "@/lib/dal";
import { can } from "@/lib/rbac";
export const dynamic = "force-dynamic";
export default async function ImportRowPage({ params }: { params: Promise<{ id: string }> }) {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!can("graphics.import", context)) redirect("/acesso-negado");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const location = await getGraphicImportRowLocation(context, id);
  if (!location) notFound();
  redirect(`/app/grafica/importar/${location.batchId}?page=${location.page}#linha-${id}`);
}

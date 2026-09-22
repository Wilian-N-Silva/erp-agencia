import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, Page, PageHeader } from "@/components/fg";
import { listGraphicImports } from "@/features/graphics/import-staging";
import { getCurrentAccessContext } from "@/lib/dal";
import { can } from "@/lib/rbac";
import { GraphicImportUploadForm } from "./upload-form";
export const dynamic = "force-dynamic";
export default async function GraphicImportsPage() {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!can("graphics.import", context)) redirect("/acesso-negado");
  const batches = await listGraphicImports(context);
  return <Page><PageHeader title="Importação histórica da Gráfica" description="Prepare uma prévia, revise cada linha e confirme os registros. Vínculos entre vendas e caixa exigem conciliação explícita." />
    <Link className="text-primary underline" href="/app/grafica">Voltar à Gráfica</Link>
    <Card title="Preparar arquivo"><GraphicImportUploadForm /></Card>
    <Card title="Lotes recentes"><ul className="grid gap-2">{batches.map(batch => <li key={batch.id}><Link className="text-primary underline" href={`/app/grafica/importar/${batch.id}`}>{batch.fileName}</Link> · {batch.status === "complete" ? "Concluído" : batch.status === "partial" ? "Parcial" : "Prévia"} · {batch.createdAt.toLocaleDateString("pt-BR")}</li>)}</ul>{!batches.length ? <p>Nenhum arquivo preparado.</p> : null}</Card>
  </Page>;
}

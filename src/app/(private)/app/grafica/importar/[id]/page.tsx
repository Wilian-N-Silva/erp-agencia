import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Card, Page, PageHeader } from "@/components/fg";
import { getGraphicImport, getGraphicImportOptions } from "@/features/graphics/import-staging";
import { getCurrentAccessContext } from "@/lib/dal";
import { can } from "@/lib/rbac";
import { ImportBatchCommitForm, ImportRowReviewForm } from "./review-form";
export const dynamic = "force-dynamic";
const statuses: Record<string, string> = { pending: "Aguardando revisão", ready: "Revisada", imported: "Importada", ignored: "Ignorada" };
const kinds: Record<string, string> = { sales: "OS / venda", incoming: "Entrada de caixa", outgoing: "Saída de caixa" };
export default async function GraphicImportDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> }) {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!can("graphics.import", context)) redirect("/acesso-negado");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [data, options] = await Promise.all([getGraphicImport(context, id), getGraphicImportOptions(context)]);
  if (!data) notFound();
  const { batch, rows } = data;
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  const requested = Number((await searchParams).page ?? 1);
  const page = Number.isSafeInteger(requested) ? Math.max(1, Math.min(pages, requested)) : 1;
  return <Page><PageHeader title={`Revisar ${batch.fileName}`} description="Compare os dados originais, resolva inconsistências e confirme somente o que foi revisado." />
    <Link className="text-primary underline" href="/app/grafica/importar">Voltar aos lotes</Link>
    <a className="text-primary underline" href={`/app/grafica/importar/${id}/relatorio`}>Baixar relatório completo (JSON)</a>
    <Card title="Resumo da prévia"><dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Object.entries(statuses).map(([status, label]) => <div key={status}><dt>{label}</dt><dd>{rows.filter(row => row.status === status).length}</dd></div>)}</dl><p className="mt-3 text-sm">Nenhum relacionamento entre venda e caixa é inferido. A conciliação será feita no Financeiro.</p></Card>
    {batch.status !== "complete" ? <Card title="Confirmar importação"><ImportBatchCommitForm batchId={id} ready={rows.filter(row => row.status === "ready").length} /></Card> : <p role="status">Lote concluído. O histórico de todas as linhas foi preservado.</p>}
    {rows.slice((page - 1) * 50, page * 50).map(row => <Card key={`${row.id}-${row.revision}`} title={`${row.sourceSheet} · linha ${row.sourceRow} · ${kinds[row.kind]}`}>
      <div id={`linha-${row.id}`} className="grid gap-3"><p><strong>{statuses[row.status]}</strong> · {row.classification === "clear" ? "Dados legíveis; confira os vínculos" : row.classification === "ambiguous" ? "Vínculo ambíguo; revisão necessária" : "Dados inválidos; correção necessária"}</p>
        <ul className="list-disc pl-5">{(row.issues as string[]).map((issue, index) => <li key={index}>{issue}</li>)}</ul>
        <details><summary className="cursor-pointer text-primary">Consultar dados originais</summary><pre className="overflow-auto whitespace-pre-wrap break-words rounded border p-3 text-sm">{JSON.stringify(row.raw, null, 2)}</pre></details>
        {row.status === "pending" || row.status === "ready" ? <ImportRowReviewForm row={row} options={options} /> : <><details><summary>Consultar decisão registrada</summary><pre className="overflow-auto whitespace-pre-wrap break-words text-sm">{JSON.stringify(row.resolution, null, 2)}</pre></details>{row.jobId ? <Link className="text-primary underline" href={`/app/grafica/${row.jobId}`}>Abrir trabalho importado</Link> : null}{row.transactionId ? <Link className="text-primary underline" href={`/app/financeiro/movimentacoes/${row.transactionId}`}>Abrir movimentação para conciliação</Link> : null}</>}
      </div>
    </Card>)}
    <nav aria-label="Páginas da prévia" className="flex gap-4">{page > 1 ? <Link href={`/app/grafica/importar/${id}?page=${page - 1}`}>Anterior</Link> : null}<span>Página {page} de {pages}</span>{page < pages ? <Link href={`/app/grafica/importar/${id}?page=${page + 1}`}>Próxima</Link> : null}</nav>
  </Page>;
}

"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { stageGraphicImportAction, type ImportActionResult } from "@/features/graphics/import-actions";
import { graphicImportFields, type GraphicImportMapping } from "@/features/graphics/import-rules";

const fields = { osNumber: "OS", date: "Data", amount: "Valor", description: "Descrição", client: "Cliente", supplier: "Fornecedor", project: "Projeto", reference: "Referência" };
export function GraphicImportUploadForm() {
  const [blocks, setBlocks] = useState<GraphicImportMapping["blocks"]>([{ kind: "sales", sheet: "Vendas", firstRow: 2, lastRow: 1000, columns: { osNumber: 1, date: 2, amount: 3, description: 4, client: 5, project: 6 } }]);
  const [result, action, pending] = useActionState(async (_: ImportActionResult | null, data: FormData) => stageGraphicImportAction(data), null);
  const update = (index: number, change: Partial<GraphicImportMapping["blocks"][number]>) => setBlocks(blocks.map((block, i) => i === index ? { ...block, ...change } : block));
  return <form action={action} className="grid gap-4" aria-busy={pending}>
    <label className="grid gap-1 text-sm">Planilha histórica XLSX<input type="file" name="file" accept=".xlsx" required /></label>
    <p className="text-sm text-muted-foreground">Informe as abas e as colunas de cada bloco. A = 1, B = 2, C = 3. Deixe campos opcionais sem coluna quando não existirem. A prévia não cria vendas nem movimenta caixa. Limites: 10 MB e 10.000 linhas.</p>
    <input type="hidden" name="mapping" value={JSON.stringify({ blocks })} />
    {blocks.map((block, index) => <fieldset key={index} className="grid gap-3 rounded-md border p-4 sm:grid-cols-3"><legend>Bloco {index + 1}</legend>
      <label>Tipo do bloco<select className="fg-input" value={block.kind} onChange={event => update(index, { kind: event.target.value as typeof block.kind })}><option value="sales">OS / vendas</option><option value="incoming">Entradas de caixa</option><option value="outgoing">Saídas de caixa</option></select></label>
      <label>Nome da aba<input className="fg-input" required maxLength={100} value={block.sheet} onChange={event => update(index, { sheet: event.target.value })} /></label>
      <label>Primeira linha de dados<input className="fg-input" type="number" min={1} max={10001} required value={block.firstRow} onChange={event => update(index, { firstRow: Number(event.target.value) })} /></label>
      <label>Última linha de dados<input className="fg-input" type="number" min={block.firstRow} max={10001} required value={block.lastRow} onChange={event => update(index, { lastRow: Number(event.target.value) })} /></label>
      {graphicImportFields.map(field => <label key={field}>Coluna de {fields[field]}<input className="fg-input" type="number" min={1} max={100} required={field === "date" || field === "amount"} value={block.columns[field] ?? ""} onChange={event => update(index, { columns: { ...block.columns, [field]: event.target.value ? Number(event.target.value) : undefined } })} /></label>)}
      {blocks.length > 1 ? <button type="button" className="text-left text-destructive underline" onClick={() => setBlocks(blocks.filter((_, i) => i !== index))}>Remover bloco {index + 1}</button> : null}
    </fieldset>)}
    <button type="button" className="justify-self-start text-primary underline" disabled={blocks.length === 3 || pending} onClick={() => setBlocks([...blocks, { kind: blocks.some(row => row.kind === "incoming") ? "outgoing" : "incoming", sheet: "Entradas", firstRow: 2, lastRow: 1000, columns: { date: 1, amount: 2, reference: 3 } }])}>Adicionar bloco</button>
    {result ? <div role={result.ok ? "status" : "alert"}><p>{result.message}</p>{result.ok && result.batchId ? <Link className="text-primary underline" href={`/app/grafica/importar/${result.batchId}`}>Abrir prévia para revisão</Link> : null}</div> : null}
    <button className="justify-self-end rounded-md bg-primary px-4 py-2 text-primary-foreground" disabled={pending}>{pending ? "Preparando prévia…" : "Preparar prévia"}</button>
  </form>;
}

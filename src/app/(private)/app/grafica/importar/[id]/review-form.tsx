"use client";
import { useActionState, useState } from "react";
import { commitGraphicImportAction, ignoreGraphicImportAction, reviewGraphicImportAction, type ImportActionResult } from "@/features/graphics/import-actions";
import type { GraphicImportOptions } from "@/features/graphics/import-staging";
import type { GraphicImportRow } from "@/features/graphics/import-rules";

type Row = { id: string; revision: number; kind: string; normalized: unknown; resolution: unknown };
const buttonClass = "justify-self-start rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50";
function Result({ value }: { value: ImportActionResult | null }) { return value ? <p role={value.ok ? "status" : "alert"}>{value.message}</p> : null; }
export function ImportRowReviewForm({ row, options }: { row: Row; options: GraphicImportOptions }) {
  const original = row.normalized as GraphicImportRow["normalized"];
  const saved = (row.resolution ?? {}) as Record<string, string | null>;
  const [values, setValues] = useState<Record<string, string>>(() => ({
    amount: original.amount ?? "", date: original.date ?? "", description: original.description, reason: "",
    clientId: "", responsibleEmployeeId: "", projectId: "", osNumber: original.osNumber,
    dueDate: original.date ?? "", competence: original.date?.slice(0, 7) ?? "", operationalStatus: "supplier_sourcing",
    accountId: "", supplierId: "", counterpartyName: row.kind === "incoming" ? original.client : original.supplier, reference: original.reference,
    ...Object.fromEntries(Object.entries(saved).map(([key, value]) => [key, value ?? ""])),
  }));
  const [result, action, pending] = useActionState(async (_: ImportActionResult | null, data: FormData) => reviewGraphicImportAction(data), null);
  const [ignored, ignore, ignoring] = useActionState(async (_: ImportActionResult | null, data: FormData) => ignoreGraphicImportAction(data), null);
  const change = (key: string, value: string) => setValues(current => ({ ...current, [key]: value }));
  const input = (key: string, label: string, type = "text", required = true, maxLength = 180) => <label className="grid gap-1">{label}<input className="fg-input" type={type} required={required} maxLength={maxLength} value={values[key]} onChange={event => change(key, event.target.value)} /></label>;
  const select = (key: string, label: string, items: { id: string; name: string }[], required = true) => <label className="grid gap-1">{label}<select className="fg-input" required={required} value={values[key]} onChange={event => change(key, event.target.value)}><option value="">{required ? "Selecione…" : "Sem vínculo"}</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
  const common = { kind: row.kind, amount: values.amount, date: values.date, description: values.description, reason: values.reason };
  const resolution = row.kind === "sales" ? { ...common, clientId: values.clientId, responsibleEmployeeId: values.responsibleEmployeeId, projectId: values.projectId || null, osNumber: values.osNumber, dueDate: values.dueDate, competence: values.competence, operationalStatus: values.operationalStatus } : { ...common, accountId: values.accountId, clientId: row.kind === "incoming" ? values.clientId || null : null, supplierId: row.kind === "outgoing" ? values.supplierId || null : null, counterpartyName: values.counterpartyName, reference: values.reference };
  return <div className="grid gap-5">
    {row.kind === "sales" || options.canImportCash ? <form action={action} className="grid gap-3" aria-busy={pending}>
      <input type="hidden" name="rowId" value={row.id} /><input type="hidden" name="expectedRevision" value={row.revision} /><input type="hidden" name="resolution" value={JSON.stringify(resolution)} />
      <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
        {input("description", "Descrição confirmada")}{input("amount", "Valor confirmado (R$)")}{input("date", "Data confirmada", "date")}
        {row.kind === "sales" ? <>{select("clientId", "Cliente", options.clients)}{select("responsibleEmployeeId", "Responsável", options.employees)}{select("projectId", "Projeto", options.projects, false)}{input("osNumber", "Referência da OS histórica", "text", false, 80)}{input("dueDate", "Vencimento da conta a receber", "date")}{input("competence", "Competência", "month")}
          <label className="grid gap-1">Situação operacional<select className="fg-input" value={values.operationalStatus} onChange={event => change("operationalStatus", event.target.value)}><option value="supplier_sourcing">Em busca de fornecedor</option><option value="delivered">Entregue</option><option value="closed">Encerrado</option></select></label>
        </> : <>{select("accountId", "Conta do caixa", options.accounts)}{row.kind === "incoming" ? select("clientId", "Cliente identificado", options.clients, false) : select("supplierId", "Fornecedor identificado", options.suppliers, false)}{input("counterpartyName", "Nome da contraparte", "text", false, 160)}{input("reference", "Referência", "text", false, 160)}</>}
        {input("reason", "Justificativa da revisão", "text", true, 1000)}
      </fieldset>
      <p className="text-sm text-muted-foreground">{row.kind === "sales" ? "Confirme o saldo histórico a receber. Esta linha criará um trabalho e uma venda com uma parcela, sem registrar recebimento." : "Esta linha criará caixa pendente de conciliação. A referência da OS não vincula títulos automaticamente."}</p>
      <Result value={result} /><button className={buttonClass} disabled={pending}>{pending ? "Salvando…" : "Salvar revisão da linha"}</button>
    </form> : <p>Solicite a revisão desta movimentação a alguém com permissão de escrita no Financeiro.</p>}
    <form action={ignore} className="grid gap-2 border-t pt-3" aria-busy={ignoring}>
      <input type="hidden" name="rowId" value={row.id} /><input type="hidden" name="expectedRevision" value={row.revision} />
      <label className="grid gap-1">Motivo para ignorar esta linha<input className="fg-input" name="reason" required minLength={3} maxLength={1000} /></label>
      <Result value={ignored} /><button className="justify-self-start text-destructive underline" disabled={ignoring}>Ignorar linha com justificativa</button>
    </form>
  </div>;
}
export function ImportBatchCommitForm({ batchId, ready }: { batchId: string; ready: number }) {
  const [result, action, pending] = useActionState(async (_: ImportActionResult | null, data: FormData) => commitGraphicImportAction(data), null);
  return <form action={action} className="grid gap-3" aria-busy={pending}><input type="hidden" name="batchId" value={batchId} />
    <p>{ready} linha(s) revisada(s). Cada confirmação importa até 100 linhas. As restantes permanecem disponíveis neste lote.</p>
    <label className="flex items-start gap-2"><input type="checkbox" name="confirmed" required />Confirmo os dados revisados e a criação dos registros. Linhas sem revisão permanecerão como pendências.</label>
    <Result value={result} /><button className={buttonClass} disabled={pending}>{pending ? "Importando…" : "Confirmar lote revisado"}</button>
  </form>;
}

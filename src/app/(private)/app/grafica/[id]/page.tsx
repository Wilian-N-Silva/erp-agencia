import { ArrowLeft, Check, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card, InlineAlert, RateLimitedActionForm, StatusBadge } from "@/components/fg";
import { formatMoney } from "@/features/finance/rules";
import {
  approveGraphicSupplierQuoteAction, cancelGraphicSupplierQuoteAction, createGraphicSupplierQuoteAction,
  deleteGraphicJobAction, updateGraphicJobAction, updateGraphicSupplierQuoteAction,
  rejectGraphicSupplierQuoteAction,
} from "@/features/graphics/actions";
import {
  getGraphicJob, getGraphicJobAuditLogs, getGraphicJobFormOptions,
  getGraphicSupplierOptions, getGraphicSupplierQuoteAuditLogs, getGraphicSupplierQuotes,
} from "@/features/graphics/dal";
import {
  canApproveGraphicSupplierQuotes, canReadGraphicJobs, canWriteGraphicJobs, canWriteGraphicSupplierQuotes,
  graphicJobFinancialStatusLabels, graphicJobOperationalStatusLabels,
  graphicSupplierQuoteStatusLabels,
} from "@/features/graphics/rules";
import { getCurrentAccessContext } from "@/lib/dal";

import { GraphicJobFormFields } from "../job-form";
import { GraphicSupplierQuoteFormFields } from "../supplier-quote-form";

export const dynamic = "force-dynamic";

export default async function GraphicJobDetailPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ edit?: string; quote?: string }>;
}) {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  const canWriteQuotes = canWriteGraphicSupplierQuotes(context);
  const canApproveQuotes = canApproveGraphicSupplierQuotes(context);
  if (!canReadGraphicJobs(context)) redirect("/acesso-negado");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const canWrite = canWriteGraphicJobs(context);
  const [job, auditLogs, options, quotes, supplierOptions] = await Promise.all([
    getGraphicJob(context, id), getGraphicJobAuditLogs(context, id),
    canWrite ? getGraphicJobFormOptions(context) : Promise.resolve(null),
    getGraphicSupplierQuotes(context, id),
    canWriteQuotes ? getGraphicSupplierOptions(context) : Promise.resolve([]),
  ]);
  if (!job) notFound();
  const query = await searchParams;
  const editing = canWrite && query?.edit === "1";
  const editedQuote = canWriteQuotes
    ? quotes.find((quote) => quote.id === query?.quote && quote.status === "pending")
    : undefined;
  const quoteAuditLogs = await getGraphicSupplierQuoteAuditLogs(context, quotes.map((quote) => quote.id));

  return <section className="flex w-full flex-col gap-6">
    <div><Link className={secondaryButtonClassName} href="/app/grafica"><ArrowLeft size={16} />Voltar</Link><div className="mt-4 flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-sm text-muted-foreground">{job.internalCode}</p><h1 className="text-2xl font-semibold">{job.title}</h1><p className="text-sm text-muted-foreground">{job.clientName}</p></div>{canWrite ? <div className="flex gap-2"><Link className={secondaryButtonClassName} href={`/app/grafica/${id}?edit=1`}><Pencil size={15} />Editar</Link><RateLimitedActionForm action={deleteGraphicJobAction}><input name="id" type="hidden" value={id} /><button className={dangerButtonClassName} type="submit"><Trash2 size={15} />Arquivar</button></RateLimitedActionForm></div> : null}</div></div>
    <InlineAlert title={`Próxima ação: ${job.nextAction}`} description={`Responsável: ${job.responsibleName}`} />
    {editing && options ? <Card title="Editar trabalho"><RateLimitedActionForm action={updateGraphicJobAction}><input name="id" type="hidden" value={id} /><GraphicJobFormFields job={job} options={options} /><div className="mt-5 flex justify-end"><button className={primaryButtonClassName} type="submit">Salvar alterações</button></div></RateLimitedActionForm></Card> : null}
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Resumo"><dl className="grid gap-4 sm:grid-cols-2"><Item label="Status operacional"><StatusBadge label={graphicJobOperationalStatusLabels[job.operationalStatus]} /></Item><Item label="Status financeiro">{graphicJobFinancialStatusLabels[job.financialStatus]}</Item><Item label="Responsável">{job.responsibleName}</Item><Item label="Projeto/evento">{job.projectName ?? "Sem projeto"}</Item><Item label="Solicitado em">{formatDate(job.requestedAt)}</Item><Item label="Entrega desejada">{formatDate(job.desiredDeliveryAt)}</Item></dl></Card>
      <Card title="Descrição"><p className="whitespace-pre-wrap text-sm">{job.description}</p>{job.notes ? <><h3 className="mt-5 text-sm font-semibold">Observações internas</h3><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{job.notes}</p></> : null}</Card>
    </div>
    <Card title="Cotações de fornecedores">
      {canWriteQuotes ? <div className="mb-6 rounded-md border p-4"><h3 className="mb-4 text-sm font-semibold">{editedQuote ? "Editar cotação pendente" : "Nova cotação"}</h3><RateLimitedActionForm action={editedQuote ? updateGraphicSupplierQuoteAction : createGraphicSupplierQuoteAction}><GraphicSupplierQuoteFormFields jobId={id} quote={editedQuote} suppliers={supplierOptions} /><div className="mt-4 flex justify-end gap-2">{editedQuote ? <Link className={secondaryButtonClassName} href={`/app/grafica/${id}`}>Cancelar edição</Link> : null}<button className={primaryButtonClassName} type="submit">{editedQuote ? "Salvar cotação" : "Adicionar cotação"}</button></div></RateLimitedActionForm></div> : null}
      {quotes.length ? <div className="grid gap-4">{quotes.map((quote) => <article className="rounded-md border p-4" key={quote.id}>
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{quote.supplierName}</h3><p className="text-sm text-muted-foreground">{formatDate(quote.quotedAt)} · {formatMoney(quote.quotedAmount)}</p></div><StatusBadge label={graphicSupplierQuoteStatusLabels[quote.status]} tone={quote.status === "approved" ? "success" : quote.status === "rejected" ? "danger" : quote.status === "pending" ? "warning" : "muted"} /></div>
        <p className="mt-3 whitespace-pre-wrap text-sm">{quote.description}</p><dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><Item label="Prazo estimado">{formatDate(quote.estimatedDeliveryAt)}</Item><Item label="Condições">{quote.conditions ?? "—"}</Item></dl>
        {quote.reviewedAt ? <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2"><Item label="Revisado por">{quote.reviewerName ?? "Usuário interno"}</Item><Item label="Revisado em">{formatDateTime(quote.reviewedAt)}</Item>{quote.rejectionReason ? <Item label="Motivo da rejeição">{quote.rejectionReason}</Item> : null}</dl> : null}
        {quote.attachments.length ? <div className="mt-3"><p className="text-xs uppercase text-muted-foreground">Anexos</p><ul className="mt-1 flex flex-wrap gap-2">{quote.attachments.map((attachment) => <li key={attachment.id}><a className="text-sm text-primary underline" href={`/app/grafica/${id}/cotacoes/${quote.id}/anexos/${attachment.id}/download`}>{attachment.originalName}</a></li>)}</ul></div> : null}
        {canWriteQuotes && quote.status === "pending" ? <div className="mt-4 flex gap-2"><Link className={secondaryButtonClassName} href={`/app/grafica/${id}?quote=${quote.id}`}>Editar</Link><RateLimitedActionForm action={cancelGraphicSupplierQuoteAction}><input name="id" type="hidden" value={quote.id} /><input name="jobId" type="hidden" value={id} /><button className={dangerButtonClassName} type="submit">Cancelar cotação</button></RateLimitedActionForm></div> : null}
        {canApproveQuotes && quote.status === "pending" && job.operationalStatus === "supplier_approval_pending" ? <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2"><RateLimitedActionForm action={approveGraphicSupplierQuoteAction}><input name="id" type="hidden" value={quote.id} /><input name="jobId" type="hidden" value={id} /><button className={primaryButtonClassName} type="submit"><Check size={15} />Aprovar cotação</button></RateLimitedActionForm><RateLimitedActionForm action={rejectGraphicSupplierQuoteAction}><input name="id" type="hidden" value={quote.id} /><input name="jobId" type="hidden" value={id} /><label className="grid gap-1 text-sm"><span>Motivo da rejeição</span><textarea className="min-h-20 rounded-md border bg-background px-3 py-2" maxLength={2000} minLength={3} name="rejectionReason" required /></label><button className={`${dangerButtonClassName} mt-2`} type="submit"><X size={15} />Rejeitar cotação</button></RateLimitedActionForm></div> : null}
        {quoteAuditLogs.some((log) => log.quoteId === quote.id) ? <ul className="mt-4 border-t pt-3 text-xs text-muted-foreground">{quoteAuditLogs.filter((log) => log.quoteId === quote.id).map((log) => <li key={log.id}>{quoteAuditLabel(log.action)} · {log.actorName ?? "Sistema"} · {formatDateTime(log.createdAt)}</li>)}</ul> : null}
      </article>)}</div> : <p className="text-sm text-muted-foreground">Nenhuma cotação registrada.</p>}
    </Card>
    <Card title="Histórico">{auditLogs.length ? <ul className="grid gap-3">{auditLogs.map((log) => <li className="border-b pb-3 text-sm last:border-0" key={log.id}><span className="font-medium">{auditLabel(log.action)}</span><span className="text-muted-foreground"> · {log.actorName ?? "Sistema"} · {formatDateTime(log.createdAt)}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">Histórico disponível para usuários com permissão de auditoria.</p>}</Card>
  </section>;
}

function Item({ children, label }: { children: React.ReactNode; label: string }) { return <div><dt className="text-xs uppercase text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{children}</dd></div>; }
function formatDate(value: Date | null) { return value ? new Intl.DateTimeFormat("pt-BR").format(value) : "—"; }
function formatDateTime(value: Date) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(value); }
function auditLabel(action: string) { return ({ create: "Trabalho criado", update: "Trabalho atualizado", delete: "Trabalho arquivado" } as Record<string, string>)[action] ?? action; }
function quoteAuditLabel(action: string) { return ({ create: "Cotação criada", update: "Cotação atualizada", status_change: "Status da cotação alterado" } as Record<string, string>)[action] ?? action; }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
const primaryButtonClassName = "inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground";
const secondaryButtonClassName = "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted";
const dangerButtonClassName = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-destructive px-3 text-sm font-medium text-destructive hover:bg-destructive/10";

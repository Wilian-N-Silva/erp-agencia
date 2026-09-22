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
import { getGraphicOsVersions, findDuplicateOsJobs } from "@/features/graphics/os-dal";
import { canRegisterOs } from "@/features/graphics/os-rules";
import { GraphicOsForm } from "../os-form";
import { ClientDecisionForm } from "../client-decision-form";
import { ProductionForm } from "../production-form";
import { CommitmentForm } from "../commitment-form";
import { GraphicSaleForm } from "../sale-form";
import { getGraphicSale } from "@/features/graphics/sale";
import { canReadGraphicFinance, getGraphicFinanceSummary } from "@/features/graphics/finance-summary";
import { getGraphicSuggestionMovements, getGraphicSuggestions } from "@/features/graphics/reconciliation";
import { GraphicSuggestionForm } from "../reconciliation-forms";
import { getGraphicCommitments, getGraphicCommitmentOptions } from "@/features/graphics/commitment";
import { getGraphicProduction } from "@/features/graphics/production";
import { productionNextStatuses, waitingReasonLabels } from "@/features/graphics/production-rules";
import { getClientDecisions } from "@/features/graphics/client-decision";
import { canRecordClientDecision, clientDecisionLabels, clientChannelLabels } from "@/features/graphics/client-decision-rules";
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
  const canProduce = context.permissions.includes("graphics.production_write");
  const [job, auditLogs, options, quotes, supplierOptions] = await Promise.all([
    getGraphicJob(context, id), getGraphicJobAuditLogs(context, id),
    canWrite || canProduce ? getGraphicJobFormOptions(context) : Promise.resolve(null),
    getGraphicSupplierQuotes(context, id),
    canWriteQuotes ? getGraphicSupplierOptions(context) : Promise.resolve([]),
  ]);
  if (!job) notFound();
  const osVersions = await getGraphicOsVersions(context, id);
  const currentOs = osVersions[0];
  const clientDecisions = await getClientDecisions(context, id);
  const production = await getGraphicProduction(context, id);
  const lastStage = production[0];
  const commitments = await getGraphicCommitments(context, id);
  const sale = await getGraphicSale(context, id);
  const finance = canReadGraphicFinance(context) ? await getGraphicFinanceSummary(context, id) : null;
  const canSuggest = context.permissions.includes("graphics.reconcile_suggest");
  const suggestions = canSuggest || canReadGraphicFinance(context) ? await getGraphicSuggestions(context, { jobId: id }) : [];
  const movements = canSuggest && sale ? await getGraphicSuggestionMovements(context, id) : [];
  const commitmentOptions = canProduce ? await getGraphicCommitmentOptions(context) : null;
  const uncontractedQuotes = quotes.filter(quote => quote.status === "approved" && !commitments.some(row => row.commitment.quoteId === quote.id));
  const duplicateJobs = currentOs ? await findDuplicateOsJobs(context, id, currentOs.externalNumber) : [];
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
      <Card title="Resumo"><dl className="grid gap-4 sm:grid-cols-2"><Item label="Status operacional"><StatusBadge label={graphicJobOperationalStatusLabels[job.operationalStatus]} /></Item><Item label="Status financeiro">{finance ? graphicJobFinancialStatusLabels[finance.status] : "Acesso restrito ao resumo financeiro"}</Item><Item label="Responsável">{job.responsibleName}</Item><Item label="Projeto/evento">{job.projectName ?? "Sem projeto"}</Item><Item label="Solicitado em">{formatDate(job.requestedAt)}</Item><Item label="Entrega desejada">{formatDate(job.desiredDeliveryAt)}</Item></dl></Card>
      <Card title="Descrição"><p className="whitespace-pre-wrap text-sm">{job.description}</p>{job.notes ? <><h3 className="mt-5 text-sm font-semibold">Observações internas</h3><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{job.notes}</p></> : null}</Card>
    </div>
    <Card title="OS externa">
      {duplicateJobs.length ? <div role="alert" className="mb-4 rounded-md border border-amber-500 p-3 text-sm">Atenção: o número desta OS também está registrado em outro trabalho da organização. Confira o documento; o registro foi mantido.</div> : null}
      {canWrite && canRegisterOs(job.operationalStatus) ? <GraphicOsForm key={currentOs?.id ?? "first"} jobId={id} current={currentOs} /> : !currentOs ? <p className="text-sm text-muted-foreground">Aprove uma cotação de fornecedor para registrar a OS externa.</p> : null}
      {osVersions.length ? <ol className="mt-5 grid gap-3">{osVersions.map(os => <li key={os.id} className="rounded-md border p-3 text-sm">
        <p className="font-semibold">OS {os.externalNumber} · Versão {os.version}{os.id === currentOs.id ? " · Atual" : ""}</p>
        <p>Data: {os.issuedAt.split("-").reverse().join("/")} · Valor apresentado: {formatMoney(os.presentedAmount)}</p>
        <p>Registrada por {os.creatorName} em {formatDateTime(os.createdAt)}</p>
        {os.revisionReason ? <p>Motivo: {os.revisionReason}</p> : null}
        <a className="text-primary underline" href={`/app/grafica/${id}/os/${os.id}/download`}>Baixar PDF da versão {os.version}</a>
      </li>)}</ol> : null}
    </Card>
    <Card title="Resposta do cliente">
      {!currentOs ? <p className="text-sm text-muted-foreground">Registre a OS para acompanhar a resposta do cliente.</p> : canRecordClientDecision(job.operationalStatus) && context.permissions.includes("graphics.client_approval_write") ? <ClientDecisionForm key={`${currentOs.id}-${clientDecisions[0]?.decision.id ?? "first"}`} jobId={id} osVersionId={currentOs.id} osVersion={currentOs.version} previousId={clientDecisions[0]?.decision.id} rejected={job.operationalStatus === "client_rejected"} /> : <p className="text-sm text-muted-foreground">{job.operationalStatus === "approved" ? "Cliente aprovou a OS. O próximo passo é liberar a produção." : "Acompanhe abaixo o histórico de respostas. O registro exige permissão e uma OS aguardando decisão."}</p>}
      {clientDecisions.length ? <ol className="mt-4 grid gap-3">{clientDecisions.map(({ decision, osVersion, actor }) => <li key={decision.id} className="rounded-md border p-3 text-sm"><p className="font-semibold">{clientDecisionLabels[decision.decision as keyof typeof clientDecisionLabels]} · OS versão {osVersion}</p><p>{decision.contact} · {clientChannelLabels[decision.channel as keyof typeof clientChannelLabels]} · {decision.decidedAt.split("-").reverse().join("/")}</p><p className="whitespace-pre-wrap">{decision.notes}</p><p className="text-muted-foreground">Registrado por {actor} em {formatDateTime(decision.createdAt)}</p>{decision.fileId ? <a className="text-primary underline" href={`/app/grafica/${id}/cliente/${decision.id}/download`}>Baixar evidência da resposta</a> : null}</li>)}</ol> : null}
    </Card>
    {finance ? <Card title="Resumo financeiro do trabalho">
      <dl className="grid gap-4 sm:grid-cols-3">
        <Item label="Valor contratado">{finance.contracted === null ? "Venda não registrada" : formatMoney(finance.contracted)}</Item>
        <Item label="A receber em aberto">{formatMoney(finance.receivableOpen)}</Item>
        <Item label="Recebido e conciliado">{formatMoney(finance.received)}</Item>
        <Item label="Custos contratados ativos">{formatMoney(finance.payableTotal)}</Item>
        <Item label="A pagar em aberto">{formatMoney(finance.payableOpen)}</Item>
        <Item label="Pago e conciliado">{formatMoney(finance.paid)}</Item>
        <Item label="Situação financeira">{graphicJobFinancialStatusLabels[finance.status]}</Item>
        <Item label="Movimentações parcialmente vinculadas">{finance.pendingMovements}</Item>
        <Item label="Margem contratada">{finance.contractedMargin === null ? "Aguardando vínculos confiáveis" : formatMoney(finance.contractedMargin)}</Item>
        <Item label="Resultado de caixa conciliado">{finance.cashResult === null ? "Aguardando vínculos confiáveis" : formatMoney(finance.cashResult)}</Item>
      </dl>
      <p className="mt-4 text-sm text-muted-foreground">Margem contratada compara a venda com os custos ativos cadastrados; não representa dinheiro disponível nem garante que todos os custos foram informados. Resultado de caixa compara recebimentos e pagamentos conciliados. Movimentações sem vínculo precisam ser identificadas pelo Financeiro.</p>
      {finance.warnings.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">{finance.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul> : null}
    </Card> : null}
    <Card title="Venda e contas a receber">
      {sale ? <div className="grid gap-3 text-sm"><p className="font-semibold">Valor contratado: {formatMoney(sale.sale.amount)}</p><p>Contas a receber criadas. Recebimento acompanhado pelo Financeiro.</p><ol className="grid gap-2">{sale.installments.map(item => <li key={item.id} className="rounded-md border p-3">{item.label} · {formatMoney(item.amount)} · Vencimento: {item.dueDate.split("-").reverse().join("/")}</li>)}</ol></div> : currentOs && context.permissions.includes("graphics.client_approval_write") && ["approved", "in_production", "waiting", "ready", "delivered"].includes(job.operationalStatus) ? <GraphicSaleForm jobId={id} osVersionId={currentOs.id} presentedAmount={currentOs.presentedAmount} /> : <p className="text-sm text-muted-foreground">Após a aprovação do cliente, registre as condições comerciais para criar as contas a receber.</p>}
    </Card>
    {canSuggest || suggestions.length ? <Card title="Sugestões de conciliação">
      {canSuggest && sale ? <GraphicSuggestionForm jobId={id} movements={movements.map(row => ({ id: row.id, label: `${row.occurredAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${row.reference ?? "Sem referência"} · Saldo ${formatMoney(row.remaining)}` }))} installments={sale.installments.map(row => ({ id: row.entryId, label: `${row.label} · ${formatMoney(row.amount)}` }))} /> : null}
      {canSuggest && !movements.length ? <p className="mt-3 text-sm text-muted-foreground">Nenhum recebimento disponível entre os 200 mais recentes do cliente ou sem identificação. Solicite ao Financeiro o registro ou a identificação da movimentação.</p> : null}
      <ol className="mt-4 grid gap-2">{suggestions.map(({ suggestion }) => <li key={suggestion.id} className="rounded-md border p-3 text-sm"><p>{formatMoney(suggestion.amount)} · {suggestion.status === "pending" ? "Aguardando Financeiro" : suggestion.status === "accepted" ? "Confirmada pelo Financeiro" : "Rejeitada pelo Financeiro"}</p><p>{suggestion.reason}</p>{suggestion.reviewNotes ? <p>Revisão: {suggestion.reviewNotes}</p> : null}</li>)}</ol>
    </Card> : null}
    <Card title="Contratação do fornecedor">
      {canProduce && commitmentOptions && ["approved", "waiting"].includes(job.operationalStatus) && uncontractedQuotes.length ? <CommitmentForm jobId={id} quotes={uncontractedQuotes.map(quote => ({ id: quote.id, name: `${quote.supplierName} · ${formatMoney(quote.quotedAmount)}` }))} categories={commitmentOptions.categories} centers={commitmentOptions.centers} /> : !commitments.length ? <p className="text-sm text-muted-foreground">A contratação fica disponível após a aprovação do cliente. Uma cotação aprovada ainda não é uma conta a pagar.</p> : null}
      {commitments.map(row => <div className="mt-3 rounded-md border p-3 text-sm" key={row.commitment.id}><p className="font-semibold">{row.supplier} · {formatMoney(row.amount)}</p><p>Contratado em {row.commitment.contractedAt.split("-").reverse().join("/")} · Vencimento: {row.dueDate.split("-").reverse().join("/")}</p><p>Conta a pagar criada. Pagamento acompanhado pelo Financeiro.</p></div>)}
    </Card>
    <Card title="Produção e entrega">
      {job.operationalStatus === "waiting" && lastStage ? <div role="status" className="mb-4 rounded-md border border-amber-500 p-3 text-sm">Aguardando {waitingReasonLabels[lastStage.event.waitingReason as keyof typeof waitingReasonLabels]} · Responsável: {lastStage.owner}{lastStage.event.dueAt ? ` · Prazo: ${lastStage.event.dueAt.split("-").reverse().join("/")}` : ""}<p>{lastStage.event.notes}</p></div> : null}
      {canProduce && options && productionNextStatuses(job.operationalStatus, lastStage?.event.fromStatus).length ? <ProductionForm key={lastStage?.event.id ?? job.operationalStatus} jobId={id} status={job.operationalStatus} previousId={lastStage?.event.id} resumeStatus={lastStage?.event.fromStatus} ownerId={job.responsibleEmployeeId} employees={options.employees} /> : <p className="text-sm text-muted-foreground">{job.operationalStatus === "closed" ? "Trabalho encerrado. O histórico permanece disponível." : "As etapas de produção ficam disponíveis após a aprovação do cliente, para usuários autorizados."}</p>}
      {production.length ? <ol className="mt-4 grid gap-3">{production.map(({ event, owner }) => <li key={event.id} className="rounded-md border p-3 text-sm"><p className="font-semibold">{graphicJobOperationalStatusLabels[event.fromStatus]} → {graphicJobOperationalStatusLabels[event.toStatus]}</p><p>{owner} · {formatDateTime(event.createdAt)}{event.dueAt ? ` · Prazo: ${event.dueAt.split("-").reverse().join("/")}` : ""}</p>{event.waitingReason ? <p>Espera: {waitingReasonLabels[event.waitingReason as keyof typeof waitingReasonLabels]}</p> : null}<p className="whitespace-pre-wrap">{event.notes}</p></li>)}</ol> : null}
    </Card>
    <Card title="Cotações de fornecedores">
      {canWriteQuotes ? <p className="mb-4 text-sm">Fornecedor não aparece na lista? <Link className="text-primary underline" href="/app/grafica/fornecedores" target="_blank" rel="noopener noreferrer">Consultar ou cadastrar fornecedor (abre em nova aba)</Link>. Depois de cadastrar, atualize este trabalho para selecionar o fornecedor.</p> : null}
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

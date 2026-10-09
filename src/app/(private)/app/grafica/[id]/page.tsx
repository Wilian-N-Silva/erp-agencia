import { GraphicWorkspace } from "../workspace";
import { GraphicActionPanel, ConfirmArchive } from "../workspace-panel";
import {
  graphicWorkspaceStage,
  graphicWorkspaceNextTab,
} from "@/features/graphics/workspace-rules";
import { GraphicJobActionForm } from "../job-action-form";
import { ArrowLeft, Check, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card, RateLimitedActionForm, StatusBadge } from "@/components/fg";
import { formatMoney } from "@/features/finance/rules";
import {
  approveGraphicSupplierQuoteAction,
  cancelGraphicSupplierQuoteAction,
  createGraphicSupplierQuoteAction,
  deleteGraphicJobAction,
  updateGraphicJobAction,
  updateGraphicSupplierQuoteAction,
  rejectGraphicSupplierQuoteAction,
} from "@/features/graphics/actions";
import {
  getGraphicJob,
  getGraphicJobAuditLogs,
  getGraphicJobFormOptions,
  getGraphicSupplierOptions,
  getGraphicSupplierQuoteAuditLogs,
  getGraphicSupplierQuotes,
} from "@/features/graphics/dal";
import {
  canApproveGraphicSupplierQuotes,
  canReadGraphicJobs,
  canWriteGraphicJobs,
  canWriteGraphicSupplierQuotes,
  graphicJobFinancialStatusLabels,
  graphicJobOperationalStatusLabels,
  graphicSupplierQuoteStatusLabels,
} from "@/features/graphics/rules";
import { getCurrentAccessContext } from "@/lib/dal";

import { GraphicJobFormFields } from "../job-form";
import {
  getGraphicOsVersions,
  findDuplicateOsJobs,
} from "@/features/graphics/os-dal";
import { canRegisterOs } from "@/features/graphics/os-rules";
import { GraphicOsForm } from "../os-form";
import { ClientDecisionForm } from "../client-decision-form";
import { ProductionForm } from "../production-form";
import { FinalArtworkForm } from "../final-artwork-form";
import { listFinalArtwork } from "@/features/graphics/final-artwork";
import { getUploadMaxBytes } from "@/features/documents/rules";
import { CommitmentForm } from "../commitment-form";
import { GraphicPayableCorrectionForm } from "@/features/graphics/payable-correction-form";
import { GraphicSaleForm } from "../sale-form";
import { GraphicSaleCorrectionForm } from "@/features/graphics/sale-correction-form";
import { getGraphicSale } from "@/features/graphics/sale";
import {
  canReadGraphicFinance,
  getGraphicFinanceSummary,
} from "@/features/graphics/finance-summary";
import {
  getGraphicSuggestionMovements,
  getGraphicSuggestions,
} from "@/features/graphics/reconciliation";
import { GraphicSuggestionForm } from "../reconciliation-forms";
import {
  getGraphicCommitments,
  getGraphicCommitmentOptions,
} from "@/features/graphics/commitment";
import { getGraphicProduction } from "@/features/graphics/production";
import {
  productionNextStatuses,
  waitingReasonLabels,
} from "@/features/graphics/production-rules";
import { getClientDecisions } from "@/features/graphics/client-decision";
import {
  canRecordClientDecision,
  clientDecisionLabels,
  clientChannelLabels,
} from "@/features/graphics/client-decision-rules";
import { GraphicSupplierQuoteFormFields } from "../supplier-quote-form";

export const dynamic = "force-dynamic";

export default async function GraphicJobDetailPage({
  params,
  searchParams,
}: {
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
    getGraphicJob(context, id),
    getGraphicJobAuditLogs(context, id),
    canWrite || canProduce
      ? getGraphicJobFormOptions(context)
      : Promise.resolve(null),
    getGraphicSupplierQuotes(context, id),
    canWriteQuotes ? getGraphicSupplierOptions(context) : Promise.resolve([]),
  ]);
  if (!job) notFound();
  const canEditQuotes =
    canWriteQuotes &&
    ["supplier_sourcing", "supplier_approval_pending"].includes(
      job.operationalStatus,
    );
  const osVersions = await getGraphicOsVersions(context, id);
  const currentOs = osVersions[0];
  const clientDecisions = await getClientDecisions(context, id);
  const production = await getGraphicProduction(context, id);
  const finalArtwork = await listFinalArtwork(context, id);
  const lastStage = production[0];
  const commitments = await getGraphicCommitments(context, id);
  const sale = await getGraphicSale(context, id);
  const finance = canReadGraphicFinance(context)
    ? await getGraphicFinanceSummary(context, id)
    : null;
  const canSuggest = context.permissions.includes("graphics.reconcile_suggest");
  const suggestions =
    canSuggest || canReadGraphicFinance(context)
      ? await getGraphicSuggestions(context, { jobId: id })
      : [];
  const movements =
    canSuggest && sale ? await getGraphicSuggestionMovements(context, id) : [];
  const commitmentOptions = canProduce
    ? await getGraphicCommitmentOptions(context)
    : null;
  const uncontractedQuotes = quotes.filter(
    (quote) =>
      quote.status === "approved" &&
      !commitments.some((row) => row.commitment.quoteId === quote.id),
  );
  const duplicateJobs = currentOs
    ? await findDuplicateOsJobs(context, id, currentOs.externalNumber)
    : [];
  const query = await searchParams;
  const editing = canWrite && query?.edit === "1";
  const editedQuote = canEditQuotes
    ? quotes.find(
        (quote) => quote.id === query?.quote && quote.status === "pending",
      )
    : undefined;
  const quoteAuditLogs = await getGraphicSupplierQuoteAuditLogs(
    context,
    quotes.map((quote) => quote.id),
  );

  const panels = {
    resumo: (
      <>
        <Card title="Visão geral do trabalho">
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Item label="Pedido">{job.description}</Item>
            <Item label="OS atual">
              {currentOs
                ? `${currentOs.externalNumber} · versão ${currentOs.version}`
                : "Ainda não registrada"}
            </Item>
            <Item label="Cliente / versão vigente">
              {clientDecisions.find(
                (row) => row.decision.osVersionId === currentOs?.id,
              )
                ? clientDecisionLabels[
                    clientDecisions.find(
                      (row) => row.decision.osVersionId === currentOs?.id,
                    )!.decision.decision as keyof typeof clientDecisionLabels
                  ]
                : "Aguardando decisão da versão atual"}
            </Item>
          </dl>
          <p className="mt-5 text-sm text-muted-foreground">
            Siga as etapas acima. As informações e documentos das etapas
            anteriores permanecem disponíveis para consulta.
          </p>
        </Card>
        <Card title="Últimos acontecimentos">
          {auditLogs.slice(0, 3).map((log) => (
            <p className="py-2 text-sm" key={log.id}>
              {auditLabel(log.action)} · {formatDateTime(log.createdAt)}
            </p>
          ))}
          {!auditLogs.length ? (
            <p className="text-sm text-muted-foreground">
              Consulte os registros nas abas de cada etapa.
            </p>
          ) : null}
        </Card>
      </>
    ),
    pedido: (
      <>
        {canWrite && options ? (
          <GraphicActionPanel title="Editar pedido" initialOpen={editing}>
            <GraphicJobActionForm action={updateGraphicJobAction}>
              <input name="id" type="hidden" value={id} />
              <GraphicJobFormFields job={job} options={options} />
              <div className="mt-5 flex justify-end">
                <button className={primaryButtonClassName} type="submit">
                  Salvar alterações
                </button>
              </div>
            </GraphicJobActionForm>
          </GraphicActionPanel>
        ) : null}
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Resumo">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Item label="Status operacional">
                <StatusBadge
                  label={
                    graphicJobOperationalStatusLabels[job.operationalStatus]
                  }
                />
              </Item>
              <Item label="Status financeiro">
                {finance
                  ? graphicJobFinancialStatusLabels[finance.status]
                  : "Acesso restrito ao resumo financeiro"}
              </Item>
              <Item label="Responsável">{job.responsibleName}</Item>
              <Item label="Projeto/evento">
                {job.projectName ?? "Sem projeto"}
              </Item>
              <Item label="Solicitado em">{formatDate(job.requestedAt)}</Item>
              <Item label="Entrega desejada">
                {formatDate(job.desiredDeliveryAt)}
              </Item>
            </dl>
          </Card>
          <Card title="Descrição">
            <p className="whitespace-pre-wrap text-sm">{job.description}</p>
            {job.notes ? (
              <>
                <h3 className="mt-5 text-sm font-semibold">
                  Observações internas
                </h3>
                <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                  {job.notes}
                </p>
              </>
            ) : null}
          </Card>
        </div>
      </>
    ),
    cotacoes: (
      <>
        <Card title="Cotações de fornecedores">
          {canWriteQuotes ? (
            <p className="mb-4 text-sm">
              Fornecedor não aparece na lista?{" "}
              <Link
                className="text-primary underline"
                href="/app/grafica/fornecedores"
                target="_blank"
                rel="noopener noreferrer"
              >
                Consultar ou cadastrar fornecedor (abre em nova aba)
              </Link>
              . Depois de cadastrar, atualize este trabalho para selecionar o
              fornecedor.
            </p>
          ) : null}
          {canEditQuotes ? (
            <GraphicActionPanel
              title={editedQuote ? "Editar cotação" : "Nova cotação"}
              initialOpen={!!editedQuote}
            >
              <div className="mb-6 rounded-md border p-4">
                <h3 className="mb-4 text-sm font-semibold">
                  {editedQuote ? "Editar cotação pendente" : "Nova cotação"}
                </h3>
                <RateLimitedActionForm
                  action={
                    editedQuote
                      ? updateGraphicSupplierQuoteAction
                      : createGraphicSupplierQuoteAction
                  }
                >
                  <GraphicSupplierQuoteFormFields
                    jobId={id}
                    quote={editedQuote}
                    suppliers={supplierOptions}
                  />
                  <div className="mt-4 flex justify-end gap-2">
                    {editedQuote ? (
                      <Link
                        className={secondaryButtonClassName}
                        href={`/app/grafica/${id}?tab=cotacoes`}
                      >
                        Cancelar edição
                      </Link>
                    ) : null}
                    <button className={primaryButtonClassName} type="submit">
                      {editedQuote ? "Salvar cotação" : "Adicionar cotação"}
                    </button>
                  </div>
                </RateLimitedActionForm>
              </div>
            </GraphicActionPanel>
          ) : null}
          {quotes.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {quotes.map((quote) => (
                <article className="rounded-md border p-4" key={quote.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{quote.supplierName}</h3>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(quote.quotedAt)} ·{" "}
                        {formatMoney(quote.quotedAmount)}
                      </p>
                    </div>
                    <StatusBadge
                      label={graphicSupplierQuoteStatusLabels[quote.status]}
                      tone={
                        quote.status === "approved"
                          ? "success"
                          : quote.status === "rejected"
                            ? "danger"
                            : quote.status === "pending"
                              ? "warning"
                              : "muted"
                      }
                    />
                  </div>
                  <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                    <Item label="Prazo estimado">
                      {formatDate(quote.estimatedDeliveryAt)}
                    </Item>
                    <Item label="Condições">{quote.conditions ?? "—"}</Item>
                  </dl>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Detalhes e anexos
                    </summary>
                    <p className="mt-3 whitespace-pre-wrap text-sm">
                      {quote.description}
                    </p>
                    {quote.reviewedAt ? (
                      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
                        <Item label="Revisado por">
                          {quote.reviewerName ?? "Usuário interno"}
                        </Item>
                        <Item label="Revisado em">
                          {formatDateTime(quote.reviewedAt)}
                        </Item>
                        {quote.rejectionReason ? (
                          <Item label="Motivo da rejeição">
                            {quote.rejectionReason}
                          </Item>
                        ) : null}
                      </dl>
                    ) : null}
                    {quote.attachments.length ? (
                      <div className="mt-3">
                        <p className="text-xs uppercase text-muted-foreground">
                          Anexos
                        </p>
                        <ul className="mt-1 flex flex-wrap gap-2">
                          {quote.attachments.map((attachment) => (
                            <li key={attachment.id}>
                              <a
                                className="text-sm text-primary underline"
                                href={`/app/grafica/${id}/cotacoes/${quote.id}/anexos/${attachment.id}/download`}
                              >
                                {attachment.originalName}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </details>
                  {canEditQuotes && quote.status === "pending" ? (
                    <div className="mt-4 flex gap-2">
                      <Link
                        className={secondaryButtonClassName}
                        href={`/app/grafica/${id}?tab=cotacoes&quote=${quote.id}`}
                      >
                        Editar
                      </Link>
                      <RateLimitedActionForm
                        action={cancelGraphicSupplierQuoteAction}
                      >
                        <input name="id" type="hidden" value={quote.id} />
                        <input name="jobId" type="hidden" value={id} />
                        <button className={dangerButtonClassName} type="submit">
                          Cancelar cotação
                        </button>
                      </RateLimitedActionForm>
                    </div>
                  ) : null}
                  {canApproveQuotes &&
                  quote.status === "pending" &&
                  job.operationalStatus === "supplier_approval_pending" ? (
                    <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
                      <RateLimitedActionForm
                        action={approveGraphicSupplierQuoteAction}
                      >
                        <input name="id" type="hidden" value={quote.id} />
                        <input name="jobId" type="hidden" value={id} />
                        <button
                          className={primaryButtonClassName}
                          type="submit"
                        >
                          <Check size={15} />
                          Aprovar cotação
                        </button>
                      </RateLimitedActionForm>
                      <RateLimitedActionForm
                        action={rejectGraphicSupplierQuoteAction}
                      >
                        <input name="id" type="hidden" value={quote.id} />
                        <input name="jobId" type="hidden" value={id} />
                        <label className="grid gap-1 text-sm">
                          <span>Motivo da rejeição</span>
                          <textarea
                            className="min-h-20 rounded-md border bg-background px-3 py-2"
                            maxLength={2000}
                            minLength={3}
                            name="rejectionReason"
                            required
                          />
                        </label>
                        <button
                          className={`${dangerButtonClassName} mt-2`}
                          type="submit"
                        >
                          <X size={15} />
                          Rejeitar cotação
                        </button>
                      </RateLimitedActionForm>
                    </div>
                  ) : null}
                  {quoteAuditLogs.some((log) => log.quoteId === quote.id) ? (
                    <ul className="mt-4 border-t pt-3 text-xs text-muted-foreground">
                      {quoteAuditLogs
                        .filter((log) => log.quoteId === quote.id)
                        .map((log) => (
                          <li key={log.id}>
                            {quoteAuditLabel(log.action)} ·{" "}
                            {log.actorName ?? "Sistema"} ·{" "}
                            {formatDateTime(log.createdAt)}
                          </li>
                        ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma cotação registrada.
            </p>
          )}
        </Card>
      </>
    ),
    os: (
      <>
        <Card title="OS externa">
          {duplicateJobs.length ? (
            <div
              role="alert"
              className="mb-4 rounded-md border border-amber-500 p-3 text-sm"
            >
              Atenção: o número desta OS também está registrado em outro
              trabalho da organização. Confira o documento; o registro foi
              mantido.
            </div>
          ) : null}
          {canWrite && canRegisterOs(job.operationalStatus) ? (
            <GraphicActionPanel
              title={currentOs ? "Nova versão da OS" : "Registrar OS externa"}
            >
              <GraphicOsForm
                key={currentOs?.id ?? "first"}
                jobId={id}
                current={currentOs}
              />
            </GraphicActionPanel>
          ) : !currentOs ? (
            <p className="text-sm text-muted-foreground">
              Aprove uma cotação de fornecedor para registrar a OS externa.{" "}
              <Link
                className="text-primary underline"
                href={`/app/grafica/${id}?tab=cotacoes`}
              >
                Ir para cotações
              </Link>
            </p>
          ) : null}
          {osVersions.length ? (
            <ol className="mt-5 grid gap-3">
              {osVersions.map((os) => (
                <li key={os.id} className="rounded-md border p-3 text-sm">
                  <details open={os.id === currentOs.id}>
                    <summary className="cursor-pointer font-semibold">
                      {os.id === currentOs.id ? "OS atual" : "Versão anterior"}{" "}
                      · {os.externalNumber} · v{os.version}
                    </summary>
                    <p className="font-semibold">
                      OS {os.externalNumber} · Versão {os.version}
                      {os.id === currentOs.id ? " · Atual" : ""}
                    </p>
                    <p>
                      Data: {os.issuedAt.split("-").reverse().join("/")} · Valor
                      apresentado: {formatMoney(os.presentedAmount)}
                    </p>
                    <p>
                      Registrada por {os.creatorName} em{" "}
                      {formatDateTime(os.createdAt)}
                    </p>
                    {os.revisionReason ? (
                      <p>Motivo: {os.revisionReason}</p>
                    ) : null}
                    <a
                      className="text-primary underline"
                      href={`/app/grafica/${id}/os/${os.id}/download`}
                    >
                      Baixar PDF da versão {os.version}
                    </a>
                  </details>
                </li>
              ))}
            </ol>
          ) : null}
        </Card>
      </>
    ),
    cliente: (
      <>
        <Card title="Resposta do cliente">
          {!currentOs ? (
            <p className="text-sm text-muted-foreground">
              Registre a OS para acompanhar a resposta do cliente.{" "}
              <Link
                className="text-primary underline"
                href={`/app/grafica/${id}?tab=os`}
              >
                Ir para OS
              </Link>
            </p>
          ) : canRecordClientDecision(job.operationalStatus) &&
            context.permissions.includes("graphics.client_approval_write") ? (
            <GraphicActionPanel title="Registrar resposta">
              <ClientDecisionForm
                key={`${currentOs.id}-${clientDecisions[0]?.decision.id ?? "first"}`}
                jobId={id}
                osVersionId={currentOs.id}
                osVersion={currentOs.version}
                previousId={clientDecisions[0]?.decision.id}
                rejected={job.operationalStatus === "client_rejected"}
              />
            </GraphicActionPanel>
          ) : (
            <p className="text-sm text-muted-foreground">
              {job.operationalStatus === "approved"
                ? "Cliente aprovou a OS. O próximo passo é liberar a produção."
                : "Acompanhe abaixo o histórico de respostas. O registro exige permissão e uma OS aguardando decisão."}
            </p>
          )}
          {clientDecisions.length ? (
            <ol className="mt-4 grid gap-3">
              {clientDecisions.map(({ decision, osVersion, actor }) => (
                <li key={decision.id} className="rounded-md border p-3 text-sm">
                  <details
                    open={decision.id === clientDecisions[0]?.decision.id}
                  >
                    <summary className="cursor-pointer font-semibold">
                      {
                        clientDecisionLabels[
                          decision.decision as keyof typeof clientDecisionLabels
                        ]
                      }{" "}
                      · OS versão {osVersion}
                    </summary>
                    <p className="font-semibold">
                      {
                        clientDecisionLabels[
                          decision.decision as keyof typeof clientDecisionLabels
                        ]
                      }{" "}
                      · OS versão {osVersion}
                    </p>
                    <p>
                      {decision.contact} ·{" "}
                      {
                        clientChannelLabels[
                          decision.channel as keyof typeof clientChannelLabels
                        ]
                      }{" "}
                      · {decision.decidedAt.split("-").reverse().join("/")}
                    </p>
                    <p className="whitespace-pre-wrap">{decision.notes}</p>
                    <p className="text-muted-foreground">
                      Registrado por {actor} em{" "}
                      {formatDateTime(decision.createdAt)}
                    </p>
                    {decision.fileId ? (
                      <a
                        className="text-primary underline"
                        href={`/app/grafica/${id}/cliente/${decision.id}/download`}
                      >
                        Baixar evidência da resposta
                      </a>
                    ) : null}
                  </details>
                </li>
              ))}
            </ol>
          ) : null}
        </Card>
      </>
    ),
    producao: (
      <>
        <Card title="Contratação do fornecedor">
          {canProduce &&
          commitmentOptions &&
          ["approved", "waiting"].includes(job.operationalStatus) &&
          uncontractedQuotes.length ? (
            <GraphicActionPanel title="Contratar fornecedor">
              <CommitmentForm
                jobId={id}
                quotes={uncontractedQuotes.map((quote) => ({
                  id: quote.id,
                  name: `${quote.supplierName} · ${formatMoney(quote.quotedAmount)}`,
                }))}
                categories={commitmentOptions.categories}
                centers={commitmentOptions.centers}
              />
            </GraphicActionPanel>
          ) : !commitments.length ? (
            <p className="text-sm text-muted-foreground">
              A contratação fica disponível após a aprovação do cliente. Uma
              cotação aprovada ainda não é uma conta a pagar.{" "}
              <Link
                className="text-primary underline"
                href={`/app/grafica/${id}?tab=cliente`}
              >
                Consultar aprovação do cliente
              </Link>
            </p>
          ) : null}
          {commitments.map((row) => (
            <div
              className="mt-3 rounded-md border p-3 text-sm"
              key={row.commitment.id}
            >
              <p className="font-semibold">
                {row.supplier} · {formatMoney(row.amount)}
              </p>
              <p>
                Contratado em{" "}
                {row.commitment.contractedAt.split("-").reverse().join("/")} ·
                Vencimento: {row.dueDate.split("-").reverse().join("/")}
              </p>
              <p>
                Conta a pagar criada. Pagamento acompanhado pelo Financeiro.
              </p>
              <Link className="underline" href={`/app/financeiro/saidas?competence=${encodeURIComponent(row.competence)}&q=${encodeURIComponent(`Gráfica ${job.internalCode}`)}`}>Consultar conta a pagar</Link>
              {context.permissions.includes("finance.write") && context.permissions.includes("finance.reverse") ? <details className="mt-3"><summary>Corrigir conta a pagar da contratação</summary><GraphicPayableCorrectionForm jobId={id} commitmentId={row.commitment.id} revision={row.revision} amount={row.amount} dueDate={row.dueDate} competence={row.competence} /></details> : null}
              {row.corrections.length ? <details className="mt-3"><summary>Histórico de correções da conta a pagar</summary><ul>{row.corrections.map(item => <li key={item.id} className="mt-2"><p>De {formatMoney(item.beforeAmount)} para {formatMoney(item.afterAmount)}</p><p>Vencimento: {item.beforeDueDate} para {item.afterDueDate} · Competência: {item.beforeCompetence} para {item.afterCompetence}</p><p>{formatDateTime(new Date(item.occurredAt))} · Responsável: {item.actorName ?? "Usuário indisponível"}</p><p>Motivo: {item.reason}</p></li>)}</ul></details> : null}
            </div>
          ))}
        </Card>
        <Card title="Produção e entrega">
          <section className="mb-6 grid gap-3" aria-label="Arquivos finais para produção">
            <h3 className="font-semibold">Arquivo final do trabalho</h3>
            {canProduce ? <FinalArtworkForm jobId={id} maxBytes={getUploadMaxBytes()} /> : null}
            {finalArtwork.length ? <ol className="grid gap-2">
              {finalArtwork.map(({ document, file }, index) => <li key={document.id} className="rounded-md border p-3 text-sm">
                <a className="font-medium underline" href={`/app/grafica/${id}/arquivos-finais/${document.id}/download`}>{file.originalName}</a>
                <p>Versão {document.version}{index === 0 ? " · Mais recente" : ""} · {formatDateTime(document.createdAt)}</p>
              </li>)}
            </ol> : <p className="text-sm text-muted-foreground">Nenhum arquivo final anexado.</p>}
          </section>
          {job.operationalStatus === "waiting" && lastStage ? (
            <div
              role="status"
              className="mb-4 rounded-md border border-amber-500 p-3 text-sm"
            >
              Aguardando{" "}
              {
                waitingReasonLabels[
                  lastStage.event
                    .waitingReason as keyof typeof waitingReasonLabels
                ]
              }{" "}
              · Responsável: {lastStage.owner}
              {lastStage.event.dueAt
                ? ` · Prazo: ${lastStage.event.dueAt.split("-").reverse().join("/")}`
                : ""}
              <p>{lastStage.event.notes}</p>
            </div>
          ) : null}
          {canProduce &&
          options &&
          productionNextStatuses(
            job.operationalStatus,
            lastStage?.event.fromStatus,
          ).length ? (
            <GraphicActionPanel title="Atualizar produção e entrega">
              <ProductionForm
                key={lastStage?.event.id ?? job.operationalStatus}
                jobId={id}
                status={job.operationalStatus}
                previousId={lastStage?.event.id}
                resumeStatus={lastStage?.event.fromStatus}
                ownerId={job.responsibleEmployeeId}
                employees={options.employees}
              />
            </GraphicActionPanel>
          ) : (
            <p className="text-sm text-muted-foreground">
              {job.operationalStatus === "closed"
                ? "Trabalho encerrado. O histórico permanece disponível."
                : "As etapas de produção ficam disponíveis após a aprovação do cliente, para usuários autorizados."}
            </p>
          )}
          {production.length ? (
            <ol className="mt-4 grid gap-3">
              {production.map(({ event, owner }) => (
                <li key={event.id} className="rounded-md border p-3 text-sm">
                  <p className="font-semibold">
                    {graphicJobOperationalStatusLabels[event.fromStatus]} →{" "}
                    {graphicJobOperationalStatusLabels[event.toStatus]}
                  </p>
                  <p>
                    {owner} · {formatDateTime(event.createdAt)}
                    {event.dueAt
                      ? ` · Prazo: ${event.dueAt.split("-").reverse().join("/")}`
                      : ""}
                  </p>
                  {event.waitingReason ? (
                    <p>
                      Espera:{" "}
                      {
                        waitingReasonLabels[
                          event.waitingReason as keyof typeof waitingReasonLabels
                        ]
                      }
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap">{event.notes}</p>
                </li>
              ))}
            </ol>
          ) : null}
        </Card>
      </>
    ),
    financeiro: (
      <>
        {finance ? (
          <Card title="Resumo financeiro do trabalho">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Item label="Valor contratado">
                {finance.contracted === null
                  ? "Venda não registrada"
                  : formatMoney(finance.contracted)}
              </Item>
              <Item label="A receber em aberto">
                {formatMoney(finance.receivableOpen)}
              </Item>
              <Item label="Recebido e conciliado">
                {formatMoney(finance.received)}
              </Item>
              <Item label="Custos contratados ativos">
                {formatMoney(finance.payableTotal)}
              </Item>
              <Item label="A pagar em aberto">
                {formatMoney(finance.payableOpen)}
              </Item>
              <Item label="Pago e conciliado">{formatMoney(finance.paid)}</Item>
              <Item label="Situação financeira">
                {graphicJobFinancialStatusLabels[finance.status]}
              </Item>
              <Item label="Movimentações parcialmente vinculadas">
                {finance.pendingMovements}
              </Item>
              <Item label="Margem contratada">
                {finance.contractedMargin === null
                  ? "Aguardando vínculos confiáveis"
                  : formatMoney(finance.contractedMargin)}
              </Item>
              <Item label="Resultado de caixa conciliado">
                {finance.cashResult === null
                  ? "Aguardando vínculos confiáveis"
                  : formatMoney(finance.cashResult)}
              </Item>
            </dl>
            <p className="mt-4 text-sm text-muted-foreground">
              Margem contratada compara a venda com os custos ativos
              cadastrados; não representa dinheiro disponível nem garante que
              todos os custos foram informados. Resultado de caixa compara
              recebimentos e pagamentos conciliados. Movimentações sem vínculo
              precisam ser identificadas pelo Financeiro.
            </p>
            {finance.warnings.length ? (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {finance.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            ) : null}
          </Card>
        ) : null}
        <Card title="Venda e contas a receber">
          {sale ? (
            <div className="grid gap-3 text-sm">
              <p className="font-semibold">
                Valor contratado atual: {formatMoney(sale.effectiveAmount)}
              </p>
              <p>
                Contas a receber criadas. Recebimento acompanhado pelo
                Financeiro.
              </p>
              <ol className="grid gap-2">
                {sale.installments.map((item) => (
                  <li key={item.id} className="rounded-md border p-3">
                    {item.label} · {formatMoney(item.amount)} · Vencimento:{" "}
                    {item.dueDate.split("-").reverse().join("/")}
                  </li>
                ))}
              </ol>
              {context.permissions.includes("finance.write") && context.permissions.includes("finance.reverse") ? <details><summary>Corrigir venda e parcelas</summary><GraphicSaleCorrectionForm jobId={id} saleId={sale.sale.id} revision={sale.revision} amount={sale.effectiveAmount} competence={sale.effectiveCompetence} installments={sale.installments}/></details> : null}
              {sale.corrections.length ? <details><summary>Histórico de correções da venda</summary><p>Venda original: {formatMoney(sale.sale.amount)} · {sale.sale.competence}</p><ol>{sale.corrections.map(item=><li key={item.id}><p>Revisão {item.version}: de {formatMoney(item.beforeAmount)} para {formatMoney(item.amount)} · Competência: {item.beforeCompetence} para {item.competence}</p><p>{formatDateTime(item.createdAt)} · {item.actorName ?? "Responsável registrado na auditoria"} · Motivo: {item.reason}</p><ul>{item.installments.map(row=><li key={row.entryId}>Parcela: {formatMoney(row.amount)} · Vencimento: {row.dueDate}</li>)}</ul></li>)}</ol></details> : null}
            </div>
          ) : currentOs &&
            context.permissions.includes("graphics.client_approval_write") &&
            [
              "approved",
              "in_production",
              "waiting",
              "ready",
              "delivered",
            ].includes(job.operationalStatus) ? (
            <GraphicActionPanel title="Definir venda e parcelas">
              <GraphicSaleForm
                jobId={id}
                osVersionId={currentOs.id}
                presentedAmount={currentOs.presentedAmount}
              />
            </GraphicActionPanel>
          ) : (
            <p className="text-sm text-muted-foreground">
              Após a aprovação do cliente, registre as condições comerciais para
              criar as contas a receber.
            </p>
          )}
        </Card>
        {canSuggest || suggestions.length ? (
          <Card title="Sugestões de conciliação">
            {canSuggest && sale ? (
              <GraphicActionPanel title="Sugerir conciliação">
                <GraphicSuggestionForm
                  jobId={id}
                  movements={movements.map((row) => ({
                    id: row.id,
                    label: `${row.occurredAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · ${row.reference ?? "Sem referência"} · Saldo ${formatMoney(row.remaining)}`,
                  }))}
                  installments={sale.installments.map((row) => ({
                    id: row.entryId,
                    label: `${row.label} · ${formatMoney(row.amount)}`,
                  }))}
                />
              </GraphicActionPanel>
            ) : null}
            {canSuggest && !movements.length ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Nenhum recebimento disponível entre os 200 mais recentes do
                cliente ou sem identificação. Solicite ao Financeiro o registro
                ou a identificação da movimentação.
              </p>
            ) : null}
            <ol className="mt-4 grid gap-2">
              {suggestions.map(({ suggestion }) => (
                <li
                  key={suggestion.id}
                  className="rounded-md border p-3 text-sm"
                >
                  <p>
                    {formatMoney(suggestion.amount)} ·{" "}
                    {suggestion.status === "pending"
                      ? "Aguardando Financeiro"
                      : suggestion.status === "accepted"
                        ? "Confirmada pelo Financeiro"
                        : "Rejeitada pelo Financeiro"}
                  </p>
                  <p>{suggestion.reason}</p>
                  {suggestion.reviewNotes ? (
                    <p>Revisão: {suggestion.reviewNotes}</p>
                  ) : null}
                </li>
              ))}
            </ol>
          </Card>
        ) : null}
      </>
    ),
    historico: (
      <>
        <Card title="Documentos do trabalho">
          <div className="grid gap-4 text-sm">
            <div>
              <h3 className="font-semibold">OS e versões</h3>
              {osVersions.length ? (
                osVersions.map((os) => (
                  <p key={os.id}>
                    <a
                      className="text-primary underline"
                      href={`/app/grafica/${id}/os/${os.id}/download`}
                    >
                      OS {os.externalNumber} · versão {os.version}
                      {os.id === currentOs?.id ? " · Atual" : ""}
                    </a>
                  </p>
                ))
              ) : (
                <p>Nenhuma OS registrada.</p>
              )}
            </div>
            <div>
              <h3 className="font-semibold">Cotações</h3>
              {quotes.flatMap((quote) =>
                quote.attachments.map((file) => (
                  <p key={file.id}>
                    <a
                      className="text-primary underline"
                      href={`/app/grafica/${id}/cotacoes/${quote.id}/anexos/${file.id}/download`}
                    >
                      {quote.supplierName} · {file.originalName}
                    </a>
                  </p>
                )),
              )}
              {!quotes.some((quote) => quote.attachments.length) ? (
                <p>Nenhum anexo de cotação.</p>
              ) : null}
            </div>
            <div>
              <h3 className="font-semibold">Evidências do cliente</h3>
              {clientDecisions
                .filter((row) => row.decision.fileId)
                .map(({ decision, osVersion }) => (
                  <p key={decision.id}>
                    <a
                      className="text-primary underline"
                      href={`/app/grafica/${id}/cliente/${decision.id}/download`}
                    >
                      Resposta · OS versão {osVersion} ·{" "}
                      {formatDateTime(decision.createdAt)}
                    </a>
                  </p>
                ))}
              {!clientDecisions.some((row) => row.decision.fileId) ? (
                <p>Nenhuma evidência anexada.</p>
              ) : null}
            </div>
          </div>
        </Card>
        <Card title="Histórico">
          {auditLogs.length ? (
            <ul className="grid gap-3">
              {auditLogs.map((log) => (
                <li
                  className="border-b pb-3 text-sm last:border-0"
                  key={log.id}
                >
                  <span className="font-medium">{auditLabel(log.action)}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {log.actorName ?? "Sistema"} ·{" "}
                    {formatDateTime(log.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Histórico disponível para usuários com permissão de auditoria.
            </p>
          )}
        </Card>
        <Card title="Eventos das cotações">
          {quoteAuditLogs.map((log) => (
            <p className="py-2 text-sm" key={log.id}>
              {quotes.find((quote) => quote.id === log.quoteId)?.supplierName} ·{" "}
              {quoteAuditLabel(log.action)} · {log.actorName ?? "Sistema"} ·{" "}
              {formatDateTime(log.createdAt)}
            </p>
          ))}
        </Card>
      </>
    ),
  };
  return (
    <section className="flex w-full min-w-0 flex-col gap-6">
      <div>
        <Link className={secondaryButtonClassName} href="/app/grafica">
          <ArrowLeft size={16} />
          Voltar
        </Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-sm text-muted-foreground">
              {job.internalCode}
            </p>
            <h1 className="text-2xl font-semibold">{job.title}</h1>
            <p className="text-sm text-muted-foreground">
              {job.clientName} · Responsável: {job.responsibleName} · Entrega:{" "}
              {formatDate(job.desiredDeliveryAt)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge
                label={graphicJobOperationalStatusLabels[job.operationalStatus]}
              />
              {finance ? (
                <StatusBadge
                  label={`Financeiro: ${graphicJobFinancialStatusLabels[finance.status]}`}
                />
              ) : null}
            </div>
          </div>
          {canWrite ? (
            <div className="flex gap-2">
              <Link
                className={secondaryButtonClassName}
                href={`/app/grafica/${id}?tab=pedido&edit=1`}
              >
                <Pencil size={15} />
                Editar
              </Link>
              <ConfirmArchive>
                <GraphicJobActionForm action={deleteGraphicJobAction}>
                  <input name="id" type="hidden" value={id} />
                  <button className={dangerButtonClassName} type="submit">
                    <Trash2 size={15} />
                    Arquivar
                  </button>
                </GraphicJobActionForm>
              </ConfirmArchive>
            </div>
          ) : null}
        </div>
      </div>

      <GraphicWorkspace
        panels={panels}
        stage={graphicWorkspaceStage(
          job.operationalStatus,
          lastStage?.event.fromStatus,
        )}
        attention={["waiting", "client_revision", "client_rejected"].includes(
          job.operationalStatus,
        )}
        closed={job.operationalStatus === "closed"}
        nextTab={graphicWorkspaceNextTab(
          job.operationalStatus,
          !!finance && finance.status !== "settled",
        )}
        nextAction={
          job.operationalStatus === "closed" &&
          finance &&
          finance.status !== "settled"
            ? "Conferir pendências financeiras"
            : job.nextAction
        }
        owner={
          job.operationalStatus === "waiting" && lastStage
            ? lastStage.owner
            : job.responsibleName
        }
        waiting={
          job.operationalStatus === "waiting" && lastStage
            ? `Em espera: ${waitingReasonLabels[lastStage.event.waitingReason as keyof typeof waitingReasonLabels]} · ${lastStage.event.notes ?? ""}`
            : undefined
        }
      />
    </section>
  );
}

function Item({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{children}</dd>
    </div>
  );
}
function formatDate(value: Date | null) {
  return value ? new Intl.DateTimeFormat("pt-BR").format(value) : "—";
}
function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}
function auditLabel(action: string) {
  return (
    (
      {
        create: "Trabalho criado",
        status_change: "Etapa do trabalho alterada",
        update: "Trabalho atualizado",
        delete: "Trabalho arquivado",
      } as Record<string, string>
    )[action] ?? action
  );
}
function quoteAuditLabel(action: string) {
  return (
    (
      {
        create: "Cotação criada",
        update: "Cotação atualizada",
        status_change: "Status da cotação alterado",
      } as Record<string, string>
    )[action] ?? action
  );
}
function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}
const primaryButtonClassName =
  "inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground";
const secondaryButtonClassName =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted";
const dangerButtonClassName =
  "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-destructive px-3 text-sm font-medium text-destructive hover:bg-destructive/10";

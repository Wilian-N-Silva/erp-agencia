import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Card, InlineAlert, RateLimitedActionForm, StatusBadge } from "@/components/fg";
import { deleteGraphicJobAction, updateGraphicJobAction } from "@/features/graphics/actions";
import { getGraphicJob, getGraphicJobAuditLogs, getGraphicJobFormOptions } from "@/features/graphics/dal";
import { canWriteGraphicJobs, graphicJobFinancialStatusLabels, graphicJobOperationalStatusLabels } from "@/features/graphics/rules";
import { getCurrentAccessContext } from "@/lib/dal";

import { GraphicJobFormFields } from "../job-form";

export const dynamic = "force-dynamic";

export default async function GraphicJobDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams?: Promise<{ edit?: string }> }) {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!context.permissions.includes("graphics.read") && !canWriteGraphicJobs(context)) redirect("/acesso-negado");
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const canWrite = canWriteGraphicJobs(context);
  const [job, auditLogs, options] = await Promise.all([
    getGraphicJob(context, id),
    getGraphicJobAuditLogs(context, id),
    canWrite ? getGraphicJobFormOptions(context) : Promise.resolve(null),
  ]);
  if (!job) notFound();
  const editing = canWrite && (await searchParams)?.edit === "1";

  return <section className="flex w-full flex-col gap-6">
    <div><Link className={secondaryButtonClassName} href="/app/grafica"><ArrowLeft size={16} />Voltar</Link><div className="mt-4 flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-sm text-muted-foreground">{job.internalCode}</p><h1 className="text-2xl font-semibold">{job.title}</h1><p className="text-sm text-muted-foreground">{job.clientName}</p></div>{canWrite ? <div className="flex gap-2"><Link className={secondaryButtonClassName} href={`/app/grafica/${id}?edit=1`}><Pencil size={15} />Editar</Link><RateLimitedActionForm action={deleteGraphicJobAction}><input name="id" type="hidden" value={id} /><button className={dangerButtonClassName} type="submit"><Trash2 size={15} />Arquivar</button></RateLimitedActionForm></div> : null}</div></div>
    <InlineAlert title={`Próxima ação: ${job.nextAction}`} description={`Responsável: ${job.responsibleName}`} />
    {editing && options ? <Card title="Editar trabalho"><RateLimitedActionForm action={updateGraphicJobAction}><input name="id" type="hidden" value={id} /><GraphicJobFormFields job={job} options={options} /><div className="mt-5 flex justify-end"><button className={primaryButtonClassName} type="submit">Salvar alterações</button></div></RateLimitedActionForm></Card> : null}
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Resumo"><dl className="grid gap-4 sm:grid-cols-2"><Item label="Status operacional"><StatusBadge label={graphicJobOperationalStatusLabels[job.operationalStatus]} /></Item><Item label="Status financeiro">{graphicJobFinancialStatusLabels[job.financialStatus]}</Item><Item label="Responsável">{job.responsibleName}</Item><Item label="Projeto/evento">{job.projectName ?? "Sem projeto"}</Item><Item label="Solicitado em">{formatDate(job.requestedAt)}</Item><Item label="Entrega desejada">{formatDate(job.desiredDeliveryAt)}</Item></dl></Card>
      <Card title="Descrição"><p className="whitespace-pre-wrap text-sm">{job.description}</p>{job.notes ? <><h3 className="mt-5 text-sm font-semibold">Observações internas</h3><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{job.notes}</p></> : null}</Card>
    </div>
    <Card title="Histórico">{auditLogs.length ? <ul className="grid gap-3">{auditLogs.map((log) => <li className="border-b pb-3 text-sm last:border-0" key={log.id}><span className="font-medium">{auditLabel(log.action)}</span><span className="text-muted-foreground"> · {log.actorName ?? "Sistema"} · {formatDateTime(log.createdAt)}</span></li>)}</ul> : <p className="text-sm text-muted-foreground">Histórico disponível para usuários com permissão de auditoria.</p>}</Card>
  </section>;
}

function Item({ children, label }: { children: React.ReactNode; label: string }) { return <div><dt className="text-xs uppercase text-muted-foreground">{label}</dt><dd className="mt-1 text-sm font-medium">{children}</dd></div>; }
function formatDate(value: Date | null) { return value ? new Intl.DateTimeFormat("pt-BR").format(value) : "—"; }
function formatDateTime(value: Date) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(value); }
function auditLabel(action: string) { return ({ create: "Trabalho criado", update: "Trabalho atualizado", delete: "Trabalho arquivado" } as Record<string, string>)[action] ?? action; }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
const primaryButtonClassName = "inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground";
const secondaryButtonClassName = "inline-flex h-10 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium hover:bg-muted";
const dangerButtonClassName = "inline-flex h-10 items-center justify-center gap-2 rounded-md border border-destructive px-3 text-sm font-medium text-destructive hover:bg-destructive/10";

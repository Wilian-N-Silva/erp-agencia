import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, Page, PageHeader } from "@/components/fg";
import { attachmentOwnerSchema, canReadFinancialAttachments, financialAttachmentLabels } from "@/features/finance/attachment-rules";
import { getFinancialAttachmentOwner, listFinancialAttachments } from "@/features/finance/attachments";
import { formatMoney } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";
import { AccessDeniedError, can } from "@/lib/rbac";
import { FinancialAttachmentForm } from "./upload-form";

export const dynamic = "force-dynamic";
export default async function FinancialAttachmentsPage({ params }: { params: Promise<{ ownerType: string; ownerId: string }> }) {
  const context = await getCurrentAccessContext();
  if (!context) redirect("/login");
  if (!canReadFinancialAttachments(context)) redirect("/acesso-negado");
  const parsed = attachmentOwnerSchema.safeParse(await params);
  if (!parsed.success) notFound();
  let owner, rows;
  try {
    owner = await getFinancialAttachmentOwner(context, parsed.data);
    rows = await listFinancialAttachments(context, parsed.data);
  } catch (error) { if (error instanceof AccessDeniedError) notFound(); throw error; }
  return <Page>
    <PageHeader eyebrow="Financeiro" title="Documentos financeiros" description={`${owner.description} · ${formatMoney(owner.amount)}`} />
    <Link href={owner.ownerType === "financial_transaction" ? `/app/financeiro/movimentacoes/${owner.ownerId}` : owner.ownerType === "financial_entry" ? "/app/financeiro/entradas" : "/app/financeiro/saidas"}>Voltar ao Financeiro</Link>
    {can("finance.write", context) ? <Card title="Anexar documento"><p>PDF, PNG ou JPG. Anexos documentam a operação; não geram pagamentos ou notas fiscais. Novos arquivos do mesmo tipo criam uma versão.</p><FinancialAttachmentForm {...parsed.data} /></Card> : null}
    <Card title="Versões e comprovantes">{rows.length ? <ul>{rows.map(({ document, file }) => <li key={document.id} className="py-2">
      <Link href={`/app/documentos/${document.id}/download`}>{file.originalName}</Link>
      <p>{financialAttachmentLabels[document.documentType as keyof typeof financialAttachmentLabels] ?? "Documento"} · Versão {document.version} · {document.createdAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
    </li>)}</ul> : <p>Nenhum documento anexado.</p>}</Card>
  </Page>;
}

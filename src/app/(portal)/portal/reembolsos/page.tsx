import { Paperclip, Plus, Receipt } from "lucide-react";
import { redirect } from "next/navigation";

import {
  ActionSheet,
  Button,
  Card,
  EmptyState,
  MoneyInput,
  RateLimitedActionForm,
  StatusBadge,
} from "@/components/fg";
import { createReimbursementAction } from "@/features/portal/actions";
import { listReimbursements, type ReimbursementListItem } from "@/features/portal/dal";
import {
  reimbursementCategories,
  reimbursementStatusLabels,
  type ReimbursementStatus,
} from "@/features/portal/rules";
import { formatDate, formatMoney } from "@/features/finance/rules";
import { getCurrentAccessContext } from "@/lib/dal";

export const dynamic = "force-dynamic";

export default async function PortalReimbursementsPage() {
  const context = await getCurrentAccessContext();
  if (!context) {
    redirect("/login");
  }

  const reimbursements = await listReimbursements(context, { ownOnly: true });

  return (
    <>
      <div className="fg-portal-page-head">
        <h1 className="fg-portal-h1">Meus reembolsos</h1>
        <NewReimbursementSheet />
      </div>

      {reimbursements.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Receipt size={32} />}
            title="Nenhum reembolso solicitado"
            description="Quando você enviar uma solicitação, ela aparecerá aqui com o acompanhamento do status."
            action={<NewReimbursementSheet />}
          />
        </Card>
      ) : (
        <div className="fg-portal-list">
          {reimbursements.map((reimbursement) => (
            <ReimbursementCard key={reimbursement.id} reimbursement={reimbursement} />
          ))}
        </div>
      )}
    </>
  );
}

function ReimbursementCard({ reimbursement }: { reimbursement: ReimbursementListItem }) {
  return (
    <article className="fg-portal-item">
      <div className="fg-portal-item-icon">
        <Receipt size={18} />
      </div>
      <div className="fg-portal-item-body">
        <div className="fg-portal-item-title">
          {reimbursement.category} ·{" "}
          <span className="fg-tabular">{formatMoney(reimbursement.amount)}</span>
        </div>
        <div className="fg-portal-item-sub">{reimbursement.title}</div>
        <div className="fg-portal-item-meta">
          <span className="fg-tabular">{formatDate(reimbursement.expenseDate)}</span>
          {reimbursement.fileId ? (
            <>
              <span>·</span>
              <Paperclip size={12} />
              <span>Comprovante anexado</span>
            </>
          ) : null}
        </div>
      </div>
      <div className="fg-portal-item-status">
        <StatusBadge
          status={mapStatus(reimbursement.status)}
          label={reimbursementStatusLabels[reimbursement.status]}
        />
      </div>
    </article>
  );
}

function NewReimbursementSheet() {
  return (
    <ActionSheet
      title="Solicitar reembolso"
      description="Sua solicitação será encaminhada ao seu gestor e depois ao financeiro."
      width={580}
      trigger={
        <Button type="button" variant="primary" icon={<Plus size={14} />}>
          Solicitar reembolso
        </Button>
      }
    >
      <RateLimitedActionForm
        action={createReimbursementAction}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div className="fg-field">
          <label className="fg-label">
            Descrição<span className="fg-required">*</span>
          </label>
          <div className="fg-input-wrap">
            <input
              className="fg-input"
              name="title"
              maxLength={180}
              required
              placeholder="Ex: Almoço com cliente — Restaurante X"
            />
          </div>
        </div>
        <div className="fg-form-row">
          <div className="fg-field">
            <label className="fg-label">
              Categoria<span className="fg-required">*</span>
            </label>
            <div className="fg-input-wrap">
              <select className="fg-input fg-select" name="category" required defaultValue="">
                <option value="" disabled>
                  Selecionar
                </option>
                {reimbursementCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="fg-field">
            <label className="fg-label">
              Valor<span className="fg-required">*</span>
            </label>
            <MoneyInput name="amount" required />
          </div>
        </div>
        <div className="fg-field">
          <label className="fg-label">
            Data da despesa<span className="fg-required">*</span>
          </label>
          <div className="fg-input-wrap">
            <input className="fg-input fg-tabular" name="expenseDate" type="date" required />
          </div>
        </div>
        <div className="fg-field">
          <label className="fg-label">Comprovante</label>
          <div className="fg-input-wrap">
            <input
              className="fg-input"
              name="file"
              type="file"
              accept=".pdf,image/*"
            />
          </div>
          <div className="fg-field-helper">PDF ou imagem · até 10 MB.</div>
        </div>
        <div className="fg-field">
          <label className="fg-label">Observações</label>
          <textarea
            className="fg-input fg-textarea"
            name="notes"
            maxLength={1000}
            rows={3}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <Button type="submit" variant="primary" icon={<Plus size={14} />}>
            Enviar para aprovação
          </Button>
        </div>
      </RateLimitedActionForm>
    </ActionSheet>
  );
}

function mapStatus(status: ReimbursementStatus) {
  switch (status) {
    case "submitted":
      return "aguardando_envio";
    case "manager_approved":
      return "enviada";
    case "finance_approved":
    case "included_in_invoice":
      return "aprovada";
    case "manager_rejected":
    case "finance_rejected":
      return "recusada";
    case "paid":
      return "pago";
    default:
      return "rascunho";
  }
}

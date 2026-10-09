import { ActionSheet, Button } from "@/components/fg";
import { createReimbursementPayableAction } from "@/features/portal/reimbursement-payable-actions";
import type { getFinanceMasterData } from "@/features/finance-master-data/dal";
import { FinancialTitleForm } from "../financeiro/financial-title-form";

export function ReimbursementPayableSheet({ id, masterData }: { id: string; masterData: Awaited<ReturnType<typeof getFinanceMasterData>> }) {
  return <ActionSheet title="Conta a pagar avulsa" description="Define a obrigação do reembolso aprovado. O pagamento será registrado e conciliado no Financeiro. Não poderá também integrar uma NF." trigger={<Button variant="outline" size="sm">Gerar conta a pagar</Button>}>
    <FinancialTitleForm action={createReimbursementPayableAction} className="fg-form">
      <input name="reimbursementId" type="hidden" value={id} />
      <label className="fg-label">Vencimento<input className="fg-input" type="date" name="dueDate" required /></label>
      <label className="fg-label">Competência<input className="fg-input" type="month" name="competence" required /></label>
      <label className="fg-label">Categoria<select aria-label="Categoria" className="fg-input fg-select" name="categoryId" required defaultValue="">
        <option value="" disabled>Selecione</option>{masterData.categories.filter(c => c.isActive && c.nature !== "income").map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select></label>
      <label className="fg-label">Centro de custo<select aria-label="Centro de custo" className="fg-input fg-select" name="costCenterId" defaultValue=""><option value="">Sem centro de custo</option>{masterData.costCenters.filter(c => c.isActive).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <Button type="submit" variant="primary">Confirmar conta a pagar</Button>
    </FinancialTitleForm>
  </ActionSheet>;
}

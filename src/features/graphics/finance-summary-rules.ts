import { centsToMoney, moneyToCents } from "@/features/finance/rules";
import type { GraphicJobFinancialStatus } from "./rules";

export type GraphicFinancialTitle = {
  amount: string;
  settled: string;
  allocated: string;
  dueDate: string;
  cancelled: boolean;
  archived: boolean;
};

/** Values are decimal strings at the boundary and integer cents during calculation. */
export function summarizeGraphicFinance(input: {
  contracted: string | null;
  receivables: GraphicFinancialTitle[];
  payables: GraphicFinancialTitle[];
  pendingMovements: number;
  today: string;
}) {
  const warnings: string[] = [];
  const aggregate = (titles: GraphicFinancialTitle[], label: string) => {
    let total = 0, settled = 0, overdue = 0, allocated = 0;
    for (const title of titles) {
      if (title.cancelled || title.archived) {
        warnings.push(`${label}: há título cancelado ou arquivado no histórico do trabalho.`);
        continue;
      }
      const amount = moneyToCents(title.amount);
      const paid = moneyToCents(title.settled);
      const linked = moneyToCents(title.allocated);
      if (paid !== linked) warnings.push(`${label}: há liquidação sem vínculo comprovado com movimentações ou saldo inconsistente.`);
      if (paid < 0 || paid > amount || linked < 0 || linked > amount) warnings.push(`${label}: saldo fora dos limites; solicite revisão ao Financeiro.`);
      total += amount;
      settled += paid;
      allocated += linked;
      if (title.dueDate < input.today && amount > paid) overdue += amount - paid;
    }
    return { total, settled, allocated, open: total - settled, overdue };
  };
  const ar = aggregate(input.receivables, "Contas a receber");
  const ap = aggregate(input.payables, "Contas a pagar");
  const contracted = input.contracted === null ? null : moneyToCents(input.contracted);
  if (contracted === null) warnings.push("Venda ainda não registrada.");
  else if (ar.total !== contracted) warnings.push("As contas a receber ativas não correspondem ao valor contratado.");
  if (!input.payables.some(row => !row.archived && !row.cancelled)) warnings.push("Nenhum custo contratado ativo foi vinculado ao trabalho.");
  if (input.pendingMovements > 0) warnings.push("Há movimentações vinculadas parcialmente ao trabalho aguardando conciliação.");
  const reliable = warnings.length === 0;
  const status: GraphicJobFinancialStatus = ar.overdue + ap.overdue > 0 ? "overdue"
    : reliable && ar.open === 0 && ap.open === 0 ? "settled"
    : ar.settled + ap.settled > 0 ? "partial"
    : ar.total + ap.total > 0 || contracted !== null ? "pending" : "not_started";
  return {
    contracted: contracted === null ? null : centsToMoney(contracted),
    receivableTotal: centsToMoney(ar.total), receivableOpen: centsToMoney(ar.open),
    received: centsToMoney(ar.allocated), payableTotal: centsToMoney(ap.total),
    payableOpen: centsToMoney(ap.open), paid: centsToMoney(ap.allocated),
    overdueReceivables: centsToMoney(ar.overdue), overduePayables: centsToMoney(ap.overdue),
    pendingMovements: input.pendingMovements, reliable, warnings: [...new Set(warnings)], status,
    contractedMargin: reliable && contracted !== null ? centsToMoney(contracted - ap.total) : null,
    cashResult: reliable ? centsToMoney(ar.allocated - ap.allocated) : null,
  };
}

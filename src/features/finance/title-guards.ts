import { moneyToCents } from "./rules";

export class FinancialTitleCorrectionError extends Error {}

export function assertTitleCorrectionAllowed(input: {
  cancelled: boolean;
  amount: string;
  settledAmount: string;
  generated: boolean;
  economicFieldsChanged: boolean;
  counterpartyChanged: boolean;
  cancellation?: boolean;
  nextAmount?: string;
}) {
  if (input.cancelled) throw new FinancialTitleCorrectionError("Título cancelado não pode ser alterado.");
  const settled = moneyToCents(input.settledAmount);
  if (input.cancellation && settled > 0) {
    throw new FinancialTitleCorrectionError("Estorne as movimentações conciliadas antes de cancelar. Baixas históricas exigem revisão explícita.");
  }
  if (input.generated && (input.cancellation || input.economicFieldsChanged)) {
    throw new FinancialTitleCorrectionError("O título possui uma origem vinculada. Valor, contraparte, competência e cancelamento devem ser tratados na origem para preservar o vínculo.");
  }
  if (input.counterpartyChanged && settled > 0) {
    throw new FinancialTitleCorrectionError("Estorne a liquidação antes de alterar a contraparte.");
  }
  if (input.nextAmount && moneyToCents(input.nextAmount) < settled) {
    throw new FinancialTitleCorrectionError("O valor não pode ser menor que o montante já liquidado.");
  }
}

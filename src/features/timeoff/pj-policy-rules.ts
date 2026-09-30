import { z } from "zod";
import { centsToMoney, moneyToCents } from "@/features/finance/rules";
import { getPjTenureReference } from "./pj-reference-rules";

export const pjDefaultDays = 15;
export const pjDaysSchema = z.coerce.number().int().min(1).max(3650);

export function suggestPjSale(baseAmount: string, days: number) {
  const quantity = pjDaysSchema.parse(days);
  const baseCents = moneyToCents(baseAmount);
  if (baseCents <= 0) throw new Error("Remuneração atual deve ser maior que zero.");
  // BigInt keeps the multiplication exact; round only the final positive amount.
  const result = (BigInt(baseCents) * BigInt(quantity) + BigInt(15)) / BigInt(30);
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("Valor excede o limite suportado.");
  const amount = centsToMoney(Number(result));
  moneyToCents(amount);
  return { baseAmount: centsToMoney(baseCents), days: quantity, divisor: 30, amount };
}

export type PjBalanceRequest = {
  type: string; status: string; startDate: string; endDate: string; soldDays: number;
};

export function calculatePjBalance(startDate: string, today: string, requests: readonly PjBalanceRequest[]) {
  const acquired = getPjTenureReference(startDate, null, today).years * 30;
  let reserved = 0, used = 0, sold = 0;
  for (const request of requests) {
    if (!["requested", "approved"].includes(request.status)) continue;
    if (!["vacation", "planned_pause", "sale"].includes(request.type)) continue;
    const restDays = request.type === "sale" ? 0 : Math.floor((Date.parse(request.endDate) - Date.parse(request.startDate)) / 86_400_000) + 1;
    const quantity = restDays + request.soldDays;
    if (request.status === "requested") reserved += quantity;
    else { used += restDays; sold += request.soldDays; }
  }
  return { acquired, reserved, used, sold, available: acquired - reserved - used - sold };
}

export class PjTimeOffError extends Error {}

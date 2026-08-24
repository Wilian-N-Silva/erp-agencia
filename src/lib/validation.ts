import { z } from "zod";

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const isoMonthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isoDateSchema = z.string().trim().refine(isIsoDate, {
  message: "Invalid date.",
});

export const isoMonthSchema = z.string().trim().refine(isIsoMonth, {
  message: "Invalid month.",
});

export function isIsoDate(value: string) {
  const match = isoDatePattern.exec(value);

  if (!match) return false;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isIsoMonth(value: string) {
  return isoMonthPattern.test(value);
}

export function formDataToObject(
  formData: FormData,
  excludedKeys: readonly string[] = [],
) {
  const input = Object.fromEntries(formData.entries());

  for (const key of excludedKeys) {
    delete input[key];
  }

  return input;
}

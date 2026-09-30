export function getPjReferenceToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function shiftedDate(start: string, months: number) {
  const [year, month, day] = start.split("-").map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}

export function getPjTenureReference(startDate: string, endDate: string | null, today: string, terminated = false) {
  const asOf = endDate && endDate < today ? endDate : today;
  const future = startDate > today;
  const [startYear, startMonth] = startDate.split("-").map(Number);
  const [year, month] = asOf.split("-").map(Number);
  let months = Math.max(0, (year - startYear) * 12 + month - startMonth);
  if (months > 0 && shiftedDate(startDate, months) > asOf) months--;
  const days = startDate > asOf ? 0 : Math.floor((Date.parse(asOf) - Date.parse(shiftedDate(startDate, months))) / 86_400_000);
  const completedYears = Math.floor(months / 12);
  const ended = terminated || Boolean(endDate && endDate <= today);
  return {
    years: completedYears, months: months % 12, days, future, ended,
    lastReference: completedYears > 0 ? shiftedDate(startDate, completedYears * 12) : null,
    nextReference: ended ? null : shiftedDate(startDate, (completedYears + 1) * 12),
    asOf,
  };
}

export function formatPjTenure(value: ReturnType<typeof getPjTenureReference>) {
  if (value.future) return "Vínculo ainda não iniciado";
  return `${value.years} ano(s), ${value.months} mês(es) e ${value.days} dia(s)`;
}

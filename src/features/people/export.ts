import { z } from "zod";

import { formatDate } from "@/features/finance/rules";

import type { EmployeeDetail } from "./dal";
import {
  employeeStatusLabels,
  employmentTypeLabels,
  type EmployeeListItem,
  type EmployeeStatus,
  type EmploymentType,
} from "./rules";

const employeeStatusSchema = z.enum(
  Object.keys(employeeStatusLabels) as [EmployeeStatus, ...EmployeeStatus[]],
);
const employmentTypeSchema = z.enum(
  Object.keys(employmentTypeLabels) as [EmploymentType, ...EmploymentType[]],
);
const exportFiltersSchema = z
  .object({
    area: z.array(z.string().trim().min(1).max(180)).max(50),
    employmentType: z.array(employmentTypeSchema).max(20),
    position: z.array(z.string().trim().min(1).max(180)).max(50),
    query: z.string().trim().max(180).optional(),
    sortDir: z.enum(["asc", "desc"]),
    sortKey: z.enum([
      "areaName",
      "employmentType",
      "fullName",
      "managerName",
      "registrationNumber",
      "startDate",
      "status",
      "tenureMonths",
    ]),
    status: z.array(employeeStatusSchema).max(20),
  })
  .strict();

export type PeopleExportFilters = z.infer<typeof exportFiltersSchema>;

export function parsePeopleExportFilters(
  searchParams: URLSearchParams,
): PeopleExportFilters {
  return exportFiltersSchema.parse({
    area: searchParams.getAll("area"),
    employmentType: searchParams.getAll("employmentType"),
    position: searchParams.getAll("position"),
    query: searchParams.get("q") || undefined,
    sortDir: searchParams.get("sortDir") || "asc",
    sortKey: searchParams.get("sortKey") || "fullName",
    status: searchParams.getAll("status"),
  });
}

export function filterPeopleForExport(
  employees: readonly EmployeeListItem[],
  filters: PeopleExportFilters,
) {
  const query = filters.query?.toLowerCase();
  const direction = filters.sortDir === "asc" ? 1 : -1;

  return employees
    .filter((employee) => {
      const displayName = employee.socialName || employee.fullName;

      return (
        (!query ||
          [
            displayName,
            employee.fullName,
            employee.registrationNumber,
            employee.corporateEmail ?? "",
            employee.positionName,
            employee.areaName,
            employee.managerName ?? "",
          ].some((value) => value.toLowerCase().includes(query))) &&
        (filters.status.length === 0 ||
          filters.status.includes(employee.status)) &&
        (filters.employmentType.length === 0 ||
          filters.employmentType.includes(employee.employmentType)) &&
        (filters.area.length === 0 || filters.area.includes(employee.areaName)) &&
        (filters.position.length === 0 ||
          filters.position.includes(employee.positionName))
      );
    })
    .sort((first, second) => {
      const firstValue = employeeSortValue(first, filters.sortKey);
      const secondValue = employeeSortValue(second, filters.sortKey);

      if (firstValue < secondValue) return -1 * direction;
      if (firstValue > secondValue) return direction;
      return 0;
    });
}

function formatTenure(months: number) {
  if (months < 12) return `${months}m`;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  return remainingMonths === 0 ? `${years}a` : `${years}a ${remainingMonths}m`;
}

const peopleCsvHeaders = [
  "Matricula",
  "Nome",
  "Area",
  "Cargo",
  "Vinculo",
  "Status",
  "Gestor",
  "Entrada",
  "Tempo de casa",
];

export function buildPeopleCsv(employees: readonly EmployeeListItem[]) {
  const rows = [
    peopleCsvHeaders,
    ...employees.map((employee) => [
      employee.registrationNumber,
      employee.socialName || employee.fullName,
      employee.areaName,
      employee.positionName,
      employmentTypeLabels[employee.employmentType],
      employeeStatusLabels[employee.status],
      employee.managerName ?? "",
      formatDate(employee.startDate),
      formatTenure(employee.tenureMonths),
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(";")).join("\n");
}

export function buildEmployeeProfile(employee: EmployeeDetail) {
  const lines = [
    "Ficha do colaborador",
    "",
    `Matricula: ${employee.registrationNumber}`,
    `Nome: ${employee.fullName}`,
    employee.socialName ? `Nome social: ${employee.socialName}` : null,
    `Status: ${employeeStatusLabels[employee.status]}`,
    `Vinculo: ${employmentTypeLabels[employee.employmentType]}`,
    `Area: ${employee.areaName}`,
    `Cargo: ${employee.positionName}`,
    `Gestor: ${employee.managerName ?? "-"}`,
    `Entrada: ${formatDate(employee.startDate)}`,
    `Saida: ${formatDate(employee.endDate)}`,
    `Modelo: ${employee.workModel ?? "-"}`,
    `Localizacao: ${employee.location ?? "-"}`,
    `Email corporativo: ${employee.corporateEmail ?? "-"}`,
    `Email pessoal: ${employee.sensitiveProfileHidden ? "Restrito" : employee.personalEmail ?? "-"}`,
    `Telefone: ${employee.sensitiveProfileHidden ? "Restrito" : employee.phone ?? "-"}`,
  ].filter(Boolean);

  return lines.join("\n");
}

export function employeeProfileFileName(employee: EmployeeDetail) {
  return `ficha-${safeFileName(employee.registrationNumber || employee.fullName)}.txt`;
}

function employeeSortValue(
  employee: EmployeeListItem,
  key: PeopleExportFilters["sortKey"],
) {
  switch (key) {
    case "fullName":
      return (employee.socialName || employee.fullName).toLowerCase();
    case "employmentType":
      return employmentTypeLabels[employee.employmentType];
    case "status":
      return employeeStatusLabels[employee.status];
    case "managerName":
      return employee.managerName ?? "";
    case "tenureMonths":
      return employee.tenureMonths;
    case "startDate":
      return String(employee.startDate);
    default:
      return employee[key].toLowerCase();
  }
}

function escapeCsvCell(value: string) {
  const normalized = value.replace(/\r?\n/g, " ");

  return /[;"]/.test(normalized)
    ? `"${normalized.replace(/"/g, '""')}"`
    : normalized;
}

function safeFileName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

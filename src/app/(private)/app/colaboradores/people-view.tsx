"use client";

import {
  BadgeDollarSign,
  Download,
  Eye,
  MoreHorizontal,
  Pencil,
  UserPlus,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  Avatar,
  DataTable,
  Dropdown,
  FilterPopover,
  Page,
  PageHeader,
  Pagination,
  StatusBadge,
  Tag,
  Toolbar,
  useToast,
} from "@/components/fg";
import type { DataTableColumn, SortDir } from "@/components/fg/data-table";
import { formatDate } from "@/features/finance/rules";
import type {
  EmployeeListItem,
  EmployeeStatus,
  EmploymentType,
  PeopleFilters,
} from "@/features/people/rules";
import {
  downloadFile,
  fileDownloadErrorFeedback,
} from "@/lib/client-file-download";

type FilterOption = { id: string; name: string };

interface PeopleViewProps {
  employees: EmployeeListItem[];
  filterOptions: {
    areas: FilterOption[];
    positions: FilterOption[];
  };
  initialFilters: PeopleFilters;
  canWrite: boolean;
}

const employeeStatusLabels: Record<EmployeeStatus, string> = {
  active: "Ativo",
  on_vacation: "Em ferias",
  away: "Afastado",
  notice: "Em aviso",
  terminated: "Desligado",
  paused: "Pausado",
  occasional_freelancer: "Freelancer eventual",
};

const employmentTypeLabels: Record<EmploymentType, string> = {
  clt: "CLT",
  pj: "PJ",
  intern: "Estagio",
  freelancer: "Freelancer",
  partner: "Socio",
  temporary: "Temporario",
  other: "Outro",
};

const statusOptions = Object.values(employeeStatusLabels);
const employmentOptions = Object.values(employmentTypeLabels);

export function PeopleView({
  employees,
  filterOptions,
  initialFilters,
  canWrite,
}: PeopleViewProps) {
  const pushToast = useToast();
  const [search, setSearch] = useState(initialFilters.query ?? "");
  const [statusFilter, setStatusFilter] = useState<string[]>(
    initialFilters.status && initialFilters.status !== "all"
      ? [employeeStatusLabels[initialFilters.status]]
      : [],
  );
  const [employmentFilter, setEmploymentFilter] = useState<string[]>([]);
  const [areaFilter, setAreaFilter] = useState<string[]>(
    initialFilters.areaId
      ? [
          filterOptions.areas.find((area) => area.id === initialFilters.areaId)?.name ??
            "",
        ].filter(Boolean)
      : [],
  );
  const [positionFilter, setPositionFilter] = useState<string[]>(
    initialFilters.positionId
      ? [
          filterOptions.positions.find(
            (position) => position.id === initialFilters.positionId,
          )?.name ?? "",
        ].filter(Boolean)
      : [],
  );
  const [density, setDensity] = useState<"regular" | "compact">("regular");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [exporting, setExporting] = useState(false);
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({
    key: "fullName",
    dir: "asc",
  });

  const onSort = (key: string) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  };

  const resetPage = () => setPage(1);
  const updateSearch = (value: string) => {
    setSearch(value);
    resetPage();
  };
  const updateStatusFilter = (value: string[]) => {
    setStatusFilter(value);
    resetPage();
  };
  const updateEmploymentFilter = (value: string[]) => {
    setEmploymentFilter(value);
    resetPage();
  };
  const updateAreaFilter = (value: string[]) => {
    setAreaFilter(value);
    resetPage();
  };
  const updatePositionFilter = (value: string[]) => {
    setPositionFilter(value);
    resetPage();
  };

  const areaOptions = useMemo(
    () => uniqueSorted(employees.map((employee) => employee.areaName)),
    [employees],
  );
  const positionOptions = useMemo(
    () => uniqueSorted(employees.map((employee) => employee.positionName)),
    [employees],
  );

  const counts = useMemo(() => {
    const visibleActive = employees.filter((employee) => employee.status !== "terminated");
    return {
      active: employees.filter((employee) => employee.status === "active").length,
      clt: visibleActive.filter((employee) => employee.employmentType === "clt").length,
      pj: visibleActive.filter((employee) => employee.employmentType === "pj").length,
      intern: visibleActive.filter((employee) => employee.employmentType === "intern").length,
    };
  }, [employees]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const dir = sort.dir === "asc" ? 1 : -1;

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
          (statusFilter.length === 0 ||
            statusFilter.includes(employeeStatusLabels[employee.status])) &&
          (employmentFilter.length === 0 ||
            employmentFilter.includes(employmentTypeLabels[employee.employmentType])) &&
          (areaFilter.length === 0 || areaFilter.includes(employee.areaName)) &&
          (positionFilter.length === 0 ||
            positionFilter.includes(employee.positionName))
        );
      })
      .sort((a, b) => {
        const av = employeeSortValue(a, sort.key);
        const bv = employeeSortValue(b, sort.key);

        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
  }, [
    employees,
    areaFilter,
    employmentFilter,
    positionFilter,
    search,
    sort,
    statusFilter,
  ]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const exportFiltered = async () => {
    const params = buildExportSearchParams({
      areaFilter,
      employmentFilter,
      positionFilter,
      search,
      sort,
      statusFilter,
    });

    setExporting(true);
    try {
      await downloadFile(
        `/app/colaboradores/exportar?${params.toString()}`,
        "colaboradores.csv",
      );
    } catch (error) {
      pushToast({
        ...fileDownloadErrorFeedback(error),
        tone: "error",
      });
    } finally {
      setExporting(false);
    }
  };

  const columns: DataTableColumn<EmployeeListItem>[] = [
    {
      key: "registrationNumber",
      label: "Matricula",
      sortable: true,
      render: (employee) => (
        <span className="fg-tabular fg-muted">{employee.registrationNumber}</span>
      ),
    },
    {
      key: "fullName",
      label: "Nome",
      sortable: true,
      render: (employee) => {
        const displayName = employee.socialName || employee.fullName;

        return (
          <Link
            className="fg-cell-user fg-cell-link"
            href={`/app/colaboradores/${employee.id}` as Route}
          >
            <Avatar
              name={displayName}
              size={28}
              dimmed={employee.status === "terminated"}
            />
            <div>
              <div className="fg-cell-strong">{displayName}</div>
              <div className="fg-cell-sub">{employee.positionName}</div>
            </div>
          </Link>
        );
      },
    },
    {
      key: "areaName",
      label: "Area",
      sortable: true,
      render: (employee) => <Tag>{employee.areaName}</Tag>,
    },
    {
      key: "employmentType",
      label: "Vinculo",
      sortable: true,
      render: (employee) => <Tag>{employmentTypeLabels[employee.employmentType]}</Tag>,
    },
    {
      key: "status",
      label: "Status",
      render: (employee) => (
        <EmployeeStatusBadge status={employee.status} />
      ),
    },
    {
      key: "startDate",
      label: "Entrada",
      sortable: true,
      render: (employee) => (
        <span className="fg-tabular fg-muted">{formatDate(employee.startDate)}</span>
      ),
    },
    {
      key: "managerName",
      label: "Gestor",
      sortable: true,
      render: (employee) => (
        employee.managerName ? (
          <div className="fg-cell-user">
            <Avatar name={employee.managerName} size={20} />
            <span>{employee.managerName.split(" ")[0]}</span>
          </div>
        ) : (
          <span className="fg-muted">-</span>
        )
      ),
    },
    {
      key: "tenureMonths",
      label: "Tempo de casa",
      sortable: true,
      align: "right",
      render: (employee) => (
        <span className="fg-tabular fg-muted">
          {formatTenure(employee.tenureMonths)}
        </span>
      ),
    },
    {
      key: "_actions",
      label: "",
      width: 44,
      render: (employee) => <EmployeeRowMenu employee={employee} canWrite={canWrite} />,
    },
  ];

  return (
    <Page>
      <PageHeader
        eyebrow="Pessoas"
        title="Colaboradores"
        description={`${counts.active} ativos - ${counts.clt} CLT - ${counts.pj} PJ - ${counts.intern} estagios`}
        actions={
          <>
            <button
              className="fg-btn fg-btn-outline fg-btn-sm"
              type="button"
              aria-busy={exporting}
              disabled={exporting}
              onClick={exportFiltered}
            >
              <Download size={14} aria-hidden />
              <span>{exporting ? "Exportando..." : "Exportar"}</span>
            </button>
            {canWrite ? (
              <Link
                className="fg-btn fg-btn-primary fg-btn-sm"
                href={"/app/colaboradores/novo" as Route}
              >
                <UserPlus size={14} aria-hidden />
                <span>Iniciar admissao</span>
              </Link>
            ) : null}
          </>
        }
      />

      <Toolbar
        search={search}
        onSearch={updateSearch}
        placeholder="Nome, matricula, email ou cargo..."
        filters={
          <>
            <FilterPopover
              label="Status"
              value={statusFilter}
              onChange={updateStatusFilter}
              options={statusOptions}
            />
            <FilterPopover
              label="Vinculo"
              value={employmentFilter}
              onChange={updateEmploymentFilter}
              options={employmentOptions}
            />
            <FilterPopover
              label="Area"
              value={areaFilter}
              onChange={updateAreaFilter}
              options={areaOptions}
            />
            <FilterPopover
              label="Cargo"
              value={positionFilter}
              onChange={updatePositionFilter}
              options={positionOptions}
            />
          </>
        }
        density={density}
        onDensity={setDensity}
      />

      <DataTable
        columns={columns}
        data={paged}
        getRowKey={(employee) => employee.id}
        sortKey={sort.key}
        sortDir={sort.dir}
        onSort={onSort}
        density={density}
        rowAttention={(employee) =>
          employee.status === "notice" || employee.status === "terminated"
            ? "danger"
            : null
        }
        emptyMessage="Nenhum colaborador para os filtros selecionados."
      />

      <Pagination
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPage={setPage}
        onPageSize={(value) => {
          setPageSize(value);
          setPage(1);
        }}
      />
    </Page>
  );
}

function EmployeeRowMenu({
  employee,
  canWrite,
}: {
  employee: EmployeeListItem;
  canWrite: boolean;
}) {
  const profileHref = `/app/colaboradores/${employee.id}`;
  const items = [
    {
      label: "Abrir perfil",
      icon: <Eye size={14} />,
      onClick: () => {
        window.location.href = profileHref;
      },
    },
    {
      label: "Remuneracao",
      icon: <BadgeDollarSign size={14} />,
      onClick: () => {
        window.location.href = `${profileHref}/remuneracao`;
      },
    },
  ];

  if (canWrite) {
    items.push({
      label: "Editar cadastro",
      icon: <Pencil size={14} />,
      onClick: () => {
        window.location.href = profileHref;
      },
    });
  }

  return (
    <Dropdown
      align="right"
      trigger={
        <button
          type="button"
          className="fg-icon-btn sm"
          title="Acoes"
          aria-label="Acoes"
        >
          <MoreHorizontal size={14} />
        </button>
      }
      items={items}
    />
  );
}

function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  if (status === "active") {
    return <StatusBadge status="ativo" label={employeeStatusLabels[status]} />;
  }

  if (status === "terminated") {
    return <StatusBadge status="desligado" label={employeeStatusLabels[status]} />;
  }

  if (status === "paused") {
    return <StatusBadge status="pausado" label={employeeStatusLabels[status]} />;
  }

  if (status === "occasional_freelancer") {
    return (
      <StatusBadge tone="brand" label={employeeStatusLabels[status]} />
    );
  }

  return (
    <StatusBadge tone="warning" label={employeeStatusLabels[status]} />
  );
}

function employeeSortValue(employee: EmployeeListItem, key: string) {
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
    default: {
      const value = (employee as unknown as Record<string, unknown>)[key];
      if (typeof value === "number") return value;
      if (typeof value === "string") return value.toLowerCase();
      return "";
    }
  }
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function formatTenure(months: number) {
  if (months < 12) return `${months}m`;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  return remainingMonths === 0 ? `${years}a` : `${years}a ${remainingMonths}m`;
}

function buildExportSearchParams(input: {
  areaFilter: string[];
  employmentFilter: string[];
  positionFilter: string[];
  search: string;
  sort: { key: string; dir: SortDir };
  statusFilter: string[];
}) {
  const params = new URLSearchParams();

  if (input.search.trim()) params.set("q", input.search.trim());
  params.set("sortKey", input.sort.key);
  params.set("sortDir", input.sort.dir);
  input.areaFilter.forEach((area) => params.append("area", area));
  input.positionFilter.forEach((position) =>
    params.append("position", position),
  );

  Object.entries(employeeStatusLabels).forEach(([status, label]) => {
    if (input.statusFilter.includes(label)) params.append("status", status);
  });
  Object.entries(employmentTypeLabels).forEach(([employmentType, label]) => {
    if (input.employmentFilter.includes(label)) {
      params.append("employmentType", employmentType);
    }
  });

  return params;
}

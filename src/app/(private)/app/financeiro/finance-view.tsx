"use client";

import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  Download,
  Repeat,
  Wallet,
} from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  Button,
  Chips,
  DataTable,
  Dropdown,
  FilterPopover,
  KpiCard,
  Page,
  PageHeader,
  Pagination,
  StatusBadge,
  Tabs,
  Tag,
  Toolbar,
} from "@/components/fg";
import type { DataTableColumn, SortDir } from "@/components/fg/data-table";
import type {
  FinanceDashboard,
  FinanceEntryListItem,
  FinanceExpenseListItem,
  ProvisionListItem,
} from "@/features/finance/dal";
import {
  centsToMoney,
  financialEntryStatusLabels,
  financialExpenseStatusLabels,
  formatCompetence,
  formatDate,
  formatMoney,
  moneyToCents,
  toDateKey,
  type FinancialEntryStatus,
  type FinancialExpenseStatus,
} from "@/features/finance/rules";

type Tab = "entradas" | "saidas" | "provisoes";

const tabLabel: Record<Tab, string> = {
  entradas: "Contas a receber",
  saidas: "Contas a pagar",
  provisoes: "Provisoes",
};

const entryStatusOptions = Object.values(financialEntryStatusLabels);
const expenseStatusOptions = Object.values(financialExpenseStatusLabels);
const provisionStatusOptions = ["Ativa", "Inativa"];

interface Props {
  dashboard: FinanceDashboard;
  canWrite: boolean;
  canExport: boolean;
  exportHref: string;
  exportXlsxHref: string;
  initialTab?: Tab;
  newEntryAction?: ReactNode;
  newExpenseAction?: ReactNode;
  newProvisionAction?: ReactNode;
  entryActions?: Record<string, ReactNode>;
  expenseActions?: Record<string, ReactNode>;
  provisionActions?: Record<string, ReactNode>;
}

export function FinanceView({
  dashboard,
  canExport,
  exportHref,
  exportXlsxHref,
  initialTab = "entradas",
  newEntryAction,
  newExpenseAction,
  newProvisionAction,
  entryActions,
  expenseActions,
  provisionActions,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState(dashboard.filters.competence ?? dashboard.competence);
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [clientFilter, setClientFilter] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [costCenterFilter, setCostCenterFilter] = useState<string[]>([]);
  const [density, setDensity] = useState<"regular" | "compact">("regular");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: string; dir: SortDir }>({
    key: "dueDate",
    dir: "asc",
  });

  const monthOptions = useMemo(() => buildMonthOptions(dashboard), [dashboard]);
  const clientOptions = useMemo(
    () =>
      uniqueSorted(
        dashboard.entries.map((entry) => entry.clientName ?? "Sem cliente"),
      ),
    [dashboard.entries],
  );
  const expenseCategoryOptions = useMemo(
    () => uniqueSorted(dashboard.expenses.map((expense) => expense.category)),
    [dashboard.expenses],
  );
  const costCenterOptions = useMemo(
    () =>
      uniqueSorted(
        dashboard.expenses
          .map((expense) => expense.costCenter)
          .filter((value): value is string => Boolean(value)),
      ),
    [dashboard.expenses],
  );
  const provisionCategoryOptions = useMemo(
    () => uniqueSorted(dashboard.provisions.map((provision) => provision.category)),
    [dashboard.provisions],
  );

  const filteredEntries = useMemo(
    () =>
      filterEntries(dashboard.entries, {
        clientFilter,
        month,
        search,
        statusFilter,
      }),
    [dashboard.entries, clientFilter, month, search, statusFilter],
  );
  const filteredExpenses = useMemo(
    () =>
      filterExpenses(dashboard.expenses, {
        categoryFilter,
        costCenterFilter,
        month,
        search,
        statusFilter,
      }),
    [
      dashboard.expenses,
      categoryFilter,
      costCenterFilter,
      month,
      search,
      statusFilter,
    ],
  );
  const filteredProvisions = useMemo(
    () =>
      filterProvisions(dashboard.provisions, {
        categoryFilter,
        search,
        statusFilter,
      }),
    [dashboard.provisions, categoryFilter, search, statusFilter],
  );

  const onSort = (key: string) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  };

  const resetListingState = () => {
    setPage(1);
    setSelected([]);
  };

  const updateSearch = (value: string) => {
    setSearch(value);
    resetListingState();
  };
  const updateStatusFilter = (value: string[]) => {
    setStatusFilter(value);
    resetListingState();
  };
  const updateClientFilter = (value: string[]) => {
    setClientFilter(value);
    resetListingState();
  };
  const updateCategoryFilter = (value: string[]) => {
    setCategoryFilter(value);
    resetListingState();
  };
  const updateCostCenterFilter = (value: string[]) => {
    setCostCenterFilter(value);
    resetListingState();
  };
  const updateMonth = (value: string) => {
    setMonth(value);
    resetListingState();
  };

  const switchTab = (next: string) => {
    const tabValue = next as Tab;
    setTab(tabValue);
    setSearch("");
    setStatusFilter([]);
    setClientFilter([]);
    setCategoryFilter([]);
    setCostCenterFilter([]);
    resetListingState();
    setSort({
      key: tabValue === "provisoes" ? "estimatedMonthlyAmount" : "dueDate",
      dir: tabValue === "provisoes" ? "desc" : "asc",
    });
    router.push(`/app/financeiro/${tabValue}` as Route);
  };

  const kpis = [
    {
      label: "Contas a receber",
      value: formatMoney(dashboard.totals.incomeExpected),
      secondary: `Competencia ${formatCompetence(dashboard.competence)}`,
      icon: <ArrowDownRight size={16} />,
    },
    {
      label: "Recebimentos liquidados",
      value: formatMoney(dashboard.totals.incomeReceived),
      secondary: "Realizado",
      icon: <Wallet size={16} />,
    },
    {
      label: "Contas a pagar",
      value: formatMoney(dashboard.totals.expensesExpected),
      secondary: `Competencia ${formatCompetence(dashboard.competence)}`,
      icon: <ArrowUpRight size={16} />,
    },
    {
      label: "Previsto 30 dias",
      value: formatMoney(dashboard.totals.forecast30Days),
      secondary: "Fluxo",
      icon: <CalendarClock size={16} />,
    },
    {
      label: "Provisoes",
      value: formatMoney(dashboard.totals.provisionsExpected),
      secondary: "Recorrente mensal",
      icon: <Repeat size={16} />,
    },
  ];

  const header = getHeaderSummary({
    entries: filteredEntries,
    expenses: filteredExpenses,
    provisions: filteredProvisions,
    tab,
  });

  return (
    <Page>
      <PageHeader
        eyebrow="Financeiro"
        title={tabLabel[tab]}
        description={header}
        actions={
          <>
            {canExport ? (
              <Dropdown
                trigger={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={<Download size={14} />}
                  >
                    Exportar
                  </Button>
                }
                items={[
                  {
                    label: "Exportar CSV",
                    onClick: () => {
                      window.location.href = exportHref;
                    },
                  },
                  {
                    label: "Exportar XLSX",
                    onClick: () => {
                      window.location.href = exportXlsxHref;
                    },
                  },
                ]}
              />
            ) : null}
            {tab === "entradas" ? newEntryAction : null}
            {tab === "saidas" ? newExpenseAction : null}
            {tab === "provisoes" ? newProvisionAction : null}
          </>
        }
        tabs={
          <Tabs
            value={tab}
            onChange={switchTab}
            items={[
              {
                value: "entradas",
                label: tabLabel.entradas,
                count: dashboard.entries.length,
              },
              {
                value: "saidas",
                label: tabLabel.saidas,
                count: dashboard.expenses.length,
              },
              {
                value: "provisoes",
                label: tabLabel.provisoes,
                count: dashboard.provisions.length,
              },
            ]}
          />
        }
      />

      <div className="fg-grid fg-grid-kpis">
        {kpis.map((kpi, index) => (
          <KpiCard
            key={kpi.label}
            label={kpi.label}
            value={kpi.value}
            secondary={kpi.secondary}
            icon={kpi.icon}
            accent={index === 0}
          />
        ))}
      </div>

      {tab !== "provisoes" ? (
        <div className="fg-financeiro-row">
          <Chips value={month} onChange={updateMonth} items={monthOptions} />
          <span className="fg-muted" style={{ fontSize: 12 }}>
            Competencia da listagem
          </span>
        </div>
      ) : null}

      {tab === "entradas" ? (
        <EntriesTab
          rows={filteredEntries}
          search={search}
          onSearch={updateSearch}
          statusFilter={statusFilter}
          onStatusFilter={updateStatusFilter}
          clientFilter={clientFilter}
          onClientFilter={updateClientFilter}
          clientOptions={clientOptions}
          density={density}
          onDensity={setDensity}
          page={page}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={(value) => {
            setPageSize(value);
            resetListingState();
          }}
          sort={sort}
          onSort={onSort}
          selected={selected}
          onSelected={setSelected}
          actionsMap={entryActions}
        />
      ) : null}

      {tab === "saidas" ? (
        <ExpensesTab
          rows={filteredExpenses}
          search={search}
          onSearch={updateSearch}
          statusFilter={statusFilter}
          onStatusFilter={updateStatusFilter}
          categoryFilter={categoryFilter}
          onCategoryFilter={updateCategoryFilter}
          categoryOptions={expenseCategoryOptions}
          costCenterFilter={costCenterFilter}
          onCostCenterFilter={updateCostCenterFilter}
          costCenterOptions={costCenterOptions}
          density={density}
          onDensity={setDensity}
          page={page}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={(value) => {
            setPageSize(value);
            resetListingState();
          }}
          sort={sort}
          onSort={onSort}
          selected={selected}
          onSelected={setSelected}
          actionsMap={expenseActions}
        />
      ) : null}

      {tab === "provisoes" ? (
        <ProvisionsTab
          rows={filteredProvisions}
          search={search}
          onSearch={updateSearch}
          statusFilter={statusFilter}
          onStatusFilter={updateStatusFilter}
          categoryFilter={categoryFilter}
          onCategoryFilter={updateCategoryFilter}
          categoryOptions={provisionCategoryOptions}
          density={density}
          onDensity={setDensity}
          page={page}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={(value) => {
            setPageSize(value);
            resetListingState();
          }}
          sort={sort}
          onSort={onSort}
          selected={selected}
          onSelected={setSelected}
          actionsMap={provisionActions}
        />
      ) : null}
    </Page>
  );
}

function EntriesTab({
  rows,
  search,
  onSearch,
  statusFilter,
  onStatusFilter,
  clientFilter,
  onClientFilter,
  clientOptions,
  density,
  onDensity,
  page,
  pageSize,
  onPage,
  onPageSize,
  sort,
  onSort,
  selected,
  onSelected,
  actionsMap,
}: {
  rows: FinanceEntryListItem[];
  search: string;
  onSearch: (value: string) => void;
  statusFilter: string[];
  onStatusFilter: (value: string[]) => void;
  clientFilter: string[];
  onClientFilter: (value: string[]) => void;
  clientOptions: string[];
  density: "regular" | "compact";
  onDensity: (value: "regular" | "compact") => void;
  page: number;
  pageSize: number;
  onPage: (value: number) => void;
  onPageSize: (value: number) => void;
  sort: { key: string; dir: SortDir };
  onSort: (key: string) => void;
  selected: string[];
  onSelected: (value: string[]) => void;
  actionsMap?: Record<string, ReactNode>;
}) {
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
  const selectedRows = sorted.filter((entry) => selected.includes(entry.id));
  const selectedTotal = selectedRows.reduce(
    (total, entry) => total + moneyToCents(entry.amount),
    0,
  );

  const columns: DataTableColumn<FinanceEntryListItem>[] = [
    {
      key: "clientName",
      label: "Cliente / descricao",
      sortable: true,
      render: (row) => (
        <div className="fg-cell-strong">
          {row.clientName ?? "Sem cliente"}
          <div className="fg-cell-sub">{row.description}</div>
        </div>
      ),
    },
    {
      key: "competence",
      label: "Comp.",
      sortable: true,
      render: (row) => (
        <span className="fg-tabular fg-muted">
          {formatCompetence(row.competence)}
        </span>
      ),
    },
    {
      key: "dueDate",
      label: "Vencimento",
      sortable: true,
      render: (row) => (
        <div className="fg-cell-strong fg-tabular">
          {formatDayMonth(row.dueDate)}
          <div className="fg-cell-sub">{relativeDateLabel(row.dueDate)}</div>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Valor original",
      sortable: true,
      align: "right",
      render: (row) => <span className="fg-tabular">{formatMoney(row.amount)}</span>,
    },
    {
      key: "settledAmount",
      label: "Liquidado",
      sortable: true,
      align: "right",
      render: (row) => (
        <span
          className={`fg-tabular ${
            row.status === "settled" ? "fg-good" : "fg-muted"
          }`.trim()}
        >
          {moneyToCents(row.settledAmount) > 0 ? formatMoney(row.settledAmount) : "-"}
        </span>
      ),
    },
    {
      key: "settlementDate",
      label: "Liquidação",
      sortable: true,
      render: (row) => (
        <span className="fg-tabular fg-muted">{formatDate(row.settlementDate)}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <StatusBadge
          status={mapEntryStatus(row.status)}
          label={financialEntryStatusLabels[row.status]}
        />
      ),
    },
    {
      key: "recurring",
      label: "Recorrente",
      render: (row) =>
        row.recurring ? <Tag>Recorrente</Tag> : <span className="fg-muted">-</span>,
    },
  ];

  if (actionsMap) {
    columns.push({
      key: "_actions",
      label: "",
      width: 72,
      render: (row) => actionsMap[row.id] ?? null,
    });
  }

  return (
    <>
      <Toolbar
        search={search}
        onSearch={onSearch}
        placeholder="Buscar cliente ou descricao..."
        filters={
          <>
            <FilterPopover
              label="Status"
              value={statusFilter}
              onChange={onStatusFilter}
              options={entryStatusOptions}
            />
            <FilterPopover
              label="Cliente"
              value={clientFilter}
              onChange={onClientFilter}
              options={clientOptions}
            />
          </>
        }
        density={density}
        onDensity={onDensity}
      />
      <DataTable
        columns={columns}
        data={paged}
        getRowKey={(row) => row.id}
        sortKey={sort.key}
        sortDir={sort.dir}
        onSort={onSort}
        selected={selected}
        onSelect={(key, value) => toggleSelected(selected, onSelected, key, value)}
        onSelectAll={(value) => togglePageSelection(selected, onSelected, paged, value)}
        rowAttention={(row) => (row.status === "overdue" ? "danger" : null)}
        density={density}
        emptyMessage="Nenhuma conta a receber para os filtros selecionados."
      />
      <Pagination
        page={page}
        pageSize={pageSize}
        total={sorted.length}
        onPage={onPage}
        onPageSize={onPageSize}
        selectedCount={selectedRows.length}
        selectedSummary={`${selectedRows.length} selecionados - Soma ${formatCents(
          selectedTotal,
        )}`}
      />
    </>
  );
}

function ExpensesTab({
  rows,
  search,
  onSearch,
  statusFilter,
  onStatusFilter,
  categoryFilter,
  onCategoryFilter,
  categoryOptions,
  costCenterFilter,
  onCostCenterFilter,
  costCenterOptions,
  density,
  onDensity,
  page,
  pageSize,
  onPage,
  onPageSize,
  sort,
  onSort,
  selected,
  onSelected,
  actionsMap,
}: {
  rows: FinanceExpenseListItem[];
  search: string;
  onSearch: (value: string) => void;
  statusFilter: string[];
  onStatusFilter: (value: string[]) => void;
  categoryFilter: string[];
  onCategoryFilter: (value: string[]) => void;
  categoryOptions: string[];
  costCenterFilter: string[];
  onCostCenterFilter: (value: string[]) => void;
  costCenterOptions: string[];
  density: "regular" | "compact";
  onDensity: (value: "regular" | "compact") => void;
  page: number;
  pageSize: number;
  onPage: (value: number) => void;
  onPageSize: (value: number) => void;
  sort: { key: string; dir: SortDir };
  onSort: (key: string) => void;
  selected: string[];
  onSelected: (value: string[]) => void;
  actionsMap?: Record<string, ReactNode>;
}) {
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
  const selectedRows = sorted.filter((expense) => selected.includes(expense.id));
  const selectedTotal = selectedRows.reduce(
    (total, expense) => total + moneyToCents(expense.amount),
    0,
  );

  const columns: DataTableColumn<FinanceExpenseListItem>[] = [
    {
      key: "supplier",
      label: "Fornecedor",
      sortable: true,
      render: (row) => (
        <div className="fg-cell-strong">
          {row.supplier}
          <div className="fg-cell-sub">{row.description}</div>
        </div>
      ),
    },
    {
      key: "category",
      label: "Categoria",
      sortable: true,
      render: (row) => <Tag>{row.category}</Tag>,
    },
    {
      key: "competence",
      label: "Comp.",
      sortable: true,
      render: (row) => (
        <span className="fg-tabular fg-muted">
          {formatCompetence(row.competence)}
        </span>
      ),
    },
    {
      key: "dueDate",
      label: "Vencimento",
      sortable: true,
      render: (row) => (
        <div className="fg-cell-strong fg-tabular">
          {formatDayMonth(row.dueDate)}
          <div className="fg-cell-sub">{relativeDateLabel(row.dueDate)}</div>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Valor original",
      sortable: true,
      align: "right",
      render: (row) => (
        <span className="fg-tabular fg-cell-strong">
          {formatMoney(row.amount)}
        </span>
      ),
    },
    {
      key: "settledAmount",
      label: "Liquidado",
      sortable: true,
      align: "right",
      render: (row) => (
        <span className={row.status === "settled" ? "fg-tabular fg-good" : "fg-tabular fg-muted"}>
          {moneyToCents(row.settledAmount) > 0 ? formatMoney(row.settledAmount) : "-"}
        </span>
      ),
    },
    {
      key: "settlementDate",
      label: "Liquidação",
      sortable: true,
      render: (row) => (
        <span className="fg-tabular fg-muted">{formatDate(row.settlementDate)}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <StatusBadge
          status={mapExpenseStatus(row.status)}
          label={financialExpenseStatusLabels[row.status]}
        />
      ),
    },
    {
      key: "costCenter",
      label: "C. custo",
      sortable: true,
      render: (row) =>
        row.costCenter ? <Tag>{row.costCenter}</Tag> : <span className="fg-muted">-</span>,
    },
  ];

  if (actionsMap) {
    columns.push({
      key: "_actions",
      label: "",
      width: 72,
      render: (row) => actionsMap[row.id] ?? null,
    });
  }

  return (
    <>
      <Toolbar
        search={search}
        onSearch={onSearch}
        placeholder="Buscar fornecedor, categoria, descricao..."
        filters={
          <>
            <FilterPopover
              label="Status"
              value={statusFilter}
              onChange={onStatusFilter}
              options={expenseStatusOptions}
            />
            <FilterPopover
              label="Categoria"
              value={categoryFilter}
              onChange={onCategoryFilter}
              options={categoryOptions}
            />
            <FilterPopover
              label="Centro de custo"
              value={costCenterFilter}
              onChange={onCostCenterFilter}
              options={costCenterOptions}
            />
          </>
        }
        density={density}
        onDensity={onDensity}
      />
      <DataTable
        columns={columns}
        data={paged}
        getRowKey={(row) => row.id}
        sortKey={sort.key}
        sortDir={sort.dir}
        onSort={onSort}
        selected={selected}
        onSelect={(key, value) => toggleSelected(selected, onSelected, key, value)}
        onSelectAll={(value) => togglePageSelection(selected, onSelected, paged, value)}
        rowAttention={(row) => (row.status === "overdue" ? "danger" : null)}
        density={density}
        emptyMessage="Nenhuma conta a pagar para os filtros selecionados."
      />
      <Pagination
        page={page}
        pageSize={pageSize}
        total={sorted.length}
        onPage={onPage}
        onPageSize={onPageSize}
        selectedCount={selectedRows.length}
        selectedSummary={`${selectedRows.length} selecionados - Soma ${formatCents(
          selectedTotal,
        )}`}
      />
    </>
  );
}

function ProvisionsTab({
  rows,
  search,
  onSearch,
  statusFilter,
  onStatusFilter,
  categoryFilter,
  onCategoryFilter,
  categoryOptions,
  density,
  onDensity,
  page,
  pageSize,
  onPage,
  onPageSize,
  sort,
  onSort,
  selected,
  onSelected,
  actionsMap,
}: {
  rows: ProvisionListItem[];
  search: string;
  onSearch: (value: string) => void;
  statusFilter: string[];
  onStatusFilter: (value: string[]) => void;
  categoryFilter: string[];
  onCategoryFilter: (value: string[]) => void;
  categoryOptions: string[];
  density: "regular" | "compact";
  onDensity: (value: "regular" | "compact") => void;
  page: number;
  pageSize: number;
  onPage: (value: number) => void;
  onPageSize: (value: number) => void;
  sort: { key: string; dir: SortDir };
  onSort: (key: string) => void;
  selected: string[];
  onSelected: (value: string[]) => void;
  actionsMap?: Record<string, ReactNode>;
}) {
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize);
  const selectedRows = sorted.filter((provision) => selected.includes(provision.id));
  const selectedTotal = selectedRows.reduce(
    (total, provision) => total + moneyToCents(provision.estimatedMonthlyAmount),
    0,
  );

  const columns: DataTableColumn<ProvisionListItem>[] = [
    {
      key: "name",
      label: "Provisao",
      sortable: true,
      render: (row) => (
        <div className="fg-cell-strong">
          {row.name}
          <div className="fg-cell-sub">
            {row.recurring ? "Recorrente" : "Pontual"}
          </div>
        </div>
      ),
    },
    {
      key: "category",
      label: "Categoria",
      sortable: true,
      render: (row) => <Tag>{row.category}</Tag>,
    },
    {
      key: "estimatedMonthlyAmount",
      label: "Valor / mes",
      sortable: true,
      align: "right",
      render: (row) => (
        <span className="fg-tabular fg-cell-strong">
          {formatMoney(row.estimatedMonthlyAmount)}
        </span>
      ),
    },
    {
      key: "annualized",
      label: "Anualizado",
      align: "right",
      render: (row) => (
        <span className="fg-tabular fg-muted">
          {formatCents(moneyToCents(row.estimatedMonthlyAmount) * 12)}
        </span>
      ),
    },
    {
      key: "expectedDay",
      label: "Proximo lanc.",
      sortable: true,
      render: (row) => (
        <span className="fg-tabular">
          {row.expectedDay ? nextProvisionLabel(row.expectedDay) : "-"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <StatusBadge
          status={row.status === "active" ? "ativo" : "pausado"}
          label={provisionStatusLabel(row.status)}
        />
      ),
    },
  ];

  if (actionsMap) {
    columns.push({
      key: "_actions",
      label: "",
      width: 72,
      render: (row) => actionsMap[row.id] ?? null,
    });
  }

  return (
    <>
      <Toolbar
        search={search}
        onSearch={onSearch}
        placeholder="Buscar provisao..."
        filters={
          <>
            <FilterPopover
              label="Status"
              value={statusFilter}
              onChange={onStatusFilter}
              options={provisionStatusOptions}
            />
            <FilterPopover
              label="Categoria"
              value={categoryFilter}
              onChange={onCategoryFilter}
              options={categoryOptions}
            />
          </>
        }
        density={density}
        onDensity={onDensity}
      />
      <DataTable
        columns={columns}
        data={paged}
        getRowKey={(row) => row.id}
        sortKey={sort.key}
        sortDir={sort.dir}
        onSort={onSort}
        selected={selected}
        onSelect={(key, value) => toggleSelected(selected, onSelected, key, value)}
        onSelectAll={(value) => togglePageSelection(selected, onSelected, paged, value)}
        density={density}
        emptyMessage="Sem provisoes cadastradas."
      />
      <Pagination
        page={page}
        pageSize={pageSize}
        total={sorted.length}
        onPage={onPage}
        onPageSize={onPageSize}
        selectedCount={selectedRows.length}
        selectedSummary={`${selectedRows.length} selecionadas - Mensal ${formatCents(
          selectedTotal,
        )}`}
      />
    </>
  );
}

function getHeaderSummary({
  entries,
  expenses,
  provisions,
  tab,
}: {
  entries: FinanceEntryListItem[];
  expenses: FinanceExpenseListItem[];
  provisions: ProvisionListItem[];
  tab: Tab;
}) {
  if (tab === "entradas") {
    const totalExpected = entries.reduce(
      (total, entry) => total + moneyToCents(entry.amount),
      0,
    );
    const totalReceived = entries.reduce(
      (total, entry) => total + moneyToCents(entry.settledAmount),
      0,
    );

    return `${entries.length} contas a receber - Total ${formatCents(
      totalExpected,
    )} - Liquidado ${formatCents(totalReceived)}`;
  }

  if (tab === "saidas") {
    const totalExpected = expenses.reduce(
      (total, expense) => total + moneyToCents(expense.amount),
      0,
    );
    const totalPaid = expenses.reduce(
      (total, expense) => total + moneyToCents(expense.settledAmount),
      0,
    );

    return `${expenses.length} contas a pagar - Total ${formatCents(
      totalExpected,
    )} - Liquidado ${formatCents(totalPaid)}`;
  }

  const activeProvisions = provisions.filter((provision) => provision.status === "active");
  const totalMonthly = activeProvisions.reduce(
    (total, provision) => total + moneyToCents(provision.estimatedMonthlyAmount),
    0,
  );

  return `${activeProvisions.length} ativas - Mensal ${formatCents(
    totalMonthly,
  )} - Anualizado ${formatCents(totalMonthly * 12)}`;
}

function filterEntries(
  entries: FinanceEntryListItem[],
  filters: {
    clientFilter: string[];
    month: string;
    search: string;
    statusFilter: string[];
  },
) {
  const query = filters.search.trim().toLowerCase();

  return entries.filter((entry) => {
    const clientName = entry.clientName ?? "Sem cliente";

    return (
      (filters.month === "all" || entry.competence === filters.month) &&
      (!query ||
        [clientName, entry.description].some((value) =>
          value.toLowerCase().includes(query),
        )) &&
      (filters.statusFilter.length === 0 ||
        filters.statusFilter.includes(financialEntryStatusLabels[entry.status])) &&
      (filters.clientFilter.length === 0 || filters.clientFilter.includes(clientName))
    );
  });
}

function filterExpenses(
  expenses: FinanceExpenseListItem[],
  filters: {
    categoryFilter: string[];
    costCenterFilter: string[];
    month: string;
    search: string;
    statusFilter: string[];
  },
) {
  const query = filters.search.trim().toLowerCase();

  return expenses.filter((expense) => {
    return (
      (filters.month === "all" || expense.competence === filters.month) &&
      (!query ||
        [expense.supplier, expense.description, expense.category].some((value) =>
          value.toLowerCase().includes(query),
        )) &&
      (filters.statusFilter.length === 0 ||
        filters.statusFilter.includes(financialExpenseStatusLabels[expense.status])) &&
      (filters.categoryFilter.length === 0 ||
        filters.categoryFilter.includes(expense.category)) &&
      (filters.costCenterFilter.length === 0 ||
        (expense.costCenter && filters.costCenterFilter.includes(expense.costCenter)))
    );
  });
}

function filterProvisions(
  provisions: ProvisionListItem[],
  filters: {
    categoryFilter: string[];
    search: string;
    statusFilter: string[];
  },
) {
  const query = filters.search.trim().toLowerCase();

  return provisions.filter((provision) => {
    return (
      (!query ||
        [provision.name, provision.category].some((value) =>
          value.toLowerCase().includes(query),
        )) &&
      (filters.categoryFilter.length === 0 ||
        filters.categoryFilter.includes(provision.category)) &&
      (filters.statusFilter.length === 0 ||
        filters.statusFilter.includes(provisionStatusLabel(provision.status)))
    );
  });
}

function sortRows<T extends Record<string, unknown>>(
  rows: T[],
  sort: { key: string; dir: SortDir },
) {
  const dir = sort.dir === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const av = financeSortValue(a, sort.key);
    const bv = financeSortValue(b, sort.key);

    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

function financeSortValue(row: Record<string, unknown>, key: string): string | number {
  const value = row[key];

  if (
    key === "amount" ||
    key === "settledAmount" ||
    key === "estimatedMonthlyAmount"
  ) {
    return moneyToCents(typeof value === "string" ? value : null);
  }

  if (key === "dueDate" || key === "settlementDate" || key === "competence") {
    return typeof value === "string" ? value : "";
  }

  if (key === "expectedDay") {
    return typeof value === "number" ? value : 99;
  }

  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") return value.toLowerCase();
  return "";
}

function buildMonthOptions(dashboard: FinanceDashboard) {
  const values = new Set<string>();
  values.add(dashboard.competence);
  if (dashboard.filters.competence) values.add(dashboard.filters.competence);
  for (const entry of dashboard.entries) values.add(entry.competence);
  for (const expense of dashboard.expenses) values.add(expense.competence);

  return [
    ...Array.from(values)
      .sort()
      .map((value) => ({ value, label: formatCompetence(value) })),
    { value: "all", label: "Todos" },
  ];
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function toggleSelected(
  selected: string[],
  onSelected: (value: string[]) => void,
  key: string,
  value: boolean,
) {
  onSelected(
    value
      ? Array.from(new Set([...selected, key]))
      : selected.filter((item) => item !== key),
  );
}

function togglePageSelection<T extends { id: string }>(
  selected: string[],
  onSelected: (value: string[]) => void,
  rows: T[],
  value: boolean,
) {
  const pageIds = rows.map((row) => row.id);

  onSelected(
    value
      ? Array.from(new Set([...selected, ...pageIds]))
      : selected.filter((id) => !pageIds.includes(id)),
  );
}

function formatCents(cents: number) {
  return formatMoney(centsToMoney(cents));
}

function formatDayMonth(value: string | Date | null | undefined) {
  if (!value) return "-";
  const [, month, day] = toDateKey(value).split("-");
  return month && day ? `${day}/${month}` : formatDate(value);
}

function relativeDateLabel(value: string | Date | null | undefined) {
  if (!value) return "";

  const diff = diffDays(toDateKey(value), toDateKey(new Date()));

  if (diff === 0) return "Hoje";
  if (diff === 1) return "Amanha";
  if (diff === -1) return "Ontem";
  if (diff < 0) return `${Math.abs(diff)} dias atras`;
  return `Em ${diff} dias`;
}

function diffDays(targetKey: string, baseKey: string) {
  return (dateKeyToUtc(targetKey) - dateKeyToUtc(baseKey)) / 86_400_000;
}

function dateKeyToUtc(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function nextProvisionLabel(expectedDay: number) {
  const today = new Date();
  const todayKey = toDateKey(today);
  const currentMonth = todayKey.slice(0, 7);
  const currentDate = clampDateKey(currentMonth, expectedDay);
  const nextDate =
    currentDate >= todayKey
      ? currentDate
      : clampDateKey(nextMonthKey(currentMonth), expectedDay);

  return `${formatDayMonth(nextDate)} (${relativeDateLabel(nextDate)})`;
}

function clampDateKey(monthKey: string, expectedDay: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = String(Math.min(Math.max(expectedDay, 1), lastDay)).padStart(2, "0");

  return `${monthKey}-${day}`;
}

function nextMonthKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  return `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
}

function provisionStatusLabel(status: string) {
  return status === "active" ? "Ativa" : "Inativa";
}

function mapEntryStatus(status: FinancialEntryStatus): string {
  switch (status) {
    case "settled":
      return "recebido";
    case "partial":
      return "parcial";
    case "overdue":
      return "atrasado";
    case "cancelled":
      return "cancelado";
    default:
      return "previsto";
  }
}

function mapExpenseStatus(status: FinancialExpenseStatus): string {
  switch (status) {
    case "settled":
      return "pago";
    case "partial":
      return "parcial";
    case "overdue":
      return "atrasado";
    case "cancelled":
      return "cancelado";
    default:
      return "previsto";
  }
}

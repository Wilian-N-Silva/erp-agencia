"use client";

import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  Avatar,
  Button,
  Card,
  Chips,
  DataTable,
  Dropdown,
  FilterPopover,
  KpiCard,
  Page,
  PageHeader,
  Sheet,
  StatusBadge,
  Tag,
  Toolbar,
} from "@/components/fg";
import type { DataTableColumn } from "@/components/fg/data-table";
import type { TimeOffListItem } from "@/features/timeoff/dal";
import type { TimeOffStatus, TimeOffType } from "@/features/timeoff/rules";
import { formatDate, toDateKey } from "@/features/finance/rules";

const timeOffStatusLabels: Record<TimeOffStatus, string> = {
  requested: "Solicitada",
  approved: "Aprovada",
  rejected: "Recusada",
  cancelled: "Cancelada",
};

const timeOffTypeLabels: Record<TimeOffType, string> = {
  vacation: "Ferias",
  planned_pause: "Pausa programada",
  absence: "Ausencia programada",
};

function getTimeOffDisplayType(employmentType: string, requestedType: TimeOffType) {
  if (employmentType === "clt") {
    return requestedType === "vacation" ? "Ferias" : timeOffTypeLabels[requestedType];
  }
  return requestedType === "vacation" ? "Pausa programada" : timeOffTypeLabels[requestedType];
}

export interface FeriasViewProps {
  requests: TimeOffListItem[];
  canCreate: boolean;
  newRequestAction?: ReactNode;
  rowActions?: Record<string, ReactNode>;
  detailActions?: Record<string, ReactNode>;
}

export function FeriasView({
  requests,
  canCreate,
  newRequestAction,
  rowActions,
  detailActions,
}: FeriasViewProps) {
  const [view, setView] = useState<"lista" | "calendario">("lista");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [density, setDensity] = useState<"regular" | "compact">("regular");
  const [open, setOpen] = useState<TimeOffListItem | null>(null);

  const typeOptions = useMemo(
    () => uniqueSorted(requests.map((r) => labelForType(r.type, r.employmentType))),
    [requests],
  );
  const statusOptions = Object.values(timeOffStatusLabels);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return requests.filter((request) => {
      const searchable = [
        request.employeeName,
        request.employeeRegistrationNumber,
        request.areaName,
      ];
      const statusLabel = timeOffStatusLabels[request.status];
      const typeLabel = labelForType(request.type, request.employmentType);

      return (
        (!query || searchable.some((value) => value.toLowerCase().includes(query))) &&
        (statusFilter.length === 0 || statusFilter.includes(statusLabel)) &&
        (typeFilter.length === 0 || typeFilter.includes(typeLabel))
      );
    });
  }, [requests, search, statusFilter, typeFilter]);

  const totalApproved = requests.filter((r) => r.status === "approved").length;
  const totalRequested = requests.filter((r) => r.status === "requested").length;
  const totalDaysApproved = requests
    .filter((r) => r.status === "approved")
    .reduce((total, r) => total + r.businessDays, 0);

  const columns: DataTableColumn<TimeOffListItem>[] = [
    {
      key: "employeeName",
      label: "Colaborador",
      render: (request) => (
        <div className="fg-cell-user">
          <Avatar name={request.employeeName} size={26} />
          <div>
            <div className="fg-cell-strong">{request.employeeName}</div>
            <div className="fg-cell-sub fg-tabular">
              {request.employeeRegistrationNumber} · {request.areaName}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "type",
      label: "Tipo",
      render: (request) => <Tag>{labelForType(request.type, request.employmentType)}</Tag>,
    },
    {
      key: "employmentType",
      label: "Vínculo",
      render: (request) => <span className="fg-muted">{employmentLabel(request.employmentType)}</span>,
    },
    {
      key: "period",
      label: "Período",
      render: (request) => (
        <div className="fg-cell-strong fg-tabular">
          {formatDayMonth(request.startDate)} → {formatDayMonth(request.endDate)}
          <div className="fg-cell-sub">{periodYearLabel(request.startDate, request.endDate)}</div>
        </div>
      ),
    },
    {
      key: "businessDays",
      label: "Dias",
      align: "right",
      render: (request) => (
        <span className="fg-tabular fg-cell-strong">{request.businessDays}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (request) => (
        <StatusBadge
          status={mapTimeOffStatus(request.status)}
          label={timeOffStatusLabels[request.status]}
        />
      ),
    },
    {
      key: "_actions",
      label: "",
      width: 96,
      render: (request) => (
        <div
          style={{ display: "inline-flex", gap: 4, justifyContent: "flex-end" }}
          onClick={(event) => event.stopPropagation()}
        >
          <Dropdown
            trigger={
              <button className="fg-icon-btn sm" type="button" aria-label="Ações">
                <MoreHorizontal size={14} />
              </button>
            }
            items={[
              {
                label: "Ver detalhe",
                icon: <Eye size={13} />,
                onClick: () => setOpen(request),
              },
            ]}
          />
          {rowActions?.[request.id]}
        </div>
      ),
    },
  ];

  return (
    <Page>
      <PageHeader
        eyebrow="Fluxos"
        title="Férias e ausências"
        description={`${filtered.length} programações — visão global para detectar conflitos por área.`}
        actions={
          <>
            <Chips
              value={view}
              onChange={(value) => setView(value as "lista" | "calendario")}
              items={[
                { value: "lista", label: "Lista" },
                { value: "calendario", label: "Calendário" },
              ]}
            />
            {canCreate ? (
              newRequestAction ?? (
                <Button type="button" variant="primary" size="sm" icon={<Plus size={14} />} disabled>
                  Programar ausência
                </Button>
              )
            ) : null}
          </>
        }
      />

      <div className="fg-grid fg-grid-4">
        <KpiCard
          label="Aprovadas"
          value={totalApproved}
          secondary={`${totalDaysApproved} dias úteis`}
          icon={<CheckCircle2 size={16} />}
          accent
        />
        <KpiCard
          label="Solicitadas"
          value={totalRequested}
          secondary="Aguardando aprovação"
          icon={<Clock size={16} />}
        />
        <KpiCard
          label="Total no fluxo"
          value={requests.length}
          secondary="Programações registradas"
          icon={<CalendarDays size={16} />}
        />
        <KpiCard
          label="Hoje"
          value={countActiveOn(requests, new Date())}
          secondary="Colaboradores fora hoje"
          icon={<Clock size={16} />}
        />
      </div>

      {view === "lista" ? (
        <>
          <Toolbar
            search={search}
            onSearch={setSearch}
            placeholder="Buscar colaborador ou matrícula..."
            filters={
              <>
                <FilterPopover
                  label="Status"
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={statusOptions}
                />
                <FilterPopover
                  label="Tipo"
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={typeOptions}
                />
              </>
            }
            density={density}
            onDensity={setDensity}
          />
          <DataTable
            columns={columns}
            data={filtered}
            getRowKey={(request) => request.id}
            density={density}
            onRowClick={setOpen}
            emptyMessage="Nenhuma solicitação para os filtros selecionados."
          />
        </>
      ) : (
        <FeriasCalendar items={filtered} />
      )}

      <TimeOffDetailSheet
        request={open}
        onClose={() => setOpen(null)}
        actions={open ? detailActions?.[open.id] : null}
      />
    </Page>
  );
}

function TimeOffDetailSheet({
  actions,
  onClose,
  request,
}: {
  actions?: ReactNode;
  onClose: () => void;
  request: TimeOffListItem | null;
}) {
  if (!request) return null;

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${labelForType(request.type, request.employmentType)} · ${request.employeeName}`}
      description={`${request.employeeRegistrationNumber} · ${request.areaName}`}
      width={580}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Fechar
          </Button>
          <div style={{ flex: 1 }} />
          {actions}
        </>
      }
    >
      <dl className="fg-deflist">
        <div>
          <dt>Tipo</dt>
          <dd>{labelForType(request.type, request.employmentType)}</dd>
        </div>
        <div>
          <dt>Vínculo</dt>
          <dd>{employmentLabel(request.employmentType)}</dd>
        </div>
        <div>
          <dt>Início</dt>
          <dd className="fg-tabular">{formatDate(request.startDate)}</dd>
        </div>
        <div>
          <dt>Fim</dt>
          <dd className="fg-tabular">{formatDate(request.endDate)}</dd>
        </div>
        <div>
          <dt>Dias úteis</dt>
          <dd className="fg-tabular fg-cell-strong">{request.businessDays}</dd>
        </div>
        <div>
          <dt>Dias vendidos</dt>
          <dd className="fg-tabular">{request.soldDays}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>
            <StatusBadge
              status={mapTimeOffStatus(request.status)}
              label={timeOffStatusLabels[request.status]}
            />
          </dd>
        </div>
        <div>
          <dt>Solicitada em</dt>
          <dd className="fg-tabular">{formatDate(request.createdAt)}</dd>
        </div>
        {request.notes ? (
          <div className="full">
            <dt>Observações</dt>
            <dd>{request.notes}</dd>
          </div>
        ) : null}
      </dl>
    </Sheet>
  );
}

function FeriasCalendar({ items }: { items: TimeOffListItem[] }) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));

  const monthName = cursor.toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const startOffset = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const cells: { date: Date; muted: boolean }[] = [];
  const prevLast = new Date(cursor.getFullYear(), cursor.getMonth(), 0).getDate();
  for (let i = startOffset - 1; i >= 0; i -= 1) {
    cells.push({
      date: new Date(cursor.getFullYear(), cursor.getMonth() - 1, prevLast - i),
      muted: true,
    });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      date: new Date(cursor.getFullYear(), cursor.getMonth(), day),
      muted: false,
    });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    cells.push({
      date: new Date(
        cursor.getFullYear(),
        cursor.getMonth() + 1,
        cells.length - daysInMonth - startOffset + 1,
      ),
      muted: true,
    });
  }

  const rows: { date: Date; muted: boolean }[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

  const eventsByDay = (date: Date) => {
    const key = toDateKey(date);
    return items.filter(
      (request) => key >= toDateKey(request.startDate) && key <= toDateKey(request.endDate),
    );
  };

  return (
    <Card padding={false}>
      <div className="fg-cal-head">
        <div className="fg-cal-title">{monthName}</div>
        <div className="fg-cal-nav">
          <button
            type="button"
            className="fg-icon-btn sm"
            aria-label="Mês anterior"
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))
            }
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            className="fg-icon-btn sm"
            aria-label="Próximo mês"
            onClick={() =>
              setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))
            }
          >
            <ChevronRight size={14} />
          </button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
          >
            Hoje
          </Button>
        </div>
        <div className="fg-cal-legend">
          <span className="fg-cal-legend-item">
            <span className="fg-cal-swatch fg-fer-clt" />
            Férias CLT
          </span>
          <span className="fg-cal-legend-item">
            <span className="fg-cal-swatch fg-fer-pj" />
            Pausa PJ
          </span>
          <span className="fg-cal-legend-item">
            <span className="fg-cal-swatch fg-fer-afas" />
            Afastamento
          </span>
        </div>
      </div>
      <div className="fg-cal-grid">
        <div className="fg-cal-weekhead">
          {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="fg-cal-body">
          {rows.map((row, rowIndex) => (
            <div className="fg-cal-row" key={rowIndex}>
              {row.map((cell, cellIndex) => {
                const isToday = sameDay(cell.date, today);
                const events = eventsByDay(cell.date);

                return (
                  <div
                    key={cellIndex}
                    className={`fg-cal-cell ${cell.muted ? "muted" : ""} ${
                      isToday ? "today" : ""
                    }`.trim()}
                  >
                    <div className="fg-cal-day fg-tabular">{cell.date.getDate()}</div>
                    <div className="fg-cal-events">
                      {events.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className={`fg-cal-ev ${eventColor(event)}`}
                          title={`${event.employeeName} · ${labelForType(
                            event.type,
                            event.employmentType,
                          )}`}
                        >
                          <span className="fg-cal-ev-dot" />
                          <span>{event.employeeName.split(" ")[0]}</span>
                        </div>
                      ))}
                      {events.length > 3 ? (
                        <div className="fg-cal-more">+{events.length - 3}</div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function labelForType(type: string, employmentType: string) {
  if (type === "vacation" || type === "planned_pause" || type === "absence") {
    return getTimeOffDisplayType(employmentType, type as TimeOffType);
  }
  return timeOffTypeLabels[type as keyof typeof timeOffTypeLabels] ?? type;
}

function employmentLabel(employmentType: string) {
  if (employmentType === "pj") return "PJ";
  if (employmentType === "clt") return "CLT";
  return employmentType;
}

function mapTimeOffStatus(status: TimeOffStatus) {
  switch (status) {
    case "approved":
      return "aprovada";
    case "rejected":
      return "recusada";
    case "cancelled":
      return "cancelado";
    case "requested":
    default:
      return "aguardando_envio";
  }
}

function eventColor(request: TimeOffListItem) {
  if (request.employmentType === "clt" && request.type === "vacation") return "fg-fer-clt";
  if (request.type === "absence") return "fg-fer-afas";
  return "fg-fer-pj";
}

function formatDayMonth(value: string | Date | null | undefined) {
  if (!value) return "-";
  const [, month, day] = toDateKey(value).split("-");
  return month && day ? `${day}/${month}` : formatDate(value);
}

function periodYearLabel(start: string | Date, end: string | Date) {
  const [startYear] = toDateKey(start).split("-");
  const [endYear] = toDateKey(end).split("-");
  return startYear === endYear ? startYear : `${startYear}–${endYear}`;
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

function countActiveOn(items: TimeOffListItem[], date: Date) {
  const key = toDateKey(date);
  return items.filter(
    (item) =>
      item.status === "approved" &&
      key >= toDateKey(item.startDate) &&
      key <= toDateKey(item.endDate),
  ).length;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

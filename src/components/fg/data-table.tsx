"use client";

import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

import { Checkbox } from "@/components/fg/atoms";

export type SortDir = "asc" | "desc";

export interface DataTableColumn<T> {
  key: string;
  label: ReactNode;
  width?: number | string;
  align?: "left" | "right";
  sortable?: boolean;
  render?: (row: T) => ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  density?: "regular" | "compact";
  zebra?: boolean;
  sortKey?: string;
  sortDir?: SortDir;
  onSort?: (key: string) => void;
  selected?: string[];
  onSelect?: (key: string, value: boolean) => void;
  onSelectAll?: (value: boolean) => void;
  rowAttention?: (row: T) => "danger" | null | undefined;
  onRowClick?: (row: T) => void;
  emptyMessage?: ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  getRowKey,
  density = "regular",
  zebra = false,
  sortKey,
  sortDir,
  onSort,
  selected,
  onSelect,
  onSelectAll,
  rowAttention,
  onRowClick,
  emptyMessage,
}: DataTableProps<T>) {
  const hasSelection = !!onSelect;
  const allSelected =
    hasSelection &&
    data.length > 0 &&
    data.every((r) => selected?.includes(getRowKey(r)));
  const someSelected =
    hasSelection && data.some((r) => selected?.includes(getRowKey(r))) && !allSelected;

  return (
    <div
      className={`fg-table-wrap fg-table-${density} ${zebra ? "zebra" : ""}`.trim()}
    >
      <table className={`fg-table ${zebra ? "zebra" : ""}`.trim()}>
        <thead>
          <tr>
            {hasSelection && (
              <th className="fg-th-check">
                <Checkbox
                  checked={allSelected}
                  indeterminate={someSelected}
                  onChange={(v) => onSelectAll?.(v)}
                />
              </th>
            )}
            {columns.map((c) => (
              <th
                key={c.key}
                className={c.align === "right" ? "right" : ""}
                style={c.width !== undefined ? { width: c.width } : undefined}
              >
                {c.sortable ? (
                  <button
                    type="button"
                    className="fg-th-sort"
                    onClick={() => onSort?.(c.key)}
                  >
                    <span>{c.label}</span>
                    <span className="fg-th-arrow">
                      {sortKey === c.key ? (
                        sortDir === "asc" ? (
                          <ArrowUp size={10} strokeWidth={2} />
                        ) : (
                          <ArrowDown size={10} strokeWidth={2} />
                        )
                      ) : (
                        <ChevronDown
                          size={10}
                          strokeWidth={2}
                          style={{ opacity: 0.3 }}
                        />
                      )}
                    </span>
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                className="fg-mini-empty"
                colSpan={columns.length + (hasSelection ? 1 : 0)}
              >
                {emptyMessage ?? "Sem resultados"}
              </td>
            </tr>
          ) : (
            data.map((row) => {
              const k = getRowKey(row);
              const isSel = selected?.includes(k);
              const attn = rowAttention?.(row);
              return (
                <tr
                  key={k}
                  className={`${isSel ? "selected" : ""} ${
                    attn ? `attn-${attn}` : ""
                  }`.trim()}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={onRowClick ? { cursor: "pointer" } : undefined}
                >
                  {hasSelection && (
                    <td
                      className="fg-td-check"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Checkbox
                        checked={isSel}
                        onChange={(v) => onSelect?.(k, v)}
                      />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={c.align === "right" ? "right" : ""}
                    >
                      {c.render ? c.render(row) : (row as Record<string, ReactNode>)[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

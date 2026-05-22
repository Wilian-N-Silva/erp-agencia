"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Select } from "@/components/fg/atoms";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
  selectedCount?: number;
  selectedSummary?: string;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  selectedCount = 0,
  selectedSummary,
}: PaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="fg-pagination">
      <div className="fg-pagination-left">
        {selectedCount > 0 && selectedSummary ? (
          <span>{selectedSummary}</span>
        ) : (
          <span>
            Mostrando{" "}
            <strong className="fg-tabular">
              {start}–{end}
            </strong>{" "}
            de <strong className="fg-tabular">{total}</strong>
          </span>
        )}
      </div>
      <div className="fg-pagination-right">
        <Select
          value={String(pageSize)}
          onChange={(v) => onPageSize(Number(v))}
          options={[
            { value: "25", label: "25 por página" },
            { value: "50", label: "50 por página" },
            { value: "100", label: "100 por página" },
          ]}
          placeholder=""
        />
        <div className="fg-page-ctrls">
          <button
            type="button"
            onClick={() => onPage(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="fg-tabular">
            {page} <span style={{ opacity: 0.4 }}>de</span> {pages}
          </span>
          <button
            type="button"
            onClick={() => onPage(Math.min(pages, page + 1))}
            disabled={page >= pages}
            aria-label="Próxima página"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { ChevronDown, Download, Search } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/fg/atoms";

export interface ToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  placeholder?: string;
  filters?: ReactNode;
  density?: "regular" | "compact";
  onDensity?: (value: "regular" | "compact") => void;
  exportLabel?: ReactNode;
  onExport?: () => void;
  action?: ReactNode;
}

export function Toolbar({
  search,
  onSearch,
  placeholder = "Buscar...",
  filters,
  density,
  onDensity,
  exportLabel = "Exportar",
  onExport,
  action,
}: ToolbarProps) {
  return (
    <div className="fg-toolbar">
      <div className="fg-toolbar-left">
        <div className="fg-search">
          <Search size={14} />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={placeholder}
          />
        </div>
        {filters}
      </div>
      <div className="fg-toolbar-right">
        {density && onDensity && (
          <div className="fg-density-toggle">
            <button
              type="button"
              className={density === "compact" ? "active" : ""}
              onClick={() => onDensity("compact")}
              title="Densidade compacta"
              aria-label="Compactar"
            >
              <svg width="12" height="12" viewBox="0 0 12 12">
                <rect x="1" y="2" width="10" height="1.5" fill="currentColor" />
                <rect x="1" y="5.25" width="10" height="1.5" fill="currentColor" />
                <rect x="1" y="8.5" width="10" height="1.5" fill="currentColor" />
              </svg>
            </button>
            <button
              type="button"
              className={density === "regular" ? "active" : ""}
              onClick={() => onDensity("regular")}
              title="Densidade confortável"
              aria-label="Confortável"
            >
              <svg width="12" height="12" viewBox="0 0 12 12">
                <rect x="1" y="1.5" width="10" height="1.5" fill="currentColor" />
                <rect x="1" y="5.25" width="10" height="1.5" fill="currentColor" />
                <rect x="1" y="9" width="10" height="1.5" fill="currentColor" />
              </svg>
            </button>
          </div>
        )}
        {onExport && (
          <Button
            variant="outline"
            size="sm"
            icon={<Download size={14} />}
            iconRight={<ChevronDown size={12} />}
            onClick={onExport}
          >
            {exportLabel}
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}

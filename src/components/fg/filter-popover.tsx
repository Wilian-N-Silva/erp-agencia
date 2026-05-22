"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Checkbox } from "@/components/fg/atoms";

export interface FilterPopoverProps {
  label: ReactNode;
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
}

export function FilterPopover({
  label,
  options,
  value,
  onChange,
}: FilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (v: string) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div className="fg-filter-pop" ref={ref}>
      <button
        type="button"
        className={`fg-filter-btn ${value.length > 0 ? "has-value" : ""}`.trim()}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        {value.length > 0 && <span className="fg-filter-count">{value.length}</span>}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="fg-filter-menu">
          {options.map((o) => (
            <button
              type="button"
              key={o}
              className="fg-filter-opt"
              onClick={() => toggle(o)}
            >
              <Checkbox checked={value.includes(o)} />
              <span>{o}</span>
            </button>
          ))}
          {value.length > 0 && (
            <div className="fg-filter-foot">
              <button
                type="button"
                className="fg-link"
                onClick={() => onChange([])}
              >
                Limpar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

export interface DropdownItem {
  label?: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  separator?: boolean;
}

export interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: "left" | "right";
}

export function Dropdown({ trigger, items, align = "right" }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  return (
    <div className="fg-dropdown" ref={ref}>
      <span onClick={() => setOpen((v) => !v)} style={{ display: "inline-flex" }}>
        {trigger}
      </span>
      {open && (
        <div className={`fg-dropdown-menu fg-dropdown-${align}`}>
          {items.map((it, i) =>
            it.separator ? (
              <div className="fg-dropdown-sep" key={i} />
            ) : (
              <button
                key={i}
                type="button"
                className={`fg-dropdown-item ${it.danger ? "danger" : ""}`.trim()}
                disabled={it.disabled}
                aria-disabled={it.disabled}
                onClick={() => {
                  if (it.disabled) return;
                  setOpen(false);
                  it.onClick?.();
                }}
              >
                {it.icon && <span>{it.icon}</span>}
                <span>{it.label}</span>
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

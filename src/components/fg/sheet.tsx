"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import type { ReactNode } from "react";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  width?: number;
  footer?: ReactNode;
  children?: ReactNode;
}

export function Sheet({
  open,
  onClose,
  title,
  description,
  width = 560,
  footer,
  children,
}: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <div className={`fg-sheet-root ${open ? "open" : ""}`.trim()} aria-hidden={!open}>
      <div className="fg-sheet-scrim" onClick={onClose} />
      <div className="fg-sheet" style={{ width }}>
        <div className="fg-sheet-head">
          <div>
            {title && <div className="fg-sheet-title">{title}</div>}
            {description && <div className="fg-sheet-desc">{description}</div>}
          </div>
          <button
            type="button"
            className="fg-icon-btn"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={16} />
          </button>
        </div>
        <div className="fg-sheet-body">{children}</div>
        {footer && <div className="fg-sheet-foot">{footer}</div>}
      </div>
    </div>
  );
}

"use client";

import type { ReactNode } from "react";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  width?: number;
  footer?: ReactNode;
  children?: ReactNode;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  width = 440,
  footer,
  children,
}: DialogProps) {
  return (
    <div className={`fg-dialog-root ${open ? "open" : ""}`.trim()}>
      <div className="fg-dialog-scrim" onClick={onClose} />
      <div className="fg-dialog" style={{ width }}>
        <div className="fg-dialog-head">
          {title && <div className="fg-dialog-title">{title}</div>}
          {description && <div className="fg-dialog-desc">{description}</div>}
        </div>
        <div className="fg-dialog-body">{children}</div>
        {footer && <div className="fg-dialog-foot">{footer}</div>}
      </div>
    </div>
  );
}

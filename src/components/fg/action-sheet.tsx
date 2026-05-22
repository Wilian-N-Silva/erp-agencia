"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import { Sheet } from "./sheet";

export interface ActionSheetProps {
  title: ReactNode;
  description?: ReactNode;
  trigger: ReactNode;
  triggerLabel?: string;
  width?: number;
  children: ReactNode | ((helpers: { close: () => void }) => ReactNode);
  footer?: ReactNode | ((helpers: { close: () => void }) => ReactNode);
}

/**
 * Drop-in replacement for the legacy `ActionDialog` that renders the prototype's
 * sliding right-Sheet. The `trigger` is cloned with an onClick that opens the
 * Sheet; on Escape or scrim click the Sheet closes.
 */
export function ActionSheet({
  title,
  description,
  trigger,
  width = 580,
  children,
  footer,
}: ActionSheetProps) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const cloned = (
    <span
      role="button"
      tabIndex={0}
      onClick={() => setOpen(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen(true);
        }
      }}
      style={{ display: "inline-flex" }}
    >
      {trigger}
    </span>
  );

  const body =
    typeof children === "function"
      ? (children as (h: { close: () => void }) => ReactNode)({ close })
      : children;
  const foot =
    typeof footer === "function"
      ? (footer as (h: { close: () => void }) => ReactNode)({ close })
      : footer;

  return (
    <>
      {cloned}
      <Sheet
        open={open}
        onClose={close}
        title={title}
        description={description}
        width={width}
        footer={foot}
      >
        {body}
      </Sheet>
    </>
  );
}

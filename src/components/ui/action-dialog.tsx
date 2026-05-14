"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useRef } from "react";

export function ActionDialog({
  children,
  disabled = false,
  title,
  trigger,
  triggerClassName,
  triggerLabel,
}: {
  children: ReactNode;
  disabled?: boolean;
  title: string;
  trigger?: ReactNode;
  triggerClassName: string;
  triggerLabel: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        aria-label={triggerLabel}
        className={triggerClassName}
        disabled={disabled}
        onClick={() => dialogRef.current?.showModal()}
        type="button"
      >
        {trigger ?? triggerLabel}
      </button>
      <dialog
        className="w-[min(calc(100vw-2rem),44rem)] rounded-lg border bg-card p-0 text-foreground shadow-xl backdrop:bg-foreground/20"
        ref={dialogRef}
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <form method="dialog">
            <button
              aria-label="Fechar"
              className="inline-flex size-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              type="submit"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </form>
        </div>
        <div className="max-h-[min(75vh,42rem)] overflow-y-auto p-4">{children}</div>
      </dialog>
    </>
  );
}

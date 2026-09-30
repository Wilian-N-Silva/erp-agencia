"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/** Native modal traps focus; contents remain mounted so closing keeps the draft. */
export function GraphicActionPanel({
  title,
  children,
  initialOpen = false,
}: {
  title: string;
  children: ReactNode;
  initialOpen?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (initialOpen && !dialog.current?.open) dialog.current?.showModal();
  }, [initialOpen]);
  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => dialog.current?.showModal()}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
      >
        {title}
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={titleId}
        className="m-0 ml-auto h-dvh max-h-dvh w-full max-w-2xl border-l bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b bg-background p-5">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            className="rounded-md border px-3 py-2 text-sm"
          >
            Fechar painel
          </button>
        </div>
        <div className="p-5">{children}</div>
        <p className="border-t p-5 text-xs text-muted-foreground">
          Fechar este painel mantém o preenchimento enquanto você permanece
          neste trabalho. Após salvar, consulte o resultado na etapa.
        </p>
      </dialog>
    </div>
  );
}

export function ConfirmArchive({ children }: { children: ReactNode }) {
  return (
    <div
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Arquivar este trabalho? Ele sairá da lista ativa e seu histórico será preservado.",
          )
        )
          event.preventDefault();
      }}
    >
      {children}
    </div>
  );
}

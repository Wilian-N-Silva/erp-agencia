"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import {
  graphicWorkspaceTabs,
  parseGraphicWorkspaceTab,
  type GraphicWorkspaceTab,
} from "@/features/graphics/workspace-rules";

const steps: { label: string; tab: GraphicWorkspaceTab }[] = [
  { label: "Pedido", tab: "pedido" },
  { label: "Cotações", tab: "cotacoes" },
  { label: "OS", tab: "os" },
  { label: "Cliente", tab: "cliente" },
  { label: "Produção", tab: "producao" },
  { label: "Entrega", tab: "producao" },
];

export function GraphicWorkspace({
  panels,
  stage,
  attention,
  closed,
  nextTab,
  nextAction,
  owner,
  waiting,
}: {
  panels: Record<GraphicWorkspaceTab, ReactNode>;
  stage: number;
  attention: boolean;
  closed: boolean;
  nextTab: GraphicWorkspaceTab;
  nextAction: string;
  owner: string;
  waiting?: string;
}) {
  const query = useSearchParams();
  const selected = parseGraphicWorkspaceTab(
    query.get("tab") ??
      (query.has("quote") ? "cotacoes" : query.has("edit") ? "pedido" : null),
  );
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);
  const progress = useRef<HTMLElement>(null);
  useEffect(() => {
    const container = progress.current;
    const current = container?.querySelector<HTMLElement>(
      '[aria-current="step"]',
    );
    if (container && current)
      container.scrollLeft =
        current.offsetLeft -
        container.offsetLeft -
        container.clientWidth / 2 +
        current.clientWidth / 2;
  }, [stage]);
  useEffect(() => {
    const button =
      tabButtons.current[
        graphicWorkspaceTabs.findIndex((tab) => tab.id === selected)
      ];
    if (button?.parentElement)
      button.parentElement.scrollLeft =
        button.offsetLeft -
        button.parentElement.offsetLeft -
        button.parentElement.clientWidth / 2 +
        button.clientWidth / 2;
  }, [selected]);
  function select(tab: GraphicWorkspaceTab) {
    const url = new URL(window.location.href);
    url.searchParams.delete("edit");
    url.searchParams.delete("quote");
    url.searchParams.set("tab", tab);
    window.history.pushState(null, "", url);
  }
  return (
    <>
      <nav
        ref={progress}
        aria-label="Andamento do trabalho"
        className="relative overflow-x-auto rounded-xl border bg-card p-3"
      >
        <ol className="flex min-w-max gap-2">
          {steps.map((step, index) => {
            const state =
              stage < 0
                ? "Cancelado"
                : index < stage || closed
                  ? "Concluída"
                  : index === stage
                    ? attention
                      ? "Requer atenção"
                      : "Atual"
                    : "Pendente";
            return (
              <li key={step.label} className="flex-1">
                <button
                  type="button"
                  onClick={() => select(step.tab)}
                  aria-current={index === stage ? "step" : undefined}
                  className={`w-full rounded-lg border px-4 py-3 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${index === stage ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted"}`}
                >
                  <span className="block font-semibold">
                    {index + 1}. {step.label}
                  </span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {state}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-primary/20 bg-primary/5 p-5">
        <div>
          <p className="text-xs uppercase text-muted-foreground">
            Próxima ação
          </p>
          <h2 className="mt-1 text-lg font-semibold">{nextAction}</h2>
          <p className="mt-1 text-sm">Responsável: {owner}</p>
          {waiting ? <p className="mt-2 text-sm">{waiting}</p> : null}
        </div>
        <button
          type="button"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          onClick={() => select(nextTab)}
        >
          {closed || stage < 0 ? "Consultar trabalho" : "Continuar etapa"}
        </button>
      </div>
      <div className="min-w-0">
        <div
          role="tablist"
          aria-label="Seções do trabalho"
          className="flex overflow-x-auto border-b"
        >
          {graphicWorkspaceTabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(node) => {
                tabButtons.current[index] = node;
              }}
              type="button"
              role="tab"
              id={`tab-${tab.id}`}
              aria-controls={`panel-${tab.id}`}
              aria-selected={selected === tab.id}
              tabIndex={selected === tab.id ? 0 : -1}
              onClick={() => select(tab.id)}
              onKeyDown={(event) => {
                let target = index;
                if (event.key === "ArrowRight")
                  target = (index + 1) % graphicWorkspaceTabs.length;
                else if (event.key === "ArrowLeft")
                  target =
                    (index - 1 + graphicWorkspaceTabs.length) %
                    graphicWorkspaceTabs.length;
                else if (event.key === "Home") target = 0;
                else if (event.key === "End")
                  target = graphicWorkspaceTabs.length - 1;
                else return;
                event.preventDefault();
                select(graphicWorkspaceTabs[target].id);
                tabButtons.current[target]?.focus();
              }}
              className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${selected === tab.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:bg-muted"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {graphicWorkspaceTabs.map((tab) => (
          <section
            key={tab.id}
            role="tabpanel"
            id={`panel-${tab.id}`}
            aria-labelledby={`tab-${tab.id}`}
            tabIndex={0}
            hidden={selected !== tab.id}
            className={selected === tab.id ? "grid gap-5 pt-5" : "hidden"}
          >
            {panels[tab.id]}
          </section>
        ))}
      </div>
    </>
  );
}

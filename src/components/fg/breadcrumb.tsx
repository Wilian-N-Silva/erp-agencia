"use client";

import { usePathname } from "next/navigation";
import { Fragment } from "react";

const ROUTE_TITLES: Record<string, string[]> = {
  "/app": ["Dashboard"],
  "/app/alertas": ["Operação", "Alertas"],
  "/app/financeiro": ["Financeiro"],
  "/app/clientes": ["Financeiro", "Clientes"],
  "/app/grafica": ["Operação", "Gráfica"],
  "/app/colaboradores": ["Pessoas", "Colaboradores"],
  "/app/colaboradores/admissoes": ["Pessoas", "Admissões"],
  "/app/colaboradores/desligamentos": ["Pessoas", "Desligamentos"],
  "/app/colaboradores/novo": ["Pessoas", "Colaboradores", "Novo"],
  "/app/ferias": ["Pessoas", "Férias e ausências"],
  "/app/nfs": ["Fluxos", "NFs PJ"],
  "/app/reembolsos": ["Fluxos", "Reembolsos"],
  "/app/equipamentos": ["TI e Governança", "Equipamentos"],
  "/app/acessos": ["TI e Governança", "Acessos"],
  "/app/assinaturas": ["TI e Governança", "Assinaturas"],
  "/app/documentos": ["Administração", "Documentos"],
  "/app/auditoria": ["Administração", "Auditoria"],
  "/app/configuracoes": ["Administração", "Configurações"],
  "/portal": ["Portal do colaborador"],
};

function resolveCrumbs(pathname: string | null): string[] {
  if (!pathname) return ["Dashboard"];
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];

  // Strip trailing slash and try again
  const trimmed = pathname.replace(/\/$/, "");
  if (ROUTE_TITLES[trimmed]) return ROUTE_TITLES[trimmed];

  // Best-effort dynamic resolution
  if (/^\/app\/clientes\/[^/]+/.test(pathname)) {
    return ["Financeiro", "Clientes", "Detalhe"];
  }
  if (/^\/app\/grafica\/[^/]+/.test(pathname)) {
    return ["Operação", "Gráfica", pathname.endsWith("/novo") ? "Novo" : "Detalhe"];
  }
  if (/^\/app\/colaboradores\/[^/]+/.test(pathname)) {
    return ["Pessoas", "Colaboradores", "Detalhe"];
  }
  if (/^\/app\/assinaturas\/[^/]+/.test(pathname)) {
    return ["TI e Governança", "Assinaturas", "Detalhe"];
  }
  if (/^\/app\/auditoria\/[^/]+/.test(pathname)) {
    return ["Administração", "Auditoria", "Evento"];
  }

  // Fallback: split the path
  return pathname.split("/").filter(Boolean).map(decodeURIComponent);
}

export function Breadcrumb({ overrideLast }: { overrideLast?: string }) {
  const pathname = usePathname();
  const crumbs = resolveCrumbs(pathname);
  if (overrideLast && crumbs.length > 0) {
    crumbs[crumbs.length - 1] = overrideLast;
  }

  return (
    <nav className="fg-breadcrumb" aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <Fragment key={`${c}-${i}`}>
          {i > 0 && <span className="fg-bc-sep">/</span>}
          <span className={i === crumbs.length - 1 ? "fg-bc-current" : "fg-bc-link"}>
            {c}
          </span>
        </Fragment>
      ))}
    </nav>
  );
}

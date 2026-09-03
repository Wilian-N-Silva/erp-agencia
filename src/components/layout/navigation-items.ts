import type { AccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";
import type { PermissionKey } from "@/lib/rbac";

export type NavigationIcon =
  | "dashboard"
  | "finance"
  | "finance-in"
  | "finance-out"
  | "finance-provision"
  | "clients"
  | "graphics"
  | "invoices"
  | "people"
  | "timeoff"
  | "documents"
  | "reimbursements"
  | "equipment"
  | "access"
  | "saas"
  | "onboarding"
  | "offboarding"
  | "alerts"
  | "audit"
  | "settings"
  | "portal";

export type NavigationSection =
  | "Operação"
  | "Financeiro"
  | "Pessoas"
  | "Fluxos"
  | "TI e Governança"
  | "Administração"
  | "Outros";

export type NavigationItem = {
  href: string;
  label: string;
  icon: NavigationIcon;
  section: NavigationSection;
  permissions: PermissionKey[];
  badge?: number;
};

export const navigationItems: NavigationItem[] = [
  {
    href: "/app",
    label: "Dashboard",
    icon: "dashboard",
    section: "Operação",
    permissions: ["dashboard.read", "dashboard.configure"],
  },
  {
    href: "/app/grafica",
    label: "Gráfica",
    icon: "graphics",
    section: "Operação",
    permissions: ["graphics.read", "graphics.write"],
  },
  {
    href: "/app/alertas",
    label: "Alertas",
    icon: "alerts",
    section: "Operação",
    permissions: ["alerts.read", "alerts.write"],
  },
  {
    href: "/app/financeiro/entradas",
    label: "Contas a receber",
    icon: "finance-in",
    section: "Financeiro",
    permissions: ["finance.read"],
  },
  {
    href: "/app/financeiro/saidas",
    label: "Contas a pagar",
    icon: "finance-out",
    section: "Financeiro",
    permissions: ["finance.read"],
  },
  {
    href: "/app/financeiro/provisoes",
    label: "Provisões",
    icon: "finance-provision",
    section: "Financeiro",
    permissions: ["finance.read"],
  },
  {
    href: "/app/financeiro/movimentacoes",
    label: "Movimentações",
    icon: "finance",
    section: "Financeiro",
    permissions: ["finance.read"],
  },
  {
    href: "/app/financeiro/cadastros",
    label: "Cadastros financeiros",
    icon: "finance",
    section: "Financeiro",
    permissions: ["finance.read", "finance.configure"],
  },
  {
    href: "/app/clientes",
    label: "Clientes",
    icon: "clients",
    section: "Financeiro",
    permissions: ["clients.read", "clients.read_limited", "clients.configure"],
  },
  {
    href: "/app/colaboradores",
    label: "Colaboradores",
    icon: "people",
    section: "Pessoas",
    permissions: ["people.read", "people.read_team", "people.read_own", "people.configure"],
  },
  {
    href: "/app/colaboradores/admissoes",
    label: "Admissões",
    icon: "onboarding",
    section: "Pessoas",
    permissions: ["lifecycle.read", "lifecycle.write"],
  },
  {
    href: "/app/colaboradores/desligamentos",
    label: "Desligamentos",
    icon: "offboarding",
    section: "Pessoas",
    permissions: ["lifecycle.read", "lifecycle.write"],
  },
  {
    href: "/app/ferias",
    label: "Férias e ausências",
    icon: "timeoff",
    section: "Pessoas",
    permissions: ["timeoff.read", "timeoff.write", "timeoff.read_team"],
  },
  {
    href: "/app/nfs",
    label: "NFs PJ",
    icon: "invoices",
    section: "Fluxos",
    permissions: ["invoices.read", "invoices.write", "invoices.approve"],
  },
  {
    href: "/app/reembolsos",
    label: "Reembolsos",
    icon: "reimbursements",
    section: "Fluxos",
    permissions: [
      "reimbursements.read",
      "reimbursements.approve_team",
      "reimbursements.approve_finance",
    ],
  },
  {
    href: "/app/equipamentos",
    label: "Equipamentos",
    icon: "equipment",
    section: "TI e Governança",
    permissions: ["equipment.read", "equipment.write", "equipment.read_team", "equipment.configure"],
  },
  {
    href: "/app/acessos",
    label: "Acessos",
    icon: "access",
    section: "TI e Governança",
    permissions: [
      "access_records.read",
      "access_records.write",
      "access_records.read_team",
      "access_records.configure",
    ],
  },
  {
    href: "/app/assinaturas",
    label: "Assinaturas",
    icon: "saas",
    section: "TI e Governança",
    permissions: ["saas.read", "saas.write", "saas.configure"],
  },
  {
    href: "/app/documentos",
    label: "Documentos",
    icon: "documents",
    section: "Administração",
    permissions: ["documents.write", "documents.read_sensitive"],
  },
  {
    href: "/app/auditoria",
    label: "Auditoria",
    icon: "audit",
    section: "Administração",
    permissions: ["audit.read", "audit.read_limited"],
  },
  {
    href: "/app/configuracoes",
    label: "Configurações",
    icon: "settings",
    section: "Administração",
    permissions: ["settings.read", "settings.manage"],
  },
  {
    href: "/portal",
    label: "Portal",
    icon: "portal",
    section: "Outros",
    permissions: ["people.read_own"],
  },
];

export function getVisibleNavigationItems(context: AccessContext) {
  return navigationItems.filter((item) => canAny(item.permissions, context));
}

export const sectionOrder: NavigationSection[] = [
  "Operação",
  "Financeiro",
  "Pessoas",
  "Fluxos",
  "TI e Governança",
  "Administração",
  "Outros",
];

export function groupNavigationItems(items: NavigationItem[]) {
  const groups = new Map<NavigationSection, NavigationItem[]>();
  for (const item of items) {
    const list = groups.get(item.section) ?? [];
    list.push(item);
    groups.set(item.section, list);
  }
  return sectionOrder
    .map((section) => ({ section, items: groups.get(section) ?? [] }))
    .filter((g) => g.items.length > 0);
}

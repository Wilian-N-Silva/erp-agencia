import type { AccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";
import type { PermissionKey } from "@/lib/rbac";

export type NavigationIcon =
  | "dashboard"
  | "finance"
  | "clients"
  | "people"
  | "reimbursements"
  | "equipment"
  | "access"
  | "saas"
  | "audit"
  | "settings"
  | "portal";

export type NavigationItem = {
  href: string;
  label: string;
  icon: NavigationIcon;
  permissions: PermissionKey[];
};

export const navigationItems: NavigationItem[] = [
  {
    href: "/app",
    label: "Dashboard",
    icon: "dashboard",
    permissions: ["dashboard.read", "dashboard.configure"],
  },
  {
    href: "/app/financeiro",
    label: "Financeiro",
    icon: "finance",
    permissions: ["finance.read"],
  },
  {
    href: "/app/clientes",
    label: "Clientes",
    icon: "clients",
    permissions: ["clients.read", "clients.read_limited", "clients.configure"],
  },
  {
    href: "/app/colaboradores",
    label: "Colaboradores",
    icon: "people",
    permissions: ["people.read", "people.read_team", "people.read_own"],
  },
  {
    href: "/app/reembolsos",
    label: "Reembolsos",
    icon: "reimbursements",
    permissions: [
      "reimbursements.read",
      "reimbursements.approve_team",
      "reimbursements.read_own",
    ],
  },
  {
    href: "/app/equipamentos",
    label: "Equipamentos",
    icon: "equipment",
    permissions: ["equipment.read", "equipment.read_team", "equipment.read_own"],
  },
  {
    href: "/app/acessos",
    label: "Acessos",
    icon: "access",
    permissions: [
      "access_records.read",
      "access_records.read_team",
      "access_records.read_own",
    ],
  },
  {
    href: "/app/saas",
    label: "SaaS",
    icon: "saas",
    permissions: ["saas.read", "saas.read_linked", "saas.configure"],
  },
  {
    href: "/app/auditoria",
    label: "Auditoria",
    icon: "audit",
    permissions: ["audit.read", "audit.read_limited"],
  },
  {
    href: "/app/configuracoes",
    label: "Configuracoes",
    icon: "settings",
    permissions: ["settings.read", "settings.manage"],
  },
  {
    href: "/portal",
    label: "Portal",
    icon: "portal",
    permissions: ["people.read_own"],
  },
];

export function getVisibleNavigationItems(context: AccessContext) {
  return navigationItems.filter((item) => canAny(item.permissions, context));
}

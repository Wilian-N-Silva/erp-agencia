import type { AccessContext } from "@/lib/dal";
import { canAny } from "@/lib/rbac";
import type { PermissionKey } from "@/lib/rbac";

export type NavigationIcon =
  | "dashboard"
  | "finance"
  | "clients"
  | "invoices"
  | "people"
  | "timeoff"
  | "documents"
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
    permissions: ["people.read", "people.read_team", "people.read_own", "people.configure"],
  },
  {
    href: "/app/ferias",
    label: "Ferias/Pausas",
    icon: "timeoff",
    permissions: ["timeoff.read", "timeoff.write", "timeoff.read_team"],
  },
  {
    href: "/app/documentos",
    label: "Documentos",
    icon: "documents",
    permissions: ["documents.write", "documents.read_sensitive"],
  },
  {
    href: "/app/nfs",
    label: "NFs PJ",
    icon: "invoices",
    permissions: ["invoices.read", "invoices.write", "invoices.approve"],
  },
  {
    href: "/app/reembolsos",
    label: "Reembolsos",
    icon: "reimbursements",
    permissions: ["reimbursements.read", "reimbursements.approve_team", "reimbursements.approve_finance"],
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

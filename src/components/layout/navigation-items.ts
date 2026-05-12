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
    href: "/portal",
    label: "Portal",
    icon: "portal",
    permissions: ["people.read_own"],
  },
];

export function getVisibleNavigationItems(context: AccessContext) {
  return navigationItems.filter((item) => canAny(item.permissions, context));
}

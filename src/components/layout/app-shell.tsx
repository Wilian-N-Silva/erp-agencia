import type { ReactNode } from "react";

import { ShellChrome } from "@/components/fg/shell-chrome";

import {
  getVisibleNavigationItems,
  groupNavigationItems,
} from "./navigation-items";
import type { NavigationItem } from "./navigation-items";

import type { AccessContext } from "@/lib/dal";
import { roleLabels } from "@/lib/rbac";

interface AppShellProps {
  children: ReactNode;
  context: AccessContext;
  user?: { name?: string | null; email?: string | null };
}

export function AppShell({ children, context, user }: AppShellProps) {
  const items: NavigationItem[] = getVisibleNavigationItems(context);
  const navGroups = groupNavigationItems(items);
  const primaryRole = context.roles[0] ? roleLabels[context.roles[0]] : "Sem papel";

  const displayName = user?.name?.trim() || user?.email?.split("@")[0] || "Usuário";

  return (
    <ShellChrome
      user={{ name: displayName, role: primaryRole }}
      navGroups={navGroups}
      allNavItems={items}
    >
      {children}
    </ShellChrome>
  );
}

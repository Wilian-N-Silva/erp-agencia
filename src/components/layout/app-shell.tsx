import {
  BadgeDollarSign,
  Boxes,
  Building2,
  ClipboardList,
  FileClock,
  Gauge,
  KeyRound,
  Laptop,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

import type { AccessContext } from "@/lib/dal";
import { roleLabels } from "@/lib/rbac";

import {
  getVisibleNavigationItems,
  type NavigationIcon,
} from "./navigation-items";

const iconMap: Record<NavigationIcon, LucideIcon> = {
  dashboard: Gauge,
  finance: BadgeDollarSign,
  clients: Building2,
  people: Users,
  reimbursements: ClipboardList,
  equipment: Laptop,
  access: KeyRound,
  saas: Boxes,
  audit: FileClock,
  settings: Settings,
  portal: UserRound,
};

export function AppShell({
  children,
  context,
}: {
  children: ReactNode;
  context: AccessContext;
}) {
  const items = getVisibleNavigationItems(context);
  const primaryRole = context.roles[0] ? roleLabels[context.roles[0]] : "Sem papel";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-card lg:block">
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center gap-3 border-b px-5">
            <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Sistema Interno FG</p>
              <p className="truncate text-xs text-muted-foreground">{primaryRole}</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
            {items.map((item) => {
              const Icon = iconMap[item.icon];

              return (
                <Link
                  className="flex h-10 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  href={item.href as Route}
                  key={item.href}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
          <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">Sistema Interno FG</p>
              <p className="truncate text-xs text-muted-foreground lg:hidden">
                {primaryRole}
              </p>
            </div>
            <div className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {context.roles.length} perfil
            </div>
          </div>
        </header>

        <main className="px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

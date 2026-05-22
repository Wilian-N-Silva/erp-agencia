"use client";

import {
  ExternalLink,
  FileText,
  FolderLock,
  KeyRound,
  Laptop,
  LogOut,
  Moon,
  Receipt,
  Settings,
  Sun,
  Umbrella,
  User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter, usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Avatar, Dropdown, FGLogo, useThemeToggle } from "@/components/fg";

interface NavItem {
  href: Route;
  label: string;
  icon: LucideIcon;
  pjOnly?: boolean;
}

const NAV: NavItem[] = [
  { href: "/portal", label: "Início", icon: User },
  { href: "/portal/nfs" as Route, label: "NFs", icon: FileText, pjOnly: true },
  { href: "/portal/reembolsos" as Route, label: "Reembolsos", icon: Receipt },
  { href: "/portal/ferias" as Route, label: "Férias", icon: Umbrella },
  { href: "/portal/documentos" as Route, label: "Documentos", icon: FolderLock },
  { href: "/portal/equipamentos" as Route, label: "Equipamentos", icon: Laptop },
  { href: "/portal/acessos" as Route, label: "Acessos", icon: KeyRound },
  { href: "/portal/dados" as Route, label: "Meus dados", icon: Settings },
];

export interface PortalShellProps {
  children: ReactNode;
  user: { name: string; registrationNumber: string | null };
  employmentType: string;
}

export function PortalShell({ children, user, employmentType }: PortalShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, toggle, mounted } = useThemeToggle();
  const isPJ = employmentType === "pj";
  const items = NAV.filter((item) => !item.pjOnly || isPJ);
  const firstName = (user.name || "").split(/\s+/)[0] || "Usuário";

  const isActive = (href: string) =>
    pathname === href || (href !== "/portal" && pathname.startsWith(href));

  return (
    <div className="fg-portal">
      <header className="fg-portal-header">
        <div className="fg-portal-header-inner">
          <Link href={"/portal" as Route} className="fg-portal-logo">
            <FGLogo size={22} />
          </Link>

          <nav className="fg-portal-nav">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`fg-portal-tab ${active ? "active" : ""}`.trim()}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="fg-portal-header-right">
            <button
              type="button"
              className="fg-icon-btn"
              onClick={toggle}
              aria-label="Alternar tema"
              suppressHydrationWarning
            >
              {!mounted ? <Moon size={16} /> : theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            <Dropdown
              align="right"
              trigger={
                <button type="button" className="fg-portal-user">
                  <Avatar name={user.name} size={32} />
                  <div className="fg-portal-user-meta">
                    <div className="fg-portal-user-name">{firstName}</div>
                    {user.registrationNumber ? (
                      <div className="fg-portal-user-role fg-tabular">
                        {user.registrationNumber}
                      </div>
                    ) : null}
                  </div>
                </button>
              }
              items={[
                {
                  label: "Meus dados",
                  icon: <User size={14} />,
                  onClick: () => router.push("/portal/dados" as Route),
                },
                {
                  label: theme === "dark" ? "Tema claro" : "Tema escuro",
                  icon: theme === "dark" ? <Sun size={14} /> : <Moon size={14} />,
                  onClick: toggle,
                },
                { separator: true },
                {
                  label: "Ir para back-office",
                  icon: <ExternalLink size={14} />,
                  onClick: () => router.push("/app" as Route),
                },
                {
                  label: "Sair",
                  icon: <LogOut size={14} />,
                  danger: true,
                  onClick: () => {
                    window.location.href = "/login";
                  },
                },
              ]}
            />
          </div>
        </div>
      </header>

      <main className="fg-portal-main">
        <div className="fg-portal-container">{children}</div>
      </main>

      <nav className="fg-portal-bottom-nav">
        {items.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`fg-portal-bnav-item ${active ? "active" : ""}`.trim()}
            >
              <Icon size={15} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

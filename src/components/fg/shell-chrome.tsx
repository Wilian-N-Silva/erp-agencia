"use client";

import { Bell, ChevronUp, LogOut, Search, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Route } from "next";
import { useEffect, useState } from "react";

import { Avatar, FGLogo } from "@/components/fg/atoms";
import { Breadcrumb } from "@/components/fg/breadcrumb";
import { CommandPalette } from "@/components/fg/command-palette";
import { Dropdown } from "@/components/fg/dropdown";
import { NavIcon } from "@/components/fg/icon-map";
import { ThemeToggle, useThemeToggle } from "@/components/fg/theme-toggle";
import type { NavigationItem } from "@/components/layout/navigation-items";

interface NavGroup {
  section: string;
  items: NavigationItem[];
}

export interface ShellChromeProps {
  user: { name: string; role: string };
  navGroups: NavGroup[];
  allNavItems: NavigationItem[];
  children: React.ReactNode;
}

function isItemActive(itemHref: string, pathname: string) {
  if (itemHref === "/app") return pathname === "/app";
  return pathname === itemHref || pathname.startsWith(`${itemHref}/`);
}

function Sidebar({
  navGroups,
  user,
}: {
  navGroups: NavGroup[];
  user: { name: string; role: string };
}) {
  const pathname = usePathname() ?? "";
  const { theme, toggle: toggleTheme } = useThemeToggle();

  return (
    <aside className="fg-sidebar">
      <div className="fg-sidebar-head">
        <Link href={"/app" as Route} className="fg-sidebar-logo">
          <FGLogo size={22} wordmark />
        </Link>
      </div>
      <nav className="fg-sidebar-nav">
        {navGroups.map((group) => (
          <div className="fg-nav-section" key={group.section}>
            <div className="fg-nav-section-label">{group.section}</div>
            {group.items.map((item) => {
              const active = isItemActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href as Route}
                  className={`fg-nav-item ${active ? "active" : ""}`.trim()}
                >
                  <span className="fg-nav-icon">
                    <NavIcon name={item.icon} size={16} />
                  </span>
                  <span className="fg-nav-label">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="fg-nav-badge">{item.badge}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="fg-sidebar-foot">
        <Dropdown
          align="left"
          trigger={
            <button type="button" className="fg-user-trigger">
              <Avatar name={user.name} size={28} />
              <div className="fg-user-meta">
                <div className="fg-user-name">{user.name}</div>
                <div className="fg-user-role">{user.role}</div>
              </div>
              <ChevronUp size={14} style={{ opacity: 0.4 }} />
            </button>
          }
          items={[
            {
              label: theme === "dark" ? "Tema claro" : "Tema escuro",
              icon: theme === "dark" ? "☀" : "☾",
              onClick: toggleTheme,
            },
            {
              label: "Configurações",
              icon: <Settings size={14} />,
            },
            { separator: true },
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
    </aside>
  );
}

function Header({
  onOpenCommand,
}: {
  onOpenCommand: () => void;
}) {
  return (
    <header className="fg-header">
      <Breadcrumb />
      <div className="fg-header-right">
        <button
          type="button"
          className="fg-cmdk-trigger"
          onClick={onOpenCommand}
        >
          <Search size={14} />
          <span>Buscar</span>
          <kbd className="fg-kbd">⌘K</kbd>
        </button>
        <ThemeToggle />
        <button type="button" className="fg-icon-btn fg-bell" aria-label="Notificações">
          <Bell size={16} />
          <span className="fg-bell-dot" />
        </button>
      </div>
    </header>
  );
}

export function ShellChrome({
  user,
  navGroups,
  allNavItems,
  children,
}: ShellChromeProps) {
  const [cmdkOpen, setCmdkOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen((v) => !v);
      } else if (e.key === "Escape") {
        setCmdkOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="fg-shell">
      <Sidebar navGroups={navGroups} user={user} />
      <div className="fg-main">
        <Header onOpenCommand={() => setCmdkOpen(true)} />
        <div className="fg-content">{children}</div>
      </div>
      <CommandPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        navItems={allNavItems}
      />
    </div>
  );
}

"use client";

import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useEffect, useRef, useState } from "react";

import { NavIcon } from "@/components/fg/icon-map";
import type { NavigationItem } from "@/components/layout/navigation-items";

interface CommandItem {
  kind: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  href: string;
}

function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function CommandPalette({
  open,
  onClose,
  navItems,
}: {
  open: boolean;
  onClose: () => void;
  navItems: NavigationItem[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      window.setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const all: CommandItem[] = navItems.map((item) => ({
    kind: "Páginas",
    label: item.label,
    hint: item.section,
    icon: <NavIcon name={item.icon} size={14} />,
    href: item.href,
  }));

  const q = normalize(query.trim());
  const filtered = q
    ? all.filter(
        (it) =>
          normalize(it.label).includes(q) ||
          normalize(it.hint ?? "").includes(q) ||
          normalize(it.kind).includes(q),
      )
    : all;

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, it) => {
    (acc[it.kind] ??= []).push(it);
    return acc;
  }, {});

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const first = filtered[0];
      if (first) {
        router.push(first.href as Route);
        onClose();
      }
    }
  };

  return (
    <div className={`fg-cmdk-root ${open ? "open" : ""}`.trim()}>
      <div className="fg-cmdk-scrim" onClick={onClose} />
      <div className="fg-cmdk-shell">
        <div className="fg-cmdk-search">
          <Search size={16} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Buscar páginas, clientes, fornecedores, ações..."
          />
          <kbd className="fg-kbd">esc</kbd>
        </div>
        <div className="fg-cmdk-list">
          {Object.entries(grouped).length === 0 ? (
            <div className="fg-cmdk-empty">Nenhum resultado para &ldquo;{query}&rdquo;</div>
          ) : (
            Object.entries(grouped).map(([kind, items]) => (
              <div key={kind} className="fg-cmdk-group">
                <div className="fg-cmdk-group-label">{kind}</div>
                {items.slice(0, 8).map((it, i) => (
                  <button
                    type="button"
                    key={`${it.href}-${i}`}
                    className="fg-cmdk-item"
                    onClick={() => {
                      router.push(it.href as Route);
                      onClose();
                    }}
                  >
                    <span className="fg-cmdk-icon">{it.icon}</span>
                    <span className="fg-cmdk-label">{it.label}</span>
                    {it.hint && <span className="fg-cmdk-hint">{it.hint}</span>}
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
        <div className="fg-cmdk-foot">
          <span>
            <kbd className="fg-kbd">↵</kbd> selecionar
          </span>
          <span>
            <kbd className="fg-kbd">↑↓</kbd> navegar
          </span>
          <span>
            <kbd className="fg-kbd">esc</kbd> fechar
          </span>
        </div>
      </div>
    </div>
  );
}

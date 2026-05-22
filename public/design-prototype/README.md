# Sistema Interno FG — Design Prototype

Source-of-truth prototype handed off from Claude Design (claude.ai/design),
served unmodified by Next.js from `public/`.

- Open in dev: <http://localhost:3000/design> (redirects to `/design-prototype/index.html`)
- Tech: React 18 + Babel-standalone via CDN. No build step.
- Light/dark theme persisted to `localStorage` (key: `fg.theme`). Tweaks panel
  bottom-right exposes 6 visual variations.

## What's implemented in the prototype

Shell (sidebar with 17 routes, breadcrumb, ⌘K, theme toggle, notifications),
Dashboard (Diretoria), Financeiro (Entradas / Saídas / Provisões + Sheet de
criar-editar), Fluxos (NFs / Reembolsos / Férias com calendário), Pessoas
(Colaboradores listagem + detalhe 11 tabs, Admissões, Desligamentos), Clientes
(listagem + detalhe 6 tabs), Assinaturas (cards/lista + detalhe 4 tabs), Portal
do Colaborador (shell distinto). Demais módulos (TI/Governança, etc.) ficam
como placeholders navegáveis.

## Porting roadmap to the real Next.js app

The prototype is the visual spec; production code should live under
`src/app/(private)` and `src/components`. Suggested order — each step is its
own PR:

1. **Design tokens** — extract from `src/styles.css` (`:root` and
   `[data-theme="dark"]` blocks) into `src/app/globals.css` and a Tailwind
   theme extension. Load Inter Tight + JetBrains Mono via `next/font`.
2. **Shell** — port `src/layout.jsx` (`Sidebar`, `Header`, `Breadcrumb`,
   `CommandPalette`, theme toggle) to `src/components/layout/app-shell.tsx`.
   Map the 17 sidebar items to real Next.js routes; gate by RBAC.
3. **UI atoms** — port `src/ui.jsx` (`Button`, `Badge`, `KPI`, `DataTable`,
   `Sheet`, `Dialog`, `FilterPopover`, `Toast`) into `src/components/ui/*`.
   Keep `class-variance-authority` for variants.
4. **Dashboard** — `src/dashboard.jsx` → `src/app/(private)/app/page.tsx`.
   Wire KPI cards and pendency lists to real Drizzle queries.
5. **Financeiro** — `src/financeiro.jsx` is the largest module (675 lines:
   tabs Entradas/Saídas/Provisões + Sheet). Map to existing `/app/financeiro`
   routes if present, otherwise create them.
6. **Fluxos** (NFs / Reembolsos / Férias) — `src/fluxos.jsx`. NFs flow
   already exists in the repo; align visuals with the prototype.
7. **Pessoas** — `src/pessoas.jsx` (750 lines, 11-tab detail page). The
   biggest single port.
8. **Clientes** — `src/clientes.jsx` (6-tab detail).
9. **Assinaturas** — `src/assinaturas.jsx`.
10. **Portal do Colaborador** — `src/portal.jsx`. Maps to existing `/portal`.
11. **Tweaks panel** — keep only the variations the team decides to ship; the
    rest were exploration scaffolding.

When porting, copy the visuals exactly. Don't copy the prototype's internal
structure unless it happens to fit (it uses Babel-CDN React and global mock
data, neither of which belong in production).

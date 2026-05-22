// Layout shell — Sistema Interno FG
// Sidebar + Header + Command Palette (⌘K) + Theme provider.

// ────────────────────────────────────────────────────────────────────────────
// Theme context
// ────────────────────────────────────────────────────────────────────────────
const ThemeContext = React.createContext({ theme: "light", setTheme: () => {} });
const useTheme = () => React.useContext(ThemeContext);
const ThemeProvider = ({ children, initial = "light" }) => {
  const [theme, setTheme] = React.useState(() => {
    try { return localStorage.getItem("fg-theme") || initial; } catch { return initial; }
  });
  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem("fg-theme", theme); } catch {}
  }, [theme]);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
};

// ────────────────────────────────────────────────────────────────────────────
// Router (hash-based, simple)
// ────────────────────────────────────────────────────────────────────────────
const RouterContext = React.createContext({ path: "/dashboard", go: () => {} });
const useRouter = () => React.useContext(RouterContext);
const RouterProvider = ({ children }) => {
  const [path, setPath] = React.useState(() => {
    const h = (location.hash || "").replace(/^#/, "");
    return h || "/dashboard";
  });
  React.useEffect(() => {
    const onChange = () => setPath((location.hash || "").replace(/^#/, "") || "/dashboard");
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const go = React.useCallback((p) => { location.hash = p; }, []);
  return <RouterContext.Provider value={{ path, go }}>{children}</RouterContext.Provider>;
};

// ────────────────────────────────────────────────────────────────────────────
// Sidebar configuration
// ────────────────────────────────────────────────────────────────────────────
const SIDEBAR = [
  {
    section: "Operação",
    items: [
      { label: "Dashboard", path: "/dashboard", icon: <IconDashboard size={16} /> },
      { label: "Alertas", path: "/alertas", icon: <IconBell size={16} />, badge: 3 },
    ],
  },
  {
    section: "Financeiro",
    items: [
      { label: "Entradas", path: "/financeiro/entradas", icon: <IconArrowDownRight size={16} /> },
      { label: "Saídas", path: "/financeiro/saidas", icon: <IconArrowUpRight size={16} /> },
      { label: "Provisões", path: "/financeiro/provisoes", icon: <IconRepeat size={16} /> },
      { label: "Clientes", path: "/clientes", icon: <IconBuilding size={16} /> },
    ],
  },
  {
    section: "Pessoas",
    items: [
      { label: "Colaboradores", path: "/colaboradores", icon: <IconUsers size={16} /> },
      { label: "Admissões", path: "/admissoes", icon: <IconUserPlus size={16} />, badge: 1 },
      { label: "Desligamentos", path: "/desligamentos", icon: <IconUserMinus size={16} /> },
    ],
  },
  {
    section: "Fluxos",
    items: [
      { label: "NFs", path: "/nfs", icon: <IconFile size={16} />, badge: 2 },
      { label: "Reembolsos", path: "/reembolsos", icon: <IconReceipt size={16} />, badge: 4 },
      { label: "Férias e ausências", path: "/ferias", icon: <IconCalendar size={16} /> },
    ],
  },
  {
    section: "TI e Governança",
    items: [
      { label: "Equipamentos", path: "/equipamentos", icon: <IconLaptop size={16} /> },
      { label: "Acessos", path: "/acessos", icon: <IconKey size={16} /> },
      { label: "Assinaturas", path: "/assinaturas", icon: <IconBoxes size={16} /> },
    ],
  },
  {
    section: "Administração",
    items: [
      { label: "Auditoria", path: "/auditoria", icon: <IconScroll size={16} /> },
      { label: "Configurações", path: "/configuracoes", icon: <IconSettings size={16} /> },
    ],
  },
];

// ────────────────────────────────────────────────────────────────────────────
// Sidebar
// ────────────────────────────────────────────────────────────────────────────
const Sidebar = ({ density = "regular" }) => {
  const { path, go } = useRouter();
  const isActive = (p) => path === p || (p !== "/dashboard" && path.startsWith(p));
  return (
    <aside className={`fg-sidebar fg-density-${density}`}>
      <div className="fg-sidebar-head">
        <a href="#/dashboard" className="fg-sidebar-logo">
          <FGLogo size={22} wordmark={true} />
        </a>
      </div>
      <nav className="fg-sidebar-nav">
        {SIDEBAR.map((sec) => (
          <div className="fg-nav-section" key={sec.section}>
            <div className="fg-nav-section-label">{sec.section}</div>
            {sec.items.map((it) => (
              <a
                key={it.path}
                href={`#${it.path}`}
                className={`fg-nav-item ${isActive(it.path) ? "active" : ""}`}
                onClick={(e) => { e.preventDefault(); go(it.path); }}
              >
                <span className="fg-nav-icon">{it.icon}</span>
                <span className="fg-nav-label">{it.label}</span>
                {it.badge != null && <span className="fg-nav-badge">{it.badge}</span>}
              </a>
            ))}
          </div>
        ))}
      </nav>
      <div className="fg-sidebar-foot">
        <UserMenu />
      </div>
    </aside>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// User menu (bottom of sidebar)
// ────────────────────────────────────────────────────────────────────────────
const UserMenu = () => {
  const { theme, setTheme } = useTheme();
  const u = window.FG_USER;
  return (
    <Dropdown
      align="left"
      trigger={
        <button className="fg-user-trigger">
          <Avatar name={u.nome} size={28} />
          <div className="fg-user-meta">
            <div className="fg-user-name">{u.nome}</div>
            <div className="fg-user-role">{u.cargo}</div>
          </div>
          <IconChevronUp size={14} style={{ opacity: 0.4 }} />
        </button>
      }
      items={[
        { label: "Meu perfil", icon: <IconUser size={14} /> },
        {
          label: theme === "dark" ? "Tema claro" : "Tema escuro",
          icon: theme === "dark" ? <IconSun size={14} /> : <IconMoon size={14} />,
          onClick: () => setTheme(theme === "dark" ? "light" : "dark"),
        },
        { label: "Configurações", icon: <IconSettings size={14} /> },
        { separator: true },
        { label: "Ir para portal do colaborador", icon: <IconExternal size={14} />, onClick: () => { location.hash = "/portal"; } },
        { separator: true },
        { label: "Sair", icon: <IconLogout size={14} />, danger: true },
      ]}
    />
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Breadcrumb
// ────────────────────────────────────────────────────────────────────────────
const ROUTE_TITLES = {
  "/dashboard": ["Dashboard"],
  "/alertas": ["Alertas"],
  "/financeiro/entradas": ["Financeiro", "Entradas"],
  "/financeiro/saidas": ["Financeiro", "Saídas"],
  "/financeiro/provisoes": ["Financeiro", "Provisões"],
  "/clientes": ["Clientes"],
  "/colaboradores": ["Pessoas", "Colaboradores"],
  "/admissoes": ["Pessoas", "Admissões"],
  "/desligamentos": ["Pessoas", "Desligamentos"],
  "/nfs": ["Fluxos", "NFs"],
  "/reembolsos": ["Fluxos", "Reembolsos"],
  "/ferias": ["Fluxos", "Férias e ausências"],
  "/equipamentos": ["TI e Governança", "Equipamentos"],
  "/acessos": ["TI e Governança", "Acessos"],
  "/assinaturas": ["TI e Governança", "Assinaturas"],
  "/auditoria": ["Administração", "Auditoria"],
  "/configuracoes": ["Administração", "Configurações"],
};

const Breadcrumb = () => {
  const { path } = useRouter();
  // Dynamic route handling
  let crumbs;
  const colabMatch = path.match(/^\/colaboradores\/(c-\d+)$/);
  const admMatch = path.match(/^\/admissoes\/(adm-\d+)$/);
  const desMatch = path.match(/^\/desligamentos\/(des-\d+)$/);
  const cliMatch = path.match(/^\/clientes\/(cli-\d+)$/);
  const saasMatch = path.match(/^\/assinaturas\/(saas-\d+)$/);
  if (colabMatch) {
    const c = (window.FG_COLABORADORES || []).find((x) => x.id === colabMatch[1]);
    crumbs = ["Pessoas", "Colaboradores", c ? c.nome : colabMatch[1]];
  } else if (admMatch) {
    const a = (window.FG_ADMISSOES || []).find((x) => x.id === admMatch[1]);
    crumbs = ["Pessoas", "Admissões", a ? a.nome : admMatch[1]];
  } else if (desMatch) {
    const d = (window.FG_DESLIGAMENTOS || []).find((x) => x.id === desMatch[1]);
    crumbs = ["Pessoas", "Desligamentos", d ? d.colaborador : desMatch[1]];
  } else if (cliMatch) {
    const cli = (window.FG_CLIENTES || []).find((x) => x.id === cliMatch[1]);
    crumbs = ["Financeiro", "Clientes", cli ? cli.nome : cliMatch[1]];
  } else if (saasMatch) {
    const sa = (window.FG_ASSINATURAS || []).find((x) => x.id === saasMatch[1]);
    crumbs = ["TI e Governança", "Assinaturas", sa ? sa.nome : saasMatch[1]];
  } else {
    crumbs = ROUTE_TITLES[path] || [path];
  }
  return (
    <nav className="fg-breadcrumb" aria-label="Breadcrumb">
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="fg-bc-sep">/</span>}
          <span className={i === crumbs.length - 1 ? "fg-bc-current" : "fg-bc-link"}>{c}</span>
        </React.Fragment>
      ))}
    </nav>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Header
// ────────────────────────────────────────────────────────────────────────────
const Header = ({ onOpenCommand }) => {
  const { theme, setTheme } = useTheme();
  return (
    <header className="fg-header">
      <Breadcrumb />
      <div className="fg-header-right">
        <button className="fg-cmdk-trigger" onClick={onOpenCommand}>
          <IconSearch size={14} />
          <span>Buscar</span>
          <kbd className="fg-kbd">⌘K</kbd>
        </button>
        <button className="fg-icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Alternar tema">
          {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
        </button>
        <button className="fg-icon-btn fg-bell" aria-label="Notificações">
          <IconBell size={16} />
          <span className="fg-bell-dot" />
        </button>
      </div>
    </header>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Page header (inside content)
// ────────────────────────────────────────────────────────────────────────────
const PageHeader = ({ title, eyebrow, description, actions, tabs }) => (
  <div className="fg-page-head">
    <div className="fg-page-head-top">
      <div>
        {eyebrow && <div className="fg-page-eyebrow">{eyebrow}</div>}
        <h1 className="fg-page-title">{title}</h1>
        {description && <p className="fg-page-desc">{description}</p>}
      </div>
      {actions && <div className="fg-page-actions">{actions}</div>}
    </div>
    {tabs && <div className="fg-page-tabs">{tabs}</div>}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// Command Palette (⌘K)
// ────────────────────────────────────────────────────────────────────────────
const CommandPalette = ({ open, onClose }) => {
  const { go } = useRouter();
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef(null);
  React.useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Build candidate list
  const routes = SIDEBAR.flatMap((s) => s.items.map((it) => ({ kind: "Páginas", label: it.label, hint: s.section, icon: it.icon, action: () => go(it.path) })));
  const clientes = (window.FG_CLIENTES || []).slice(0, 6).map((c) => ({ kind: "Clientes", label: c.nome, hint: c.codigo, icon: <IconBuilding size={14} />, action: () => go("/clientes") }));
  const fornecedores = (window.FG_FORNECEDORES || []).slice(0, 4).map((f) => ({ kind: "Fornecedores", label: f.nome, hint: f.categoria, icon: <IconBank size={14} />, action: () => go("/financeiro/saidas") }));
  const actions = [
    { kind: "Ações", label: "Nova entrada financeira", hint: "Financeiro › Entradas", icon: <IconPlus size={14} />, action: () => go("/financeiro/entradas?new=1") },
    { kind: "Ações", label: "Nova saída financeira", hint: "Financeiro › Saídas", icon: <IconPlus size={14} />, action: () => go("/financeiro/saidas?new=1") },
    { kind: "Ações", label: "Nova provisão", hint: "Financeiro › Provisões", icon: <IconPlus size={14} />, action: () => go("/financeiro/provisoes?new=1") },
  ];
  const all = [...actions, ...routes, ...clientes, ...fornecedores];
  const norm = (s) => (s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const q = norm(query.trim());
  const filtered = q ? all.filter((it) => norm(it.label).includes(q) || norm(it.hint || "").includes(q) || norm(it.kind).includes(q)) : all;

  // Group by kind
  const grouped = filtered.reduce((acc, it) => { (acc[it.kind] = acc[it.kind] || []).push(it); return acc; }, {});

  // Keyboard: Enter executes first
  const onKeyDown = (e) => {
    if (e.key === "Enter") {
      const first = filtered[0];
      if (first) { first.action(); onClose(); }
    }
  };

  return (
    <div className={`fg-cmdk-root ${open ? "open" : ""}`}>
      <div className="fg-cmdk-scrim" onClick={onClose} />
      <div className="fg-cmdk-shell">
        <div className="fg-cmdk-search">
          <IconSearch size={16} />
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
            <div className="fg-cmdk-empty">Nenhum resultado para "{query}"</div>
          ) : (
            Object.entries(grouped).map(([kind, items]) => (
              <div key={kind} className="fg-cmdk-group">
                <div className="fg-cmdk-group-label">{kind}</div>
                {items.slice(0, 6).map((it, i) => (
                  <button key={i} className="fg-cmdk-item" onClick={() => { it.action(); onClose(); }}>
                    <span className="fg-cmdk-icon">{it.icon}</span>
                    <span className="fg-cmdk-label">{it.label}</span>
                    <span className="fg-cmdk-hint">{it.hint}</span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
        <div className="fg-cmdk-foot">
          <span><kbd className="fg-kbd">↵</kbd> selecionar</span>
          <span><kbd className="fg-kbd">↑↓</kbd> navegar</span>
          <span><kbd className="fg-kbd">esc</kbd> fechar</span>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Layout shell wrapper
// ────────────────────────────────────────────────────────────────────────────
const AppShell = ({ children, density = "regular" }) => {
  const [cmdkOpen, setCmdkOpen] = React.useState(false);
  React.useEffect(() => {
    const h = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen((v) => !v);
      } else if (e.key === "Escape") {
        setCmdkOpen(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);
  return (
    <div className="fg-shell">
      <Sidebar density={density} />
      <div className="fg-main">
        <Header onOpenCommand={() => setCmdkOpen(true)} />
        <div className="fg-content">{children}</div>
      </div>
      <CommandPalette open={cmdkOpen} onClose={() => setCmdkOpen(false)} />
    </div>
  );
};

Object.assign(window, {
  ThemeContext, ThemeProvider, useTheme,
  RouterContext, RouterProvider, useRouter,
  Sidebar, Header, PageHeader, Breadcrumb, CommandPalette, AppShell, SIDEBAR,
});

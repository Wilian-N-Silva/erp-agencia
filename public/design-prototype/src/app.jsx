// App entry — Sistema Interno FG.
// Wires up Theme + Router + Toast + Tweaks + routes.

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "sidebarActive": "soft",
  "tableDensity": "regular",
  "tableZebra": false,
  "kpiAccent": "left-bar",
  "orangeUse": "cta-only",
  "headerStyle": "minimal",
  "showSubmodules": true
}/*EDITMODE-END*/;

// ────────────────────────────────────────────────────────────────────────────
// Tweaks-aware style injection
// ────────────────────────────────────────────────────────────────────────────
const applyTweakStyles = (t) => {
  const id = "fg-tweak-overrides";
  let el = document.getElementById(id);
  if (!el) { el = document.createElement("style"); el.id = id; document.head.appendChild(el); }
  const css = [];

  // Active item treatment
  if (t.sidebarActive === "underline") {
    css.push(`.fg-nav-item.active { background: transparent !important; color: var(--ink-900) !important; }
              .fg-nav-item.active::before { display: none; }
              .fg-nav-item.active::after { content:""; position:absolute; left:8px; right:8px; bottom:1px; height:2px; background: var(--brand-orange); border-radius: 2px; }`);
  } else if (t.sidebarActive === "filled") {
    css.push(`.fg-nav-item.active { background: var(--ink-900) !important; color: var(--surface-0) !important; }
              html[data-theme="dark"] .fg-nav-item.active { background: var(--brand-orange) !important; color: white !important; }
              .fg-nav-item.active .fg-nav-icon { color: inherit !important; }
              .fg-nav-item.active::before { display: none; }`);
  } else if (t.sidebarActive === "no-accent") {
    css.push(`.fg-nav-item.active { background: var(--surface-2) !important; color: var(--ink-900) !important; }
              .fg-nav-item.active .fg-nav-icon { color: var(--ink-900) !important; }
              .fg-nav-item.active::before { display: none; }`);
  }

  // Orange use
  if (t.orangeUse === "no-orange") {
    css.push(`.fg-btn-primary { background: var(--ink-900) !important; border-color: var(--ink-900) !important; color: var(--surface-0) !important; }
              .fg-nav-item.active { background: var(--surface-2) !important; color: var(--ink-900) !important; }
              .fg-nav-item.active::before { background: var(--ink-900) !important; }
              .fg-nav-item.active .fg-nav-icon { color: var(--ink-900) !important; }`);
  } else if (t.orangeUse === "editorial") {
    css.push(`.fg-page-title { color: var(--brand-orange-deep); }
              .fg-greet-title { color: var(--brand-orange-deep); }
              html[data-theme="dark"] .fg-page-title, html[data-theme="dark"] .fg-greet-title { color: #ff8d6e; }`);
  }

  // KPI accent
  if (t.kpiAccent === "outline") {
    css.push(`.fg-kpi-accent { border-color: var(--brand-orange) !important; }
              .fg-kpi-accent::before { display: none; }`);
  } else if (t.kpiAccent === "tinted") {
    css.push(`.fg-kpi-accent { background: var(--brand-orange-soft) !important; border-color: var(--status-brand-border) !important; }
              .fg-kpi-accent::before { display: none; }`);
  } else if (t.kpiAccent === "none") {
    css.push(`.fg-kpi-accent::before { display: none; }`);
  }

  // Header style
  if (t.headerStyle === "compact") {
    css.push(`.fg-header { height: 48px; } .fg-cmdk-trigger { min-width: 200px; }`);
  } else if (t.headerStyle === "dense") {
    css.push(`.fg-content { padding-top: 18px; }`);
  }

  el.textContent = css.join("\n");
};

// ────────────────────────────────────────────────────────────────────────────
// Tweaks Panel UI
// ────────────────────────────────────────────────────────────────────────────
function FGTweaks({ t, setTweak }) {
  return (
    <TweaksPanel title="Tweaks · Sistema FG">
      <TweakSection label="Sidebar" />
      <TweakRadio
        label="Item ativo"
        value={t.sidebarActive}
        options={[
          { label: "Soft", value: "soft" },
          { label: "Linha", value: "underline" },
          { label: "Cheio", value: "filled" },
        ]}
        onChange={(v) => setTweak("sidebarActive", v)}
      />

      <TweakSection label="Tabelas" />
      <TweakRadio
        label="Densidade"
        value={t.tableDensity}
        options={[
          { label: "Compacta", value: "compact" },
          { label: "Confortável", value: "regular" },
        ]}
        onChange={(v) => setTweak("tableDensity", v)}
      />
      <TweakToggle label="Zebra striping" value={t.tableZebra} onChange={(v) => setTweak("tableZebra", v)} />

      <TweakSection label="KPI cards" />
      <TweakSelect
        label="Destaque do superávit"
        value={t.kpiAccent}
        options={[
          { label: "Barra esquerda (padrão)", value: "left-bar" },
          { label: "Borda colorida", value: "outline" },
          { label: "Fundo tingido", value: "tinted" },
          { label: "Sem destaque", value: "none" },
        ]}
        onChange={(v) => setTweak("kpiAccent", v)}
      />

      <TweakSection label="Identidade" />
      <TweakSelect
        label="Uso do laranja"
        value={t.orangeUse}
        options={[
          { label: "Só em CTAs (padrão)", value: "cta-only" },
          { label: "Editorial — títulos", value: "editorial" },
          { label: "Sem laranja (preto/branco)", value: "no-orange" },
        ]}
        onChange={(v) => setTweak("orangeUse", v)}
      />

      <TweakSection label="Header" />
      <TweakRadio
        label="Compactação"
        value={t.headerStyle}
        options={[
          { label: "Normal", value: "minimal" },
          { label: "Compacto", value: "compact" },
        ]}
        onChange={(v) => setTweak("headerStyle", v)}
      />
    </TweaksPanel>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Route renderer
// ────────────────────────────────────────────────────────────────────────────
const ContentRouter = ({ tweaks }) => {
  const { path } = useRouter();
  const [sheet, setSheet] = React.useState({ open: false, mode: "entrada", entry: null });

  // Open sheet via ?new=1 query in hash
  React.useEffect(() => {
    if (path.includes("?new=1")) {
      const mode = path.includes("entradas") ? "entrada" : path.includes("saidas") ? "saida" : "provisao";
      setSheet({ open: true, mode, entry: null });
      location.hash = path.split("?")[0];
    }
  }, [path]);

  const openNew = (mode) => setSheet({ open: true, mode, entry: null });
  const openEdit = (mode, entry) => setSheet({ open: true, mode, entry });

  const cleanPath = path.split("?")[0];

  // Dynamic routes
  const colabMatch = cleanPath.match(/^\/colaboradores\/(c-\d+)$/);
  const admMatch = cleanPath.match(/^\/admissoes\/(adm-\d+)$/);
  const desMatch = cleanPath.match(/^\/desligamentos\/(des-\d+)$/);
  const cliMatch = cleanPath.match(/^\/clientes\/(cli-\d+)$/);
  const saasMatch = cleanPath.match(/^\/assinaturas\/(saas-\d+)$/);

  let page = null;
  if (colabMatch) page = <ColaboradorDetail id={colabMatch[1]} />;
  else if (admMatch) page = <ChecklistDetail kind="admissao" id={admMatch[1]} />;
  else if (desMatch) page = <ChecklistDetail kind="desligamento" id={desMatch[1]} />;
  else if (cliMatch) page = <ClienteDetail id={cliMatch[1]} />;
  else if (saasMatch) page = <AssinaturaDetail id={saasMatch[1]} />;
  else switch (cleanPath) {
    case "/dashboard":         page = <Dashboard />; break;
    case "/alertas":           page = <Alertas />; break;
    case "/financeiro/entradas":  page = <Entradas onNew={() => openNew("entrada")} onEdit={(e) => openEdit("entrada", e)} />; break;
    case "/financeiro/saidas":    page = <Saidas onNew={() => openNew("saida")} onEdit={(e) => openEdit("saida", e)} />; break;
    case "/financeiro/provisoes": page = <Provisoes onNew={() => openNew("provisao")} onEdit={(e) => openEdit("provisao", e)} />; break;
    case "/clientes":          page = <Clientes />; break;
    case "/colaboradores":     page = <Colaboradores />; break;
    case "/admissoes":         page = <Admissoes />; break;
    case "/desligamentos":     page = <Desligamentos />; break;
    case "/nfs":               page = <NFs />; break;
    case "/reembolsos":        page = <Reembolsos />; break;
    case "/ferias":            page = <Ferias />; break;
    case "/equipamentos":      page = <SimplePage icon={<IconLaptop size={32} />} eyebrow="TI e Governança" title="Equipamentos" />; break;
    case "/acessos":           page = <SimplePage icon={<IconKey size={32} />} eyebrow="TI e Governança" title="Acessos" />; break;
    case "/assinaturas":       page = <Assinaturas />; break;
    case "/auditoria":         page = <SimplePage icon={<IconScroll size={32} />} eyebrow="Administração" title="Auditoria" />; break;
    case "/configuracoes":     page = <SimplePage icon={<IconSettings size={32} />} eyebrow="Administração" title="Configurações" />; break;
    default:                   page = <Dashboard />;
  }

  return (
    <>
      {page}
      <EntryFormSheet
        open={sheet.open}
        onClose={() => setSheet((s) => ({ ...s, open: false }))}
        entry={sheet.entry}
        mode={sheet.mode}
      />
    </>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Portal route renderer
// ────────────────────────────────────────────────────────────────────────────
const PortalRouter = () => {
  const { path } = useRouter();
  const cleanPath = path.split("?")[0];
  switch (cleanPath) {
    case "/portal":              return <PortalInicio />;
    case "/portal/nfs":          return <PortalNFs />;
    case "/portal/reembolsos":   return <PortalReembolsos />;
    case "/portal/ferias":       return <PortalFerias />;
    case "/portal/equipamentos": return <PortalEquipamentos />;
    case "/portal/documentos":   return <PortalDocumentos />;
    case "/portal/dados":        return <PortalDados />;
    case "/portal/acessos":      return <PortalAcessos />;
    case "/portal/remuneracao":  return <PortalDados />;
    default:                     return <PortalInicio />;
  }
};

// ────────────────────────────────────────────────────────────────────────────
// Inner app (after providers)
// ────────────────────────────────────────────────────────────────────────────
function InnerApp() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const { path } = useRouter();
  const isPortal = path.startsWith("/portal");

  React.useEffect(() => { applyTweakStyles(tweaks); }, [tweaks]);
  React.useEffect(() => {
    document.body.classList.toggle("fg-table-zebra-all", !!tweaks.tableZebra);
    document.body.classList.toggle("fg-on-portal", isPortal);
  }, [tweaks.tableZebra, isPortal]);

  return (
    <>
      {isPortal ? (
        <PortalShell><PortalRouter /></PortalShell>
      ) : (
        <AppShell density={tweaks.tableDensity}>
          <ContentRouter tweaks={tweaks} />
        </AppShell>
      )}
      {!isPortal && <FGTweaks t={tweaks} setTweak={setTweak} />}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Top-level app
// ────────────────────────────────────────────────────────────────────────────
function App() {
  return (
    <ThemeProvider>
      <RouterProvider>
        <ToastProvider>
          <InnerApp />
        </ToastProvider>
      </RouterProvider>
    </ThemeProvider>
  );
}

// Add zebra class globally when tweak is on
const _zebraStyleEl = document.createElement("style");
_zebraStyleEl.textContent = `
  body.fg-table-zebra-all .fg-table tbody tr:nth-child(even) { background: var(--surface-1); }
  body.fg-table-zebra-all .fg-table tbody tr:hover { background: var(--surface-2); }
`;
document.head.appendChild(_zebraStyleEl);

// Mount
const _root = ReactDOM.createRoot(document.getElementById("app"));
_root.render(<App />);

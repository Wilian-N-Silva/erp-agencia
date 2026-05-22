// Assinaturas / SaaS — cards grid + lista + detalhe.
// Conecta financeiro (custo recorrente) e governança (licenças, criticidade).

// ────────────────────────────────────────────────────────────────────────────
// Mock data
// ────────────────────────────────────────────────────────────────────────────
const _d4 = (dia, mes, ano = 2026) => new Date(ano, mes, dia);

window.FG_ASSINATURAS = window.FG_ASSINATURAS || [
  { id: "saas-001", nome: "Figma Organization", categoria: "Design", fornecedor: "Figma Inc.", custo: 8910, periodicidade: "Mensal", licencas: 18, emUso: 16, renovacao: _d4(10, 5), status: "ativa", criticidade: "alta", responsavel: "Rafael Aguiar", contrato: "contrato-figma-2025.pdf", monograma: "Fi", cor: "#0acf83", obs: "Plano Organization com guests ilimitados.", usuarios: ["c-003", "c-006", "c-007", "c-008", "c-009", "c-010", "c-011", "c-018", "c-020", "c-021", "c-002", "c-004", "c-005", "c-013", "c-016", "c-022"] },
  { id: "saas-002", nome: "Adobe Creative Cloud", categoria: "Design", fornecedor: "Adobe Systems", custo: 14256, periodicidade: "Mensal", licencas: 22, emUso: 22, renovacao: _d4(8, 5), status: "ativa", criticidade: "critica", responsavel: "Rafael Aguiar", contrato: "contrato-adobe-cc-2025.pdf", monograma: "Ad", cor: "#fa0f00", obs: "Todas as licenças ocupadas — avaliar upgrade.", usuarios: Array.from({length: 22}, (_, i) => `c-${String(i+1).padStart(3, "0")}`).filter((id) => !["c-001", "c-005", "c-020", "c-021"].includes(id)) },
  { id: "saas-003", nome: "Google Workspace", categoria: "Produtividade", fornecedor: "Google Cloud Platform", custo: 6840, periodicidade: "Mensal", licencas: 30, emUso: 28, renovacao: _d4(12, 5), status: "ativa", criticidade: "critica", responsavel: "Lívia Câmara", contrato: "contrato-google-workspace.pdf", monograma: "Gw", cor: "#4285f4", obs: "Plano Business Standard. Inclui GCP com R$ 2.400 em créditos.", usuarios: window.FG_COLABORADORES.filter((c) => c.status !== "desligado").map((c) => c.id).slice(0, 28) },
  { id: "saas-004", nome: "Notion Team", categoria: "Produtividade", fornecedor: "Notion Labs", custo: 1890, periodicidade: "Mensal", licencas: 30, emUso: 24, renovacao: _d4(22, 6), status: "ativa", criticidade: "media", responsavel: "Helena Vasconcelos", contrato: "contrato-notion.pdf", monograma: "No", cor: "#000000", obs: "Workspace agência.", usuarios: window.FG_COLABORADORES.filter((c) => c.status !== "desligado").map((c) => c.id).slice(0, 24) },
  { id: "saas-005", nome: "Slack Pro", categoria: "Comunicação", fornecedor: "Salesforce", custo: 4200, periodicidade: "Mensal", licencas: 30, emUso: 28, renovacao: _d4(15, 7), status: "ativa", criticidade: "alta", responsavel: "Helena Vasconcelos", contrato: "contrato-slack.pdf", monograma: "Sl", cor: "#611f69", obs: "Migrar para Enterprise Grid em 2026?", usuarios: window.FG_COLABORADORES.filter((c) => c.status !== "desligado").map((c) => c.id).slice(0, 28) },
  { id: "saas-006", nome: "Cloudflare Pro", categoria: "Cloud", fornecedor: "Cloudflare", custo: 1180, periodicidade: "Mensal", licencas: null, emUso: null, renovacao: _d4(14, 5), status: "ativa", criticidade: "media", responsavel: "Lívia Câmara", contrato: "contrato-cloudflare.pdf", monograma: "Cf", cor: "#f48120", obs: "Pro + R2 storage 250GB.", usuarios: [] },
  { id: "saas-007", nome: "Linear", categoria: "Dev tools", fornecedor: "Linear B.V.", custo: 1450, periodicidade: "Mensal", licencas: 18, emUso: 12, renovacao: _d4(25, 6), status: "ativa", criticidade: "baixa", responsavel: "Rafael Aguiar", contrato: "contrato-linear.pdf", monograma: "Ln", cor: "#5e6ad2", obs: "Time de produto + criação.", usuarios: ["c-003", "c-006", "c-007", "c-008", "c-009", "c-010", "c-011", "c-018", "c-019", "c-020", "c-021", "c-004"] },
  { id: "saas-008", nome: "1Password Business", categoria: "Segurança", fornecedor: "AgileBits", custo: 980, periodicidade: "Mensal", licencas: 30, emUso: 26, renovacao: _d4(5, 6), status: "ativa", criticidade: "critica", responsavel: "Lívia Câmara", contrato: "contrato-1password.pdf", monograma: "1P", cor: "#0364d3", obs: "Cofre da agência. Crítico — não revogar acessos sem orientação do TI.", usuarios: window.FG_COLABORADORES.filter((c) => c.status !== "desligado").map((c) => c.id).slice(0, 26) },
  { id: "saas-009", nome: "Loom Business", categoria: "Produtividade", fornecedor: "Atlassian", custo: 720, periodicidade: "Mensal", licencas: 15, emUso: 8, renovacao: _d4(30, 4), status: "ativa", criticidade: "baixa", responsavel: "Helena Vasconcelos", contrato: "contrato-loom.pdf", monograma: "Lo", cor: "#625df5", obs: "Uso baixo — avaliar redução de 15 → 10 licenças no próximo ciclo.", usuarios: ["c-001", "c-002", "c-003", "c-004", "c-005", "c-006", "c-012", "c-018"] },
  { id: "saas-010", nome: "Frame.io", categoria: "Design", fornecedor: "Adobe Systems", custo: 1620, periodicidade: "Mensal", licencas: 12, emUso: 6, renovacao: _d4(3, 5), status: "ativa", criticidade: "media", responsavel: "Rafael Aguiar", contrato: "contrato-frameio.pdf", monograma: "F.", cor: "#fc6353", obs: "Vídeo / motion. Cortar licenças ociosas no próximo ciclo.", usuarios: ["c-003", "c-006", "c-007", "c-008", "c-010", "c-011"] },
  { id: "saas-011", nome: "Sentry Team", categoria: "Dev tools", fornecedor: "Functional Software", custo: 580, periodicidade: "Mensal", licencas: 10, emUso: 4, renovacao: _d4(18, 7), status: "ativa", criticidade: "baixa", responsavel: "Lívia Câmara", contrato: "contrato-sentry.pdf", monograma: "Se", cor: "#362d59", obs: "Observabilidade do site institucional.", usuarios: ["c-003", "c-011", "c-005", "c-001"] },
  { id: "saas-012", nome: "HubSpot Marketing", categoria: "Marketing", fornecedor: "HubSpot Inc.", custo: 5400, periodicidade: "Mensal", licencas: 8, emUso: 7, renovacao: _d4(20, 8), status: "ativa", criticidade: "media", responsavel: "Marina Toledo", contrato: "contrato-hubspot.pdf", monograma: "Hs", cor: "#ff7a59", obs: "Operação Mídia + Atendimento.", usuarios: ["c-002", "c-012", "c-013", "c-014", "c-015", "c-016", "c-017"] },
];

// Renovações históricas
window.FG_RENOVACOES = {
  "saas-001": [
    { data: _d4(10, 5, 2026), valor: 8910, acao: "Renovação automática programada", status: "previsto" },
    { data: _d4(10, 5, 2025), valor: 8400, acao: "Renovado com reajuste de 6%", status: "ok" },
    { data: _d4(10, 5, 2024), valor: 7920, acao: "Renovação anual", status: "ok" },
  ],
  "saas-002": [
    { data: _d4(8, 5, 2026), valor: 14256, acao: "Renovação automática programada", status: "previsto" },
    { data: _d4(8, 5, 2025), valor: 13140, acao: "Renovado com reajuste de 8,5%", status: "ok" },
  ],
  "saas-008": [
    { data: _d4(5, 6, 2026), valor: 980, acao: "Renovação automática programada", status: "previsto" },
    { data: _d4(5, 6, 2025), valor: 940, acao: "Renovação anual", status: "ok" },
  ],
};

// Forçar 1 licença "fantasma" (colaborador desligado ainda na lista) em Figma
// Já está no array (c-022 = Roberto Salles em aviso prévio).
// E em 1Password adicionar uma de desligado real:
const _pwdAlerta = window.FG_COLABORADORES.find((c) => c.status === "desligado");
if (_pwdAlerta && !window.FG_ASSINATURAS[7].usuarios.includes(_pwdAlerta.id)) {
  window.FG_ASSINATURAS[7].usuarios.push(_pwdAlerta.id);
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
const daysUntil = (date) => Math.round((date - window.FG_TODAY) / 86400000);
const findColab = (id) => (window.FG_COLABORADORES || []).find((c) => c.id === id);
const desligadosNaLista = (s) => (s.usuarios || []).map(findColab).filter((c) => c && c.status === "desligado");

const CATEGORIA_CORES = {
  "Design": "#fb923c",
  "Produtividade": "#3b82f6",
  "Comunicação": "#a855f7",
  "Cloud": "#06b6d4",
  "Dev tools": "#10b981",
  "Segurança": "#ef4444",
  "Marketing": "#ec4899",
};

// ════════════════════════════════════════════════════════════════════════════
// LISTAGEM — Grid de cards / Lista
// ════════════════════════════════════════════════════════════════════════════
const Assinaturas = () => {
  const { go } = useRouter();
  const [view, setView] = React.useState("grid");
  const [search, setSearch] = React.useState("");
  const [catF, setCatF] = React.useState([]);
  const [critF, setCritF] = React.useState([]);
  const [respF, setRespF] = React.useState([]);
  const [density, setDensity] = React.useState("regular");

  const all = window.FG_ASSINATURAS;
  const filtered = React.useMemo(() => {
    let xs = all;
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter((s) => s.nome.toLowerCase().includes(q) || s.fornecedor.toLowerCase().includes(q));
    }
    if (catF.length) xs = xs.filter((s) => catF.includes(s.categoria));
    if (critF.length) {
      const map = { "Crítica": "critica", "Alta": "alta", "Média": "media", "Baixa": "baixa" };
      xs = xs.filter((s) => critF.map((c) => map[c]).includes(s.criticidade));
    }
    if (respF.length) xs = xs.filter((s) => respF.includes(s.responsavel));
    return xs;
  }, [all, search, catF, critF, respF]);

  // KPIs
  const totalMensal = filtered.reduce((a, s) => a + s.custo, 0);
  const totalAnual = totalMensal * 12;
  const proximas14 = filtered.filter((s) => { const d = daysUntil(s.renovacao); return d >= 0 && d <= 14; });
  const proximasCusto = proximas14.reduce((a, s) => a + s.custo, 0);
  const comAlertas = filtered.filter((s) => desligadosNaLista(s).length > 0 || (s.emUso === s.licencas && s.licencas)).length;

  const responsaveis = [...new Set(all.map((s) => s.responsavel))];

  return (
    <div className="fg-page">
      <PageHeader
        eyebrow="TI e Governança"
        title="Assinaturas"
        description={`${filtered.length} ferramentas ativas · ${formatBRL(totalMensal)}/mês · ${formatBRL(totalAnual)}/ano`}
        actions={
          <>
            <div className="fg-chips">
              <button className={`fg-chip ${view === "grid" ? "active" : ""}`} onClick={() => setView("grid")}><IconBoxes size={13} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Cards</button>
              <button className={`fg-chip ${view === "list" ? "active" : ""}`} onClick={() => setView("list")}>Lista</button>
            </div>
            <Button variant="outline" size="sm" icon={<IconDownload size={14} />}>Exportar</Button>
            <Button variant="primary" size="sm" icon={<IconPlus size={14} />}>Nova assinatura</Button>
          </>
        }
      />

      <div className="fg-grid fg-grid-kpis">
        <KpiCard label="Custo mensal" value={formatBRL(totalMensal)} secondary="Recorrente · todas as ativas" icon={<IconRepeat size={16} />} />
        <KpiCard label="Custo anualizado" value={formatBRL(totalAnual)} secondary="Projetado para 12 meses" icon={<IconWallet size={16} />} />
        <KpiCard label="Renovações em 14 dias" value={`${proximas14.length}`} secondary={formatBRL(proximasCusto) + " em jogo"} icon={<IconClock size={16} />} accent={proximas14.length > 0} mono={false} />
        <KpiCard label="Com alerta" value={`${comAlertas}`} secondary="Licença ocupada por desligado ou em uso máximo" icon={<IconAlertCircle size={16} />} mono={false} />
      </div>

      <Toolbar
        search={search}
        onSearch={setSearch}
        filters={
          <>
            <FilterPopover label="Categoria" value={catF} onChange={setCatF} options={[...new Set(all.map((s) => s.categoria))]} />
            <FilterPopover label="Criticidade" value={critF} onChange={setCritF} options={["Crítica", "Alta", "Média", "Baixa"]} />
            <FilterPopover label="Responsável" value={respF} onChange={setRespF} options={responsaveis} />
          </>
        }
        density={density}
        onDensity={setDensity}
      />

      {view === "grid" ? (
        <div className="fg-saas-grid">
          {filtered.map((s) => <SaasCard key={s.id} s={s} onOpen={() => go(`/assinaturas/${s.id}`)} />)}
        </div>
      ) : (
        <SaasList items={filtered} onOpen={(id) => go(`/assinaturas/${id}`)} density={density} />
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Card de assinatura
// ────────────────────────────────────────────────────────────────────────────
const SaasCard = ({ s, onOpen }) => {
  const d = daysUntil(s.renovacao);
  const alertaRen = d >= 0 && d <= 14;
  const desligados = desligadosNaLista(s);
  const usoMax = s.licencas && s.emUso === s.licencas;
  const usoPct = s.licencas ? Math.round((s.emUso / s.licencas) * 100) : null;
  return (
    <button className={`fg-saas-card ${alertaRen ? "alert-soon" : ""}`} onClick={onOpen}>
      <div className="fg-saas-head">
        <div className="fg-saas-logo" style={{ background: s.cor }}>{s.monograma}</div>
        <div className="fg-saas-head-meta">
          <div className="fg-saas-name">{s.nome}</div>
          <div className="fg-saas-cat">
            <span className="fg-saas-cat-dot" style={{ background: CATEGORIA_CORES[s.categoria] || "#71717a" }} />
            {s.categoria}
          </div>
        </div>
        <div className="fg-saas-crit">
          <StatusBadge status={s.criticidade} label={s.criticidade === "critica" ? "Crítica" : s.criticidade === "alta" ? "Alta" : s.criticidade === "media" ? "Média" : "Baixa"} />
        </div>
      </div>

      <div className="fg-saas-cost">
        <div className="fg-saas-cost-val fg-tabular">{formatBRL(s.custo)}<span className="fg-saas-cost-unit">/{s.periodicidade.toLowerCase().includes("mensal") ? "mês" : s.periodicidade.toLowerCase()}</span></div>
      </div>

      {s.licencas != null ? (
        <div className="fg-saas-licencas">
          <div className="fg-saas-licencas-text">
            <span className="fg-tabular fg-cell-strong">{s.emUso}</span> de <span className="fg-tabular">{s.licencas}</span> licenças em uso
            {usoMax && <span className="fg-saas-warn"> · uso máximo</span>}
          </div>
          <div className="fg-saas-bar">
            <div className="fg-saas-bar-fill" style={{ width: `${usoPct}%`, background: usoMax ? "var(--status-warning-text)" : "var(--ink-700)" }} />
          </div>
        </div>
      ) : (
        <div className="fg-saas-licencas">
          <div className="fg-saas-licencas-text fg-muted">Sem controle de licenças</div>
        </div>
      )}

      <div className="fg-saas-foot">
        <div className="fg-saas-renew">
          <IconRepeat size={13} />
          <span>Renova {formatDate(s.renovacao, "dayMonth")}</span>
          <span className={`fg-saas-renew-rel ${alertaRen ? "alert" : ""}`}>· {formatRelative(s.renovacao)}</span>
        </div>
        {desligados.length > 0 && (
          <div className="fg-saas-warn-row">
            <IconAlertCircle size={12} />
            <span>{desligados.length} licença{desligados.length > 1 ? "s" : ""} de desligado</span>
          </div>
        )}
      </div>
    </button>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Lista (tabela densa)
// ────────────────────────────────────────────────────────────────────────────
const SaasList = ({ items, onOpen, density }) => {
  const columns = [
    { key: "nome", label: "Assinatura", render: (r) => (
      <div className="fg-cell-user fg-cell-link" onClick={() => onOpen(r.id)} role="link" style={{ cursor: "pointer" }}>
        <div className="fg-saas-logo sm" style={{ background: r.cor }}>{r.monograma}</div>
        <div>
          <div className="fg-cell-strong">{r.nome}</div>
          <div className="fg-cell-sub">{r.fornecedor}</div>
        </div>
      </div>
    ) },
    { key: "categoria", label: "Categoria", render: (r) => (
      <span className="fg-saas-cat" style={{ fontSize: 12 }}>
        <span className="fg-saas-cat-dot" style={{ background: CATEGORIA_CORES[r.categoria] || "#71717a" }} />
        {r.categoria}
      </span>
    ) },
    { key: "custo", label: "Custo / mês", align: "right", render: (r) => <span className="fg-tabular fg-cell-strong">{formatBRL(r.custo)}</span> },
    { key: "_lic", label: "Licenças", align: "right", render: (r) => r.licencas != null ? (
      <span className="fg-tabular"><span className="fg-cell-strong">{r.emUso}</span><span className="fg-muted"> / {r.licencas}</span></span>
    ) : <span className="fg-muted">—</span> },
    { key: "renovacao", label: "Próx. renovação", render: (r) => {
      const d = daysUntil(r.renovacao);
      const soon = d >= 0 && d <= 14;
      return (
        <div className="fg-cell-strong fg-tabular">{formatDate(r.renovacao, "dayMonth")}<div className={`fg-cell-sub ${soon ? "fg-bad" : ""}`}>{formatRelative(r.renovacao)}</div></div>
      );
    } },
    { key: "criticidade", label: "Criticidade", render: (r) => <StatusBadge status={r.criticidade} label={r.criticidade === "critica" ? "Crítica" : r.criticidade === "alta" ? "Alta" : r.criticidade === "media" ? "Média" : "Baixa"} /> },
    { key: "_alertas", label: "Alertas", render: (r) => {
      const desligados = desligadosNaLista(r);
      const usoMax = r.licencas && r.emUso === r.licencas;
      if (desligados.length === 0 && !usoMax) return <span className="fg-muted">—</span>;
      return (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {desligados.length > 0 && <StatusBadge status="danger" label={`${desligados.length} desligado${desligados.length > 1 ? "s" : ""}`} withDot={false} icon={<IconAlertCircle size={11} />} />}
          {usoMax && <StatusBadge status="warning" label="Uso máx" withDot={false} icon={<IconAlertCircle size={11} />} />}
        </div>
      );
    } },
    { key: "responsavel", label: "Responsável", render: (r) => (
      <div className="fg-cell-user"><Avatar name={r.responsavel} size={22} /><span>{r.responsavel.split(" ")[0]}</span></div>
    ) },
  ];
  return <DataTable columns={columns} data={items} getRowKey={(r) => r.id} density={density} />;
};

// ════════════════════════════════════════════════════════════════════════════
// DETALHE
// ════════════════════════════════════════════════════════════════════════════
const ASSINATURA_TABS = [
  { value: "resumo", label: "Resumo" },
  { value: "usuarios", label: "Usuários vinculados" },
  { value: "renovacoes", label: "Renovações" },
  { value: "contrato", label: "Contrato" },
];

const AssinaturaDetail = ({ id }) => {
  const { go } = useRouter();
  const s = window.FG_ASSINATURAS.find((x) => x.id === id);
  const [tab, setTab] = React.useState("resumo");
  if (!s) return <div className="fg-page"><PageHeader eyebrow="TI e Governança" title="Assinatura não encontrada" /><Button variant="outline" onClick={() => go("/assinaturas")}>Voltar</Button></div>;

  const d = daysUntil(s.renovacao);
  const desligados = desligadosNaLista(s);
  const usoMax = s.licencas && s.emUso === s.licencas;
  const usuarios = (s.usuarios || []).map(findColab).filter(Boolean);

  return (
    <div className="fg-page">
      <button className="fg-back" onClick={() => go("/assinaturas")}>
        <IconChevronLeft size={14} /> Assinaturas
      </button>

      <div className="fg-detail-head">
        <div className="fg-saas-logo lg" style={{ background: s.cor }}>{s.monograma}</div>
        <div className="fg-detail-head-meta">
          <div className="fg-detail-eyebrow">
            <span>{s.fornecedor}</span>
            <span>·</span>
            <span>{s.categoria}</span>
            <span>·</span>
            <span>Responsável: {s.responsavel}</span>
          </div>
          <h1 className="fg-detail-title">{s.nome}</h1>
          <div className="fg-detail-badges">
            <StatusBadge status={s.criticidade} label={s.criticidade === "critica" ? "Crítica" : s.criticidade === "alta" ? "Alta" : s.criticidade === "media" ? "Média" : "Baixa"} />
            <Tag>{formatBRL(s.custo)}/mês</Tag>
            <Tag>{s.periodicidade}</Tag>
            {s.licencas && <Tag>{s.emUso}/{s.licencas} licenças</Tag>}
          </div>
        </div>
        <div className="fg-detail-head-actions">
          <Button variant="outline" size="sm" icon={<IconEdit size={14} />}>Editar</Button>
          <Button variant="outline" size="sm" icon={<IconRepeat size={14} />}>Registrar renovação</Button>
          <Dropdown align="right" trigger={<button className="fg-icon-btn"><IconMore size={16} /></button>}
            items={[{ label: "Adicionar usuário", icon: <IconPlus size={13} /> }, { label: "Substituir contrato", icon: <IconUpload size={13} /> }, { separator: true }, { label: "Encerrar assinatura", icon: <IconX size={13} />, danger: true }]} />
        </div>
      </div>

      {(desligados.length > 0 || usoMax) && (
        <div className="fg-inline-alert danger">
          <IconAlertCircle size={16} />
          <div>
            <div className="fg-inline-alert-title">Atenção nesta assinatura</div>
            <ul className="fg-inline-list">
              {desligados.length > 0 && <li><strong>{desligados.length} licença{desligados.length > 1 ? "s" : ""}</strong> ainda vinculada{desligados.length > 1 ? "s" : ""} a colaborador desligado: {desligados.map((c) => c.nome).join(", ")}. Revogue manualmente para liberar a vaga.</li>}
              {usoMax && <li>Todas as licenças estão em uso. Considere ampliar o pacote antes de novas admissões.</li>}
            </ul>
          </div>
        </div>
      )}

      <div className="fg-detail-tabs"><Tabs value={tab} onChange={setTab} items={ASSINATURA_TABS} /></div>

      <div className="fg-detail-body">
        {tab === "resumo" && (
          <>
            <div className="fg-grid fg-grid-4">
              <KpiCard label="Custo mensal" value={formatBRL(s.custo)} secondary={formatBRL(s.custo * 12) + " / ano"} icon={<IconWallet size={16} />} />
              <KpiCard label="Licenças" value={s.licencas ? `${s.emUso} / ${s.licencas}` : "—"} secondary={s.licencas ? `${s.licencas - s.emUso} disponíveis` : "Sem cap de licença"} mono={false} icon={<IconUsers size={16} />} accent={!usoMax} />
              <KpiCard label="Próx. renovação" value={formatDate(s.renovacao, "dayMonth")} secondary={d >= 0 ? `em ${d} dia${d !== 1 ? "s" : ""}` : `vencida há ${Math.abs(d)}d`} icon={<IconClock size={16} />} />
              <KpiCard label="Custo / licença" value={s.licencas ? formatBRL(s.custo / s.licencas) : "—"} secondary={s.licencas ? "Baseado no pacote" : ""} icon={<IconBoxes size={16} />} />
            </div>

            <div className="fg-grid fg-grid-2">
              <Card title="Dados da assinatura">
                <dl className="fg-deflist">
                  <div><dt>Fornecedor</dt><dd>{s.fornecedor}</dd></div>
                  <div><dt>Categoria</dt><dd>{s.categoria}</dd></div>
                  <div><dt>Periodicidade</dt><dd>{s.periodicidade}</dd></div>
                  <div><dt>Criticidade</dt><dd>{s.criticidade.charAt(0).toUpperCase() + s.criticidade.slice(1)}</dd></div>
                  <div className="full"><dt>Responsável interno</dt><dd>{s.responsavel}</dd></div>
                  {s.obs && <div className="full"><dt>Observações</dt><dd>{s.obs}</dd></div>}
                </dl>
              </Card>
              <Card title="Conexão com o financeiro" description="Lançamentos automáticos gerados pela renovação.">
                <ul className="fg-list-inline" style={{ gap: 12 }}>
                  <li><IconArrowUpRight size={13} /> Lançado em <strong>Saídas</strong> mensal sob categoria <Tag>SaaS</Tag></li>
                  <li><IconRepeat size={13} /> Vinculado à provisão <strong>Pacote {s.fornecedor.split(" ")[0]}</strong></li>
                  <li><IconBank size={13} /> Método: <Tag>Cartão corporativo</Tag></li>
                </ul>
                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <Button variant="outline" size="sm" icon={<IconArrowRight size={13} />}>Abrir no financeiro</Button>
                  <Button variant="ghost" size="sm">Ver provisão</Button>
                </div>
              </Card>
            </div>
          </>
        )}

        {tab === "usuarios" && (
          <Card padding={false} title={`${usuarios.length} usuários com licença`} description={s.licencas ? `${s.licencas - s.emUso} licença${s.licencas - s.emUso !== 1 ? "s" : ""} disponíve${s.licencas - s.emUso !== 1 ? "is" : "l"} para nova atribuição.` : "Sem controle de licenças."}
            action={<Button variant="primary" size="sm" icon={<IconPlus size={14} />}>Adicionar usuário</Button>}>
            <table className="fg-aumento-table">
              <thead><tr><th>Colaborador</th><th>Cargo</th><th>Vínculo</th><th>Status</th><th>Concedido em</th><th></th></tr></thead>
              <tbody>
                {usuarios.map((u) => (
                  <tr key={u.id} className={u.status === "desligado" ? "attn-danger" : ""}>
                    <td>
                      <div className="fg-cell-user">
                        <Avatar name={u.nome} size={26} dimmed={u.status === "desligado"} />
                        <div>
                          <div className="fg-cell-strong">{u.nome}</div>
                          <div className="fg-cell-sub fg-tabular">{u.matricula}</div>
                        </div>
                      </div>
                    </td>
                    <td>{u.cargo}</td>
                    <td><Tag>{u.vinculo}</Tag></td>
                    <td>
                      {u.status === "desligado" ? (
                        <StatusBadge status="danger" label="Desligado" withDot={false} icon={<IconAlertCircle size={11} />} />
                      ) : u.status === "in_notice" ? (
                        <StatusBadge status="warning" label="Em aviso" />
                      ) : <StatusBadge status="ativo" />}
                    </td>
                    <td className="fg-tabular fg-muted">{formatDate(u.entrada)}</td>
                    <td style={{ textAlign: "right" }}>
                      {u.status === "desligado" ? (
                        <Button variant="destructive" size="sm" icon={<IconX size={13} />}>Revogar acesso</Button>
                      ) : (
                        <Dropdown trigger={<button className="fg-icon-btn sm"><IconMore size={16} /></button>}
                          items={[{ label: "Trocar nível", icon: <IconEdit size={13} /> }, { separator: true }, { label: "Remover licença", icon: <IconTrash size={13} />, danger: true }]} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {tab === "renovacoes" && (
          <Card title="Histórico de renovações" description="Cronológico — vinculado ao financeiro.">
            <ol className="fg-timeline fg-timeline-vertical">
              {(window.FG_RENOVACOES[s.id] || [{ data: s.renovacao, valor: s.custo, acao: "Renovação programada", status: "previsto" }]).map((r, i) => (
                <li key={i} className={`fg-tl-step ${r.status === "previsto" ? "fg-tl-current" : "fg-tl-done"}`}>
                  <div className="fg-tl-dot">{r.status === "previsto" ? <IconClock size={10} /> : <IconCheck size={10} stroke={3} />}</div>
                  <div className="fg-tl-body">
                    <div className="fg-tl-label">{r.acao} — <span className="fg-tabular">{formatBRL(r.valor)}</span></div>
                    <div className="fg-tl-meta">{formatDate(r.data, "long")}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {tab === "contrato" && (
          <Card title="Contrato anexado" description="Versões anteriores ficam na lista." padding={false}
            action={<Button variant="primary" size="sm" icon={<IconUpload size={14} />}>Substituir contrato</Button>}>
            <table className="fg-aumento-table">
              <thead><tr><th>Arquivo</th><th>Versão</th><th>Enviado por</th><th>Em</th><th></th></tr></thead>
              <tbody>
                <tr>
                  <td>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <IconFile size={14} style={{ color: "var(--ink-500)" }} />
                      <span className="fg-cell-strong">{s.contrato}</span>
                    </span>
                  </td>
                  <td className="fg-tabular fg-muted">v1</td>
                  <td><div className="fg-cell-user"><Avatar name="Lívia Câmara" size={20} /><span>Lívia</span></div></td>
                  <td className="fg-tabular fg-muted">{formatDate(_d4(15, 0, 2025))}</td>
                  <td style={{ textAlign: "right" }}>
                    <Dropdown trigger={<button className="fg-icon-btn sm"><IconMore size={16} /></button>}
                      items={[{ label: "Visualizar", icon: <IconEye size={13} /> }, { label: "Baixar", icon: <IconDownload size={13} /> }]} />
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
};

Object.assign(window, { Assinaturas, AssinaturaDetail, ASSINATURA_TABS });

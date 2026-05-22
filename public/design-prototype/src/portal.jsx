// Portal do Colaborador — shell distinto, mais respirado.
// Demo user: Carlos Augusto (FG-00031, PJ Criação) — tem NF aberta para mai/26.

// ────────────────────────────────────────────────────────────────────────────
// Portal user picker (via tweaks ou seletor manual)
// ────────────────────────────────────────────────────────────────────────────
window.FG_PORTAL_USER_ID = window.FG_PORTAL_USER_ID || "c-011"; // Carlos Augusto
const getPortalUser = () => (window.FG_COLABORADORES || []).find((c) => c.id === window.FG_PORTAL_USER_ID) || window.FG_COLABORADORES[10];
const setPortalUser = (id) => {
  window.FG_PORTAL_USER_ID = id;
  window.dispatchEvent(new Event("fg-portal-user-changed"));
};

const usePortalUser = () => {
  const [u, setU] = React.useState(getPortalUser());
  React.useEffect(() => {
    const h = () => setU(getPortalUser());
    window.addEventListener("fg-portal-user-changed", h);
    return () => window.removeEventListener("fg-portal-user-changed", h);
  }, []);
  return u;
};

// ────────────────────────────────────────────────────────────────────────────
// Portal navigation config
// ────────────────────────────────────────────────────────────────────────────
const PORTAL_NAV = [
  { path: "/portal", label: "Início", icon: <IconUser size={15} /> },
  { path: "/portal/nfs", label: "NFs", icon: <IconFile size={15} />, pjOnly: true },
  { path: "/portal/reembolsos", label: "Reembolsos", icon: <IconReceipt size={15} /> },
  { path: "/portal/ferias", label: "Férias", icon: <IconUmbrella size={15} /> },
  { path: "/portal/documentos", label: "Documentos", icon: <IconFolderLock size={15} /> },
  { path: "/portal/equipamentos", label: "Equipamentos", icon: <IconLaptop size={15} /> },
  { path: "/portal/acessos", label: "Acessos", icon: <IconKey size={15} /> },
  { path: "/portal/dados", label: "Meus dados", icon: <IconSettings size={15} /> },
];

// ────────────────────────────────────────────────────────────────────────────
// Portal Shell
// ────────────────────────────────────────────────────────────────────────────
const PortalShell = ({ children }) => {
  const { path, go } = useRouter();
  const u = usePortalUser();
  const { theme, setTheme } = useTheme();
  const nav = PORTAL_NAV.filter((n) => !n.pjOnly || u.vinculo === "PJ");
  const isActive = (p) => path === p || (p !== "/portal" && path.startsWith(p));
  return (
    <div className="fg-portal">
      <header className="fg-portal-header">
        <div className="fg-portal-header-inner">
          <a href="#/portal" className="fg-portal-logo" onClick={(e) => { e.preventDefault(); go("/portal"); }}>
            <FGLogo size={22} wordmark={true} />
          </a>

          <nav className="fg-portal-nav">
            {nav.map((n) => (
              <a
                key={n.path}
                href={`#${n.path}`}
                className={`fg-portal-tab ${isActive(n.path) ? "active" : ""}`}
                onClick={(e) => { e.preventDefault(); go(n.path); }}
              >
                {n.icon}
                <span>{n.label}</span>
              </a>
            ))}
          </nav>

          <div className="fg-portal-header-right">
            <button className="fg-icon-btn" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="Alternar tema">
              {theme === "dark" ? <IconSun size={16} /> : <IconMoon size={16} />}
            </button>
            <Dropdown
              align="right"
              trigger={
                <button className="fg-portal-user">
                  <Avatar name={u.nome} size={32} />
                  <div className="fg-portal-user-meta">
                    <div className="fg-portal-user-name">{u.nome.split(" ")[0]}</div>
                    <div className="fg-portal-user-role fg-tabular">{u.matricula}</div>
                  </div>
                </button>
              }
              items={[
                { label: "Meus dados", icon: <IconUser size={14} />, onClick: () => go("/portal/dados") },
                { label: theme === "dark" ? "Tema claro" : "Tema escuro", icon: theme === "dark" ? <IconSun size={14} /> : <IconMoon size={14} />, onClick: () => setTheme(theme === "dark" ? "light" : "dark") },
                { separator: true },
                { label: "Ir para back-office", icon: <IconExternal size={14} />, onClick: () => go("/dashboard") },
                { label: "Sair", icon: <IconLogout size={14} />, danger: true },
              ]}
            />
          </div>
        </div>
      </header>

      <main className="fg-portal-main">
        <div className="fg-portal-container">
          <PortalUserSwitcher />
          {children}
        </div>
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="fg-portal-bottom-nav">
        {nav.slice(0, 5).map((n) => (
          <a key={n.path} href={`#${n.path}`} className={`fg-portal-bnav-item ${isActive(n.path) ? "active" : ""}`} onClick={(e) => { e.preventDefault(); go(n.path); }}>
            {n.icon}
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
    </div>
  );
};

// Demo helper: switch portal user (shows only on /portal)
const PortalUserSwitcher = () => {
  const u = usePortalUser();
  const candidates = [
    { id: "c-011", label: "Carlos Augusto · PJ Criação · com NF aberta" },
    { id: "c-006", label: "João Bertolazi · CLT Criação · com férias" },
    { id: "c-018", label: "Jéssica Hara · CLT Estratégia · reembolso aprovado" },
    { id: "c-001", label: "Helena Vasconcelos · Sócia Diretoria" },
  ];
  return (
    <div className="fg-portal-demo-bar">
      <span className="fg-portal-demo-label">Demo · trocar perfil de visualização</span>
      <div className="fg-portal-demo-chips">
        {candidates.map((c) => (
          <button
            key={c.id}
            className={`fg-portal-demo-chip ${u.id === c.id ? "active" : ""}`}
            onClick={() => setPortalUser(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// PORTAL · INÍCIO
// ════════════════════════════════════════════════════════════════════════════
const PortalInicio = () => {
  const { go } = useRouter();
  const u = usePortalUser();
  const today = window.FG_TODAY;
  const hour = 14; // tarde
  const greeting = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";

  // NF aberta do PJ?
  const nfAberta = u.vinculo === "PJ"
    ? (window.FG_NFS || []).find((n) => n.colaborador === u.nome && n.status === "aguardando_envio")
    : null;
  const diasParaPrazo = nfAberta ? Math.round((nfAberta.prazo - today) / 86400000) : null;

  // Reembolsos próprios
  const meusReemb = (window.FG_REEMBOLSOS || []).filter((r) => r.colaborador === u.nome);
  const reembAndamento = meusReemb.filter((r) => ["aguardando_envio", "enviada", "aprovada"].includes(r.status));

  // Férias
  const minhasFerias = (window.FG_FERIAS || []).filter((f) => f.colaborador === u.nome);
  const proxFerias = minhasFerias.find((f) => f.inicio >= today);
  const feriasInfo = u.vinculo === "CLT" && u.ferias
    ? { dias: u.ferias.emFerias ? 0 : u.ferias.dias, em: u.ferias.emFerias, atencao: u.ferias.atencao }
    : null;

  // Equipamentos
  const eqs = window.FG_EQUIPAMENTOS_DE[u.id] || [];

  return (
    <div className="fg-portal-page">
      <div className="fg-portal-greet">
        <h1>{greeting}, {u.nome.split(" ")[0]}.</h1>
        <p>Hoje é {today.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}.</p>
      </div>

      {/* Card laranja de NF — única superfície grande em brand-orange no sistema */}
      {nfAberta && (
        <div className="fg-portal-nf-card">
          <div className="fg-portal-nf-icon"><IconAlertCircle size={20} stroke={2} /></div>
          <div className="fg-portal-nf-body">
            <div className="fg-portal-nf-eyebrow">Ação requerida</div>
            <h2 className="fg-portal-nf-title">Você precisa emitir sua NF de {nfAberta.competencia}</h2>
            <div className="fg-portal-nf-meta">
              <div>
                <span className="fg-portal-nf-label">Competência</span>
                <span className="fg-portal-nf-val">{nfAberta.competencia}</span>
              </div>
              <div>
                <span className="fg-portal-nf-label">Prazo</span>
                <span className="fg-portal-nf-val fg-tabular">{formatDate(nfAberta.prazo, "long")} <span className="fg-portal-nf-rel">· faltam {diasParaPrazo} dias</span></span>
              </div>
              <div>
                <span className="fg-portal-nf-label">Valor total esperado</span>
                <span className="fg-portal-nf-val big fg-tabular">{formatBRL(nfAberta.valorEsperado)}</span>
              </div>
            </div>
          </div>
          <div className="fg-portal-nf-cta">
            <button className="fg-portal-nf-btn" onClick={() => go("/portal/nfs")}>
              Ver composição e enviar NF
              <IconArrowRight size={16} stroke={2} />
            </button>
          </div>
        </div>
      )}

      {/* Quick-access cards */}
      <div className="fg-portal-quick">
        <button className="fg-portal-qcard" onClick={() => go("/portal/reembolsos")}>
          <div className="fg-portal-qcard-icon"><IconReceipt size={20} /></div>
          <div>
            <div className="fg-portal-qcard-num fg-tabular">{reembAndamento.length}</div>
            <div className="fg-portal-qcard-label">Reembolsos em andamento</div>
          </div>
          <IconChevronRight size={14} style={{ color: "var(--ink-400)" }} />
        </button>

        <button className="fg-portal-qcard" onClick={() => go("/portal/ferias")}>
          <div className="fg-portal-qcard-icon"><IconUmbrella size={20} /></div>
          <div>
            <div className="fg-portal-qcard-num fg-tabular">
              {feriasInfo ? `${feriasInfo.dias} dias` : proxFerias ? formatDate(proxFerias.inicio, "dayMonth") : "—"}
            </div>
            <div className="fg-portal-qcard-label">
              {feriasInfo ? "Férias disponíveis" : proxFerias ? `Próxima ${proxFerias.tipo.toLowerCase()}` : "Sem pausas programadas"}
            </div>
          </div>
          <IconChevronRight size={14} style={{ color: "var(--ink-400)" }} />
        </button>

        <button className="fg-portal-qcard" onClick={() => go("/portal/equipamentos")}>
          <div className="fg-portal-qcard-icon"><IconLaptop size={20} /></div>
          <div>
            <div className="fg-portal-qcard-num fg-tabular">{eqs.length}</div>
            <div className="fg-portal-qcard-label">{eqs.length === 1 ? "Equipamento atribuído" : "Equipamentos atribuídos"}</div>
          </div>
          <IconChevronRight size={14} style={{ color: "var(--ink-400)" }} />
        </button>
      </div>

      {/* Avisos recentes */}
      <section className="fg-portal-section">
        <h3 className="fg-portal-section-title">Avisos recentes</h3>
        <ul className="fg-portal-avisos">
          {u.vinculo === "PJ" && <li><span className="fg-portal-aviso-dot good" /> Sua NF de abril foi aprovada <span className="fg-portal-aviso-when">· 12 mai</span></li>}
          {reembAndamento.length > 0 && <li><span className="fg-portal-aviso-dot good" /> Reembolso de {formatBRL(reembAndamento[0].valor)} foi {reembAndamento[0].status === "aprovada" ? "aprovado" : "encaminhado"} <span className="fg-portal-aviso-when">· 14 mai</span></li>}
          <li><span className="fg-portal-aviso-dot warn" /> Atualizar dependentes no plano de saúde até 30/05 <span className="fg-portal-aviso-when">· RH</span></li>
          <li><span className="fg-portal-aviso-dot" /> Política de reembolsos atualizada — leia em Documentos <span className="fg-portal-aviso-when">· 08 mai</span></li>
        </ul>
      </section>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// PORTAL · MINHAS NFs (PJ)
// ════════════════════════════════════════════════════════════════════════════
const PortalNFs = () => {
  const u = usePortalUser();
  const minhas = (window.FG_NFS || []).filter((n) => n.colaborador === u.nome);
  const aberta = minhas.find((n) => n.status === "aguardando_envio");
  const historico = minhas.filter((n) => n.status !== "aguardando_envio");
  const [tab, setTab] = React.useState(aberta ? "atual" : "historico");

  if (u.vinculo !== "PJ") {
    return (
      <div className="fg-portal-page">
        <h1 className="fg-portal-h1">NFs</h1>
        <Card><EmptyState icon={<IconFile size={32} />} title="Você não é PJ" description="O fluxo de notas fiscais aparece aqui apenas para colaboradores com vínculo PJ." /></Card>
      </div>
    );
  }

  return (
    <div className="fg-portal-page">
      <h1 className="fg-portal-h1">Minhas notas fiscais</h1>

      <div className="fg-detail-tabs" style={{ marginBottom: 16 }}>
        <Tabs value={tab} onChange={setTab} items={[
          { value: "atual", label: aberta ? `NF atual · ${aberta.competencia}` : "NF atual" },
          { value: "historico", label: "Histórico", count: historico.length },
        ]} />
      </div>

      {tab === "atual" && (aberta ? <PortalNFAtual nf={aberta} /> : (
        <Card><EmptyState icon={<IconCheckCircle size={32} />} title="Nenhuma NF aberta no momento" description="A próxima composição será gerada automaticamente no início da nova competência." /></Card>
      ))}

      {tab === "historico" && (
        <Card padding={false} title="Histórico de NFs">
          <table className="fg-aumento-table">
            <thead><tr><th>Competência</th><th>Valor</th><th>Número</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {historico.map((n) => (
                <tr key={n.id}>
                  <td className="fg-tabular">{n.competencia}</td>
                  <td className="fg-tabular fg-cell-strong">{formatBRL(n.valorEmitido ?? n.valorEsperado)}</td>
                  <td className="fg-tabular fg-muted">{n.numeroNF || "—"}</td>
                  <td><StatusBadge status={n.status} /></td>
                  <td style={{ textAlign: "right" }}>
                    <Button variant="ghost" size="sm" icon={<IconEye size={13} />}>Detalhe</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

const PortalNFAtual = ({ nf }) => {
  const toast = useToast();
  const [numero, setNumero] = React.useState("");
  const [valor, setValor] = React.useState(String(nf.valorEsperado));
  const [emissao, setEmissao] = React.useState("");
  const [arquivo, setArquivo] = React.useState(null);
  const diferenca = Number(valor || 0) - nf.valorEsperado;
  const canSubmit = !!numero && !!arquivo && !!valor && Math.abs(diferenca) < 100;
  const descritivo = `Prestação de serviços de ${nf.area.toLowerCase()} referente à competência ${nf.competencia} — conforme contrato firmado entre as partes.`;
  return (
    <>
      <div className="fg-portal-nf-strip">
        <div><span>Competência</span><strong className="fg-tabular">{nf.competencia}</strong></div>
        <div><span>Prazo</span><strong className="fg-tabular">{formatDate(nf.prazo, "dayMonth")} · {formatRelative(nf.prazo)}</strong></div>
        <div><span>Valor esperado</span><strong className="fg-tabular">{formatBRL(nf.valorEsperado)}</strong></div>
      </div>

      <Card title="Composição esperada" description="Esses são os itens que compõem o valor da sua NF. Confira antes de emitir.">
        <table className="fg-compo-table">
          <tbody>
            {nf.composicao.map((c, i) => (
              <tr key={i}>
                <td>{c.item}</td>
                <td className={`right fg-tabular ${c.valor < 0 ? "fg-bad" : ""}`}>{c.valor < 0 ? "−" : ""}{formatBRL(Math.abs(c.valor))}</td>
              </tr>
            ))}
            <tr className="fg-compo-total"><td>Total esperado</td><td className="right fg-tabular">{formatBRL(nf.valorEsperado)}</td></tr>
          </tbody>
        </table>
      </Card>

      <Card title="Descritivo sugerido" description="Cole esse texto no campo de descrição da sua NF. O financeiro espera essa redação."
        action={<Button variant="outline" size="sm" icon={<IconCopy size={13} />} onClick={() => { navigator.clipboard?.writeText(descritivo); toast({ tone: "success", title: "Copiado" }); }}>Copiar</Button>}>
        <div className="fg-quote">{descritivo}</div>
      </Card>

      <Card title="Enviar NF emitida" description="Faça upload do PDF e informe os dados da nota emitida.">
        <div className="fg-form">
          <Field label="Arquivo da NF (PDF)" required helper="Até 10 MB. PDF emitido pelo seu portal de NFs.">
            <div className="fg-dropzone" onClick={() => setArquivo({ nome: "nf-carlos-augusto-052026.pdf", tamanho: "184 KB" })} role="button" tabIndex={0}>
              {arquivo ? (
                <>
                  <IconFile size={20} />
                  <div className="fg-dropzone-text"><strong>{arquivo.nome}</strong> · {arquivo.tamanho}</div>
                  <div className="fg-dropzone-hint"><a href="#" className="fg-link" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setArquivo(null); }}>Substituir arquivo</a></div>
                </>
              ) : (
                <>
                  <IconUpload size={20} />
                  <div className="fg-dropzone-text"><strong>Arraste o arquivo</strong> ou <a href="#" className="fg-link" onClick={(e) => { e.preventDefault(); }}>clique para enviar</a></div>
                  <div className="fg-dropzone-hint">PDF · máx 10 MB</div>
                </>
              )}
            </div>
          </Field>
          <div className="fg-form-row">
            <Field label="Número da NF" required>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Ex: NF 0142" mono />
            </Field>
            <Field label="Data de emissão" required>
              <Input type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} mono />
            </Field>
          </div>
          <Field
            label="Valor emitido"
            required
            helper={Math.abs(diferenca) > 0 && Math.abs(diferenca) < 100 ? `Diferença de ${formatBRL(Math.abs(diferenca))} ${diferenca > 0 ? "acima" : "abaixo"} do esperado — tolerância OK.` : null}
            error={Math.abs(diferenca) >= 100 ? `Divergência de ${formatBRL(Math.abs(diferenca))} ${diferenca > 0 ? "acima" : "abaixo"} do esperado. Confirme antes de enviar.` : null}
          >
            <Input prefix="R$" value={valor} onChange={(e) => setValor(e.target.value)} mono inputMode="decimal" />
          </Field>

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <Button variant="primary" size="lg" disabled={!canSubmit} onClick={() => toast({ tone: "success", title: "NF enviada para revisão do financeiro", description: `${nf.competencia} · ${formatBRL(Number(valor))}` })}>Enviar NF para aprovação</Button>
            <Button variant="outline" size="lg">Salvar rascunho</Button>
          </div>
        </div>
      </Card>
    </>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// PORTAL · REEMBOLSOS
// ════════════════════════════════════════════════════════════════════════════
const PortalReembolsos = () => {
  const u = usePortalUser();
  const meus = (window.FG_REEMBOLSOS || []).filter((r) => r.colaborador === u.nome);
  const [solOpen, setSolOpen] = React.useState(false);
  return (
    <div className="fg-portal-page">
      <div className="fg-portal-page-head">
        <h1 className="fg-portal-h1">Meus reembolsos</h1>
        <Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setSolOpen(true)}>Solicitar reembolso</Button>
      </div>

      {meus.length === 0 ? (
        <Card><EmptyState icon={<IconReceipt size={32} />} title="Nenhum reembolso solicitado" description="Quando você enviar uma solicitação, ela aparecerá aqui com o acompanhamento do status." action={<Button variant="primary" icon={<IconPlus size={14} />} onClick={() => setSolOpen(true)}>Solicitar reembolso</Button>} /></Card>
      ) : (
        <div className="fg-portal-list">
          {meus.map((r) => (
            <article key={r.id} className="fg-portal-item">
              <div className="fg-portal-item-icon"><IconReceipt size={18} /></div>
              <div className="fg-portal-item-body">
                <div className="fg-portal-item-title">{r.categoria} · <span className="fg-tabular">{formatBRL(r.valor)}</span></div>
                <div className="fg-portal-item-sub">{r.descricao}</div>
                <div className="fg-portal-item-meta">
                  <span className="fg-tabular">{formatDate(r.dataDespesa, "long")}</span>
                  {r.cliente && <><span>·</span><Tag>{r.cliente}</Tag></>}
                  {r.anexo && <><span>·</span><IconPaperclip size={12} /> <span>{r.anexo}</span></>}
                </div>
              </div>
              <div className="fg-portal-item-status">
                <StatusBadge status={r.status} />
                <Button variant="ghost" size="sm" iconRight={<IconChevronRight size={13} />}>Detalhe</Button>
              </div>
            </article>
          ))}
        </div>
      )}

      <PortalSolicitarReembolso open={solOpen} onClose={() => setSolOpen(false)} />
    </div>
  );
};

const PortalSolicitarReembolso = ({ open, onClose }) => {
  const toast = useToast();
  const [form, setForm] = React.useState({ data: "", categoria: "", valor: "", descricao: "", cliente: "", cc: "" });
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Solicitar reembolso"
      description="Sua solicitação será encaminhada ao seu gestor e depois ao financeiro."
      width={580}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancelar</Button>
        <Button variant="primary" icon={<IconArrowRight size={14} />} onClick={() => { toast({ tone: "success", title: "Reembolso enviado para aprovação" }); onClose(); }}>Enviar para aprovação</Button>
      </>}
    >
      <div className="fg-form">
        <div className="fg-form-row">
          <Field label="Data da despesa" required><Input type="date" value={form.data} onChange={(e) => set("data", e.target.value)} mono /></Field>
          <Field label="Valor" required><Input prefix="R$" value={form.valor} onChange={(e) => set("valor", e.target.value)} mono inputMode="decimal" /></Field>
        </div>
        <Field label="Categoria" required>
          <Select value={form.categoria} onChange={(v) => set("categoria", v)} options={["Refeição com cliente", "Transporte", "Material gráfico", "Shooting / Produção", "Software", "Workshop / Evento", "Outros"]} />
        </Field>
        <Field label="Descrição" required helper="Descreva a despesa com clareza para facilitar a aprovação.">
          <Textarea value={form.descricao} onChange={(e) => set("descricao", e.target.value)} rows={3} placeholder="Ex: Almoço com cliente Pampulha Banking — 4 pessoas — Restaurante Tordesilhas" />
        </Field>
        <div className="fg-form-row">
          <Field label="Cliente atribuído"><Select value={form.cliente} onChange={(v) => set("cliente", v)} options={window.FG_CLIENTES.map((c) => c.nome)} /></Field>
          <Field label="Centro de custo"><Select value={form.cc} onChange={(v) => set("cc", v)} options={window.FG_CENTROS_CUSTO} /></Field>
        </div>
        <Field label="Comprovante" required>
          <div className="fg-dropzone">
            <IconUpload size={20} />
            <div className="fg-dropzone-text"><strong>Arraste o arquivo</strong> ou <a href="#" className="fg-link" onClick={(e) => e.preventDefault()}>clique para enviar</a></div>
            <div className="fg-dropzone-hint">PDF, JPG ou PNG · máx 10 MB</div>
          </div>
        </Field>
      </div>
    </Sheet>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// PORTAL · FÉRIAS / PAUSAS
// ════════════════════════════════════════════════════════════════════════════
const PortalFerias = () => {
  const u = usePortalUser();
  const isCLT = u.vinculo === "CLT";
  const minhas = (window.FG_FERIAS || []).filter((f) => f.colaborador === u.nome);
  return (
    <div className="fg-portal-page">
      <div className="fg-portal-page-head">
        <h1 className="fg-portal-h1">{isCLT ? "Minhas férias" : "Minhas pausas"}</h1>
        <Button variant="primary" icon={<IconPlus size={14} />}>{isCLT ? "Solicitar férias" : "Programar pausa"}</Button>
      </div>

      {isCLT && u.ferias && (
        <div className="fg-portal-ferias-hero">
          <div className="fg-portal-ferias-big">
            <div className="fg-portal-ferias-num fg-tabular">{u.ferias.emFerias ? 0 : u.ferias.dias}</div>
            <div className="fg-portal-ferias-unit">dias disponíveis</div>
          </div>
          <div className="fg-portal-ferias-side">
            <div className="fg-portal-ferias-row"><span>Tirados no período</span><strong className="fg-tabular">{30 - (u.ferias.dias || 0)} dias</strong></div>
            <div className="fg-portal-ferias-row"><span>Vendidos</span><strong className="fg-tabular">0 dias</strong></div>
            <div className="fg-portal-ferias-row"><span>Vencimento</span><strong className={`fg-tabular ${u.ferias.atencao ? "fg-bad" : ""}`}>{formatDate(u.ferias.vencimento)}</strong></div>
            {u.ferias.atencao && <div className="fg-portal-ferias-warn"><IconAlertCircle size={13} /> Vencimento próximo — programe suas férias até o fim do mês.</div>}
          </div>
        </div>
      )}

      <section className="fg-portal-section">
        <h3 className="fg-portal-section-title">Histórico</h3>
        {minhas.length === 0 ? (
          <EmptyState icon={<IconUmbrella size={32} />} title="Nada registrado ainda" />
        ) : (
          <div className="fg-portal-list">
            {minhas.map((f) => (
              <article key={f.id} className="fg-portal-item">
                <div className="fg-portal-item-icon"><IconUmbrella size={18} /></div>
                <div className="fg-portal-item-body">
                  <div className="fg-portal-item-title">{f.tipo} · {f.dias} dias</div>
                  <div className="fg-portal-item-meta fg-tabular">{formatDate(f.inicio, "long")} → {formatDate(f.fim, "long")}</div>
                </div>
                <div className="fg-portal-item-status">
                  <StatusBadge status={f.status} />
                  <span className="fg-portal-item-aprov">aprovação de {f.aprovador.split(" ")[0]}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// PORTAL · EQUIPAMENTOS
// ════════════════════════════════════════════════════════════════════════════
const PortalEquipamentos = () => {
  const u = usePortalUser();
  const eqs = window.FG_EQUIPAMENTOS_DE[u.id] || [];
  return (
    <div className="fg-portal-page">
      <h1 className="fg-portal-h1">Meus equipamentos</h1>
      {eqs.length === 0 ? (
        <Card><EmptyState icon={<IconLaptop size={32} />} title="Nenhum equipamento atribuído a você no momento" /></Card>
      ) : (
        <div className="fg-portal-eq-grid">
          {eqs.map((e) => (
            <article key={e.patrimonio} className="fg-portal-eq-card">
              <div className="fg-portal-eq-icon"><IconLaptop size={28} /></div>
              <div className="fg-portal-eq-title">{e.tipo}</div>
              <div className="fg-portal-eq-pat fg-tabular">{e.patrimonio}</div>
              <dl className="fg-portal-eq-dl">
                <div><dt>Atribuído em</dt><dd className="fg-tabular">{formatDate(e.entrega, "long")}</dd></div>
                <div><dt>Estado</dt><dd>{e.estado}</dd></div>
              </dl>
              <Button variant="outline" size="sm" icon={<IconDownload size={13} />}>Baixar termo</Button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// PORTAL · DOCUMENTOS
// ════════════════════════════════════════════════════════════════════════════
const PortalDocumentos = () => {
  const groups = [
    { label: "Contratos", icon: <IconFile size={16} />, items: [
      { tipo: "Contrato", nome: "Contrato de prestação de serviços 2025.pdf", em: new Date(2025, 0, 15), sens: true },
      { tipo: "Aditivo", nome: "Aditivo de reajuste mar/2026.pdf", em: new Date(2026, 2, 1), sens: false },
    ] },
    { label: "Documentos pessoais", icon: <IconFolderLock size={16} />, items: [
      { tipo: "RG", nome: "RG digitalizado.pdf", em: new Date(2024, 1, 12), sens: true },
      { tipo: "Comprovante", nome: "Comprovante de endereço — abril 2026.pdf", em: new Date(2026, 3, 8), sens: true },
    ] },
    { label: "NFs emitidas", icon: <IconFile size={16} />, items: [
      { tipo: "NF", nome: "NF-carlos-augusto-042026.pdf", em: new Date(2026, 3, 30), sens: false },
      { tipo: "NF", nome: "NF-carlos-augusto-032026.pdf", em: new Date(2026, 2, 30), sens: false },
    ] },
    { label: "Recibos", icon: <IconReceipt size={16} />, items: [
      { tipo: "Recibo", nome: "Recibo reembolso shooting abr/26.pdf", em: new Date(2026, 4, 5), sens: false },
    ] },
  ];
  return (
    <div className="fg-portal-page">
      <h1 className="fg-portal-h1">Meus documentos</h1>
      <p className="fg-portal-lead">Visualize e baixe contratos, NFs, recibos e documentos pessoais. Cada acesso a documento sensível é registrado em audit log.</p>
      {groups.map((g) => (
        <section key={g.label} className="fg-portal-section">
          <h3 className="fg-portal-section-title">{g.icon}<span>{g.label}</span></h3>
          <div className="fg-portal-doc-list">
            {g.items.map((d, i) => (
              <article key={i} className="fg-portal-doc">
                <IconFile size={18} />
                <div className="fg-portal-doc-body">
                  <div className="fg-portal-doc-name">{d.nome}</div>
                  <div className="fg-portal-doc-meta fg-tabular">{formatDate(d.em)} {d.sens && <StatusBadge status="danger" label="Sensível" withDot={false} icon={<IconAlertCircle size={11} />} />}</div>
                </div>
                <div className="fg-portal-doc-actions">
                  <Button variant="ghost" size="sm" icon={<IconEye size={13} />}>Ver</Button>
                  <Button variant="ghost" size="sm" icon={<IconDownload size={13} />}>Baixar</Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// PORTAL · MEUS DADOS
// ════════════════════════════════════════════════════════════════════════════
const PortalDados = () => {
  const u = usePortalUser();
  const [reveal, setReveal] = React.useState(false);
  const toast = useToast();
  return (
    <div className="fg-portal-page">
      <h1 className="fg-portal-h1">Meus dados</h1>
      <p className="fg-portal-lead">Confira seus dados cadastrais. Para alterar dados sensíveis, abra uma solicitação ao RH — ela será revisada antes de aplicar.</p>

      <Card title="Identificação" action={<Button variant="outline" size="sm" icon={<IconEye size={13} />} onClick={() => setReveal(!reveal)}>{reveal ? "Ocultar dados sensíveis" : "Revelar dados sensíveis"}</Button>}>
        <dl className="fg-deflist">
          <div><dt>Nome completo</dt><dd>{u.nome}</dd></div>
          <div><dt>Matrícula</dt><dd className="fg-tabular">{u.matricula}</dd></div>
          <div><dt>CPF</dt><dd className="fg-tabular">{reveal ? "153.987.456-21" : "***.***.456-**"}</dd></div>
          <div><dt>RG</dt><dd className="fg-tabular">{reveal ? "32.456.789-1" : "**.***.**9-*"}</dd></div>
          <div className="full"><dt>Endereço</dt><dd>{reveal ? "Rua Aspicuelta, 312 ap 41 — Vila Madalena, São Paulo/SP — 05433-010" : "*** restrito — clique em revelar"}</dd></div>
        </dl>
      </Card>

      <Card title="Vínculo">
        <dl className="fg-deflist">
          <div><dt>Cargo</dt><dd>{u.cargo}</dd></div>
          <div><dt>Área</dt><dd>{u.area}</dd></div>
          <div><dt>Vínculo</dt><dd><Tag>{u.vinculo}</Tag></dd></div>
          <div><dt>Modelo</dt><dd>{u.modelo}</dd></div>
          <div><dt>Gestor</dt><dd>{u.gestor || "—"}</dd></div>
          <div><dt>Localização</dt><dd>{u.localizacao}</dd></div>
        </dl>
      </Card>

      <Card title="Contato">
        <dl className="fg-deflist">
          <div><dt>E-mail corporativo</dt><dd>{u.nome.split(" ")[0].toLowerCase()}@formulagroup.com.br</dd></div>
          <div><dt>E-mail pessoal</dt><dd>{u.nome.split(" ")[0].toLowerCase()}@gmail.com</dd></div>
          <div><dt>Telefone</dt><dd className="fg-tabular">{reveal ? "(11) 9 9876-5432" : "(11) 9 ****-5432"}</dd></div>
        </dl>
        <div style={{ marginTop: 14 }}>
          <Button variant="outline" icon={<IconEdit size={14} />} onClick={() => toast({ tone: "default", title: "Solicitação encaminhada ao RH" })}>Solicitar alteração de dados</Button>
        </div>
      </Card>

      <Card title="Remuneração" action={<a href="#/portal/remuneracao" className="fg-link">Ver histórico</a>}>
        <div className="fg-portal-rem-big">
          <div className="fg-portal-rem-num fg-tabular">{formatBRL(u.remuneracao || 0)}</div>
          <div className="fg-portal-rem-label">{u.vinculo === "PJ" ? "Remuneração contratada" : u.vinculo === "Sócia" ? "Composição mensal" : "Salário atual"}</div>
        </div>
      </Card>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// PORTAL · ACESSOS
// ════════════════════════════════════════════════════════════════════════════
const PortalAcessos = () => {
  const u = usePortalUser();
  const acessos = (window.FG_ASSINATURAS || []).filter((s) => (s.usuarios || []).includes(u.id));
  return (
    <div className="fg-portal-page">
      <div className="fg-portal-page-head">
        <h1 className="fg-portal-h1">Meus acessos</h1>
        <Button variant="outline" icon={<IconPlus size={14} />}>Solicitar acesso</Button>
      </div>
      <p className="fg-portal-lead">Sistemas e ferramentas em que você tem licença ativa. Para solicitar um novo acesso, abra um ticket ao time de TI.</p>

      <div className="fg-portal-acessos-grid">
        {acessos.map((s) => (
          <article key={s.id} className="fg-portal-acesso-card">
            <div className="fg-saas-logo" style={{ background: s.cor }}>{s.monograma}</div>
            <div>
              <div className="fg-portal-acesso-name">{s.nome}</div>
              <div className="fg-portal-acesso-cat">{s.categoria} · {s.fornecedor}</div>
            </div>
            <StatusBadge status="ativo" />
          </article>
        ))}
      </div>
    </div>
  );
};

Object.assign(window, {
  PortalShell, PortalInicio, PortalNFs, PortalReembolsos, PortalFerias,
  PortalEquipamentos, PortalDocumentos, PortalDados, PortalAcessos,
  usePortalUser, setPortalUser, PORTAL_NAV,
});

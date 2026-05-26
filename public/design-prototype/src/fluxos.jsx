// Fluxos — NFs, Reembolsos, Férias
// Padrão: tabs por status + DataTable + Sheet/Página de aprovação.

// ════════════════════════════════════════════════════════════════════════════
// NFs (Notas Fiscais)
// ════════════════════════════════════════════════════════════════════════════
const NFS_TABS = [
  { value: "aguardando_envio", label: "Aguardando envio" },
  { value: "enviada", label: "Enviadas" },
  { value: "divergente", label: "Divergentes" },
  { value: "aprovada", label: "Aprovadas" },
  { value: "lancada", label: "Lançadas" },
  { value: "pago", label: "Pagas" },
  { value: "todos", label: "Todas" },
];

const NFs = () => {
  const [tab, setTab] = React.useState("aguardando_envio");
  const [search, setSearch] = React.useState("");
  const [areaF, setAreaF] = React.useState([]);
  const [compF, setCompF] = React.useState([]);
  const [density, setDensity] = React.useState("regular");
  const [sortKey, setSortKey] = React.useState("prazo");
  const [sortDir, setSortDir] = React.useState("asc");
  const [open, setOpen] = React.useState(null);

  const all = window.FG_NFS;
  const tabCounts = NFS_TABS.reduce((acc, t) => {
    acc[t.value] = t.value === "todos" ? all.length : all.filter((n) => n.status === t.value).length;
    return acc;
  }, {});

  const filtered = React.useMemo(() => {
    let xs = tab === "todos" ? all : all.filter((n) => n.status === tab);
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter((n) => n.colaborador.toLowerCase().includes(q) || n.matricula.toLowerCase().includes(q));
    }
    if (areaF.length) xs = xs.filter((n) => areaF.includes(n.area));
    if (compF.length) xs = xs.filter((n) => compF.includes(n.competencia));
    xs = [...xs].sort((a, b) => {
      const av = a[sortKey] || 0, bv = b[sortKey] || 0;
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return xs;
  }, [all, tab, search, areaF, compF, sortKey, sortDir]);

  const onSort = (k) => { if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("asc"); } };

  const totalEsperado = filtered.reduce((a, n) => a + n.valorEsperado, 0);
  const totalEmitido = filtered.reduce((a, n) => a + (n.valorEmitido || 0), 0);

  const columns = [
    { key: "colaborador", label: "PJ", sortable: true, render: (r) => (
      <div className="fg-cell-user">
        <Avatar name={r.colaborador} size={28} />
        <div>
          <div className="fg-cell-strong">{r.colaborador}</div>
          <div className="fg-cell-sub fg-tabular">{r.matricula} · {r.area}</div>
        </div>
      </div>
    ) },
    { key: "competencia", label: "Comp.", sortable: true, render: (r) => <span className="fg-tabular fg-muted">{r.competencia}</span> },
    { key: "valorEsperado", label: "Esperado", sortable: true, align: "right", render: (r) => <span className="fg-tabular fg-cell-strong">{formatBRL(r.valorEsperado)}</span> },
    { key: "valorEmitido", label: "Emitido", align: "right", render: (r) => r.valorEmitido != null
      ? <span className="fg-tabular">{formatBRL(r.valorEmitido)}</span>
      : <span className="fg-muted">—</span> },
    { key: "_div", label: "Divergência", align: "right", render: (r) => r.divergencia
      ? <span className="fg-tabular fg-bad">+{formatBRL(r.divergencia.valor)}</span>
      : <span className="fg-muted">—</span> },
    { key: "prazo", label: "Prazo", sortable: true, render: (r) => (
      <div className="fg-cell-strong fg-tabular">{formatDate(r.prazo, "dayMonth")}<div className="fg-cell-sub">{formatRelative(r.prazo)}</div></div>
    ) },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "_acoes", label: "", width: 40, render: (r) => (
      <Dropdown
        trigger={<button className="fg-icon-btn sm"><IconMore size={16} /></button>}
        items={[
          { label: "Abrir detalhes", icon: <IconEye size={13} />, onClick: () => setOpen(r) },
          { label: "Aprovar", icon: <IconCheckCircle size={13} /> },
          { label: "Pedir ajuste", icon: <IconRefresh size={13} /> },
          { separator: true },
          { label: "Recusar", icon: <IconX size={13} />, danger: true },
        ]}
      />
    ) },
  ];

  return (
    <div className="fg-page">
      <PageHeader
        eyebrow="Fluxos"
        title="Notas Fiscais"
        description={`${filtered.length} composições · Esperado ${formatBRL(totalEsperado)} · Emitido ${formatBRL(totalEmitido)}`}
        actions={
          <>
            <Button variant="outline" size="sm" icon={<IconDownload size={14} />}>Exportar composições</Button>
            <Button variant="primary" size="sm" icon={<IconPlus size={14} />}>Nova composição</Button>
          </>
        }
        tabs={<Tabs value={tab} onChange={setTab} items={NFS_TABS.map((t) => ({ ...t, count: tabCounts[t.value] }))} />}
      />

      <Toolbar
        search={search}
        onSearch={setSearch}
        filters={
          <>
            <FilterPopover label="Área" value={areaF} onChange={setAreaF} options={[...new Set(all.map((n) => n.area))]} />
            <FilterPopover label="Competência" value={compF} onChange={setCompF} options={[...new Set(all.map((n) => n.competencia))]} />
          </>
        }
        density={density}
        onDensity={setDensity}
      />

      <DataTable
        columns={columns}
        data={filtered}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        getRowKey={(r) => r.id}
        rowAttention={(r) => r.status === "divergente" ? "danger" : null}
        density={density}
      />

      <NFDetailSheet open={!!open} nf={open} onClose={() => setOpen(null)} />
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// NF Detail Sheet — composição esperada vs envio + ações
// ────────────────────────────────────────────────────────────────────────────
const NFDetailSheet = ({ open, nf, onClose }) => {
  const toast = useToast();
  const [obs, setObs] = React.useState("");
  React.useEffect(() => { if (open) setObs(""); }, [open]);
  if (!nf) return <Sheet open={false} onClose={onClose} />;

  const action = (kind) => {
    const map = {
      aprovar: { tone: "success", title: "NF aprovada", description: `${nf.colaborador} · ${nf.competencia}` },
      ajuste: { tone: "default", title: "Ajuste solicitado", description: `${nf.colaborador} foi notificado` },
      recusar: { tone: "error", title: "NF recusada", description: nf.colaborador },
    };
    toast(map[kind]);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`NF ${nf.competencia} · ${nf.colaborador}`}
      description={`${nf.matricula} · ${nf.area}`}
      width={680}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <div style={{ flex: 1 }} />
          <Button variant="destructive" icon={<IconX size={14} />} onClick={() => action("recusar")}>Recusar</Button>
          <Button variant="outline" icon={<IconRefresh size={14} />} onClick={() => action("ajuste")}>Pedir ajuste</Button>
          <Button variant="primary" icon={<IconCheck size={14} />} onClick={() => action("aprovar")}>Aprovar</Button>
        </>
      }
    >
      {/* Status + meta strip */}
      <div className="fg-nf-strip">
        <div className="fg-nf-strip-item">
          <div className="fg-nf-strip-label">Status</div>
          <StatusBadge status={nf.status} />
        </div>
        <div className="fg-nf-strip-item">
          <div className="fg-nf-strip-label">Prazo</div>
          <div className="fg-nf-strip-val fg-tabular">{formatDate(nf.prazo, "dayMonth")} <span className="fg-muted">· {formatRelative(nf.prazo)}</span></div>
        </div>
        <div className="fg-nf-strip-item">
          <div className="fg-nf-strip-label">Esperado</div>
          <div className="fg-nf-strip-val fg-tabular">{formatBRL(nf.valorEsperado)}</div>
        </div>
        <div className="fg-nf-strip-item">
          <div className="fg-nf-strip-label">Emitido</div>
          <div className="fg-nf-strip-val fg-tabular">{nf.valorEmitido != null ? formatBRL(nf.valorEmitido) : "—"}</div>
        </div>
      </div>

      {/* Divergência */}
      {nf.divergencia && (
        <div className="fg-inline-alert danger">
          <IconAlertCircle size={16} />
          <div>
            <div className="fg-inline-alert-title">Divergência detectada</div>
            <div className="fg-inline-alert-desc">{nf.divergencia.motivo}</div>
          </div>
        </div>
      )}

      {/* Composição esperada */}
      <div className="fg-section">
        <div className="fg-section-head">
          <div className="fg-section-title">Composição esperada</div>
          <Button variant="ghost" size="sm" icon={<IconCopy size={13} />}>Copiar descritivo</Button>
        </div>
        <table className="fg-compo-table">
          <tbody>
            {nf.composicao.map((c, i) => (
              <tr key={i}>
                <td>{c.item}</td>
                <td className={`right fg-tabular ${c.valor < 0 ? "fg-bad" : ""}`}>
                  {c.valor < 0 ? "−" : ""}{formatBRL(Math.abs(c.valor))}
                </td>
              </tr>
            ))}
            <tr className="fg-compo-total">
              <td>Total esperado</td>
              <td className="right fg-tabular">{formatBRL(nf.valorEsperado)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Descritivo sugerido */}
      <div className="fg-section">
        <div className="fg-section-head">
          <div className="fg-section-title">Descritivo sugerido</div>
        </div>
        <div className="fg-quote">
          Prestação de serviços de {nf.area.toLowerCase()} referente à competência {nf.competencia} —
          conforme contrato firmado entre as partes. Composição detalhada em anexo.
        </div>
      </div>

      {/* NF enviada / aguardando */}
      <div className="fg-section">
        <div className="fg-section-head">
          <div className="fg-section-title">{nf.valorEmitido != null ? "NF enviada" : "Aguardando emissão pelo PJ"}</div>
          {nf.numeroNF && <span className="fg-tabular fg-muted">{nf.numeroNF} · {formatDate(nf.emitidaEm)}</span>}
        </div>
        {nf.valorEmitido != null ? (
          <div className="fg-pdf-preview">
            <div className="fg-pdf-thumb">
              <IconFile size={36} />
              <div className="fg-pdf-thumb-name">NF-{nf.colaborador.split(" ")[0].toLowerCase()}-{nf.competencia.replace("/", "")}.pdf</div>
            </div>
            <div className="fg-pdf-meta">
              <div className="fg-pdf-line"><span>Número</span><strong className="fg-tabular">{nf.numeroNF}</strong></div>
              <div className="fg-pdf-line"><span>Emissão</span><strong className="fg-tabular">{formatDate(nf.emitidaEm)}</strong></div>
              <div className="fg-pdf-line"><span>Valor emitido</span><strong className="fg-tabular">{formatBRL(nf.valorEmitido)}</strong></div>
              <Button variant="outline" size="sm" icon={<IconDownload size={13} />}>Baixar PDF</Button>
            </div>
          </div>
        ) : (
          <div className="fg-inline-alert default">
            <IconClock size={16} />
            <div>
              <div className="fg-inline-alert-title">Composição pronta — PJ ainda não enviou</div>
              <div className="fg-inline-alert-desc">O colaborador foi notificado via portal. Prazo: {formatDate(nf.prazo)} ({formatRelative(nf.prazo)}).</div>
            </div>
          </div>
        )}
      </div>

      {/* Observação para o histórico */}
      <Field label="Observação interna" helper="Visível apenas para o financeiro e a diretoria. Anexada ao audit log.">
        <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex: divergência tolerada — alinhado em reunião financeira." rows={3} />
      </Field>
    </Sheet>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// REEMBOLSOS
// ════════════════════════════════════════════════════════════════════════════
const RB_TABS = [
  { value: "aguardando_envio", label: "Aguardando aprov." },
  { value: "enviada", label: "Em revisão" },
  { value: "aprovada", label: "Aprovados" },
  { value: "recusada", label: "Recusados" },
  { value: "pago", label: "Pagos" },
  { value: "todos", label: "Todos" },
];

const Reembolsos = () => {
  const [tab, setTab] = React.useState("aguardando_envio");
  const [search, setSearch] = React.useState("");
  const [catF, setCatF] = React.useState([]);
  const [areaF, setAreaF] = React.useState([]);
  const [density, setDensity] = React.useState("regular");
  const [open, setOpen] = React.useState(null);

  const all = window.FG_REEMBOLSOS;
  const tabCounts = RB_TABS.reduce((acc, t) => {
    acc[t.value] = t.value === "todos" ? all.length : all.filter((r) => r.status === t.value).length;
    return acc;
  }, {});

  const filtered = React.useMemo(() => {
    let xs = tab === "todos" ? all : all.filter((r) => r.status === tab);
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter((r) => r.colaborador.toLowerCase().includes(q) || r.descricao.toLowerCase().includes(q));
    }
    if (catF.length) xs = xs.filter((r) => catF.includes(r.categoria));
    if (areaF.length) xs = xs.filter((r) => areaF.includes(r.area));
    return xs;
  }, [all, tab, search, catF, areaF]);

  const totalValor = filtered.reduce((a, r) => a + r.valor, 0);

  const columns = [
    { key: "colaborador", label: "Colaborador", render: (r) => (
      <div className="fg-cell-user">
        <Avatar name={r.colaborador} size={26} />
        <div>
          <div className="fg-cell-strong">{r.colaborador}</div>
          <div className="fg-cell-sub">{r.area} · {r.vinculo}</div>
        </div>
      </div>
    ) },
    { key: "dataDespesa", label: "Data", render: (r) => <span className="fg-tabular">{formatDate(r.dataDespesa, "dayMonth")}</span> },
    { key: "categoria", label: "Categoria", render: (r) => <Tag>{r.categoria}</Tag> },
    { key: "descricao", label: "Descrição", render: (r) => <div className="fg-cell-clamp">{r.descricao}</div> },
    { key: "valor", label: "Valor", align: "right", render: (r) => <span className="fg-tabular fg-cell-strong">{formatBRL(r.valor)}</span> },
    { key: "cliente", label: "Cliente", render: (r) => r.cliente ? <Tag>{r.cliente}</Tag> : <span className="fg-muted">—</span> },
    { key: "anexo", label: "Anexo", render: (r) => r.anexo ? <span className="fg-cell-attach"><IconPaperclip size={13} /></span> : <span className="fg-muted">—</span> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "_acoes", label: "", width: 40, render: (r) => (
      <Dropdown
        trigger={<button className="fg-icon-btn sm"><IconMore size={16} /></button>}
        items={[
          { label: "Abrir detalhe", icon: <IconEye size={13} />, onClick: () => setOpen(r) },
          { label: "Aprovar", icon: <IconCheckCircle size={13} /> },
          ...(r.vinculo === "PJ" ? [{ label: "Incluir em NF", icon: <IconFile size={13} /> }] : []),
          { separator: true },
          { label: "Recusar", icon: <IconX size={13} />, danger: true },
        ]}
      />
    ) },
  ];

  return (
    <div className="fg-page">
      <PageHeader
        eyebrow="Fluxos"
        title="Reembolsos"
        description={`${filtered.length} solicitações · ${formatBRL(totalValor)} no fluxo`}
        actions={
          <Button variant="primary" size="sm" icon={<IconPlus size={14} />}>Reembolso manual</Button>
        }
        tabs={<Tabs value={tab} onChange={setTab} items={RB_TABS.map((t) => ({ ...t, count: tabCounts[t.value] }))} />}
      />

      <Toolbar
        search={search}
        onSearch={setSearch}
        filters={
          <>
            <FilterPopover label="Categoria" value={catF} onChange={setCatF} options={[...new Set(all.map((r) => r.categoria))]} />
            <FilterPopover label="Área" value={areaF} onChange={setAreaF} options={[...new Set(all.map((r) => r.area))]} />
          </>
        }
        density={density}
        onDensity={setDensity}
      />

      <DataTable columns={columns} data={filtered} getRowKey={(r) => r.id} density={density} />

      <ReembolsoDetailSheet open={!!open} rb={open} onClose={() => setOpen(null)} />
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Reembolso Detail Sheet
// ────────────────────────────────────────────────────────────────────────────
const ReembolsoDetailSheet = ({ open, rb, onClose }) => {
  const toast = useToast();
  if (!rb) return <Sheet open={false} onClose={onClose} />;

  const steps = [
    { label: "Enviado", state: "done", actor: rb.colaborador, when: formatDate(rb.dataDespesa) },
    { label: "Aprovação do gestor", state: rb.aprovacoes?.gestor ? "done" : rb.status === "recusada" ? "rejected" : "current", actor: rb.aprovacoes?.gestor?.por, when: rb.aprovacoes?.gestor && formatDate(rb.aprovacoes.gestor.em), motivo: rb.aprovacoes?.gestor?.motivo },
    { label: "Aprovação do financeiro", state: rb.aprovacoes?.financeiro ? "done" : (rb.aprovacoes?.gestor ? "current" : "pending"), actor: rb.aprovacoes?.financeiro?.por, when: rb.aprovacoes?.financeiro && formatDate(rb.aprovacoes.financeiro.em) },
    { label: "Pago", state: rb.status === "pago" ? "done" : "pending" },
  ];

  const action = (kind) => {
    const map = {
      aprovar: { tone: "success", title: "Reembolso aprovado", description: `${rb.colaborador} · ${formatBRL(rb.valor)}` },
      recusar: { tone: "error", title: "Reembolso recusado", description: rb.colaborador },
      nf: { tone: "success", title: "Incluído em NF", description: `${rb.colaborador} · NF de ${formatDate(window.FG_TODAY, "monthYear")}` },
    };
    toast(map[kind]);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Reembolso · ${formatBRL(rb.valor)}`}
      description={`${rb.colaborador} · ${rb.area} · ${formatDate(rb.dataDespesa, "long")}`}
      width={720}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Fechar</Button>
          <div style={{ flex: 1 }} />
          {rb.status !== "recusada" && rb.status !== "pago" && (
            <Button variant="destructive" icon={<IconX size={14} />} onClick={() => action("recusar")}>Recusar</Button>
          )}
          {rb.vinculo === "PJ" && rb.status === "aprovada" && !rb.nfAtrelada && (
            <Button variant="outline" icon={<IconFile size={14} />} onClick={() => action("nf")}>Incluir em NF</Button>
          )}
          {(rb.status === "aguardando_envio" || rb.status === "enviada") && (
            <Button variant="primary" icon={<IconCheck size={14} />} onClick={() => action("aprovar")}>
              {rb.aprovacoes?.gestor ? "Aprovar para pagamento" : "Aprovar como gestor"}
            </Button>
          )}
        </>
      }
    >
      <div className="fg-rb-grid">
        {/* Coluna esquerda: preview do anexo */}
        <div className="fg-rb-attach">
          <div className="fg-rb-attach-frame">
            <div className="fg-pdf-thumb-big">
              <IconFile size={64} />
              <div className="fg-pdf-thumb-name">{rb.anexo || "sem-anexo.pdf"}</div>
            </div>
          </div>
          <div className="fg-rb-attach-actions">
            <Button variant="outline" size="sm" icon={<IconEye size={13} />}>Abrir</Button>
            <Button variant="outline" size="sm" icon={<IconDownload size={13} />}>Baixar</Button>
          </div>
        </div>

        {/* Coluna direita: detalhes + timeline */}
        <div className="fg-rb-details">
          <dl className="fg-deflist">
            <div><dt>Solicitante</dt><dd>{rb.colaborador}</dd></div>
            <div><dt>Data da despesa</dt><dd className="fg-tabular">{formatDate(rb.dataDespesa, "long")}</dd></div>
            <div><dt>Categoria</dt><dd>{rb.categoria}</dd></div>
            <div><dt>Valor</dt><dd className="fg-tabular fg-cell-strong">{formatBRL(rb.valor)}</dd></div>
            <div><dt>Centro de custo</dt><dd><Tag>{rb.centroCusto}</Tag></dd></div>
            {rb.cliente && <div><dt>Cliente atribuído</dt><dd><Tag>{rb.cliente}</Tag></dd></div>}
            <div className="full"><dt>Descrição</dt><dd>{rb.descricao}</dd></div>
          </dl>

          <div className="fg-section" style={{ marginTop: 18 }}>
            <div className="fg-section-head"><div className="fg-section-title">Histórico de aprovação</div></div>
            <ol className="fg-timeline">
              {steps.map((s, i) => (
                <li key={i} className={`fg-tl-step fg-tl-${s.state}`}>
                  <div className="fg-tl-dot">
                    {s.state === "done" && <IconCheck size={10} stroke={3} />}
                    {s.state === "rejected" && <IconX size={10} stroke={3} />}
                  </div>
                  <div className="fg-tl-body">
                    <div className="fg-tl-label">{s.label}</div>
                    {s.actor && <div className="fg-tl-meta">{s.actor}{s.when && ` · ${s.when}`}</div>}
                    {s.motivo && <div className="fg-tl-motivo">{s.motivo}</div>}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {rb.nfAtrelada && (
            <div className="fg-inline-alert default">
              <IconFile size={16} />
              <div>
                <div className="fg-inline-alert-title">Incluído em NF</div>
                <div className="fg-inline-alert-desc">Este reembolso integrará a NF de {window.FG_NFS.find((n) => n.id === rb.nfAtrelada)?.competencia || "—"} de {rb.colaborador}.</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// FÉRIAS — Lista + Calendário
// ════════════════════════════════════════════════════════════════════════════
const FERIAS_TIPO_COR = {
  "Férias": "fg-fer-clt",
  "Pausa programada": "fg-fer-pj",
  "Afastamento": "fg-fer-afas",
};

const Ferias = () => {
  const [view, setView] = React.useState("lista");
  const [statusF, setStatusF] = React.useState([]);
  const [tipoF, setTipoF] = React.useState([]);
  const [search, setSearch] = React.useState("");
  const [density, setDensity] = React.useState("regular");

  const all = window.FG_FERIAS;
  const filtered = React.useMemo(() => {
    let xs = all;
    if (search) xs = xs.filter((f) => f.colaborador.toLowerCase().includes(search.toLowerCase()));
    if (statusF.length) xs = xs.filter((f) => statusF.includes(STATUS_MAP[f.status]?.label || f.status));
    if (tipoF.length) xs = xs.filter((f) => tipoF.includes(f.tipo));
    return xs;
  }, [all, search, statusF, tipoF]);

  const columns = [
    { key: "colaborador", label: "Colaborador", render: (r) => (
      <div className="fg-cell-user">
        <Avatar name={r.colaborador} size={26} />
        <div>
          <div className="fg-cell-strong">{r.colaborador}</div>
          <div className="fg-cell-sub fg-tabular">{r.matricula} · {r.area}</div>
        </div>
      </div>
    ) },
    { key: "tipo", label: "Tipo", render: (r) => <Tag>{r.tipo}</Tag> },
    { key: "vinculo", label: "Vínculo", render: (r) => <span className="fg-muted">{r.vinculo}</span> },
    { key: "_periodo", label: "Período", render: (r) => (
      <div className="fg-cell-strong fg-tabular">{formatDate(r.inicio, "dayMonth")} → {formatDate(r.fim, "dayMonth")}
        <div className="fg-cell-sub">{r.inicio.getFullYear() === r.fim.getFullYear() ? r.inicio.getFullYear() : `${r.inicio.getFullYear()}–${r.fim.getFullYear()}`}</div>
      </div>
    ) },
    { key: "dias", label: "Dias", align: "right", render: (r) => <span className="fg-tabular fg-cell-strong">{r.dias}</span> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "aprovador", label: "Aprovador", render: (r) => (
      <div className="fg-cell-user"><Avatar name={r.aprovador} size={22} /><span>{r.aprovador.split(" ")[0]}</span></div>
    ) },
    { key: "_acoes", label: "", width: 40, render: () => (
      <Dropdown
        trigger={<button className="fg-icon-btn sm"><IconMore size={16} /></button>}
        items={[{ label: "Ver detalhe", icon: <IconEye size={13} /> }, { label: "Editar", icon: <IconEdit size={13} /> }, { separator: true }, { label: "Cancelar", icon: <IconX size={13} />, danger: true }]}
      />
    ) },
  ];

  return (
    <div className="fg-page">
      <PageHeader
        eyebrow="Fluxos"
        title="Férias e ausências"
        description={`${filtered.length} programações ativas — visão global para detectar conflitos por área.`}
        actions={
          <>
            <div className="fg-chips">
              <button className={`fg-chip ${view === "lista" ? "active" : ""}`} onClick={() => setView("lista")}>Lista</button>
              <button className={`fg-chip ${view === "calendario" ? "active" : ""}`} onClick={() => setView("calendario")}>Calendário</button>
            </div>
            <Button variant="primary" size="sm" icon={<IconPlus size={14} />}>Programar ausência</Button>
          </>
        }
      />

      {view === "lista" ? (
        <>
          <Toolbar
            search={search}
            onSearch={setSearch}
            filters={
              <>
                <FilterPopover label="Status" value={statusF} onChange={setStatusF} options={["Previsto", "Aprovada"]} />
                <FilterPopover label="Tipo" value={tipoF} onChange={setTipoF} options={[...new Set(all.map((f) => f.tipo))]} />
              </>
            }
            density={density}
            onDensity={setDensity}
          />
          <DataTable columns={columns} data={filtered} getRowKey={(r) => r.id} density={density} />
        </>
      ) : (
        <FeriasCalendar items={filtered} />
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Calendar view — junho 2026 default (próximo mês)
// ────────────────────────────────────────────────────────────────────────────
const FeriasCalendar = ({ items }) => {
  const [cursor, setCursor] = React.useState(new Date(2026, 4, 1)); // Maio/26
  const monthName = cursor.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const firstDay = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const lastDay = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const startOffset = firstDay.getDay(); // 0=domingo
  const daysInMonth = lastDay.getDate();

  // Build a 6x7 grid; show prev/next month days as muted
  const cells = [];
  // Previous month tail
  const prevLast = new Date(cursor.getFullYear(), cursor.getMonth(), 0).getDate();
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth() - 1, prevLast - i), muted: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth(), d), muted: false });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) cells.push({ date: new Date(cursor.getFullYear(), cursor.getMonth() + 1, cells.length - daysInMonth - startOffset + 1), muted: true });
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  // Group items active in this month into "rows" assigned greedily (no overlap on the same lane)
  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const activeItems = items.filter((it) => it.fim >= monthStart && it.inicio <= monthEnd);
  // Sort by start; assign to row tracks per week
  const today = window.FG_TODAY;

  const dayHas = (date) => activeItems.filter((it) => date >= new Date(it.inicio.getFullYear(), it.inicio.getMonth(), it.inicio.getDate()) && date <= new Date(it.fim.getFullYear(), it.fim.getMonth(), it.fim.getDate()));

  return (
    <Card padding={false}>
      <div className="fg-cal-head">
        <div className="fg-cal-title">{monthName}</div>
        <div className="fg-cal-nav">
          <button className="fg-icon-btn sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}><IconChevronLeft size={14} /></button>
          <button className="fg-icon-btn sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}><IconChevronRight size={14} /></button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}>Hoje</Button>
        </div>
        <div className="fg-cal-legend">
          <span className="fg-cal-legend-item"><span className="fg-cal-swatch fg-fer-clt" />Férias CLT</span>
          <span className="fg-cal-legend-item"><span className="fg-cal-swatch fg-fer-pj" />Pausa PJ</span>
          <span className="fg-cal-legend-item"><span className="fg-cal-swatch fg-fer-afas" />Afastamento</span>
        </div>
      </div>
      <div className="fg-cal-grid">
        <div className="fg-cal-weekhead">
          {["dom", "seg", "ter", "qua", "qui", "sex", "sáb"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="fg-cal-body">
          {rows.map((row, ri) => (
            <div className="fg-cal-row" key={ri}>
              {row.map((cell, ci) => {
                const isToday = cell.date.toDateString() === today.toDateString();
                const events = dayHas(cell.date);
                return (
                  <div key={ci} className={`fg-cal-cell ${cell.muted ? "muted" : ""} ${isToday ? "today" : ""}`}>
                    <div className="fg-cal-day fg-tabular">{cell.date.getDate()}</div>
                    <div className="fg-cal-events">
                      {events.slice(0, 3).map((ev) => (
                        <div key={ev.id} className={`fg-cal-ev ${FERIAS_TIPO_COR[ev.tipo] || ""}`} title={`${ev.colaborador} · ${ev.tipo}`}>
                          <span className="fg-cal-ev-dot" />
                          <span>{ev.colaborador.split(" ")[0]}</span>
                        </div>
                      ))}
                      {events.length > 3 && <div className="fg-cal-more">+{events.length - 3}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};

Object.assign(window, { NFs, NFDetailSheet, NFS_TABS, Reembolsos, ReembolsoDetailSheet, RB_TABS, Ferias, FeriasCalendar });

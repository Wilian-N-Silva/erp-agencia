// Financeiro — Entradas / Saídas / Provisões + Sheet de criação/edição.

// ────────────────────────────────────────────────────────────────────────────
// DataTable wrapper genérico
// ────────────────────────────────────────────────────────────────────────────
const DataTable = ({ columns, data, sortKey, sortDir, onSort, selected, onSelect, onSelectAll, density = "regular", zebra = false, getRowKey, rowAttention }) => {
  const allSelected = selected && data.length > 0 && data.every((r) => selected.includes(getRowKey(r)));
  const someSelected = selected && data.some((r) => selected.includes(getRowKey(r))) && !allSelected;
  return (
    <div className={`fg-table-wrap fg-table-${density} ${zebra ? "zebra" : ""}`}>
      <table className="fg-table">
        <thead>
          <tr>
            {onSelect && (
              <th className="fg-th-check">
                <Checkbox checked={allSelected} indeterminate={someSelected} onChange={(v) => onSelectAll?.(v)} />
              </th>
            )}
            {columns.map((c) => (
              <th key={c.key} className={c.align === "right" ? "right" : ""} style={{ width: c.width }}>
                {c.sortable ? (
                  <button className="fg-th-sort" onClick={() => onSort?.(c.key)}>
                    <span>{c.label}</span>
                    <span className="fg-th-arrow">
                      {sortKey === c.key ? (sortDir === "asc" ? <IconArrowUp size={10} stroke={2} /> : <IconArrowDown size={10} stroke={2} />) : <IconChevronDown size={10} stroke={2} style={{ opacity: 0.3 }} />}
                    </span>
                  </button>
                ) : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => {
            const k = getRowKey(row);
            const isSel = selected?.includes(k);
            const attn = rowAttention?.(row);
            return (
              <tr key={k} className={`${isSel ? "selected" : ""} ${attn ? `attn-${attn}` : ""}`}>
                {onSelect && (
                  <td className="fg-td-check">
                    <Checkbox checked={isSel} onChange={(v) => onSelect(k, v)} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={c.align === "right" ? "right" : ""}>
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Filter Popover
// ────────────────────────────────────────────────────────────────────────────
const FilterPopover = ({ label, options, value, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const count = value.length;
  const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="fg-filter-pop" ref={ref}>
      <button className={`fg-filter-btn ${count > 0 ? "has-value" : ""}`} onClick={() => setOpen((v) => !v)}>
        <span>{label}</span>
        {count > 0 && <span className="fg-filter-count">{count}</span>}
        <IconChevronDown size={12} />
      </button>
      {open && (
        <div className="fg-filter-menu">
          {options.map((o) => (
            <button key={o} className="fg-filter-opt" onClick={() => toggle(o)}>
              <Checkbox checked={value.includes(o)} />
              <span>{o}</span>
            </button>
          ))}
          {count > 0 && (
            <div className="fg-filter-foot">
              <button className="fg-link" onClick={() => onChange([])}>Limpar</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Toolbar
// ────────────────────────────────────────────────────────────────────────────
const Toolbar = ({ search, onSearch, filters, density, onDensity, action }) => (
  <div className="fg-toolbar">
    <div className="fg-toolbar-left">
      <div className="fg-search">
        <IconSearch size={14} />
        <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Buscar..." />
      </div>
      {filters}
    </div>
    <div className="fg-toolbar-right">
      <div className="fg-density-toggle">
        <button className={density === "compact" ? "active" : ""} onClick={() => onDensity("compact")} title="Densidade compacta">
          <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="2" width="10" height="1.5" fill="currentColor"/><rect x="1" y="5.25" width="10" height="1.5" fill="currentColor"/><rect x="1" y="8.5" width="10" height="1.5" fill="currentColor"/></svg>
        </button>
        <button className={density === "regular" ? "active" : ""} onClick={() => onDensity("regular")} title="Densidade confortável">
          <svg width="12" height="12" viewBox="0 0 12 12"><rect x="1" y="1.5" width="10" height="1.5" fill="currentColor"/><rect x="1" y="5.25" width="10" height="1.5" fill="currentColor"/><rect x="1" y="9" width="10" height="1.5" fill="currentColor"/></svg>
        </button>
      </div>
      <Button variant="outline" size="sm" icon={<IconDownload size={14} />} iconRight={<IconChevronDown size={12} />}>Exportar</Button>
      {action}
    </div>
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// Pagination
// ────────────────────────────────────────────────────────────────────────────
const Pagination = ({ page, pageSize, total, onPage, onPageSize, selectedCount, selectedSum }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  return (
    <div className="fg-pagination">
      <div className="fg-pagination-left">
        {selectedCount > 0 ? (
          <span><strong className="fg-tabular">{selectedCount}</strong> selecionados · Soma <strong className="fg-tabular">{formatBRL(selectedSum)}</strong></span>
        ) : (
          <span>Mostrando <strong className="fg-tabular">{start}–{end}</strong> de <strong className="fg-tabular">{total}</strong></span>
        )}
      </div>
      <div className="fg-pagination-right">
        <Select value={String(pageSize)} onChange={(v) => onPageSize(Number(v))} options={[{ value: "25", label: "25 por página" }, { value: "50", label: "50 por página" }, { value: "100", label: "100 por página" }]} placeholder={null} />
        <div className="fg-page-ctrls">
          <button onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}><IconChevronLeft size={14} /></button>
          <span className="fg-tabular">{page} <span style={{ opacity: 0.4 }}>de</span> {pages}</span>
          <button onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages}><IconChevronRight size={14} /></button>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Financeiro Tabs (sub-nav)
// ────────────────────────────────────────────────────────────────────────────
const FinanceiroTabs = () => {
  const { path, go } = useRouter();
  const items = [
    { value: "/financeiro/entradas", label: "Entradas" },
    { value: "/financeiro/saidas", label: "Saídas" },
    { value: "/financeiro/provisoes", label: "Provisões" },
  ];
  return <Tabs value={path} onChange={(v) => go(v)} items={items} />;
};

// ────────────────────────────────────────────────────────────────────────────
// Month chips
// ────────────────────────────────────────────────────────────────────────────
const MonthChips = ({ value, onChange }) => {
  const opts = ["mar/26", "abr/26", "mai/26", "todos"];
  const labels = { "mar/26": "Mar", "abr/26": "Abr", "mai/26": "Maio", "todos": "Todos" };
  return (
    <div className="fg-chips">
      {opts.map((o) => (
        <button key={o} className={`fg-chip ${value === o ? "active" : ""}`} onClick={() => onChange(o)}>
          {labels[o]}
        </button>
      ))}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// ENTRADAS
// ════════════════════════════════════════════════════════════════════════════
const Entradas = ({ onNew, onEdit }) => {
  const [search, setSearch] = React.useState("");
  const [month, setMonth] = React.useState("mai/26");
  const [statusF, setStatusF] = React.useState([]);
  const [catF, setCatF] = React.useState([]);
  const [respF, setRespF] = React.useState([]);
  const [sortKey, setSortKey] = React.useState("vencimento");
  const [sortDir, setSortDir] = React.useState("asc");
  const [selected, setSelected] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [density, setDensity] = React.useState("regular");

  const all = window.FG_ENTRADAS;
  const responsaveis = [...new Set(all.map((e) => e.responsavel))];

  const filtered = React.useMemo(() => {
    let xs = all;
    if (month !== "todos") xs = xs.filter((e) => e.competencia === month);
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter((e) => e.cliente.toLowerCase().includes(q) || e.descricao.toLowerCase().includes(q));
    }
    if (statusF.length) xs = xs.filter((e) => statusF.includes(STATUS_MAP[e.status]?.label || e.status));
    if (catF.length) xs = xs.filter((e) => catF.includes(e.categoria));
    if (respF.length) xs = xs.filter((e) => respF.includes(e.responsavel));
    xs = [...xs].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return xs;
  }, [all, search, month, statusF, catF, respF, sortKey, sortDir]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selectedRows = filtered.filter((e) => selected.includes(e.id));
  const selectedSum = selectedRows.reduce((a, e) => a + e.valorPrevisto, 0);

  const onSort = (k) => { if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("asc"); } };

  const totalPrev = filtered.reduce((a, e) => a + e.valorPrevisto, 0);
  const totalReceb = filtered.reduce((a, e) => a + (e.valorRecebido || 0), 0);

  const columns = [
    { key: "cliente", label: "Cliente", sortable: true, render: (r) => (
      <div className="fg-cell-strong">{r.cliente}<div className="fg-cell-sub">{r.descricao}</div></div>
    ) },
    { key: "categoria", label: "Categoria", render: (r) => <Tag>{r.categoria}</Tag> },
    { key: "competencia", label: "Comp.", render: (r) => <span className="fg-tabular fg-muted">{r.competencia}</span> },
    { key: "vencimento", label: "Vencimento", sortable: true, render: (r) => (
      <div className="fg-cell-strong fg-tabular">{formatDate(r.vencimento, "dayMonth")}<div className="fg-cell-sub">{formatRelative(r.vencimento)}</div></div>
    ) },
    { key: "valorPrevisto", label: "Previsto", sortable: true, align: "right", render: (r) => <span className="fg-tabular">{formatBRL(r.valorPrevisto)}</span> },
    { key: "valorRecebido", label: "Recebido", align: "right", render: (r) => (
      <span className={`fg-tabular ${r.status === "recebido" ? "fg-good" : "fg-muted"}`}>
        {r.valorRecebido ? formatBRL(r.valorRecebido) : "—"}
      </span>
    ) },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "responsavel", label: "Responsável", render: (r) => (
      <div className="fg-cell-user"><Avatar name={r.responsavel} size={22} /><span>{r.responsavel.split(" ")[0]}</span></div>
    ) },
    { key: "_acoes", label: "", width: 40, render: (r) => (
      <Dropdown
        trigger={<button className="fg-icon-btn sm"><IconMore size={16} /></button>}
        items={[
          { label: "Ver detalhe", icon: <IconEye size={13} />, onClick: () => onEdit?.(r) },
          { label: "Editar", icon: <IconEdit size={13} />, onClick: () => onEdit?.(r) },
          { label: "Marcar como recebido", icon: <IconCheckCircle size={13} /> },
          { separator: true },
          { label: "Cancelar lançamento", icon: <IconX size={13} />, danger: true },
        ]}
      />
    ) },
  ];

  return (
    <div className="fg-page">
      <PageHeader
        eyebrow="Financeiro"
        title="Entradas"
        description={`${filtered.length} lançamentos · Previsto ${formatBRL(totalPrev)} · Recebido ${formatBRL(totalReceb)}`}
        actions={
          <>
            <Button variant="outline" size="sm" icon={<IconFilter size={14} />}>Mais filtros</Button>
            <Button variant="primary" size="sm" icon={<IconPlus size={14} />} onClick={onNew}>Nova entrada</Button>
          </>
        }
        tabs={<FinanceiroTabs />}
      />

      <div className="fg-financeiro-row">
        <MonthChips value={month} onChange={setMonth} />
      </div>

      <Toolbar
        search={search}
        onSearch={setSearch}
        filters={
          <>
            <FilterPopover label="Status" value={statusF} onChange={setStatusF} options={["Previsto", "Recebido", "Atrasado", "Parcial", "Cancelado"]} />
            <FilterPopover label="Categoria" value={catF} onChange={setCatF} options={window.FG_CATEGORIAS_ENTRADA} />
            <FilterPopover label="Responsável" value={respF} onChange={setRespF} options={responsaveis} />
          </>
        }
        density={density}
        onDensity={setDensity}
      />

      <DataTable
        columns={columns}
        data={paged}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        selected={selected}
        onSelect={(k, v) => setSelected((xs) => v ? [...xs, k] : xs.filter((x) => x !== k))}
        onSelectAll={(v) => setSelected(v ? paged.map((r) => r.id) : [])}
        getRowKey={(r) => r.id}
        rowAttention={(r) => r.status === "atrasado" ? "danger" : null}
        density={density}
      />

      <Pagination
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPage={setPage}
        onPageSize={(v) => { setPageSize(v); setPage(1); }}
        selectedCount={selected.length}
        selectedSum={selectedSum}
      />
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// SAÍDAS
// ════════════════════════════════════════════════════════════════════════════
const Saidas = ({ onNew, onEdit }) => {
  const [search, setSearch] = React.useState("");
  const [month, setMonth] = React.useState("mai/26");
  const [statusF, setStatusF] = React.useState([]);
  const [catF, setCatF] = React.useState([]);
  const [ccF, setCcF] = React.useState([]);
  const [sortKey, setSortKey] = React.useState("vencimento");
  const [sortDir, setSortDir] = React.useState("asc");
  const [selected, setSelected] = React.useState([]);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [density, setDensity] = React.useState("regular");

  const all = window.FG_SAIDAS;
  const filtered = React.useMemo(() => {
    let xs = all;
    if (month !== "todos") xs = xs.filter((s) => s.competencia === month);
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter((s) => s.fornecedor.toLowerCase().includes(q) || s.descricao.toLowerCase().includes(q));
    }
    if (statusF.length) xs = xs.filter((s) => statusF.includes(STATUS_MAP[s.status]?.label || s.status));
    if (catF.length) xs = xs.filter((s) => catF.includes(s.categoria));
    if (ccF.length) xs = xs.filter((s) => ccF.includes(s.centroCusto));
    xs = [...xs].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return xs;
  }, [all, search, month, statusF, catF, ccF, sortKey, sortDir]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const selectedSum = filtered.filter((s) => selected.includes(s.id)).reduce((a, s) => a + s.valor, 0);
  const onSort = (k) => { if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("asc"); } };

  const totalValor = filtered.reduce((a, s) => a + s.valor, 0);
  const totalPago = filtered.filter((s) => s.status === "pago").reduce((a, s) => a + s.valor, 0);

  const columns = [
    { key: "fornecedor", label: "Fornecedor", sortable: true, render: (r) => (
      <div className="fg-cell-strong">{r.fornecedor}<div className="fg-cell-sub">{r.descricao}</div></div>
    ) },
    { key: "categoria", label: "Categoria", render: (r) => <Tag>{r.categoria}</Tag> },
    { key: "competencia", label: "Comp.", render: (r) => <span className="fg-tabular fg-muted">{r.competencia}</span> },
    { key: "vencimento", label: "Vencimento", sortable: true, render: (r) => (
      <div className="fg-cell-strong fg-tabular">{formatDate(r.vencimento, "dayMonth")}<div className="fg-cell-sub">{formatRelative(r.vencimento)}</div></div>
    ) },
    { key: "valor", label: "Valor", sortable: true, align: "right", render: (r) => <span className="fg-tabular fg-cell-strong">{formatBRL(r.valor)}</span> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "centroCusto", label: "C. Custo", render: (r) => <Tag>{r.centroCusto}</Tag> },
    { key: "responsavel", label: "Responsável", render: (r) => (
      <div className="fg-cell-user"><Avatar name={r.responsavel} size={22} /><span>{r.responsavel.split(" ")[0]}</span></div>
    ) },
    { key: "_acoes", label: "", width: 40, render: (r) => (
      <Dropdown
        trigger={<button className="fg-icon-btn sm"><IconMore size={16} /></button>}
        items={[
          { label: "Ver detalhe", icon: <IconEye size={13} />, onClick: () => onEdit?.(r) },
          { label: "Editar", icon: <IconEdit size={13} />, onClick: () => onEdit?.(r) },
          { label: "Marcar como pago", icon: <IconCheckCircle size={13} /> },
          { separator: true },
          { label: "Cancelar lançamento", icon: <IconX size={13} />, danger: true },
        ]}
      />
    ) },
  ];

  return (
    <div className="fg-page">
      <PageHeader
        eyebrow="Financeiro"
        title="Saídas"
        description={`${filtered.length} lançamentos · Total ${formatBRL(totalValor)} · Pago ${formatBRL(totalPago)}`}
        actions={
          <>
            <Button variant="outline" size="sm" icon={<IconFilter size={14} />}>Mais filtros</Button>
            <Button variant="primary" size="sm" icon={<IconPlus size={14} />} onClick={onNew}>Nova saída</Button>
          </>
        }
        tabs={<FinanceiroTabs />}
      />

      <div className="fg-financeiro-row">
        <MonthChips value={month} onChange={setMonth} />
      </div>

      <Toolbar
        search={search}
        onSearch={setSearch}
        filters={
          <>
            <FilterPopover label="Status" value={statusF} onChange={setStatusF} options={["Previsto", "Pago", "Atrasado", "Aguardando NF", "Cancelado"]} />
            <FilterPopover label="Categoria" value={catF} onChange={setCatF} options={window.FG_CATEGORIAS_SAIDA} />
            <FilterPopover label="Centro de custo" value={ccF} onChange={setCcF} options={window.FG_CENTROS_CUSTO} />
          </>
        }
        density={density}
        onDensity={setDensity}
      />

      <DataTable
        columns={columns}
        data={paged}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={onSort}
        selected={selected}
        onSelect={(k, v) => setSelected((xs) => v ? [...xs, k] : xs.filter((x) => x !== k))}
        onSelectAll={(v) => setSelected(v ? paged.map((r) => r.id) : [])}
        getRowKey={(r) => r.id}
        rowAttention={(r) => r.status === "atrasado" ? "danger" : null}
        density={density}
      />

      <Pagination
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPage={setPage}
        onPageSize={(v) => { setPageSize(v); setPage(1); }}
        selectedCount={selected.length}
        selectedSum={selectedSum}
      />
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// PROVISÕES
// ════════════════════════════════════════════════════════════════════════════
const Provisoes = ({ onNew, onEdit }) => {
  const [search, setSearch] = React.useState("");
  const [catF, setCatF] = React.useState([]);
  const [ccF, setCcF] = React.useState([]);
  const [density, setDensity] = React.useState("regular");
  const [sortKey, setSortKey] = React.useState("valor");
  const [sortDir, setSortDir] = React.useState("desc");

  const all = window.FG_PROVISOES;
  const filtered = React.useMemo(() => {
    let xs = all;
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter((p) => p.descricao.toLowerCase().includes(q));
    }
    if (catF.length) xs = xs.filter((p) => catF.includes(p.categoria));
    if (ccF.length) xs = xs.filter((p) => ccF.includes(p.centroCusto));
    xs = [...xs].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return xs;
  }, [all, search, catF, ccF, sortKey, sortDir]);

  const onSort = (k) => { if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("asc"); } };

  const total = filtered.reduce((a, p) => a + p.valor, 0);
  const totalAno = total * 12;

  const columns = [
    { key: "descricao", label: "Descrição", sortable: true, render: (r) => (
      <div className="fg-cell-strong">{r.descricao}<div className="fg-cell-sub">{r.recorrencia}</div></div>
    ) },
    { key: "categoria", label: "Categoria", render: (r) => <Tag>{r.categoria}</Tag> },
    { key: "valor", label: "Valor / mês", sortable: true, align: "right", render: (r) => <span className="fg-tabular fg-cell-strong">{formatBRL(r.valor)}</span> },
    { key: "anual", label: "Anualizado", align: "right", render: (r) => <span className="fg-tabular fg-muted">{formatBRL(r.valor * 12)}</span> },
    { key: "proxima", label: "Próximo lançamento", render: (r) => <span className="fg-tabular">{formatDate(r.proxima, "dayMonth")} <span className="fg-muted">· {formatRelative(r.proxima)}</span></span> },
    { key: "centroCusto", label: "C. Custo", render: (r) => <Tag>{r.centroCusto}</Tag> },
    { key: "ativo", label: "Status", render: (r) => <StatusBadge status={r.ativo ? "ativo" : "pausado"} /> },
    { key: "_acoes", label: "", width: 40, render: (r) => (
      <Dropdown
        trigger={<button className="fg-icon-btn sm"><IconMore size={16} /></button>}
        items={[
          { label: "Editar", icon: <IconEdit size={13} />, onClick: () => onEdit?.(r) },
          { label: r.ativo ? "Pausar" : "Reativar", icon: r.ativo ? <IconClock size={13} /> : <IconCheckCircle size={13} /> },
          { separator: true },
          { label: "Excluir", icon: <IconTrash size={13} />, danger: true },
        ]}
      />
    ) },
  ];

  return (
    <div className="fg-page">
      <PageHeader
        eyebrow="Financeiro"
        title="Provisões"
        description={`${filtered.length} provisões ativas · Mensal ${formatBRL(total)} · Anualizado ${formatBRL(totalAno)}`}
        actions={
          <>
            <Button variant="outline" size="sm" icon={<IconFilter size={14} />}>Mais filtros</Button>
            <Button variant="primary" size="sm" icon={<IconPlus size={14} />} onClick={onNew}>Nova provisão</Button>
          </>
        }
        tabs={<FinanceiroTabs />}
      />

      <Toolbar
        search={search}
        onSearch={setSearch}
        filters={
          <>
            <FilterPopover label="Categoria" value={catF} onChange={setCatF} options={window.FG_CATEGORIAS_SAIDA} />
            <FilterPopover label="Centro de custo" value={ccF} onChange={setCcF} options={window.FG_CENTROS_CUSTO} />
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
        density={density}
      />
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// Sheet de criação/edição de Entrada
// ════════════════════════════════════════════════════════════════════════════
const EntryFormSheet = ({ open, onClose, entry, mode = "entrada" }) => {
  const toast = useToast();
  const isEdit = !!entry;
  const [form, setForm] = React.useState({});
  React.useEffect(() => {
    if (open) {
      if (entry) setForm({
        cliente: entry.cliente || entry.fornecedor || "",
        descricao: entry.descricao || "",
        categoria: entry.categoria || "",
        competencia: entry.competencia || "mai/26",
        vencimento: entry.vencimento ? entry.vencimento.toISOString().slice(0, 10) : "",
        valor: entry.valorPrevisto || entry.valor || "",
        responsavel: entry.responsavel || "",
        metodo: entry.metodo || "TED",
        centroCusto: entry.centroCusto || "Operação",
        obs: "",
      });
      else setForm({ cliente: "", descricao: "", categoria: "", competencia: "mai/26", vencimento: "", valor: "", responsavel: "", metodo: "TED", centroCusto: "Operação", obs: "" });
    }
  }, [open, entry]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const isEntrada = mode === "entrada";
  const partyLabel = isEntrada ? "Cliente" : mode === "saida" ? "Fornecedor" : "Descrição da provisão";
  const partyOpts = isEntrada ? window.FG_CLIENTES.map((c) => c.nome) : window.FG_FORNECEDORES.map((f) => f.nome);
  const catOpts = isEntrada ? window.FG_CATEGORIAS_ENTRADA : window.FG_CATEGORIAS_SAIDA;
  const title = isEdit ? `Editar ${mode}` : `Nova ${mode}`;
  const desc = isEdit ? `Atualize os dados do lançamento.` : `Cadastre um novo lançamento ${isEntrada ? "de receita" : "de despesa"}.`;

  const submit = () => {
    toast({ tone: "success", title: isEdit ? "Lançamento atualizado" : "Lançamento criado", description: `${form.cliente || form.descricao} · ${formatBRL(Number(form.valor) || 0)}` });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={desc}
      width={580}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit}>{isEdit ? "Salvar alterações" : "Criar lançamento"}</Button>
        </>
      }
    >
      <div className="fg-form">
        <Field label={partyLabel} required>
          {isEntrada || mode === "saida" ? (
            <Select value={form.cliente} onChange={(v) => set("cliente", v)} options={partyOpts} placeholder={`Selecionar ${partyLabel.toLowerCase()}...`} />
          ) : (
            <Input value={form.cliente} onChange={(e) => set("cliente", e.target.value)} placeholder="Ex: Folha CLT — média mensal" />
          )}
        </Field>

        <Field label="Descrição" required helper="Um resumo curto que aparece nas listagens e relatórios.">
          <Input value={form.descricao} onChange={(e) => set("descricao", e.target.value)} placeholder="Ex: Fee maio/26" />
        </Field>

        <div className="fg-form-row">
          <Field label="Categoria" required>
            <Select value={form.categoria} onChange={(v) => set("categoria", v)} options={catOpts} placeholder="Selecionar..." />
          </Field>
          <Field label="Competência" required helper="Mês/ano de referência.">
            <Select value={form.competencia} onChange={(v) => set("competencia", v)} options={["mar/26", "abr/26", "mai/26", "jun/26", "jul/26"]} placeholder={null} />
          </Field>
        </div>

        <div className="fg-form-row">
          <Field label="Vencimento" required>
            <Input type="date" value={form.vencimento} onChange={(e) => set("vencimento", e.target.value)} mono />
          </Field>
          <Field label={isEntrada ? "Valor previsto" : "Valor"} required>
            <Input prefix="R$" value={form.valor} onChange={(e) => set("valor", e.target.value)} placeholder="0,00" mono inputMode="decimal" />
          </Field>
        </div>

        <div className="fg-form-row">
          <Field label="Método de pagamento">
            <Select value={form.metodo} onChange={(v) => set("metodo", v)} options={["TED", "PIX", "Boleto", "Cartão", "Débito", "Dinheiro"]} placeholder={null} />
          </Field>
          {mode !== "entrada" && (
            <Field label="Centro de custo">
              <Select value={form.centroCusto} onChange={(v) => set("centroCusto", v)} options={window.FG_CENTROS_CUSTO} placeholder={null} />
            </Field>
          )}
          {mode === "entrada" && (
            <Field label="Responsável interno">
              <Select value={form.responsavel} onChange={(v) => set("responsavel", v)} options={["Helena Vasconcelos", "Marina Toledo", "Rafael Aguiar", "Júlia Bernardes", "Lívia Câmara"]} placeholder="Selecionar..." />
            </Field>
          )}
        </div>

        <Field label="Anexo" helper="PDF, JPG ou PNG, máx 10 MB.">
          <div className="fg-dropzone">
            <IconUpload size={20} />
            <div className="fg-dropzone-text">
              <strong>Arraste o arquivo</strong> ou <a href="#" className="fg-link">clique para enviar</a>
            </div>
            <div className="fg-dropzone-hint">Comprovante / contrato / nota fiscal</div>
          </div>
        </Field>

        <Field label="Observações">
          <Textarea value={form.obs} onChange={(e) => set("obs", e.target.value)} placeholder="Notas internas, instruções, contexto..." rows={3} />
        </Field>

        {!isEdit && (
          <div className="fg-form-aux">
            <Checkbox label="Lançamento retroativo (vencimento anterior a hoje)" />
            <Checkbox label="Criar como provisão recorrente mensal" checked={mode === "provisao"} onChange={() => {}} />
          </div>
        )}
      </div>
    </Sheet>
  );
};

Object.assign(window, { DataTable, Toolbar, Pagination, FilterPopover, Entradas, Saidas, Provisoes, EntryFormSheet, FinanceiroTabs });

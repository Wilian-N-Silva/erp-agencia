// Clientes — listagem + página de detalhe com 6 tabs + sheet de novo pagamento.

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
const tempoDeCasa = (entrada, saida) => {
  const fim = saida || window.FG_TODAY;
  const meses = (fim.getFullYear() - entrada.getFullYear()) * 12 + (fim.getMonth() - entrada.getMonth());
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  if (anos === 0) return `${resto}m`;
  if (resto === 0) return `${anos}a`;
  return `${anos}a ${resto}m`;
};

const entriesDoCliente = (clienteId) =>
  (window.FG_ENTRADAS || []).filter((e) => e.clienteId === clienteId);

const statusDoMesPara = (clienteId, comp = "mai/26") => {
  const xs = entriesDoCliente(clienteId).filter((e) => e.competencia === comp);
  if (xs.length === 0) return null;
  const allRec = xs.every((e) => e.status === "recebido");
  const someRec = xs.some((e) => e.status === "recebido");
  const overdue = xs.some((e) => e.status === "atrasado");
  if (overdue) return "atrasado";
  if (allRec) return "recebido";
  if (someRec) return "parcial";
  return "previsto";
};

const proximoVencimento = (clienteId) => {
  const xs = entriesDoCliente(clienteId).filter((e) => e.status !== "recebido");
  if (xs.length === 0) return null;
  return xs.sort((a, b) => a.vencimento - b.vencimento)[0].vencimento;
};

const ultimoPagamento = (clienteId) => {
  const xs = entriesDoCliente(clienteId).filter((e) => e.status === "recebido");
  if (xs.length === 0) return null;
  return xs.sort((a, b) => (b.recebidoEm || 0) - (a.recebidoEm || 0))[0];
};

const totalEmAtraso = (clienteId) => {
  return entriesDoCliente(clienteId)
    .filter((e) => e.status === "atrasado")
    .reduce((a, e) => a + (e.valorPrevisto - (e.valorRecebido || 0)), 0);
};

// ════════════════════════════════════════════════════════════════════════════
// CLIENTES — Listagem
// ════════════════════════════════════════════════════════════════════════════
const Clientes = () => {
  const { go } = useRouter();
  const [search, setSearch] = React.useState("");
  const [statusF, setStatusF] = React.useState([]);
  const [respF, setRespF] = React.useState([]);
  const [mesF, setMesF] = React.useState([]);
  const [density, setDensity] = React.useState("regular");
  const [sortKey, setSortKey] = React.useState("nome");
  const [sortDir, setSortDir] = React.useState("asc");

  const all = window.FG_CLIENTES;
  const responsaveis = [...new Set(all.map((c) => c.responsavel))];

  const enriched = React.useMemo(() => all.map((c) => ({
    ...c,
    statusMesCalc: statusDoMesPara(c.id) || "—",
    proxVenc: proximoVencimento(c.id),
    atraso: totalEmAtraso(c.id),
    multiOpen: entriesDoCliente(c.id).filter((e) => e.status !== "recebido" && e.competencia === "mai/26").length,
  })), [all]);

  const filtered = React.useMemo(() => {
    let xs = enriched;
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter((c) => c.nome.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q));
    }
    if (statusF.length) {
      const map = { "Ativo": "ativo", "Pausado": "pausado" };
      xs = xs.filter((c) => statusF.map((s) => map[s]).includes(c.status));
    }
    if (respF.length) xs = xs.filter((c) => respF.includes(c.responsavel));
    if (mesF.length) {
      const map = { "Recebido": "recebido", "Previsto": "previsto", "Atrasado": "atrasado", "Parcial": "parcial" };
      xs = xs.filter((c) => mesF.map((s) => map[s]).includes(c.statusMesCalc));
    }
    xs = [...xs].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = (av || "") < (bv || "") ? -1 : (av || "") > (bv || "") ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return xs;
  }, [enriched, search, statusF, respF, mesF, sortKey, sortDir]);

  const onSort = (k) => { if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("asc"); } };

  // KPIs
  const feeRecorrente = enriched.filter((c) => c.status === "ativo").reduce((a, c) => a + c.fee, 0);
  const receberMes = enriched.reduce((a, c) => a + (entriesDoCliente(c.id)
    .filter((e) => e.competencia === "mai/26" && e.status !== "recebido")
    .reduce((s, e) => s + (e.valorPrevisto - (e.valorRecebido || 0)), 0)), 0);
  const recebidoMes = enriched.reduce((a, c) => a + (entriesDoCliente(c.id)
    .filter((e) => e.competencia === "mai/26")
    .reduce((s, e) => s + (e.valorRecebido || 0), 0)), 0);
  const emAtraso = enriched.reduce((a, c) => a + c.atraso, 0);
  const numAtraso = enriched.filter((c) => c.atraso > 0).length;

  const columns = [
    { key: "nome", label: "Cliente", sortable: true, render: (r) => (
      <a href={`#/clientes/${r.id}`} className="fg-cell-user fg-cell-link" onClick={(e) => { e.preventDefault(); go(`/clientes/${r.id}`); }}>
        <Avatar name={r.nome} size={28} />
        <div>
          <div className="fg-cell-strong">
            {r.nome}
            {r.multiOpen > 1 && (
              <span title={`${r.multiOpen} cobranças abertas neste mês`} style={{ marginLeft: 6, verticalAlign: "-2px", color: "var(--status-warning-text)" }}>
                <IconAlertCircle size={13} />
              </span>
            )}
          </div>
          <div className="fg-cell-sub fg-tabular">{r.codigo}</div>
        </div>
      </a>
    ) },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "fee", label: "Fee mensal", sortable: true, align: "right", render: (r) => <span className="fg-tabular fg-cell-strong">{formatBRL(r.fee)}</span> },
    { key: "dia", label: "Dia cob.", align: "right", render: (r) => <span className="fg-tabular fg-muted">dia {r.dia}</span> },
    { key: "proxVenc", label: "Próx. vencimento", render: (r) => r.proxVenc ? (
      <div className="fg-cell-strong fg-tabular">{formatDate(r.proxVenc, "dayMonth")}<div className="fg-cell-sub">{formatRelative(r.proxVenc)}</div></div>
    ) : <span className="fg-muted">—</span> },
    { key: "statusMesCalc", label: "Status do mês", render: (r) => r.statusMesCalc !== "—" ? <StatusBadge status={r.statusMesCalc} /> : <span className="fg-muted">—</span> },
    { key: "responsavel", label: "Responsável", render: (r) => (
      <div className="fg-cell-user"><Avatar name={r.responsavel} size={22} /><span>{r.responsavel.split(" ")[0]}</span></div>
    ) },
    { key: "_acoes", label: "", width: 40, render: (r) => (
      <Dropdown
        trigger={<button className="fg-icon-btn sm"><IconMore size={16} /></button>}
        items={[
          { label: "Abrir cliente", icon: <IconEye size={13} />, onClick: () => go(`/clientes/${r.id}`) },
          { label: "Editar cadastro", icon: <IconEdit size={13} /> },
          { label: "Gerar entrada prevista", icon: <IconPlus size={13} /> },
          { separator: true },
          { label: r.status === "ativo" ? "Pausar" : "Reativar", icon: <IconClock size={13} /> },
        ]}
      />
    ) },
  ];

  return (
    <div className="fg-page">
      <PageHeader
        eyebrow="Financeiro"
        title="Clientes"
        description={`${filtered.length} clientes · ${enriched.filter((c) => c.status === "ativo").length} com fee recorrente ativo`}
        actions={
          <>
            <Button variant="outline" size="sm" icon={<IconDownload size={14} />}>Exportar</Button>
            <Button variant="primary" size="sm" icon={<IconPlus size={14} />}>Novo cliente</Button>
          </>
        }
      />

      <div className="fg-grid fg-grid-kpis">
        <KpiCard label="Fee recorrente" value={formatBRL(feeRecorrente)} secondary={`${enriched.filter((c) => c.status === "ativo").length} contratos ativos`} icon={<IconRepeat size={16} />} />
        <KpiCard label="A receber · mai" value={formatBRL(receberMes)} secondary="Pendente neste mês" icon={<IconClock size={16} />} />
        <KpiCard label="Recebido · mai" value={formatBRL(recebidoMes)} trend={12.4} trendLabel="vs abr" icon={<IconArrowDownRight size={16} />} accent={true} />
        <KpiCard label="Em atraso" value={formatBRL(emAtraso)} secondary={`${numAtraso} cliente${numAtraso !== 1 ? "s" : ""} atrasado${numAtraso !== 1 ? "s" : ""}`} icon={<IconAlertCircle size={16} />} />
      </div>

      <Toolbar
        search={search}
        onSearch={setSearch}
        filters={
          <>
            <FilterPopover label="Status" value={statusF} onChange={setStatusF} options={["Ativo", "Pausado"]} />
            <FilterPopover label="Status do mês" value={mesF} onChange={setMesF} options={["Recebido", "Previsto", "Atrasado", "Parcial"]} />
            <FilterPopover label="Responsável" value={respF} onChange={setRespF} options={responsaveis} />
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
        rowAttention={(r) => r.statusMesCalc === "atrasado" ? "danger" : null}
        density={density}
      />
    </div>
  );
};

// ════════════════════════════════════════════════════════════════════════════
// CLIENTE — Página de detalhe
// ════════════════════════════════════════════════════════════════════════════
const CLIENTE_TABS = [
  { value: "resumo", label: "Resumo" },
  { value: "pagamentos", label: "Pagamentos" },
  { value: "cobranca", label: "Cobrança" },
  { value: "contratos", label: "Contratos" },
  { value: "historico", label: "Histórico" },
  { value: "observacoes", label: "Observações" },
];

const ClienteDetail = ({ id }) => {
  const { go } = useRouter();
  const c = window.FG_CLIENTES.find((x) => x.id === id);
  const [tab, setTab] = React.useState("resumo");
  if (!c) {
    return <div className="fg-page"><PageHeader eyebrow="Financeiro" title="Cliente não encontrado" /><Button variant="outline" onClick={() => go("/clientes")}>Voltar</Button></div>;
  }
  const inicio = window.FG_CLIENTES_INICIO[id];

  return (
    <div className="fg-page">
      <button className="fg-back" onClick={() => go("/clientes")}>
        <IconChevronLeft size={14} /> Clientes
      </button>

      <div className="fg-detail-head">
        <Avatar name={c.nome} size={64} />
        <div className="fg-detail-head-meta">
          <div className="fg-detail-eyebrow">
            <span className="fg-tabular">{c.codigo}</span>
            {inicio && <><span>·</span><span>Cliente desde {formatDate(inicio, "monthYear")}</span></>}
            <span>·</span><span>Responsável: {c.responsavel}</span>
          </div>
          <h1 className="fg-detail-title">{c.nome}</h1>
          <div className="fg-detail-badges">
            <StatusBadge status={c.status} />
            <Tag>Fee mensal {formatBRL(c.fee)}</Tag>
            <Tag>Cobrança dia {c.dia}</Tag>
          </div>
        </div>
        <div className="fg-detail-head-actions">
          <Button variant="outline" size="sm" icon={<IconEdit size={14} />}>Editar</Button>
          <Button variant="primary" size="sm" icon={<IconPlus size={14} />}>Gerar entrada</Button>
          <Dropdown
            align="right"
            trigger={<button className="fg-icon-btn"><IconMore size={16} /></button>}
            items={[
              { label: "Adicionar documento", icon: <IconUpload size={13} /> },
              { label: "Anotar observação", icon: <IconEdit size={13} /> },
              { separator: true },
              { label: c.status === "ativo" ? "Pausar cliente" : "Reativar cliente", icon: <IconClock size={13} /> },
            ]}
          />
        </div>
      </div>

      <div className="fg-detail-tabs"><Tabs value={tab} onChange={setTab} items={CLIENTE_TABS} /></div>

      <div className="fg-detail-body">
        {tab === "resumo" && <ClienteResumo c={c} inicio={inicio} />}
        {tab === "pagamentos" && <ClientePagamentos c={c} />}
        {tab === "cobranca" && <ClienteCobranca c={c} />}
        {tab === "contratos" && <ClienteContratos c={c} />}
        {tab === "historico" && <ClienteHistorico c={c} inicio={inicio} />}
        {tab === "observacoes" && <ClienteObservacoes c={c} />}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Tab Resumo
// ────────────────────────────────────────────────────────────────────────────
const ClienteResumo = ({ c, inicio }) => {
  const sm = statusDoMesPara(c.id);
  const px = proximoVencimento(c.id);
  const up = ultimoPagamento(c.id);
  const atraso = totalEmAtraso(c.id);
  const billing = window.FG_BILLING[c.id] || {};
  return (
    <>
      <div className="fg-grid fg-grid-4">
        <KpiCard label="Status" value={c.status === "ativo" ? "Ativo" : "Pausado"} secondary={inicio ? `Cliente há ${tempoDeCasa(inicio)}` : ""} mono={false} accent={c.status === "ativo"} icon={<IconBuilding size={16} />} />
        <KpiCard label="Status do mês" value={sm ? STATUS_MAP[sm]?.label : "—"} secondary={sm === "atrasado" ? "Requer cobrança" : sm === "recebido" ? "Tudo em dia" : sm === "parcial" ? "Parte pendente" : "Aguardando"} mono={false} icon={sm === "atrasado" ? <IconAlertCircle size={16} /> : <IconCheckCircle size={16} />} />
        <KpiCard label="Fee mensal" value={formatBRL(c.fee)} secondary={`Vencimento dia ${c.dia}`} icon={<IconRepeat size={16} />} />
        <KpiCard label="Próx. vencimento" value={px ? formatDate(px, "dayMonth") : "—"} secondary={px ? formatRelative(px) : "Sem cobrança aberta"} icon={<IconClock size={16} />} />
      </div>

      <div className="fg-grid fg-grid-2">
        <Card title="Cobrança">
          <dl className="fg-deflist">
            <div><dt>Método padrão</dt><dd>{billing.metodo || "—"}</dd></div>
            <div><dt>Prazo</dt><dd className="fg-tabular">{billing.prazo ? `${billing.prazo} dias` : "—"}</dd></div>
            <div><dt>Recorrência</dt><dd>{billing.recorrencia || "Mensal"}</dd></div>
            <div><dt>Contato financeiro</dt><dd>{billing.contato?.nome || "—"}</dd></div>
            <div className="full"><dt>E-mail</dt><dd>{billing.contato?.email || "—"}</dd></div>
          </dl>
        </Card>
        <Card title="Histórico financeiro">
          <dl className="fg-deflist">
            <div><dt>Último pagamento</dt><dd className="fg-tabular fg-cell-strong">{up ? formatBRL(up.valorRecebido) : "—"}</dd></div>
            <div><dt>Recebido em</dt><dd className="fg-tabular">{up ? formatDate(up.recebidoEm) : "—"}</dd></div>
            <div><dt>Responsável interno</dt><dd>{c.responsavel}</dd></div>
            <div><dt>Total em atraso</dt><dd className={atraso > 0 ? "fg-tabular fg-bad" : "fg-tabular fg-muted"}>{atraso > 0 ? formatBRL(atraso) : "—"}</dd></div>
          </dl>
        </Card>
      </div>

      {atraso > 0 && (
        <div className="fg-inline-alert danger">
          <IconAlertCircle size={16} />
          <div>
            <div className="fg-inline-alert-title">Cliente com {formatBRL(atraso)} em atraso</div>
            <div className="fg-inline-alert-desc">Veja a aba <strong>Pagamentos</strong> para registrar o recebimento ou enviar nova cobrança.</div>
          </div>
        </div>
      )}
    </>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Tab Pagamentos
// ────────────────────────────────────────────────────────────────────────────
const ClientePagamentos = ({ c }) => {
  const [recOpen, setRecOpen] = React.useState(null);
  const entries = entriesDoCliente(c.id).sort((a, b) => b.vencimento - a.vencimento);
  return (
    <Card padding={false} title="Lançamentos vinculados" description={`${entries.length} entradas — receitas previstas e recebidas deste cliente.`}
      action={<Button variant="primary" size="sm" icon={<IconPlus size={14} />}>Nova entrada</Button>}>
      <table className="fg-aumento-table">
        <thead><tr>
          <th>Competência</th><th>Vencimento</th><th>Previsto</th><th>Recebido</th><th>Método</th><th>Status</th><th>Recebimento</th><th></th>
        </tr></thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td className="fg-tabular fg-muted">{e.competencia}</td>
              <td className="fg-tabular">{formatDate(e.vencimento)}</td>
              <td className="fg-tabular">{formatBRL(e.valorPrevisto)}</td>
              <td className={`fg-tabular ${e.status === "recebido" ? "fg-good fg-cell-strong" : "fg-muted"}`}>{e.valorRecebido ? formatBRL(e.valorRecebido) : "—"}</td>
              <td><Tag>{e.metodo}</Tag></td>
              <td><StatusBadge status={e.status} /></td>
              <td className="fg-tabular fg-muted">{e.recebidoEm ? formatDate(e.recebidoEm) : "—"}</td>
              <td>
                {e.status !== "recebido" ? (
                  <Button variant="outline" size="sm" icon={<IconCheckCircle size={13} />} onClick={() => setRecOpen(e)}>Marcar recebido</Button>
                ) : (
                  <Dropdown trigger={<button className="fg-icon-btn sm"><IconMore size={16} /></button>} items={[{ label: "Ver detalhe", icon: <IconEye size={13} /> }, { label: "Editar", icon: <IconEdit size={13} /> }]} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <MarcarRecebidoDialog open={!!recOpen} entry={recOpen} onClose={() => setRecOpen(null)} />
    </Card>
  );
};

const MarcarRecebidoDialog = ({ open, entry, onClose }) => {
  const toast = useToast();
  const [valor, setValor] = React.useState("");
  const [data, setData] = React.useState("");
  React.useEffect(() => {
    if (open && entry) {
      setValor(String(entry.valorPrevisto - (entry.valorRecebido || 0)));
      setData(window.FG_TODAY.toISOString().slice(0, 10));
    }
  }, [open, entry]);
  if (!entry) return <Dialog open={false} onClose={onClose} />;
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Marcar como recebido"
      description={`${entry.descricao} · ${entry.competencia}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={<IconCheck size={14} />} onClick={() => { toast({ tone: "success", title: "Pagamento registrado", description: `${entry.cliente} · ${formatBRL(Number(valor) || 0)}` }); onClose(); }}>Confirmar</Button>
        </>
      }
    >
      <div className="fg-form">
        <Field label="Valor recebido" required>
          <Input prefix="R$" value={valor} onChange={(e) => setValor(e.target.value)} mono inputMode="decimal" />
        </Field>
        <Field label="Data de recebimento" required>
          <Input type="date" value={data} onChange={(e) => setData(e.target.value)} mono />
        </Field>
      </div>
    </Dialog>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Tab Cobrança
// ────────────────────────────────────────────────────────────────────────────
const ClienteCobranca = ({ c }) => {
  const initial = window.FG_BILLING[c.id] || { metodo: "PIX", prazo: 5, recorrencia: "Mensal", contato: {}, lembreteAntes: { ativo: false, dias: 0 }, lembreteApos: { ativo: false, dias: 0 }, obs: "", autoGerar: true };
  const [form, setForm] = React.useState(initial);
  React.useEffect(() => { setForm(initial); /* eslint-disable-next-line */ }, [c.id]);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setContato = (k, v) => setForm((f) => ({ ...f, contato: { ...f.contato, [k]: v } }));
  const setLembrete = (which, k, v) => setForm((f) => ({ ...f, [which]: { ...f[which], [k]: v } }));
  const toast = useToast();
  return (
    <Card title="Perfil de cobrança" description="Define como e quando o sistema gera a entrada prevista e dispara lembretes." action={<Button variant="primary" size="sm" icon={<IconCheck size={14} />} onClick={() => toast({ tone: "success", title: "Perfil de cobrança salvo", description: c.nome })}>Salvar perfil</Button>}>
      <div className="fg-form">
        <div className="fg-form-row">
          <Field label="Fee mensal" required>
            <Input prefix="R$" defaultValue={c.fee} mono />
          </Field>
          <Field label="Dia de vencimento" required>
            <Input type="number" min="1" max="28" defaultValue={c.dia} mono />
          </Field>
        </div>
        <div className="fg-form-row">
          <Field label="Método padrão">
            <Select value={form.metodo} onChange={(v) => set("metodo", v)} options={["PIX", "TED", "Boleto", "Cartão", "Débito"]} placeholder={null} />
          </Field>
          <Field label="Prazo de pagamento" helper="Dias úteis após emissão da cobrança.">
            <Input type="number" value={form.prazo} onChange={(e) => set("prazo", Number(e.target.value))} mono suffix="dias" />
          </Field>
        </div>
        <Field label="Recorrência">
          <Select value={form.recorrencia} onChange={(v) => set("recorrencia", v)} options={["Mensal", "Bimestral", "Trimestral", "Semestral", "Anual", "Pontual"]} placeholder={null} />
        </Field>

        <div className="fg-form-section-label">Contato financeiro</div>
        <div className="fg-form-row">
          <Field label="Nome" required><Input value={form.contato.nome || ""} onChange={(e) => setContato("nome", e.target.value)} /></Field>
          <Field label="Telefone"><Input value={form.contato.telefone || ""} onChange={(e) => setContato("telefone", e.target.value)} mono /></Field>
        </div>
        <Field label="E-mail" required><Input value={form.contato.email || ""} onChange={(e) => setContato("email", e.target.value)} type="email" /></Field>

        <div className="fg-form-section-label">Lembretes automáticos</div>
        <div className="fg-form-aux">
          <div className="fg-toggle-row">
            <Checkbox checked={form.lembreteAntes.ativo} onChange={(v) => setLembrete("lembreteAntes", "ativo", v)} label="Lembrar antes do vencimento" />
            {form.lembreteAntes.ativo && (
              <div className="fg-toggle-extra">
                <Input type="number" value={form.lembreteAntes.dias} onChange={(e) => setLembrete("lembreteAntes", "dias", Number(e.target.value))} mono suffix="dias antes" />
              </div>
            )}
          </div>
          <div className="fg-toggle-row">
            <Checkbox checked={form.lembreteApos.ativo} onChange={(v) => setLembrete("lembreteApos", "ativo", v)} label="Cobrar após o vencimento" />
            {form.lembreteApos.ativo && (
              <div className="fg-toggle-extra">
                <Input type="number" value={form.lembreteApos.dias} onChange={(e) => setLembrete("lembreteApos", "dias", Number(e.target.value))} mono suffix="dias depois" />
              </div>
            )}
          </div>
          <Checkbox checked={form.autoGerar} onChange={(v) => set("autoGerar", v)} label="Gerar entrada prevista automaticamente a cada ciclo" />
        </div>

        <Field label="Observações" helper="Visível para financeiro e atendimento.">
          <Textarea value={form.obs} onChange={(e) => set("obs", e.target.value)} rows={3} />
        </Field>
      </div>
    </Card>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Tab Contratos / Documentos
// ────────────────────────────────────────────────────────────────────────────
const ClienteContratos = ({ c }) => {
  const docs = window.FG_DOCS_CLIENTE[c.id] || [];
  return (
    <Card padding={false} title="Contratos e documentos" description="Versionados e auditados — apenas perfis com clients.write podem editar."
      action={<Button variant="primary" size="sm" icon={<IconUpload size={14} />}>Adicionar documento</Button>}>
      {docs.length === 0 ? (
        <EmptyState icon={<IconFolderLock size={32} />} title="Nenhum documento" description="Anexe contratos, aditivos, NDAs e briefings para que fiquem rastreados." />
      ) : (
        <table className="fg-aumento-table">
          <thead><tr><th>Tipo</th><th>Nome</th><th>Versão</th><th>Enviado por</th><th>Data</th><th></th></tr></thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <td><Tag>{d.tipo}</Tag></td>
                <td>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <IconFile size={14} style={{ color: "var(--ink-500)" }} />
                    <span className="fg-cell-strong">{d.nome}</span>
                    {d.sensivel && <StatusBadge status="danger" label="Sensível" withDot={false} />}
                  </span>
                </td>
                <td className="fg-tabular fg-muted">v{d.versao}</td>
                <td><div className="fg-cell-user"><Avatar name={d.enviadoPor} size={20} /><span>{d.enviadoPor.split(" ")[0]}</span></div></td>
                <td className="fg-tabular fg-muted">{formatDate(d.em)}</td>
                <td style={{ textAlign: "right" }}>
                  <Dropdown trigger={<button className="fg-icon-btn sm"><IconMore size={16} /></button>}
                    items={[{ label: "Visualizar", icon: <IconEye size={13} /> }, { label: "Baixar", icon: <IconDownload size={13} /> }, { label: "Substituir versão", icon: <IconUpload size={13} /> }, { separator: true }, { label: "Excluir", icon: <IconTrash size={13} />, danger: true }]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Tab Histórico
// ────────────────────────────────────────────────────────────────────────────
const TIMELINE_ICONS = {
  pagamento: <IconArrowDownRight size={10} stroke={2.5} />,
  atraso: <IconAlertCircle size={10} stroke={2.5} />,
  cobranca: <IconBell size={10} stroke={2.5} />,
  contrato: <IconFile size={10} stroke={2.5} />,
  fee_reajuste: <IconArrowUpRight size={10} stroke={2.5} />,
  projeto: <IconPlus size={10} stroke={2.5} />,
  criado: <IconBuilding size={10} stroke={2.5} />,
};
const TIMELINE_TONES = {
  pagamento: "fg-tl-done",
  atraso: "fg-tl-rejected",
  cobranca: "fg-tl-current",
  contrato: "fg-tl-pending",
  fee_reajuste: "fg-tl-done",
  projeto: "fg-tl-done",
  criado: "fg-tl-pending",
};

const ClienteHistorico = ({ c }) => {
  const evts = window.FG_TIMELINE_CLIENTE[c.id] || [{ tipo: "criado", titulo: "Cliente criado no sistema", ator: "—", em: window.FG_CLIENTES_INICIO[c.id] || window.FG_TODAY }];
  return (
    <Card title="Histórico" description="Cronológico — eventos auditados de pagamentos, contratos, cobranças e mudanças de status.">
      <ol className="fg-timeline fg-timeline-vertical">
        {evts.map((e, i) => (
          <li key={i} className={`fg-tl-step ${TIMELINE_TONES[e.tipo] || "fg-tl-pending"}`}>
            <div className="fg-tl-dot">{TIMELINE_ICONS[e.tipo] || null}</div>
            <div className="fg-tl-body">
              <div className="fg-tl-label">{e.titulo}</div>
              <div className="fg-tl-meta">{e.ator} · {formatDate(e.em, "long")}</div>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Tab Observações
// ────────────────────────────────────────────────────────────────────────────
const ClienteObservacoes = ({ c }) => {
  const initial = window.FG_OBS_CLIENTE[c.id] || "";
  const [text, setText] = React.useState(initial);
  React.useEffect(() => { setText(initial); /* eslint-disable-next-line */ }, [c.id]);
  const toast = useToast();
  return (
    <Card title="Observações internas" description="Notas livres do time — visíveis apenas para perfis com clients.write."
      action={<Button variant="primary" size="sm" icon={<IconCheck size={14} />} onClick={() => toast({ tone: "success", title: "Observações salvas" })}>Salvar</Button>}>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder="Notas sobre relacionamento, riscos, oportunidades, cuidados específicos..." />
      <div className="fg-field-helper" style={{ marginTop: 10 }}>Última edição há 4 dias por Helena Vasconcelos.</div>
    </Card>
  );
};

Object.assign(window, { Clientes, ClienteDetail, CLIENTE_TABS });

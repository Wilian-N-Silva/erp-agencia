// Pessoas — Colaboradores (lista + detalhe completo), Admissões, Desligamentos.

// ════════════════════════════════════════════════════════════════════════════
// COLABORADORES — Listagem
// ════════════════════════════════════════════════════════════════════════════
const tempoDeCasa = (entrada, saida) => {
  const fim = saida || window.FG_TODAY;
  const meses = (fim.getFullYear() - entrada.getFullYear()) * 12 + (fim.getMonth() - entrada.getMonth());
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  if (anos === 0) return `${resto}m`;
  if (resto === 0) return `${anos}a`;
  return `${anos}a ${resto}m`;
};

const Colaboradores = () => {
  const { go } = useRouter();
  const [search, setSearch] = React.useState("");
  const [statusF, setStatusF] = React.useState(["Ativo", "Em férias", "Em aviso"]);
  const [vinculoF, setVinculoF] = React.useState([]);
  const [areaF, setAreaF] = React.useState([]);
  const [density, setDensity] = React.useState("regular");
  const [sortKey, setSortKey] = React.useState("nome");
  const [sortDir, setSortDir] = React.useState("asc");

  const all = window.FG_COLABORADORES;
  const filtered = React.useMemo(() => {
    let xs = all;
    if (search) {
      const q = search.toLowerCase();
      xs = xs.filter((c) => c.nome.toLowerCase().includes(q) || c.matricula.toLowerCase().includes(q) || c.cargo.toLowerCase().includes(q));
    }
    if (statusF.length) {
      const statusMap = { "Ativo": "ativo", "Em férias": "on_vacation", "Em aviso": "in_notice", "Desligado": "desligado", "Pausado": "pausado" };
      const statusKeys = statusF.map((s) => statusMap[s]).filter(Boolean);
      xs = xs.filter((c) => statusKeys.includes(c.status));
    }
    if (vinculoF.length) xs = xs.filter((c) => vinculoF.includes(c.vinculo));
    if (areaF.length) xs = xs.filter((c) => areaF.includes(c.area));
    xs = [...xs].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return xs;
  }, [all, search, statusF, vinculoF, areaF, sortKey, sortDir]);

  const onSort = (k) => { if (sortKey === k) setSortDir((d) => d === "asc" ? "desc" : "asc"); else { setSortKey(k); setSortDir("asc"); } };

  const counts = {
    ativos: all.filter((c) => c.status === "ativo").length,
    clt: all.filter((c) => c.vinculo === "CLT" && c.status !== "desligado").length,
    pj: all.filter((c) => c.vinculo === "PJ" && c.status !== "desligado").length,
    estagio: all.filter((c) => c.vinculo === "Estágio" && c.status !== "desligado").length,
    socio: all.filter((c) => c.vinculo === "Sócia" && c.status !== "desligado").length,
  };

  const columns = [
    { key: "matricula", label: "Matrícula", render: (r) => <span className="fg-tabular fg-muted">{r.matricula}</span> },
    { key: "nome", label: "Nome", sortable: true, render: (r) => (
      <a href={`#/colaboradores/${r.id}`} className="fg-cell-user fg-cell-link" onClick={(e) => { e.preventDefault(); go(`/colaboradores/${r.id}`); }}>
        <Avatar name={r.nome} size={28} dimmed={r.status === "desligado"} />
        <div>
          <div className="fg-cell-strong">{r.nome}</div>
          <div className="fg-cell-sub">{r.cargo}</div>
        </div>
      </a>
    ) },
    { key: "area", label: "Área", sortable: true, render: (r) => <Tag>{r.area}</Tag> },
    { key: "vinculo", label: "Vínculo", render: (r) => <Tag>{r.vinculo}</Tag> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status === "on_vacation" ? "warning" : r.status === "in_notice" ? "warning" : r.status} label={r.status === "on_vacation" ? "Em férias" : r.status === "in_notice" ? "Em aviso" : null} /> },
    { key: "gestor", label: "Gestor", render: (r) => r.gestor ? (
      <div className="fg-cell-user"><Avatar name={r.gestor} size={20} /><span>{r.gestor.split(" ")[0]}</span></div>
    ) : <span className="fg-muted">—</span> },
    { key: "_tempo", label: "Tempo de casa", align: "right", render: (r) => <span className="fg-tabular fg-muted">{tempoDeCasa(r.entrada, r.saida)}</span> },
    { key: "_acoes", label: "", width: 40, render: (r) => (
      <Dropdown
        trigger={<button className="fg-icon-btn sm"><IconMore size={16} /></button>}
        items={[
          { label: "Abrir perfil", icon: <IconEye size={13} />, onClick: () => go(`/colaboradores/${r.id}`) },
          { label: "Editar", icon: <IconEdit size={13} /> },
          ...(r.status !== "desligado" ? [{ label: "Iniciar desligamento", icon: <IconUserMinus size={13} />, danger: true }] : []),
        ]}
      />
    ) },
  ];

  return (
    <div className="fg-page">
      <PageHeader
        eyebrow="Pessoas"
        title="Colaboradores"
        description={`${counts.ativos} ativos · ${counts.clt} CLT · ${counts.pj} PJ · ${counts.estagio} estágios · ${counts.socio} sócia`}
        actions={
          <>
            <Button variant="outline" size="sm" icon={<IconDownload size={14} />}>Exportar</Button>
            <Button variant="primary" size="sm" icon={<IconUserPlus size={14} />}>Iniciar admissão</Button>
          </>
        }
      />

      <Toolbar
        search={search}
        onSearch={setSearch}
        filters={
          <>
            <FilterPopover label="Status" value={statusF} onChange={setStatusF} options={["Ativo", "Em férias", "Em aviso", "Pausado", "Desligado"]} />
            <FilterPopover label="Vínculo" value={vinculoF} onChange={setVinculoF} options={[...new Set(all.map((c) => c.vinculo))]} />
            <FilterPopover label="Área" value={areaF} onChange={setAreaF} options={[...new Set(all.map((c) => c.area))]} />
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
// COLABORADOR — Página de detalhe
// ════════════════════════════════════════════════════════════════════════════
const COLAB_TABS = [
  { value: "resumo", label: "Resumo" },
  { value: "dados", label: "Dados pessoais" },
  { value: "vinculo", label: "Vínculo e cargo" },
  { value: "remuneracao", label: "Remuneração" },
  { value: "ferias", label: "Férias / Pausas" },
  { value: "documentos", label: "Documentos" },
  { value: "equipamentos", label: "Equipamentos" },
  { value: "acessos", label: "Acessos" },
  { value: "nfs", label: "NFs" },
  { value: "reembolsos", label: "Reembolsos" },
  { value: "historico", label: "Histórico" },
];

const ColaboradorDetail = ({ id }) => {
  const { go } = useRouter();
  const c = window.FG_COLABORADORES.find((x) => x.id === id);
  const [tab, setTab] = React.useState("resumo");

  if (!c) {
    return (
      <div className="fg-page">
        <PageHeader eyebrow="Pessoas" title="Colaborador não encontrado" />
        <Button variant="outline" onClick={() => go("/colaboradores")}>Voltar para a lista</Button>
      </div>
    );
  }

  // Filter tabs: PJ shows NFs, CLT shows Férias formal; both fine here.
  const tabs = COLAB_TABS.filter((t) => {
    if (t.value === "nfs" && c.vinculo !== "PJ") return false;
    return true;
  });

  const statusLabel = c.status === "on_vacation" ? "Em férias" : c.status === "in_notice" ? "Em aviso prévio" : c.status === "desligado" ? "Desligado" : "Ativo";

  return (
    <div className="fg-page">
      <button className="fg-back" onClick={() => go("/colaboradores")}>
        <IconChevronLeft size={14} /> Colaboradores
      </button>

      <div className="fg-detail-head">
        <Avatar name={c.nome} size={64} dimmed={c.status === "desligado"} />
        <div className="fg-detail-head-meta">
          <div className="fg-detail-eyebrow">
            <span className="fg-tabular">{c.matricula}</span>
            <span>·</span>
            <span>{c.cargo}</span>
            <span>·</span>
            <span>{c.area}</span>
          </div>
          <h1 className="fg-detail-title">{c.nome}</h1>
          <div className="fg-detail-badges">
            <StatusBadge status={c.status === "on_vacation" || c.status === "in_notice" ? "warning" : c.status} label={statusLabel} />
            <Tag>{c.vinculo}</Tag>
            <Tag>{c.modelo}</Tag>
            <Tag>{c.localizacao}</Tag>
            {c.gestor && (
              <span className="fg-detail-gestor">
                <span className="fg-muted">Gestor</span>
                <Avatar name={c.gestor} size={18} />
                <span>{c.gestor}</span>
              </span>
            )}
          </div>
        </div>
        <div className="fg-detail-head-actions">
          <Button variant="outline" size="sm" icon={<IconEdit size={14} />}>Editar</Button>
          {c.status !== "desligado" && (
            <Button variant="destructive" size="sm" icon={<IconUserMinus size={14} />}>Iniciar desligamento</Button>
          )}
          <Dropdown
            align="right"
            trigger={<button className="fg-icon-btn"><IconMore size={16} /></button>}
            items={[
              { label: "Solicitar férias", icon: <IconUmbrella size={13} /> },
              { label: "Registrar reembolso", icon: <IconReceipt size={13} /> },
              { label: "Atribuir equipamento", icon: <IconLaptop size={13} /> },
              { separator: true },
              { label: "Exportar ficha", icon: <IconDownload size={13} /> },
            ]}
          />
        </div>
      </div>

      <div className="fg-detail-tabs">
        <Tabs value={tab} onChange={setTab} items={tabs} />
      </div>

      <div className="fg-detail-body">
        {tab === "resumo" && <ColabResumo c={c} />}
        {tab === "dados" && <ColabDados c={c} />}
        {tab === "vinculo" && <ColabVinculo c={c} />}
        {tab === "remuneracao" && <ColabRemuneracao c={c} />}
        {tab === "ferias" && <ColabFerias c={c} />}
        {tab === "documentos" && <ColabDocumentos c={c} />}
        {tab === "equipamentos" && <ColabEquipamentos c={c} />}
        {tab === "acessos" && <ColabAcessos c={c} />}
        {tab === "nfs" && <ColabNFs c={c} />}
        {tab === "reembolsos" && <ColabReembolsos c={c} />}
        {tab === "historico" && <ColabHistorico c={c} />}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Resumo tab
// ────────────────────────────────────────────────────────────────────────────
const ColabResumo = ({ c }) => {
  const rb = (window.FG_REEMBOLSOS || []).filter((r) => r.colaborador === c.nome);
  const nfs = (window.FG_NFS || []).filter((n) => n.colaborador === c.nome);
  return (
    <div className="fg-grid fg-grid-2">
      <Card title="Tempo de casa" description="Em vigência desde o início do vínculo">
        <div className="fg-resumo-big">
          <div className="fg-resumo-val fg-tabular">{tempoDeCasa(c.entrada, c.saida)}</div>
          <div className="fg-resumo-sub">Desde {formatDate(c.entrada, "long")}</div>
        </div>
      </Card>
      <Card title={c.vinculo === "CLT" ? "Férias disponíveis" : "Próxima pausa programada"}>
        {c.vinculo === "CLT" ? (
          c.ferias ? (
            <div className="fg-resumo-big">
              <div className="fg-resumo-val fg-tabular">{c.ferias.emFerias ? "0" : c.ferias.dias} <span className="fg-resumo-unit">dias</span></div>
              <div className={`fg-resumo-sub ${c.ferias.atencao ? "fg-bad" : ""}`}>
                {c.ferias.atencao && <IconAlertCircle size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />}
                Vencimento {formatDate(c.ferias.vencimento)} {c.ferias.atencao && "— próximo do limite"}
              </div>
            </div>
          ) : <div className="fg-muted">Sem dados de férias.</div>
        ) : (
          <div className="fg-resumo-big">
            <div className="fg-resumo-val">—</div>
            <div className="fg-resumo-sub">Nenhuma pausa programada.</div>
          </div>
        )}
      </Card>
      <Card title="Atividade recente" description="Últimos 30 dias">
        <div className="fg-resumo-stats">
          <div><strong className="fg-tabular">{nfs.length}</strong><span>NFs em fluxo</span></div>
          <div><strong className="fg-tabular">{rb.length}</strong><span>Reembolsos</span></div>
          <div><strong className="fg-tabular">12</strong><span>Eventos auditados</span></div>
        </div>
      </Card>
      <Card title="Acessos críticos" description="Sistemas com privilégios elevados">
        <ul className="fg-list-inline">
          <li><IconKey size={13} /> Google Workspace <span className="fg-muted">· admin</span></li>
          <li><IconKey size={13} /> Figma <span className="fg-muted">· editor</span></li>
          {c.vinculo !== "Estágio" && <li><IconKey size={13} /> Adobe CC <span className="fg-muted">· editor</span></li>}
        </ul>
      </Card>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Dados pessoais (mostra restrito quando aplicável)
// ────────────────────────────────────────────────────────────────────────────
const ColabDados = ({ c }) => {
  const [reveal, setReveal] = React.useState(false);
  return (
    <div className="fg-grid fg-grid-2">
      <Card title="Identificação">
        <dl className="fg-deflist">
          <div><dt>Nome completo</dt><dd>{c.nome}</dd></div>
          <div><dt>CPF</dt><dd className="fg-tabular">{reveal ? "153.987.456-21" : "***.***.456-**"}</dd></div>
          <div><dt>RG</dt><dd className="fg-tabular">{reveal ? "32.456.789-1" : "**.***.**9-*"}</dd></div>
          <div><dt>Data de nascimento</dt><dd className="fg-tabular">{reveal ? "12/03/1990" : "**/**/****"}</dd></div>
          <div className="full">
            <dt>Endereço</dt>
            <dd>{reveal ? "Rua Aspicuelta, 312 ap 41 — Vila Madalena, São Paulo/SP — 05433-010" : "*** restrito — clique em revelar"}</dd>
          </div>
        </dl>
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <Button variant="outline" size="sm" icon={<IconEye size={13} />} onClick={() => setReveal(!reveal)}>
            {reveal ? "Ocultar dados sensíveis" : "Revelar dados sensíveis"}
          </Button>
          <span className="fg-field-helper" style={{ alignSelf: "center" }}>Gera audit log de visualização.</span>
        </div>
      </Card>
      <Card title="Contatos">
        <dl className="fg-deflist">
          <div><dt>E-mail pessoal</dt><dd>{c.nome.split(" ")[0].toLowerCase()}@gmail.com</dd></div>
          <div><dt>E-mail corporativo</dt><dd>{c.nome.split(" ")[0].toLowerCase()}@formulagroup.com.br</dd></div>
          <div><dt>Telefone</dt><dd className="fg-tabular">(11) 9 9876-5432</dd></div>
          <div className="full"><dt>Contato de emergência</dt><dd>Maria José Vasconcelos · (11) 9 1234-5678 · Mãe</dd></div>
        </dl>
      </Card>
      <Card title="Pagamento">
        <dl className="fg-deflist">
          <div><dt>Banco</dt><dd>Itaú</dd></div>
          <div><dt>Conta</dt><dd className="fg-tabular">{reveal ? "0152-7 / 32145-0" : "****-* / ****-*"}</dd></div>
          <div><dt>PIX</dt><dd>{reveal ? c.nome.split(" ")[0].toLowerCase() + "@formulagroup.com.br" : "**********@*****"}</dd></div>
        </dl>
      </Card>
      <Card title="Dependentes">
        <div className="fg-muted">Nenhum dependente registrado.</div>
      </Card>
    </div>
  );
};

const ColabVinculo = ({ c }) => (
  <Card title="Vínculo e cargo">
    <dl className="fg-deflist three">
      <div><dt>Vínculo</dt><dd><Tag>{c.vinculo}</Tag></dd></div>
      <div><dt>Cargo</dt><dd>{c.cargo}</dd></div>
      <div><dt>Área</dt><dd>{c.area}</dd></div>
      <div><dt>Gestor direto</dt><dd>{c.gestor || "—"}</dd></div>
      <div><dt>Modelo de trabalho</dt><dd>{c.modelo}</dd></div>
      <div><dt>Localização base</dt><dd>{c.localizacao}</dd></div>
      <div><dt>Data de entrada</dt><dd className="fg-tabular">{formatDate(c.entrada, "long")}</dd></div>
      <div><dt>Tempo de casa</dt><dd className="fg-tabular">{tempoDeCasa(c.entrada, c.saida)}</dd></div>
      {c.saida && <div><dt>Data de saída</dt><dd className="fg-tabular">{formatDate(c.saida, "long")}</dd></div>}
      {c.desligamentoEm && <div><dt>Desligamento previsto</dt><dd className="fg-tabular fg-bad">{formatDate(c.desligamentoEm, "long")}</dd></div>}
    </dl>
  </Card>
);

// ────────────────────────────────────────────────────────────────────────────
// Remuneração
// ────────────────────────────────────────────────────────────────────────────
const ColabRemuneracao = ({ c }) => {
  const aumentos = window.FG_AUMENTOS[c.id] || [
    { data: c.entrada, valorAnterior: 0, valorNovo: c.remuneracao, motivo: "Admissão", aprovado: c.gestor || "Helena Vasconcelos" },
  ];
  const total = c.remuneracao + (c.ajudaCusto || 0) + (c.transporte || 0);
  return (
    <>
      <div className="fg-grid fg-grid-2">
        <Card title={c.vinculo === "PJ" ? "Remuneração contratada" : c.vinculo === "Sócia" || c.vinculo === "Sócio" ? "Composição mensal" : "Salário atual"}>
          <div className="fg-resumo-big">
            <div className="fg-resumo-val fg-tabular">{formatBRL(c.remuneracao)}</div>
            <div className="fg-resumo-sub">Vigente desde {formatDate(aumentos[0].data, "long")}</div>
          </div>
          <div className="fg-rem-breakdown">
            <div><span>Base</span><span className="fg-tabular">{formatBRL(c.remuneracao)}</span></div>
            <div><span>Ajuda de custo</span><span className="fg-tabular">{formatBRL(c.ajudaCusto || 0)}</span></div>
            <div><span>Transporte</span><span className="fg-tabular">{formatBRL(c.transporte || 0)}</span></div>
            <div className="total"><span>Total mensal</span><span className="fg-tabular">{formatBRL(total)}</span></div>
          </div>
        </Card>
        <Card title="Ações" description="Registrar alteração de remuneração ou benefícios">
          <div className="fg-action-stack">
            <Button variant="primary" icon={<IconPlus size={14} />}>Registrar alteração</Button>
            <Button variant="outline" icon={<IconReceipt size={14} />}>Adicionar benefício</Button>
            <Button variant="outline" icon={<IconDownload size={14} />}>Exportar histórico</Button>
          </div>
        </Card>
      </div>

      <Card title="Histórico de alterações" description="Auditado · visível apenas para RH, Diretoria e Financeiro" padding={false}>
        <table className="fg-aumento-table">
          <thead>
            <tr><th>Data</th><th>De</th><th>Para</th><th>Variação</th><th>Motivo</th><th>Aprovado por</th></tr>
          </thead>
          <tbody>
            {aumentos.map((a, i) => {
              const diff = a.valorNovo - a.valorAnterior;
              const pct = a.valorAnterior > 0 ? (diff / a.valorAnterior) * 100 : null;
              return (
                <tr key={i}>
                  <td className="fg-tabular">{formatDate(a.data)}</td>
                  <td className="fg-tabular fg-muted">{a.valorAnterior > 0 ? formatBRL(a.valorAnterior) : "—"}</td>
                  <td className="fg-tabular fg-cell-strong">{formatBRL(a.valorNovo)}</td>
                  <td className="fg-tabular">
                    {diff > 0 ? (
                      <span className="fg-good">+{formatBRL(diff)}{pct != null && ` (+${pct.toFixed(1).replace(".", ",")}%)`}</span>
                    ) : "—"}
                  </td>
                  <td>{a.motivo}</td>
                  <td>
                    <div className="fg-cell-user"><Avatar name={a.aprovado} size={20} /><span>{a.aprovado.split(" ")[0]}</span></div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Férias
// ────────────────────────────────────────────────────────────────────────────
const ColabFerias = ({ c }) => {
  const minhas = (window.FG_FERIAS || []).filter((f) => f.colaborador === c.nome);
  const isCLT = c.vinculo === "CLT";
  return (
    <>
      {isCLT && c.ferias && (
        <div className="fg-grid fg-grid-4">
          <KpiCard label="Disponíveis" value={`${c.ferias.emFerias ? 0 : c.ferias.dias} dias`} mono={false} />
          <KpiCard label="Tirados no período" value={`${30 - (c.ferias.dias || 0)} dias`} mono={false} />
          <KpiCard label="Vendidos" value="0 dias" mono={false} />
          <KpiCard label="Vencimento" value={formatDate(c.ferias.vencimento, "dayMonth")} secondary={c.ferias.atencao ? "Próximo do limite" : "Em dia"} mono={true} accent={!c.ferias.atencao} />
        </div>
      )}
      <Card title={isCLT ? "Histórico de férias" : "Pausas programadas"} description={isCLT ? null : "PJs não acumulam férias formais — pausas são informadas para alinhamento."} padding={false}>
        {minhas.length === 0 ? (
          <EmptyState icon={<IconUmbrella size={32} />} title="Nada registrado ainda" description="Quando este colaborador solicitar férias ou uma pausa, aparecerá aqui." />
        ) : (
          <table className="fg-aumento-table">
            <thead><tr><th>Tipo</th><th>Início</th><th>Fim</th><th>Dias</th><th>Status</th><th>Aprovador</th></tr></thead>
            <tbody>
              {minhas.map((f) => (
                <tr key={f.id}>
                  <td><Tag>{f.tipo}</Tag></td>
                  <td className="fg-tabular">{formatDate(f.inicio)}</td>
                  <td className="fg-tabular">{formatDate(f.fim)}</td>
                  <td className="fg-tabular">{f.dias}</td>
                  <td><StatusBadge status={f.status} /></td>
                  <td><div className="fg-cell-user"><Avatar name={f.aprovador} size={20} /><span>{f.aprovador.split(" ")[0]}</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
};

const ColabDocumentos = () => (
  <Card title="Documentos" description="Contratos, NFs, recibos, comprovantes — todos rastreados">
    <EmptyState icon={<IconFolderLock size={32} />} title="Demo — esta lista renderiza o componente DocumentList compartilhado" description="No produto, mostra: ícone do tipo + nome + versão + badge 'Sensível' + enviado por + data + ações (visualizar, baixar, substituir, excluir — auditadas)." action={<Button variant="primary" size="sm" icon={<IconUpload size={14} />}>Enviar documento</Button>} />
  </Card>
);

const ColabEquipamentos = ({ c }) => {
  const eqs = window.FG_EQUIPAMENTOS_DE[c.id] || [];
  return eqs.length === 0 ? (
    <Card><EmptyState icon={<IconLaptop size={32} />} title="Nenhum equipamento atribuído" /></Card>
  ) : (
    <div className="fg-grid fg-grid-2">
      {eqs.map((e) => (
        <Card key={e.patrimonio} title={e.tipo} description={<span className="fg-tabular">{e.patrimonio}</span>}>
          <dl className="fg-deflist">
            <div><dt>Atribuído em</dt><dd className="fg-tabular">{formatDate(e.entrega, "long")}</dd></div>
            <div><dt>Estado</dt><dd>{e.estado}</dd></div>
            <div><dt>Termo</dt><dd><a href="#" className="fg-link">Baixar termo de responsabilidade</a></dd></div>
          </dl>
        </Card>
      ))}
    </div>
  );
};

const ColabAcessos = () => (
  <Card title="Acessos concedidos" padding={false}>
    <table className="fg-aumento-table">
      <thead><tr><th>Sistema</th><th>Categoria</th><th>Nível</th><th>Criticidade</th><th>Concessão</th><th>Próx. revisão</th></tr></thead>
      <tbody>
        <tr><td>Google Workspace</td><td><Tag>E-mail</Tag></td><td>Editor</td><td><StatusBadge status="critico" label="Crítica" /></td><td className="fg-tabular">12/03/2024</td><td className="fg-tabular">12/09/2026</td></tr>
        <tr><td>Figma Organization</td><td><Tag>Design</Tag></td><td>Editor</td><td><StatusBadge status="alto" label="Alta" /></td><td className="fg-tabular">12/03/2024</td><td className="fg-tabular">12/03/2027</td></tr>
        <tr><td>Adobe Creative Cloud</td><td><Tag>Design</Tag></td><td>Editor</td><td><StatusBadge status="medio" label="Média" /></td><td className="fg-tabular">15/03/2024</td><td className="fg-tabular">15/03/2027</td></tr>
        <tr><td>Notion (workspace agência)</td><td><Tag>Docs</Tag></td><td>Membro</td><td><StatusBadge status="baixo" label="Baixa" /></td><td className="fg-tabular">12/03/2024</td><td className="fg-tabular">—</td></tr>
      </tbody>
    </table>
  </Card>
);

const ColabNFs = ({ c }) => {
  const nfs = (window.FG_NFS || []).filter((n) => n.colaborador === c.nome);
  return (
    <Card padding={false} title="NFs deste PJ">
      {nfs.length === 0 ? (
        <EmptyState icon={<IconFile size={32} />} title="Nenhuma NF registrada" />
      ) : (
        <table className="fg-aumento-table">
          <thead><tr><th>Competência</th><th>Valor esperado</th><th>Valor emitido</th><th>Status</th><th>Prazo</th></tr></thead>
          <tbody>
            {nfs.map((n) => (
              <tr key={n.id}>
                <td className="fg-tabular">{n.competencia}</td>
                <td className="fg-tabular">{formatBRL(n.valorEsperado)}</td>
                <td className="fg-tabular">{n.valorEmitido != null ? formatBRL(n.valorEmitido) : "—"}</td>
                <td><StatusBadge status={n.status} /></td>
                <td className="fg-tabular">{formatDate(n.prazo, "dayMonth")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
};

const ColabReembolsos = ({ c }) => {
  const rbs = (window.FG_REEMBOLSOS || []).filter((r) => r.colaborador === c.nome);
  return (
    <Card padding={false} title="Reembolsos solicitados">
      {rbs.length === 0 ? (
        <EmptyState icon={<IconReceipt size={32} />} title="Nenhum reembolso solicitado" />
      ) : (
        <table className="fg-aumento-table">
          <thead><tr><th>Data</th><th>Categoria</th><th>Valor</th><th>Status</th></tr></thead>
          <tbody>
            {rbs.map((r) => (
              <tr key={r.id}>
                <td className="fg-tabular">{formatDate(r.dataDespesa)}</td>
                <td>{r.categoria}</td>
                <td className="fg-tabular">{formatBRL(r.valor)}</td>
                <td><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
};

const ColabHistorico = () => (
  <Card title="Histórico de eventos" description="Linha do tempo auditada">
    <ol className="fg-timeline fg-timeline-vertical">
      <li className="fg-tl-step fg-tl-done"><div className="fg-tl-dot"><IconUserPlus size={10} stroke={2.5} /></div><div className="fg-tl-body"><div className="fg-tl-label">Admissão concluída</div><div className="fg-tl-meta">Lívia Câmara · 12/03/2024</div></div></li>
      <li className="fg-tl-step fg-tl-done"><div className="fg-tl-dot"><IconLaptop size={10} stroke={2.5} /></div><div className="fg-tl-body"><div className="fg-tl-label">MacBook Pro 14" M3 (EQ-00012) atribuído</div><div className="fg-tl-meta">TI · 12/03/2024</div></div></li>
      <li className="fg-tl-step fg-tl-done"><div className="fg-tl-dot"><IconArrowUpRight size={10} stroke={2.5} /></div><div className="fg-tl-body"><div className="fg-tl-label">Aumento salarial · R$ 11.000 → R$ 12.800</div><div className="fg-tl-meta">Helena Vasconcelos · 15/06/2024</div></div></li>
      <li className="fg-tl-step fg-tl-done"><div className="fg-tl-dot"><IconUmbrella size={10} stroke={2.5} /></div><div className="fg-tl-body"><div className="fg-tl-label">Férias 15 dias · jul/2025</div><div className="fg-tl-meta">João Bertolazi · aprovado 02/06/2025</div></div></li>
      <li className="fg-tl-step fg-tl-done"><div className="fg-tl-dot"><IconArrowUpRight size={10} stroke={2.5} /></div><div className="fg-tl-body"><div className="fg-tl-label">Aumento salarial + promoção a Sênior · R$ 12.800 → R$ 14.200</div><div className="fg-tl-meta">Helena Vasconcelos · 01/01/2026</div></div></li>
    </ol>
  </Card>
);

// ════════════════════════════════════════════════════════════════════════════
// ADMISSÕES e DESLIGAMENTOS — Listagens
// ════════════════════════════════════════════════════════════════════════════
const Admissoes = () => {
  const { go } = useRouter();
  const items = window.FG_ADMISSOES;
  return (
    <div className="fg-page">
      <PageHeader
        eyebrow="Pessoas"
        title="Admissões"
        description={`${items.length} admissão em andamento`}
        actions={<Button variant="primary" size="sm" icon={<IconUserPlus size={14} />}>Iniciar admissão</Button>}
      />
      {items.length === 0 ? (
        <Card><EmptyState icon={<IconUserPlus size={32} />} title="Nenhuma admissão em andamento" /></Card>
      ) : (
        <div className="fg-checklist-list">
          {items.map((a) => (
            <ChecklistCard
              key={a.id}
              eyebrow="Admissão"
              title={a.nome}
              subtitle={`${a.cargo} · ${a.area} · ${a.vinculo}`}
              when={`Entrada prevista ${formatDate(a.entrada, "long")}`}
              responsavel={a.responsavel}
              checklist={a.checklist}
              onOpen={() => go(`/admissoes/${a.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const Desligamentos = () => {
  const { go } = useRouter();
  const items = window.FG_DESLIGAMENTOS;
  return (
    <div className="fg-page">
      <PageHeader
        eyebrow="Pessoas"
        title="Desligamentos"
        description={`${items.length} processos · ${items.filter((d) => d.checklist.blocked > 0).length} com pendência`}
        actions={<Button variant="outline" size="sm" icon={<IconDownload size={14} />}>Exportar</Button>}
      />
      <div className="fg-checklist-list">
        {items.map((d) => (
          <ChecklistCard
            key={d.id}
            eyebrow="Desligamento"
            title={d.colaborador}
            subtitle={<><span className="fg-tabular">{d.matricula}</span> · {d.cargo} · {d.area}</>}
            when={`Prevista ${formatDate(d.prevista, "long")}`}
            responsavel={d.responsavel}
            checklist={d.checklist}
            tone={d.checklist.blocked > 0 ? "warning" : "default"}
            onOpen={() => go(`/desligamentos/${d.id}`)}
          />
        ))}
      </div>
    </div>
  );
};

const ChecklistCard = ({ eyebrow, title, subtitle, when, responsavel, checklist, tone = "default", onOpen }) => {
  const pct = Math.round((checklist.done / checklist.total) * 100);
  return (
    <div className={`fg-check-card ${tone === "warning" ? "warn" : ""}`}>
      <div className="fg-check-head">
        <div>
          <div className="fg-check-eyebrow">{eyebrow}</div>
          <div className="fg-check-title">{title}</div>
          <div className="fg-check-sub">{subtitle}</div>
        </div>
        <div className="fg-check-meta">
          <div className="fg-check-when fg-tabular">{when}</div>
          <div className="fg-check-resp">
            <span className="fg-muted">Responsável</span>
            <Avatar name={responsavel} size={20} />
            <span>{responsavel}</span>
          </div>
        </div>
      </div>
      <div className="fg-check-progress">
        <div className="fg-check-bar">
          <div className="fg-check-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="fg-check-bar-label fg-tabular">
          <strong>{checklist.done}</strong> de {checklist.total} concluídos
          {checklist.blocked > 0 && <span className="fg-bad"> · {checklist.blocked} bloqueado{checklist.blocked > 1 ? "s" : ""}</span>}
        </div>
      </div>
      <div className="fg-check-actions">
        <Button variant="outline" size="sm" onClick={onOpen}>Abrir checklist</Button>
        <Button variant="ghost" size="sm" iconRight={<IconChevronRight size={13} />}>Notificar responsáveis</Button>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Admissão / Desligamento — Detalhe (checklist)
// ────────────────────────────────────────────────────────────────────────────
const ChecklistDetail = ({ kind, id }) => {
  const { go } = useRouter();
  const source = kind === "admissao" ? window.FG_ADMISSOES : window.FG_DESLIGAMENTOS;
  const item = source.find((x) => x.id === id);
  if (!item) return <div className="fg-page"><PageHeader eyebrow="Pessoas" title="Não encontrado" /></div>;

  const title = kind === "admissao" ? item.nome : item.colaborador;
  const subtitle = kind === "admissao"
    ? `${item.cargo} · ${item.area} · ${item.vinculo} · entrada prevista ${formatDate(item.entrada, "long")}`
    : `${item.matricula} · ${item.cargo} · ${item.area} · prevista ${formatDate(item.prevista, "long")}`;
  const pct = Math.round((item.checklist.done / item.checklist.total) * 100);

  return (
    <div className="fg-page">
      <button className="fg-back" onClick={() => go(kind === "admissao" ? "/admissoes" : "/desligamentos")}>
        <IconChevronLeft size={14} /> {kind === "admissao" ? "Admissões" : "Desligamentos"}
      </button>

      <PageHeader
        eyebrow={kind === "admissao" ? "Admissão" : "Desligamento"}
        title={title}
        description={subtitle}
        actions={
          <>
            <Button variant="outline" size="sm" icon={<IconBell size={14} />}>Notificar responsáveis</Button>
            <Button variant={pct === 100 ? "primary" : "outline"} size="sm" disabled={pct !== 100}>
              {kind === "admissao" ? "Concluir admissão" : "Concluir desligamento"}
            </Button>
          </>
        }
      />

      {kind === "desligamento" && (
        <div className="fg-inline-alert danger">
          <IconAlertOctagonReplace size={16} />
          <div>
            <div className="fg-inline-alert-title">Alertas associados a este desligamento</div>
            <ul className="fg-inline-list">
              <li>Equipamento <span className="fg-tabular">EQ-00019</span> ainda atribuído ao colaborador — pendente de devolução.</li>
              <li>1 reembolso pendente bloqueando o item de aprovação.</li>
              <li>Verifique os acessos críticos após a conclusão.</li>
            </ul>
          </div>
        </div>
      )}

      <Card title={`Progresso · ${pct}%`} description={`${item.checklist.done} de ${item.checklist.total} concluídos · ${item.checklist.blocked} bloqueado${item.checklist.blocked > 1 ? "s" : ""}`} padding={false}>
        <div className="fg-check-progress" style={{ padding: "0 20px 18px" }}>
          <div className="fg-check-bar"><div className="fg-check-bar-fill" style={{ width: `${pct}%` }} /></div>
        </div>
        <ul className="fg-check-items">
          {item.checklist.items.map((it) => (
            <li key={it.id} className={`fg-check-item fg-check-${it.status}`}>
              <div className="fg-check-item-mark">
                {it.status === "done" ? <IconCheck size={12} stroke={3} /> :
                  it.status === "blocked" ? <IconX size={11} stroke={3} /> :
                    it.status === "in_progress" ? <IconClock size={11} /> : null}
              </div>
              <div className="fg-check-item-body">
                <div className="fg-check-item-title">{it.titulo}</div>
                {it.motivo && <div className="fg-check-item-motivo">Bloqueio: {it.motivo}</div>}
              </div>
              <div className="fg-check-item-meta">
                <div className="fg-cell-user"><Avatar name={it.responsavel} size={20} /><span>{it.responsavel}</span></div>
              </div>
              <div className="fg-check-item-actions">
                {it.status !== "done" && <Button variant="outline" size="sm">Marcar concluído</Button>}
                {it.status === "blocked" && <Button variant="ghost" size="sm">Desbloquear</Button>}
                {it.status !== "blocked" && it.status !== "done" && <Button variant="ghost" size="sm">Bloquear</Button>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
};

// Alias to allow IconAlertOctagon-like styling without adding a new icon to icons.jsx
const IconAlertOctagonReplace = (p) => <IconAlertCircle {...p} />;

Object.assign(window, {
  Colaboradores, ColaboradorDetail, COLAB_TABS,
  Admissoes, Desligamentos, ChecklistCard, ChecklistDetail,
});

// Dashboard executivo (perfil Diretoria)

const SeverityIcon = ({ s }) => {
  if (s === "critico") return <IconAlertCircle size={14} />;
  if (s === "alto") return <IconAlertTriangle size={14} />;
  return <IconClock size={14} />;
};

const Dashboard = () => {
  const { go } = useRouter();
  const today = window.FG_TODAY;
  const greeting = "Boa tarde";
  const dataFmt = today.toLocaleDateString("pt-BR", { day: "numeric", month: "long" });

  // KPIs (recalculados a partir do mock)
  const entradas = window.FG_ENTRADAS.filter((e) => e.competencia === "mai/26");
  const saidas = window.FG_SAIDAS.filter((s) => s.competencia === "mai/26");
  const entradaTotal = entradas.reduce((a, e) => a + (e.valorRecebido || 0), 0);
  const saidaTotal = saidas.reduce((a, s) => a + (s.status === "pago" ? s.valor : 0), 0);
  const previstoEntradas = entradas.filter((e) => e.status !== "recebido").reduce((a, e) => a + (e.valorPrevisto - (e.valorRecebido || 0)), 0);
  const previstoSaidas = saidas.filter((s) => s.status !== "pago").reduce((a, s) => a + s.valor, 0);
  const saldo = 1245800 + entradaTotal - saidaTotal; // saldo de abertura fictício
  const resultado = entradaTotal - saidaTotal;
  const previsto30 = previstoEntradas - previstoSaidas;

  const proximas = entradas.filter((e) => e.status !== "recebido").sort((a, b) => a.vencimento - b.vencimento).slice(0, 5);
  const aPagar = saidas.filter((s) => s.status !== "pago").sort((a, b) => a.vencimento - b.vencimento).slice(0, 5);

  return (
    <div className="fg-page">
      <div className="fg-greet">
        <div>
          <h1 className="fg-greet-title">{greeting}, {window.FG_USER.primeiroNome}.</h1>
          <p className="fg-greet-sub">Aqui está o resumo de hoje, {dataFmt} de 2026.</p>
        </div>
        <div className="fg-greet-actions">
          <Button variant="outline" size="sm" icon={<IconRefresh size={14} />}>Atualizar</Button>
          <Button variant="outline" size="sm" iconRight={<IconChevronDown size={14} />}>Mai/26</Button>
        </div>
      </div>

      <div className="fg-grid fg-grid-kpis">
        <KpiCard label="Saldo atual" value={formatBRL(saldo)} secondary="Conta + reserva" icon={<IconBank size={16} />} />
        <KpiCard label="Entradas · mai" value={formatBRL(entradaTotal)} trend={12.4} trendLabel="vs abr" icon={<IconArrowDownRight size={16} />} />
        <KpiCard label="Saídas · mai" value={formatBRL(saidaTotal)} trend={-3.1} trendLabel="vs abr" icon={<IconArrowUpRight size={16} />} />
        <KpiCard label="Resultado · mai" value={formatBRL(resultado)} secondary={resultado >= 0 ? "Superávit parcial" : "Déficit parcial"} icon={<IconWallet size={16} />} accent={resultado >= 0} />
        <KpiCard label="Próx. 30 dias" value={formatBRL(previsto30)} secondary="Entradas − Saídas previstas" icon={<IconClock size={16} />} />
      </div>

      <div className="fg-grid fg-grid-2">
        <Card
          title="Pendências críticas"
          description="Ordenadas por severidade. Tudo o que requer ação executiva."
          action={<Button variant="ghost" size="sm" iconRight={<IconArrowRight size={14} />} onClick={() => go("/alertas")}>Ver todas</Button>}
        >
          <div className="fg-alert-list">
            {window.FG_ALERTAS.slice(0, 4).map((a) => (
              <div key={a.id} className={`fg-alert fg-alert-${a.severidade}`}>
                <span className="fg-alert-icon"><SeverityIcon s={a.severidade} /></span>
                <div className="fg-alert-body">
                  <div className="fg-alert-title">{a.titulo}</div>
                  <div className="fg-alert-sub">{a.subtitulo}</div>
                  <div className="fg-alert-ctx">{a.contexto}</div>
                </div>
                <div className="fg-alert-meta">
                  <StatusBadge status={a.severidade} withDot={false} icon={<SeverityIcon s={a.severidade} />} />
                  <span className="fg-alert-when">{a.quando}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card
          title="Próximos eventos"
          description="Aniversários, férias, admissões, renovações e desligamentos."
          action={<Button variant="ghost" size="sm" iconRight={<IconArrowRight size={14} />}>Ver agenda</Button>}
        >
          <div className="fg-event-list">
            {window.FG_EVENTOS.map((e) => (
              <div key={e.id} className="fg-event">
                <span className={`fg-event-icon fg-event-${e.tipo}`}>
                  {e.tipo === "aniversario" && <IconCake size={14} />}
                  {e.tipo === "ferias" && <IconUmbrella size={14} />}
                  {e.tipo === "renovacao" && <IconRepeat size={14} />}
                  {e.tipo === "admissao" && <IconUserPlus size={14} />}
                  {e.tipo === "desligamento" && <IconUserMinus size={14} />}
                </span>
                <div className="fg-event-body">
                  <div className="fg-event-title">{e.titulo}</div>
                </div>
                <span className="fg-event-when">{e.quando}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="fg-grid fg-grid-2">
        <Card
          title="A receber · próximos 7 dias"
          description={`${proximas.length} entradas pendentes · ${formatBRL(proximas.reduce((a, e) => a + (e.valorPrevisto - (e.valorRecebido || 0)), 0))}`}
          action={<Button variant="ghost" size="sm" iconRight={<IconArrowRight size={14} />} onClick={() => go("/financeiro/entradas")}>Ver todas</Button>}
          padding={false}
        >
          <MiniTable
            cols={[{ k: "cliente" }, { k: "venc" }, { k: "valor", right: true }, { k: "status" }]}
            rows={proximas.map((e) => ({
              key: e.id,
              cliente: <div className="fg-cell-strong">{e.cliente}<div className="fg-cell-sub">{e.descricao}</div></div>,
              venc: <span className="fg-tabular">{formatDate(e.vencimento, "dayMonth")}</span>,
              valor: <span className="fg-tabular fg-cell-strong">{formatBRL(e.valorPrevisto - (e.valorRecebido || 0))}</span>,
              status: <StatusBadge status={e.status} />,
            }))}
          />
        </Card>

        <Card
          title="A pagar · próximos 7 dias"
          description={`${aPagar.length} saídas pendentes · ${formatBRL(aPagar.reduce((a, s) => a + s.valor, 0))}`}
          action={<Button variant="ghost" size="sm" iconRight={<IconArrowRight size={14} />} onClick={() => go("/financeiro/saidas")}>Ver todas</Button>}
          padding={false}
        >
          <MiniTable
            cols={[{ k: "forn" }, { k: "venc" }, { k: "valor", right: true }, { k: "status" }]}
            rows={aPagar.map((s) => ({
              key: s.id,
              forn: <div className="fg-cell-strong">{s.fornecedor}<div className="fg-cell-sub">{s.descricao}</div></div>,
              venc: <span className="fg-tabular">{formatDate(s.vencimento, "dayMonth")}</span>,
              valor: <span className="fg-tabular fg-cell-strong">{formatBRL(s.valor)}</span>,
              status: <StatusBadge status={s.status} />,
            }))}
          />
        </Card>
      </div>

      <div className="fg-grid fg-grid-2">
        <Card
          title="NFs pendentes"
          description="Composições aguardando emissão pelos PJs."
          action={<Button variant="ghost" size="sm" iconRight={<IconArrowRight size={14} />} onClick={() => go("/nfs")}>Ver todas</Button>}
          padding={false}
        >
          <MiniTable
            cols={[{ k: "pj" }, { k: "comp" }, { k: "valor", right: true }, { k: "status" }]}
            rows={[
              { key: "n1", pj: <div className="fg-cell-strong">Carlos Augusto<div className="fg-cell-sub">FG-00031 · PJ Criação</div></div>, comp: "mai/26", valor: <span className="fg-tabular">{formatBRL(11240)}</span>, status: <StatusBadge status="aguardando_envio" /> },
              { key: "n2", pj: <div className="fg-cell-strong">Diego Penna<div className="fg-cell-sub">FG-00018 · PJ Atendimento</div></div>, comp: "mai/26", valor: <span className="fg-tabular">{formatBRL(14800)}</span>, status: <StatusBadge status="aguardando_envio" /> },
              { key: "n3", pj: <div className="fg-cell-strong">Beatriz Solano<div className="fg-cell-sub">FG-00022 · PJ Mídia</div></div>, comp: "mai/26", valor: <span className="fg-tabular">{formatBRL(9600)}</span>, status: <StatusBadge status="enviada" /> },
              { key: "n4", pj: <div className="fg-cell-strong">Carlos Augusto<div className="fg-cell-sub">FG-00031 · PJ Criação</div></div>, comp: "abr/26", valor: <span className="fg-tabular">{formatBRL(11780)}</span>, status: <StatusBadge status="divergente" /> },
            ]}
          />
        </Card>

        <Card
          title="Reembolsos pendentes"
          description="Aguardando aprovação de gestor ou financeiro."
          action={<Button variant="ghost" size="sm" iconRight={<IconArrowRight size={14} />} onClick={() => go("/reembolsos")}>Ver todos</Button>}
          padding={false}
        >
          <MiniTable
            cols={[{ k: "colab" }, { k: "data" }, { k: "valor", right: true }, { k: "status" }]}
            rows={[
              { key: "r1", colab: <div className="fg-cell-strong">Daniela Marques<div className="fg-cell-sub">Atendimento · Refeição cliente</div></div>, data: "17/05", valor: <span className="fg-tabular">{formatBRL(1245.30)}</span>, status: <StatusBadge status="aguardando_envio" label="Aguardando aprov." /> },
              { key: "r2", colab: <div className="fg-cell-strong">Pedro Lima<div className="fg-cell-sub">Criação · Uber produção</div></div>, data: "18/05", valor: <span className="fg-tabular">{formatBRL(286.40)}</span>, status: <StatusBadge status="enviada" label="Em revisão" /> },
              { key: "r3", colab: <div className="fg-cell-strong">Jéssica Hara<div className="fg-cell-sub">Estratégia · Workshop SP</div></div>, data: "14/05", valor: <span className="fg-tabular">{formatBRL(640.00)}</span>, status: <StatusBadge status="aprovada" label="Aprov. gestor" /> },
              { key: "r4", colab: <div className="fg-cell-strong">Beatriz Solano<div className="fg-cell-sub">Mídia · Material gráfico</div></div>, data: "10/05", valor: <span className="fg-tabular">{formatBRL(412.85)}</span>, status: <StatusBadge status="aprovada" /> },
            ]}
          />
        </Card>
      </div>
    </div>
  );
};

// Mini table for cards
const MiniTable = ({ cols, rows }) => (
  <table className="fg-mini-table">
    <tbody>
      {rows.length === 0 ? (
        <tr><td className="fg-mini-empty">Nada por aqui.</td></tr>
      ) : rows.map((r) => (
        <tr key={r.key}>
          {cols.map((c) => (
            <td key={c.k} className={c.right ? "right" : ""}>{r[c.k]}</td>
          ))}
        </tr>
      ))}
    </tbody>
  </table>
);

Object.assign(window, { Dashboard });

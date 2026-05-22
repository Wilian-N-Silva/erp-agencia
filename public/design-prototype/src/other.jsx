// Placeholders for non-Financeiro modules — navigable but minimal.

const ModulePlaceholder = ({ icon, title, eyebrow, description, statusItems = [] }) => (
  <div className="fg-page">
    <PageHeader eyebrow={eyebrow} title={title} description={description} />
    <Card padding={true}>
      <div className="fg-placeholder">
        <div className="fg-placeholder-icon">{icon}</div>
        <div>
          <div className="fg-placeholder-title">Módulo navegável — não é o foco desta entrega</div>
          <div className="fg-placeholder-sub">
            O foco da rodada é o módulo Financeiro. Os outros módulos seguem o mesmo sistema visual,
            mas o layout final será detalhado em branches separadas conforme §13.2 do brief.
          </div>
          {statusItems.length > 0 && (
            <ul className="fg-placeholder-list">
              {statusItems.map((it, i) => (
                <li key={i}>
                  <span className="fg-placeholder-bullet" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Card>
  </div>
);

const Alertas = () => (
  <div className="fg-page">
    <PageHeader
      eyebrow="Operação"
      title="Central de alertas"
      description={`${window.FG_ALERTAS.length} alertas pendentes — ordenados por severidade.`}
      actions={
        <>
          <Button variant="outline" size="sm" icon={<IconFilter size={14} />}>Severidade</Button>
          <Button variant="outline" size="sm" icon={<IconFilter size={14} />}>Tipo</Button>
        </>
      }
    />
    <div className="fg-alert-feed">
      {window.FG_ALERTAS.map((a) => (
        <div key={a.id} className={`fg-alert-card fg-alert-${a.severidade}`}>
          <div className="fg-alert-card-side"></div>
          <div className="fg-alert-card-icon">
            {a.severidade === "critico" ? <IconAlertCircle size={18} /> : a.severidade === "alto" ? <IconAlertTriangle size={18} /> : <IconClock size={18} />}
          </div>
          <div className="fg-alert-card-body">
            <div className="fg-alert-card-title">{a.titulo}</div>
            <div className="fg-alert-card-sub">{a.subtitulo}</div>
            <div className="fg-alert-card-ctx">{a.contexto}</div>
          </div>
          <div className="fg-alert-card-meta">
            <StatusBadge status={a.severidade} />
            <span className="fg-alert-when">{a.quando}</span>
            <div className="fg-alert-card-actions">
              <Button variant="outline" size="sm">Ver detalhe</Button>
              <Button variant="ghost" size="sm">Marcar resolvido</Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const SimplePage = ({ icon, eyebrow, title }) => (
  <ModulePlaceholder icon={icon} eyebrow={eyebrow} title={title} description="Navegação válida — layout completo nesta rota será entregue em branch separada conforme §13.2 do brief." />
);

Object.assign(window, { Alertas, SimplePage, ModulePlaceholder });

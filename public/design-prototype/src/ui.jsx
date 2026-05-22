// UI primitives — Sistema Interno FG
// Atoms that wrap shadcn-style behaviors with our tokens.

// ────────────────────────────────────────────────────────────────────────────
// Button
// ────────────────────────────────────────────────────────────────────────────
const Button = ({ variant = "primary", size = "default", icon, iconRight, children, className = "", loading, ...rest }) => {
  const sizes = {
    sm: "fg-btn-sm",
    default: "fg-btn-default",
    lg: "fg-btn-lg",
    icon: "fg-btn-icon",
  };
  return (
    <button
      className={`fg-btn fg-btn-${variant} ${sizes[size] || ""} ${className}`}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading ? <span className="fg-spinner" aria-hidden="true" /> : icon}
      {children && <span>{children}</span>}
      {iconRight}
    </button>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// StatusBadge — canonical status map
// ────────────────────────────────────────────────────────────────────────────
const STATUS_MAP = {
  // financeiro
  previsto: { label: "Previsto", tone: "warning" },
  recebido: { label: "Recebido", tone: "success" },
  pago: { label: "Pago", tone: "success" },
  atrasado: { label: "Atrasado", tone: "danger" },
  cancelado: { label: "Cancelado", tone: "muted" },
  parcial: { label: "Parcial", tone: "warning" },
  rascunho: { label: "Rascunho", tone: "muted" },
  aguardando_nf: { label: "Aguardando NF", tone: "brand" },
  // NFs
  aguardando_envio: { label: "Aguardando envio", tone: "brand" },
  enviada: { label: "Enviada", tone: "warning" },
  divergente: { label: "Com divergência", tone: "danger" },
  aguardando_ajuste: { label: "Aguardando ajuste", tone: "brand" },
  aprovada: { label: "Aprovada", tone: "success" },
  recusada: { label: "Recusada", tone: "danger" },
  lancada: { label: "Lançada", tone: "success" },
  // pessoas
  ativo: { label: "Ativo", tone: "success" },
  pausado: { label: "Pausado", tone: "muted" },
  desligado: { label: "Desligado", tone: "muted" },
  // alerts
  critico: { label: "Crítico", tone: "danger" },
  alto: { label: "Alto", tone: "warning" },
  medio: { label: "Médio", tone: "warning-soft" },
  baixo: { label: "Baixo", tone: "muted" },
};

const StatusBadge = ({ status, label, icon, withDot = true }) => {
  const meta = STATUS_MAP[status] || { label: label || status, tone: "muted" };
  const showIcon = icon != null;
  return (
    <span className={`fg-badge fg-badge-${meta.tone}`}>
      {showIcon ? icon : (withDot && <span className="fg-badge-dot" />)}
      <span>{label || meta.label}</span>
    </span>
  );
};

// Tag (neutro, sem cor de fundo) — para categorias livres
const Tag = ({ children, className = "" }) => (
  <span className={`fg-tag ${className}`}>{children}</span>
);

// ────────────────────────────────────────────────────────────────────────────
// KpiCard
// ────────────────────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, secondary, trend, trendLabel, icon, accent = false, mono = true, footnote }) => {
  const trendIsUp = trend != null && trend >= 0;
  return (
    <div className={`fg-kpi ${accent ? "fg-kpi-accent" : ""}`}>
      <div className="fg-kpi-head">
        <span className="fg-kpi-label">{label}</span>
        {icon && <span className="fg-kpi-icon">{icon}</span>}
      </div>
      <div className={`fg-kpi-value ${mono ? "fg-tabular" : ""}`}>{value}</div>
      {(secondary || trend != null) && (
        <div className="fg-kpi-foot">
          {trend != null && (
            <span className={`fg-kpi-trend ${trendIsUp ? "up" : "down"}`}>
              {trendIsUp ? <IconArrowUpRight size={12} stroke={2} /> : <IconArrowDownRight size={12} stroke={2} />}
              <span>{trend > 0 ? "+" : ""}{trend.toFixed(1).replace(".", ",")}%</span>
            </span>
          )}
          {(trendLabel || secondary) && <span className="fg-kpi-sec">{trendLabel || secondary}</span>}
        </div>
      )}
      {footnote && <div className="fg-kpi-foot-note">{footnote}</div>}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Card
// ────────────────────────────────────────────────────────────────────────────
const Card = ({ title, description, action, children, className = "", padding = true, dense = false }) => (
  <div className={`fg-card ${className}`}>
    {(title || action) && (
      <div className={`fg-card-head ${dense ? "dense" : ""}`}>
        <div>
          {title && <div className="fg-card-title">{title}</div>}
          {description && <div className="fg-card-desc">{description}</div>}
        </div>
        {action && <div>{action}</div>}
      </div>
    )}
    <div className={padding ? "fg-card-body" : ""}>{children}</div>
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// EmptyState
// ────────────────────────────────────────────────────────────────────────────
const EmptyState = ({ icon, title, description, action }) => (
  <div className="fg-empty">
    {icon && <div className="fg-empty-icon">{icon}</div>}
    <div className="fg-empty-title">{title}</div>
    {description && <div className="fg-empty-desc">{description}</div>}
    {action && <div style={{ marginTop: 16 }}>{action}</div>}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// Input / Select / Textarea
// ────────────────────────────────────────────────────────────────────────────
const Field = ({ label, required, helper, error, children, htmlFor }) => (
  <div className="fg-field">
    {label && (
      <label className="fg-label" htmlFor={htmlFor}>
        {label}
        {required && <span className="fg-required" aria-label="obrigatório">*</span>}
      </label>
    )}
    {children}
    {error ? (
      <div className="fg-field-error"><IconAlertCircle size={12} /><span>{error}</span></div>
    ) : helper ? (
      <div className="fg-field-helper">{helper}</div>
    ) : null}
  </div>
);

const Input = ({ prefix, suffix, mono, className = "", ...p }) => (
  <div className={`fg-input-wrap ${prefix ? "has-prefix" : ""} ${suffix ? "has-suffix" : ""}`}>
    {prefix && <span className="fg-input-prefix">{prefix}</span>}
    <input className={`fg-input ${mono ? "fg-tabular" : ""} ${className}`} {...p} />
    {suffix && <span className="fg-input-suffix">{suffix}</span>}
  </div>
);

const Textarea = (p) => <textarea className="fg-input fg-textarea" {...p} />;

const Select = ({ value, onChange, options, placeholder = "Selecionar..." }) => (
  <div className="fg-input-wrap">
    <select className="fg-input fg-select" value={value || ""} onChange={(e) => onChange?.(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => {
        const v = typeof o === "string" ? o : o.value;
        const l = typeof o === "string" ? o : o.label;
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
    <span className="fg-select-chevron"><IconChevronDown size={14} /></span>
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// Sheet — sliding right panel
// ────────────────────────────────────────────────────────────────────────────
const Sheet = ({ open, onClose, title, description, children, width = 560, footer }) => {
  React.useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  return (
    <div className={`fg-sheet-root ${open ? "open" : ""}`} aria-hidden={!open}>
      <div className="fg-sheet-scrim" onClick={onClose} />
      <div className="fg-sheet" style={{ width }}>
        <div className="fg-sheet-head">
          <div>
            <div className="fg-sheet-title">{title}</div>
            {description && <div className="fg-sheet-desc">{description}</div>}
          </div>
          <button className="fg-icon-btn" onClick={onClose} aria-label="Fechar"><IconX size={16} /></button>
        </div>
        <div className="fg-sheet-body">{children}</div>
        {footer && <div className="fg-sheet-foot">{footer}</div>}
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Dialog (small, centered)
// ────────────────────────────────────────────────────────────────────────────
const Dialog = ({ open, onClose, title, description, children, footer, width = 440 }) => (
  <div className={`fg-dialog-root ${open ? "open" : ""}`}>
    <div className="fg-dialog-scrim" onClick={onClose} />
    <div className="fg-dialog" style={{ width }}>
      <div className="fg-dialog-head">
        <div className="fg-dialog-title">{title}</div>
        {description && <div className="fg-dialog-desc">{description}</div>}
      </div>
      <div className="fg-dialog-body">{children}</div>
      {footer && <div className="fg-dialog-foot">{footer}</div>}
    </div>
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// Avatar
// ────────────────────────────────────────────────────────────────────────────
const _avatarTones = ["zinc-1", "zinc-2", "zinc-3", "zinc-4", "zinc-5", "zinc-6", "brand"];
const hashName = (s) => { let h = 0; for (const c of s || "") h = ((h << 5) - h + c.charCodeAt(0)) | 0; return Math.abs(h); };
const Avatar = ({ name, size = 32, dimmed = false }) => {
  const tone = _avatarTones[hashName(name) % _avatarTones.length];
  const initials = (name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join("").toUpperCase();
  return (
    <div className={`fg-avatar fg-avatar-${tone} ${dimmed ? "dimmed" : ""}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {initials}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Tabs
// ────────────────────────────────────────────────────────────────────────────
const Tabs = ({ value, onChange, items }) => (
  <div className="fg-tabs" role="tablist">
    {items.map((it) => (
      <button
        key={it.value}
        role="tab"
        aria-selected={value === it.value}
        className={`fg-tab ${value === it.value ? "active" : ""}`}
        onClick={() => onChange?.(it.value)}
      >
        <span>{it.label}</span>
        {it.count != null && <span className="fg-tab-count">{it.count}</span>}
      </button>
    ))}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────
// Toast (simple, top-right)
// ────────────────────────────────────────────────────────────────────────────
const ToastContext = React.createContext(null);
const useToast = () => React.useContext(ToastContext);
const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = React.useState([]);
  const push = React.useCallback((t) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((xs) => [...xs, { id, ...t }]);
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), t.duration ?? 3800);
  }, []);
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="fg-toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`fg-toast fg-toast-${t.tone || "default"}`}>
            <span className="fg-toast-icon">
              {t.tone === "success" ? <IconCheckCircle size={16} /> :
                t.tone === "error" ? <IconAlertCircle size={16} /> :
                  <IconCheck size={16} />}
            </span>
            <div>
              <div className="fg-toast-title">{t.title}</div>
              {t.description && <div className="fg-toast-desc">{t.description}</div>}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Dropdown menu (basic)
// ────────────────────────────────────────────────────────────────────────────
const Dropdown = ({ trigger, items, align = "right" }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  return (
    <div className="fg-dropdown" ref={ref}>
      <span onClick={() => setOpen((v) => !v)}>{trigger}</span>
      {open && (
        <div className={`fg-dropdown-menu fg-dropdown-${align}`}>
          {items.map((it, i) => it.separator ? (
            <div className="fg-dropdown-sep" key={i} />
          ) : (
            <button key={i} className={`fg-dropdown-item ${it.danger ? "danger" : ""}`} onClick={() => { setOpen(false); it.onClick?.(); }}>
              {it.icon && <span>{it.icon}</span>}
              <span>{it.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Logo — placeholder geométrico estilo logoipsum
// ────────────────────────────────────────────────────────────────────────────
const FGLogo = ({ size = 24, wordmark = true, wordmarkText = "Formula" }) => (
  <span className="fg-logo">
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="2" width="20" height="20" rx="5" fill="currentColor" />
      <path d="M2 17 Q 8 11 14 17 T 22 17" stroke="var(--surface-0)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <circle cx="17.5" cy="8" r="2.2" fill="var(--surface-0)" />
    </svg>
    {wordmark && (
      <span className="fg-logo-wordmark">
        <span className="fg-logo-word">{wordmarkText}</span>
        <span className="fg-logo-sub">Sistema Interno</span>
      </span>
    )}
  </span>
);

// ────────────────────────────────────────────────────────────────────────────
// Skeleton
// ────────────────────────────────────────────────────────────────────────────
const Skeleton = ({ w = "100%", h = 16, r = 4, style }) => (
  <div className="fg-skeleton" style={{ width: w, height: h, borderRadius: r, ...style }} />
);

// ────────────────────────────────────────────────────────────────────────────
// Checkbox
// ────────────────────────────────────────────────────────────────────────────
const Checkbox = ({ checked, onChange, indeterminate, label, ...p }) => (
  <label className="fg-checkbox">
    <input
      type="checkbox"
      checked={!!checked}
      onChange={(e) => onChange?.(e.target.checked)}
      ref={(el) => { if (el) el.indeterminate = !!indeterminate; }}
      {...p}
    />
    <span className="fg-checkbox-box">
      {indeterminate ? <span className="fg-checkbox-dash" /> : checked ? <IconCheck size={11} stroke={2.5} /> : null}
    </span>
    {label && <span className="fg-checkbox-label">{label}</span>}
  </label>
);

Object.assign(window, {
  Button, StatusBadge, Tag, STATUS_MAP, KpiCard, Card, EmptyState,
  Field, Input, Textarea, Select, Sheet, Dialog, Avatar, Tabs,
  ToastProvider, useToast, Dropdown, FGLogo, Skeleton, Checkbox,
});

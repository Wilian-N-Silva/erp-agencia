import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
} from "lucide-react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

/* ── Button ─────────────────────────────────────────────────────────── */
export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "destructive";
export type ButtonSize = "sm" | "default" | "lg" | "icon";

type ButtonBase = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "size">;
export interface ButtonProps extends ButtonBase {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
}

export function Button({
  variant = "primary",
  size = "default",
  icon,
  iconRight,
  children,
  className = "",
  loading,
  disabled,
  ...rest
}: ButtonProps) {
  const sizeClass: Record<ButtonSize, string> = {
    sm: "fg-btn-sm",
    default: "fg-btn-default",
    lg: "fg-btn-lg",
    icon: "fg-btn-icon",
  };
  return (
    <button
      className={`fg-btn fg-btn-${variant} ${sizeClass[size]} ${className}`.trim()}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <span className="fg-spinner" aria-hidden /> : icon}
      {children !== undefined && <span>{children}</span>}
      {iconRight}
    </button>
  );
}

/* ── StatusBadge ────────────────────────────────────────────────────── */
type Tone = "success" | "warning" | "warning-soft" | "danger" | "muted" | "brand";

interface StatusEntry {
  label: string;
  tone: Tone;
}

export const STATUS_MAP: Record<string, StatusEntry> = {
  previsto: { label: "Previsto", tone: "warning" },
  recebido: { label: "Recebido", tone: "success" },
  pago: { label: "Pago", tone: "success" },
  atrasado: { label: "Atrasado", tone: "danger" },
  cancelado: { label: "Cancelado", tone: "muted" },
  parcial: { label: "Parcial", tone: "warning" },
  rascunho: { label: "Rascunho", tone: "muted" },
  aguardando_nf: { label: "Aguardando NF", tone: "brand" },
  aguardando_envio: { label: "Aguardando envio", tone: "brand" },
  enviada: { label: "Enviada", tone: "warning" },
  divergente: { label: "Com divergência", tone: "danger" },
  aguardando_ajuste: { label: "Aguardando ajuste", tone: "brand" },
  aprovada: { label: "Aprovada", tone: "success" },
  recusada: { label: "Recusada", tone: "danger" },
  lancada: { label: "Lançada", tone: "success" },
  ativo: { label: "Ativo", tone: "success" },
  pausado: { label: "Pausado", tone: "muted" },
  desligado: { label: "Desligado", tone: "muted" },
  critico: { label: "Crítico", tone: "danger" },
  alto: { label: "Alto", tone: "warning" },
  medio: { label: "Médio", tone: "warning-soft" },
  baixo: { label: "Baixo", tone: "muted" },
};

export interface StatusBadgeProps {
  status?: string;
  label?: string;
  tone?: Tone;
  icon?: ReactNode;
  withDot?: boolean;
}

export function StatusBadge({
  status,
  label,
  tone,
  icon,
  withDot = true,
}: StatusBadgeProps) {
  const meta = status ? STATUS_MAP[status] : undefined;
  const resolvedTone: Tone = tone ?? meta?.tone ?? "muted";
  const resolvedLabel = label ?? meta?.label ?? status ?? "";
  return (
    <span className={`fg-badge fg-badge-${resolvedTone}`}>
      {icon ?? (withDot ? <span className="fg-badge-dot" /> : null)}
      <span>{resolvedLabel}</span>
    </span>
  );
}

/* ── Tag ────────────────────────────────────────────────────────────── */
export function Tag({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={`fg-tag ${className}`.trim()}>{children}</span>;
}

/* ── KpiCard ────────────────────────────────────────────────────────── */
export interface KpiCardProps {
  label: ReactNode;
  value: ReactNode;
  secondary?: ReactNode;
  trend?: number;
  trendLabel?: ReactNode;
  icon?: ReactNode;
  accent?: boolean;
  mono?: boolean;
}

export function KpiCard({
  label,
  value,
  secondary,
  trend,
  trendLabel,
  icon,
  accent = false,
  mono = true,
}: KpiCardProps) {
  const trendIsUp = trend !== undefined && trend >= 0;
  return (
    <div className={`fg-kpi ${accent ? "fg-kpi-accent" : ""}`.trim()}>
      <div className="fg-kpi-head">
        <span className="fg-kpi-label">{label}</span>
        {icon && <span className="fg-kpi-icon">{icon}</span>}
      </div>
      <div className={`fg-kpi-value ${mono ? "fg-tabular" : ""}`.trim()}>{value}</div>
      {(secondary || trend !== undefined) && (
        <div className="fg-kpi-foot">
          {trend !== undefined && (
            <span className={`fg-kpi-trend ${trendIsUp ? "up" : "down"}`}>
              {trendIsUp ? (
                <ArrowUpRight size={12} strokeWidth={2} />
              ) : (
                <ArrowDownRight size={12} strokeWidth={2} />
              )}
              <span>
                {trend > 0 ? "+" : ""}
                {trend.toFixed(1).replace(".", ",")}%
              </span>
            </span>
          )}
          {(trendLabel || secondary) && (
            <span className="fg-kpi-sec">{trendLabel || secondary}</span>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Card ───────────────────────────────────────────────────────────── */
export interface CardProps {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  padding?: boolean;
  dense?: boolean;
}

export function Card({
  title,
  description,
  action,
  children,
  className = "",
  padding = true,
  dense = false,
}: CardProps) {
  return (
    <div className={`fg-card ${className}`.trim()}>
      {(title || action) && (
        <div className={`fg-card-head ${dense ? "dense" : ""}`.trim()}>
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
}

/* ── EmptyState ─────────────────────────────────────────────────────── */
export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="fg-empty">
      {icon && <div className="fg-empty-icon">{icon}</div>}
      <div className="fg-empty-title">{title}</div>
      {description && <div className="fg-empty-desc">{description}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

/* ── Field / Input / Select / Textarea ──────────────────────────────── */
export interface FieldProps {
  label?: ReactNode;
  required?: boolean;
  helper?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}

export function Field({ label, required, helper, error, children, htmlFor }: FieldProps) {
  return (
    <div className="fg-field">
      {label && (
        <label className="fg-label" htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="fg-required" aria-label="obrigatório">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <div className="fg-field-error">
          <AlertCircle size={12} />
          <span>{error}</span>
        </div>
      ) : helper ? (
        <div className="fg-field-helper">{helper}</div>
      ) : null}
    </div>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  prefix?: ReactNode;
  suffix?: ReactNode;
  mono?: boolean;
}

export function Input({ prefix, suffix, mono, className = "", ...p }: InputProps) {
  return (
    <div
      className={`fg-input-wrap ${prefix ? "has-prefix" : ""} ${
        suffix ? "has-suffix" : ""
      }`.trim()}
    >
      {prefix && <span className="fg-input-prefix">{prefix}</span>}
      <input
        className={`fg-input ${mono ? "fg-tabular" : ""} ${className}`.trim()}
        {...p}
      />
      {suffix && <span className="fg-input-suffix">{suffix}</span>}
    </div>
  );
}

export function Textarea({
  className = "",
  ...p
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`fg-input fg-textarea ${className}`.trim()} {...p} />;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  options: Array<SelectOption | string>;
  placeholder?: string;
  onChange?: (value: string) => void;
}

export function Select({
  options,
  placeholder = "Selecionar...",
  value,
  onChange,
  ...rest
}: SelectProps) {
  return (
    <div className="fg-input-wrap">
      <select
        className="fg-input fg-select"
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        {...rest}
      >
        {placeholder !== "" && <option value="">{placeholder}</option>}
        {options.map((o) => {
          const v = typeof o === "string" ? o : o.value;
          const l = typeof o === "string" ? o : o.label;
          return (
            <option key={v} value={v}>
              {l}
            </option>
          );
        })}
      </select>
      <span className="fg-select-chevron">
        <ChevronDown size={14} />
      </span>
    </div>
  );
}

/* ── Tabs (stateless, controlled) ───────────────────────────────────── */
export interface TabItem {
  value: string;
  label: ReactNode;
  count?: number;
}

export interface TabsProps {
  value: string;
  onChange?: (value: string) => void;
  items: TabItem[];
  className?: string;
}

export function Tabs({ value, onChange, items, className = "" }: TabsProps) {
  return (
    <div className={`fg-tabs ${className}`.trim()} role="tablist">
      {items.map((it) => {
        const active = value === it.value;
        return (
          <button
            key={it.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`fg-tab ${active ? "active" : ""}`.trim()}
            onClick={() => onChange?.(it.value)}
          >
            <span>{it.label}</span>
            {it.count !== undefined && <span className="fg-tab-count">{it.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ── Avatar ─────────────────────────────────────────────────────────── */
const AVATAR_TONES = [
  "zinc-1",
  "zinc-2",
  "zinc-3",
  "zinc-4",
  "zinc-5",
  "zinc-6",
  "brand",
] as const;

function hashName(s: string) {
  let h = 0;
  for (const c of s) h = ((h << 5) - h + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export interface AvatarProps {
  name: string;
  size?: number;
  dimmed?: boolean;
}

export function Avatar({ name, size = 32, dimmed = false }: AvatarProps) {
  const tone = AVATAR_TONES[hashName(name) % AVATAR_TONES.length];
  const initials = (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();
  return (
    <div
      className={`fg-avatar fg-avatar-${tone} ${dimmed ? "dimmed" : ""}`.trim()}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </div>
  );
}

/* ── Chips (segmented control) ──────────────────────────────────────── */
export interface ChipItem {
  value: string;
  label: ReactNode;
}

export interface ChipsProps {
  value: string;
  onChange?: (value: string) => void;
  items: ChipItem[];
}

export function Chips({ value, onChange, items }: ChipsProps) {
  return (
    <div className="fg-chips">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          className={`fg-chip ${value === it.value ? "active" : ""}`.trim()}
          onClick={() => onChange?.(it.value)}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

/* ── FGLogo ─────────────────────────────────────────────────────────── */
export interface LogoProps {
  size?: number;
  wordmark?: boolean;
  wordmarkText?: string;
}

export function FGLogo({ size = 24, wordmark = true, wordmarkText = "Formula" }: LogoProps) {
  return (
    <span className="fg-logo">
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="2" y="2" width="20" height="20" rx="5" fill="currentColor" />
        <path
          d="M2 17 Q 8 11 14 17 T 22 17"
          stroke="var(--surface-0)"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
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
}

/* ── Skeleton ───────────────────────────────────────────────────────── */
export function Skeleton({
  w = "100%",
  h = 16,
  r = 4,
  style,
}: {
  w?: number | string;
  h?: number | string;
  r?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="fg-skeleton"
      style={{ width: w, height: h, borderRadius: r, ...style }}
    />
  );
}

/* ── Checkbox ───────────────────────────────────────────────────────── */
export interface CheckboxProps {
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}

export function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
  disabled,
}: CheckboxProps) {
  return (
    <label className="fg-checkbox">
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        ref={(el) => {
          if (el) el.indeterminate = !!indeterminate;
        }}
      />
      <span className="fg-checkbox-box">
        {indeterminate ? (
          <span className="fg-checkbox-dash" />
        ) : checked ? (
          <Check size={11} strokeWidth={2.5} />
        ) : null}
      </span>
      {label && <span className="fg-checkbox-label">{label}</span>}
    </label>
  );
}

/* ── Inline alert ───────────────────────────────────────────────────── */
export interface InlineAlertProps {
  tone?: "default" | "danger" | "warning";
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
}

export function InlineAlert({
  tone = "default",
  title,
  description,
  icon,
  children,
}: InlineAlertProps) {
  return (
    <div className={`fg-inline-alert ${tone}`}>
      {icon && <div>{icon}</div>}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title && <div className="fg-inline-alert-title">{title}</div>}
        {description && <div className="fg-inline-alert-desc">{description}</div>}
        {children}
      </div>
    </div>
  );
}

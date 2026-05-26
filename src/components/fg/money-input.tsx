"use client";

import { useMemo, useState } from "react";

export interface MoneyInputProps {
  name?: string;
  defaultValue?: string | number | null;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  id?: string;
  className?: string;
  ariaLabel?: string;
  /** If true, allow values down to 0,01. If false (default), zero is allowed as empty. */
  minimumCents?: number;
}

/**
 * Brazilian Real money input.
 *
 * UX: digits-only entry; formats live as `R$ 1.234,56`.
 * Submission: a hidden input emits the canonical decimal string ("1234.56")
 * consumed by server-side `normalizeMoneyInput`. Empty when no value is set so
 * `optionalMoneySchema()` correctly receives `null`.
 */
export function MoneyInput({
  name,
  defaultValue,
  required = false,
  disabled = false,
  readOnly = false,
  placeholder = "0,00",
  id,
  className = "",
  ariaLabel,
  minimumCents,
}: MoneyInputProps) {
  const initialCents = useMemo(() => parseInitialCents(defaultValue), [defaultValue]);
  const [cents, setCents] = useState<number>(initialCents);

  const display = cents > 0 ? formatBRL(cents) : "";
  const submitValue = cents > 0 ? centsToCanonical(cents) : "";
  const invalid = required && cents <= 0;
  const belowMin =
    typeof minimumCents === "number" && cents > 0 && cents < minimumCents;

  return (
    <div className={`fg-input-wrap has-prefix ${className}`.trim()}>
      <span className="fg-input-prefix" aria-hidden="true">
        R$
      </span>
      <input
        id={id}
        className="fg-input fg-tabular"
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={display}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
        aria-label={ariaLabel}
        aria-invalid={invalid || belowMin ? true : undefined}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "").slice(0, 14);
          setCents(digits ? Number(digits) : 0);
        }}
        onKeyDown={(event) => {
          if (event.key === "Backspace" && cents === 0) {
            event.preventDefault();
          }
        }}
      />
      <input type="hidden" name={name} value={submitValue} />
    </div>
  );
}

function parseInitialCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.round(value * 100));
  }

  const trimmed = value.trim().replace(/\s/g, "");
  if (!trimmed) return 0;

  const normalized = trimmed.replace(",", ".");
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;

  return Math.round(numeric * 100);
}

function centsToCanonical(cents: number): string {
  const units = Math.floor(cents / 100);
  const remainder = String(cents % 100).padStart(2, "0");
  return `${units}.${remainder}`;
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

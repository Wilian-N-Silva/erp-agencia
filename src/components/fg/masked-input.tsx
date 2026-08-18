"use client";

import { useMemo, useState } from "react";

type MaskKind = "cpf" | "phone";

export interface MaskedInputProps {
  name: string;
  mask: MaskKind;
  defaultValue?: string | null;
  required?: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
  autoComplete?: string;
}

export function MaskedInput({
  name,
  mask,
  defaultValue,
  required = false,
  disabled = false,
  readOnly = false,
  id,
  className = "fg-input",
  placeholder,
  autoComplete,
}: MaskedInputProps) {
  const initialValue = useMemo(
    () => formatMaskedValue(mask, defaultValue ?? ""),
    [defaultValue, mask],
  );
  const [value, setValue] = useState(initialValue);

  return (
    <input
      id={id}
      autoComplete={autoComplete}
      className={className}
      disabled={disabled}
      inputMode="numeric"
      maxLength={mask === "cpf" ? 14 : 15}
      name={name}
      placeholder={placeholder ?? (mask === "cpf" ? "000.000.000-00" : "(00) 00000-0000")}
      readOnly={readOnly}
      required={required}
      type="text"
      value={value}
      onChange={(event) => {
        setValue(formatMaskedValue(mask, event.target.value));
      }}
    />
  );
}

export function formatMaskedValue(mask: MaskKind, value: string) {
  const digits = value.replace(/\D/g, "");

  if (mask === "cpf") {
    return formatCpf(digits);
  }

  return formatPhone(digits);
}

function formatCpf(digits: string) {
  const value = digits.slice(0, 11);
  const part1 = value.slice(0, 3);
  const part2 = value.slice(3, 6);
  const part3 = value.slice(6, 9);
  const part4 = value.slice(9, 11);

  return [part1, part2, part3]
    .filter(Boolean)
    .join(".")
    .concat(part4 ? `-${part4}` : "");
}

function formatPhone(digits: string) {
  const value = digits.slice(0, 11);
  const area = value.slice(0, 2);
  const first = value.length > 10 ? value.slice(2, 7) : value.slice(2, 6);
  const second = value.length > 10 ? value.slice(7, 11) : value.slice(6, 10);

  if (!area) {
    return "";
  }

  if (!first) {
    return `(${area}`;
  }

  return `(${area}) ${first}${second ? `-${second}` : ""}`;
}

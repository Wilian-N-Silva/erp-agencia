#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

if command -v pwsh >/dev/null 2>&1; then
  CODEX_PS_KIND="pwsh"
  CODEX_POWERSHELL=(pwsh -NoProfile)
elif command -v powershell.exe >/dev/null 2>&1; then
  CODEX_PS_KIND="windows"
  CODEX_POWERSHELL=(powershell.exe -NoProfile -ExecutionPolicy Bypass)
elif command -v powershell >/dev/null 2>&1; then
  CODEX_PS_KIND="powershell"
  CODEX_POWERSHELL=(powershell -NoProfile -ExecutionPolicy Bypass)
else
  echo "Erro: PowerShell não encontrado. Instale PowerShell 7 (pwsh) ou use um Windows com powershell.exe disponível." >&2
  exit 127
fi

run_ps1() {
  local script_name="$1"
  shift
  local script_path="$SCRIPT_DIR/$script_name"

  # Git Bash/MSYS funciona melhor com caminho Windows explícito ao chamar powershell.exe.
  if [[ "$CODEX_PS_KIND" == "windows" ]] && command -v cygpath >/dev/null 2>&1; then
    script_path="$(cygpath -w "$script_path")"
  fi

  exec "${CODEX_POWERSHELL[@]}" -File "$script_path" "$@"
}

#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=codex-shell-common.sh
source "$SCRIPT_DIR/codex-shell-common.sh"
run_ps1 "codex-status.ps1" "$@"
